import "server-only";
import type { Types } from "mongoose";
import { withTransaction } from "@/infrastructure/database/transaction";
import { INVITATION_PURGE_AFTER_DAYS, MEMBER_INVITATION_TTL_DAYS } from "@/lib/constants/retention";
import type { InvitationRole, InvitationStatus } from "@/lib/constants/enums";
import { generateToken, hashToken } from "@/lib/crypto/tokens";
import { getEnv } from "@/lib/env";
import { AppError, isDuplicateKeyError } from "@/lib/errors";
import type { NumberedPageMeta } from "@/lib/http/pagination";
import { normalizeEmail } from "@/lib/text/normalize";
import { enforceRateLimit, RATE_LIMITS } from "@/modules/auth/rate-limit";
import type { AuthContext } from "@/modules/auth/session.service";
import type { WeddingAuth } from "@/modules/members/guards";
import {
  invitationState,
  toInvitationDto,
  type InvitationDto,
} from "@/modules/members/invitation.dto";
import {
  claimInvitation,
  findInvitation,
  findInvitationByTokenHash,
  findPendingInvitationForEmail,
  insertInvitation,
  listInvitationsPage,
  revokeInvitation,
  rotateInvitationToken,
} from "@/modules/members/invitation.repository";
import type { CreateInvitationInput } from "@/modules/members/invitation.schemas";
import { createMembership, findActiveMembershipByUser } from "@/modules/members/member.repository";
import { sendEmail } from "@/modules/notifications/email.service";
import { memberInvitationEmail } from "@/modules/notifications/templates";
import { findUserByEmail, findUserSummaries } from "@/modules/users/user.repository";
import { findWedding } from "@/modules/weddings/wedding.repository";

// Member invitations (API Design §6.9–§6.11, DB Design §6.6, Architecture §15). The token itself
// authorizes the join: no email-match requirement, no email verification. Mitigations are
// single use, expiry and revocation.

const DAY_MS = 24 * 60 * 60 * 1000;

function purgeAtFor(from: Date) {
  return new Date(from.getTime() + INVITATION_PURGE_AFTER_DAYS * DAY_MS);
}

function inviteUrlFor(token: string) {
  return new URL(`/join/${token}`, getEnv().APP_URL).toString();
}

/** Emails the link. A delivery failure never undoes the invitation (Architecture §49). */
async function emailInvitation(
  auth: WeddingAuth,
  invitation: {
    _id: Types.ObjectId;
    email: string;
    role: InvitationRole;
    message?: string | null;
  },
  token: string,
) {
  const wedding = await findWedding(auth.weddingId);
  const { status } = await sendEmail({
    type: "member_invitation",
    weddingId: auth.weddingId,
    invitationId: invitation._id,
    to: invitation.email,
    ...memberInvitationEmail({
      inviterName: auth.user.name,
      weddingTitle: wedding?.title ?? "a wedding",
      role: invitation.role,
      message: invitation.message,
      inviteUrl: inviteUrlFor(token),
      validDays: MEMBER_INVITATION_TTL_DAYS,
    }),
  });
  return status;
}

export async function listInvitations(
  auth: WeddingAuth,
  query: { page: number; pageSize: number; status?: InvitationStatus },
): Promise<{ items: InvitationDto[]; meta: NumberedPageMeta }> {
  const { rows, totalCount } = await listInvitationsPage(
    auth.weddingId,
    { status: query.status },
    { skip: (query.page - 1) * query.pageSize, limit: query.pageSize },
  );
  return {
    items: rows.map(toInvitationDto),
    meta: { page: query.page, pageSize: query.pageSize, totalCount },
  };
}

