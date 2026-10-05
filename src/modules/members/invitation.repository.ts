import "server-only";
import type { ClientSession, Types } from "mongoose";
import { connectDb } from "@/infrastructure/database/connection";
import type { InvitationRole, InvitationStatus, MemberRelationship } from "@/lib/constants/enums";
import { WeddingInvitation } from "@/models/weddingInvitation.model";

type Id = Types.ObjectId | string;

// Member invitations (DB Design §6.6). Hash-only tokens; "expired" is never stored. Rows are
// hard-deleted by the purgeAt TTL index, so there is no soft delete here. Everything is scoped by
// weddingId except the two token lookups, which are how a person holding a link finds its wedding.

export async function insertInvitation(input: {
  weddingId: Id;
  invitedBy: Id;
  email: string;
  role: InvitationRole;
  relationship?: MemberRelationship;
  message?: string;
  tokenHash: string;
  expiresAt: Date;
  purgeAt: Date;
}) {
  await connectDb();
  const invitation = await WeddingInvitation.create(input);
  return invitation.toObject();
}

export async function findPendingInvitationForEmail(weddingId: Id, emailNormalized: string) {
  await connectDb();
  return WeddingInvitation.findOne({ weddingId, emailNormalized, status: "pending" }).lean();
}

export async function findInvitation(weddingId: Id, invitationId: Id) {
  await connectDb();
  return WeddingInvitation.findOne({ _id: invitationId, weddingId }).lean();
}

export async function listInvitationsPage(
  weddingId: Id,
  filter: { status?: InvitationStatus },
  page: { skip: number; limit: number },
) {
  await connectDb();
  const where = { weddingId, ...(filter.status ? { status: filter.status } : {}) };
  const [rows, totalCount] = await Promise.all([
    WeddingInvitation.find(where)
      .sort({ createdAt: -1, _id: -1 })
      .skip(page.skip)
      .limit(page.limit)
      .lean(),
    WeddingInvitation.countDocuments(where),
  ]);
  return { rows, totalCount };
}

/** Pending only: an accepted or already revoked invitation can't be revoked again. */
export async function revokeInvitation(
  weddingId: Id,
  invitationId: Id,
  revocation: { by: Id; purgeAt: Date },
  session?: ClientSession,
) {
  await connectDb();
  return WeddingInvitation.findOneAndUpdate(
    { _id: invitationId, weddingId, status: "pending" },
    {
      $set: {
        status: "revoked",
        revokedAt: new Date(),
        revokedBy: revocation.by,
        purgeAt: revocation.purgeAt,
      },
    },
    { returnDocument: "after", session },
  ).lean();
}

/**
 * Resend = a new token with a fresh expiry (the old link dies at once). The plaintext token is
 * never stored, so the original link can't simply be re-sent.
 */
export async function rotateInvitationToken(
  weddingId: Id,
  invitationId: Id,
  change: { tokenHash: string; expiresAt: Date; purgeAt: Date },
) {
  await connectDb();
  return WeddingInvitation.findOneAndUpdate(
    { _id: invitationId, weddingId, status: "pending" },
    { $set: change },
    { returnDocument: "after" },
  ).lean();
}

/** The link-holder's lookup: by token hash, not by wedding (it is how the wedding is found). */
export async function findInvitationByTokenHash(tokenHash: string) {
  await connectDb();
  return WeddingInvitation.findOne({ tokenHash }).lean();
}

/**
 * Atomically claims a usable invitation (pending and unexpired), so two clicks can't both accept
 * it. Inside the accept transaction: if creating the membership then fails, the claim rolls back.
 */
export async function claimInvitation(
  tokenHash: string,
  acceptance: { by: Id; purgeAt: Date },
  session: ClientSession,
) {
  await connectDb();
  const now = new Date();
  return WeddingInvitation.findOneAndUpdate(
    { tokenHash, status: "pending", expiresAt: { $gt: now } },
    {
      $set: {
        status: "accepted",
        acceptedAt: now,
        acceptedBy: acceptance.by,
        purgeAt: acceptance.purgeAt,
      },
    },
    { returnDocument: "after", session },
  ).lean();
}