export async function createInvitation(auth: WeddingAuth, input: CreateInvitationInput) {
  await enforceRateLimit(`member-invite:${auth.weddingId}`, RATE_LIMITS.memberInvite);
  const emailNormalized = normalizeEmail(input.email);

  // Already on the team? (Someone in a DIFFERENT wedding isn't checked here: that would tell
  // admins which emails have accounts. It is rejected when they try to accept.)
  const existingUser = await findUserByEmail(input.email);
  if (existingUser) {
    const theirs = await findActiveMembershipByUser(existingUser._id);
    if (theirs?.weddingId.toString() === auth.weddingId) {
      throw new AppError("CONFLICT", { message: "This person is already on your team." });
    }
  }

  const now = new Date();
  const pending = await findPendingInvitationForEmail(auth.weddingId, emailNormalized);
  if (pending) {
    if (pending.expiresAt.getTime() > now.getTime()) {
      throw new AppError("CONFLICT", {
        message: "An invitation to this email is already pending. Resend it instead.",
        details: { invitationId: pending._id.toString() },
      });
    }
    // A stale pending row would block the unique index, so retire it first (DB Design §6.6 rule 3).
    await revokeInvitation(auth.weddingId, pending._id, {
      by: auth.userId,
      purgeAt: purgeAtFor(now),
    });
  }

  const token = generateToken();
  const expiresAt = new Date(now.getTime() + MEMBER_INVITATION_TTL_DAYS * DAY_MS);
  let invitation;
  try {
    invitation = await insertInvitation({
      weddingId: auth.weddingId,
      invitedBy: auth.userId,
      email: input.email,
      role: input.role,
      relationship: input.relationship,
      message: input.message || undefined,
      tokenHash: hashToken(token),
      expiresAt,
      purgeAt: purgeAtFor(expiresAt),
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) throw new AppError("CONFLICT");
    throw error;
  }

  const emailStatus = await emailInvitation(auth, invitation, token);
  // The link is returned once so the inviter can copy it, e.g. if the email fails.
  return { invitation: toInvitationDto(invitation), inviteLink: inviteUrlFor(token), emailStatus };
}

/** New link, fresh expiry, email again. The previous link stops working immediately. */
export async function resendInvitation(auth: WeddingAuth, invitationId: string) {
  await enforceRateLimit(`member-invite:${auth.weddingId}`, RATE_LIMITS.memberInvite);
  const existing = await findInvitation(auth.weddingId, invitationId);
  if (!existing) throw new AppError("NOT_FOUND");
  if (existing.status !== "pending") {
    throw new AppError("CONFLICT", { message: "Only a pending invitation can be resent." });
  }

  const token = generateToken();
  const expiresAt = new Date(Date.now() + MEMBER_INVITATION_TTL_DAYS * DAY_MS);
  const rotated = await rotateInvitationToken(auth.weddingId, invitationId, {
    tokenHash: hashToken(token),
    expiresAt,
    purgeAt: purgeAtFor(expiresAt),
  });
  if (!rotated) throw new AppError("CONFLICT");

  const emailStatus = await emailInvitation(auth, rotated, token);
  return { invitation: toInvitationDto(rotated), inviteLink: inviteUrlFor(token), emailStatus };
}

export async function revokeInvitationFor(auth: WeddingAuth, invitationId: string) {
  const existing = await findInvitation(auth.weddingId, invitationId);
  if (!existing) throw new AppError("NOT_FOUND");
  if (existing.status !== "pending") {
    throw new AppError("CONFLICT", { message: "Only a pending invitation can be revoked." });
  }
  const revoked = await revokeInvitation(auth.weddingId, invitationId, {
    by: auth.userId,
    purgeAt: purgeAtFor(new Date()),
  });
  if (!revoked) throw new AppError("CONFLICT");
  return toInvitationDto(revoked);
}

export type InvitationPreview =
  | { valid: false }
  | {
      valid: true;
      weddingTitle: string;
      inviterName: string;
      role: InvitationRole;
      expiresAt: string;
    };

/**
 * Landing-page data before signup (API Design §6.9). Anything wrong with the link — unknown,
 * expired, used, revoked, wedding deleted — is the same quiet `{ valid: false }`.
 */
export async function previewInvitation(token: string): Promise<InvitationPreview> {
  const invitation = await findInvitationByTokenHash(hashToken(token));
  if (!invitation || invitationState(invitation) !== "pending") return { valid: false };
  const wedding = await findWedding(invitation.weddingId);
  if (!wedding) return { valid: false };
  const [inviter] = await findUserSummaries([invitation.invitedBy]);
  return {
    valid: true,
    weddingTitle: wedding.title,
    inviterName: inviter?.name ?? "A family member",
    role: invitation.role,
    expiresAt: invitation.expiresAt.toISOString(),
  };
}

/**
 * Claim the invitation and create the membership in one transaction (DB Design §6.6 rule 2). If
 * the person already belongs to a wedding the membership insert fails, the claim rolls back, and
 * the invitation stays pending (not burned by a failed attempt).
 */
export async function acceptInvitation(auth: AuthContext, token: string) {
  await enforceRateLimit(`invitation-accept:${auth.userId}`, RATE_LIMITS.invitationAccept);
  if (await findActiveMembershipByUser(auth.userId)) throw new AppError("ALREADY_IN_WEDDING");

  const tokenHash = hashToken(token);
  try {
    return await withTransaction(async (session) => {
      const claimed = await claimInvitation(
        tokenHash,
        { by: auth.userId, purgeAt: purgeAtFor(new Date()) },
        session,
      );
      if (!claimed) throw new AppError("INVALID_TOKEN");

      const wedding = await findWedding(claimed.weddingId);
      if (!wedding) throw new AppError("INVALID_TOKEN");

      const membership = await createMembership(
        {
          weddingId: claimed.weddingId,
          userId: auth.userId,
          role: claimed.role,
          relationship: claimed.relationship ?? undefined,
          invitedBy: claimed.invitedBy,
        },
        session,
      );
      return {
        membership: { id: membership._id.toString(), role: membership.role },
        wedding: { id: wedding._id.toString(), title: wedding.title },
      };
    });
  } catch (error) {
    if (isDuplicateKeyError(error, "userId")) throw new AppError("ALREADY_IN_WEDDING");
    throw error;
  }
}
