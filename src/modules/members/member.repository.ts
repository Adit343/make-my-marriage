import "server-only";
import type { ClientSession, Types } from "mongoose";
import { connectDb } from "@/infrastructure/database/connection";
import type { MemberRelationship, MemberRole } from "@/lib/constants/enums";
import { WeddingMember } from "@/models/weddingMember.model";

type Id = Types.ObjectId | string;

/** deletionReason on memberships ended by deleting the wedding; restore looks for it. */
export const WEDDING_DELETED_REASON = "wedding_deleted";

/**
 * The one lookup that is by user rather than by wedding: it is how a request finds out WHICH
 * wedding the user belongs to (DB Design §8.3), served by the partial unique userId index.
 */
export async function findActiveMembershipByUser(userId: Id) {
  await connectDb();
  return WeddingMember.findOne({ userId }).lean();
}

/** A wedding's current team, oldest first (soft-deleted members are excluded by the plugin). */
export async function listMembers(weddingId: Id) {
  await connectDb();
  return WeddingMember.find({ weddingId }).sort({ joinedAt: 1 }).lean();
}

export async function createOwnerMembership(
  input: { weddingId: Id; userId: Id; relationship?: MemberRelationship },
  session: ClientSession,
) {
  const [membership] = await WeddingMember.create(
    [
      {
        weddingId: input.weddingId,
        userId: input.userId,
        role: "owner",
        relationship: input.relationship,
        joinedAt: new Date(),
      },
    ],
    { session },
  );
  return membership!.toObject();
}

// Every function below is scoped by weddingId (DB Design §9.2). Soft-deleted members are hidden
// by the plugin; the restore helpers filter on `deletedAt` themselves, which switches it off.

export async function countActiveMembers(weddingId: Id): Promise<number> {
  await connectDb();
  return WeddingMember.countDocuments({ weddingId });
}

/** One page of the team, oldest first — a small admin list, so page-number pagination. */
export async function listMembersPage(weddingId: Id, page: { skip: number; limit: number }) {
  await connectDb();
  const [rows, totalCount] = await Promise.all([
    WeddingMember.find({ weddingId })
      .sort({ joinedAt: 1, _id: 1 })
      .skip(page.skip)
      .limit(page.limit)
      .lean(),
    WeddingMember.countDocuments({ weddingId }),
  ]);
  return { rows, totalCount };
}

export async function findMember(weddingId: Id, memberId: Id) {
  await connectDb();
  return WeddingMember.findOne({ _id: memberId, weddingId }).lean();
}

/** The owner's own role can never change here: ownership only moves by transfer. */
export async function updateMember(
  weddingId: Id,
  memberId: Id,
  changes: { role?: MemberRole; relationship?: MemberRelationship },
) {
  await connectDb();
  return WeddingMember.findOneAndUpdate(
    { _id: memberId, weddingId, role: { $ne: "owner" } },
    { $set: changes },
    { returnDocument: "after" },
  ).lean();
}

/** Soft delete: access ends and the user's one-wedding slot is freed (DB Design §6.5 rule 1). */
export async function softDeleteMember(
  weddingId: Id,
  memberId: Id,
  deletion: { by: Id; reason: string },
  session?: ClientSession,
): Promise<boolean> {
  await connectDb();
  const result = await WeddingMember.updateOne(
    { _id: memberId, weddingId, role: { $ne: "owner" } },
    { $set: { deletedAt: new Date(), deletedBy: deletion.by, deletionReason: deletion.reason } },
    { session },
  );
  return result.modifiedCount === 1;
}

/** Wedding deletion and an owner's account deletion end every membership of the wedding. */
export async function softDeleteAllMembers(
  weddingId: Id,
  deletion: { by: Id; reason: string; at: Date },
  session: ClientSession,
) {
  await connectDb();
  await WeddingMember.updateMany(
    { weddingId },
    { $set: { deletedAt: deletion.at, deletedBy: deletion.by, deletionReason: deletion.reason } },
    { session },
  );
}

/** Step 1 of an ownership transfer: demote first so the one-owner index never sees two owners. */
export async function demoteOwnerToAdmin(weddingId: Id, memberId: Id, session: ClientSession) {
  await connectDb();
  const result = await WeddingMember.updateOne(
    { _id: memberId, weddingId, role: "owner" },
    { $set: { role: "admin" } },
    { session },
  );
  return result.modifiedCount === 1;
}

/** Step 2 of an ownership transfer. */
export async function promoteToOwner(weddingId: Id, memberId: Id, session: ClientSession) {
  await connectDb();
  const result = await WeddingMember.updateOne(
    { _id: memberId, weddingId, role: { $ne: "owner" }, status: "active" },
    { $set: { role: "owner" } },
    { session },
  );
  return result.modifiedCount === 1;
}

export async function findMembersByIds(weddingId: Id, memberIds: Id[]) {
  await connectDb();
  return WeddingMember.find({ weddingId, _id: { $in: memberIds } }).lean();
}

/** The caller's soft-deleted owner row — how a former owner proves they may restore (API §6.4). */
export async function findDeletedOwnerMembership(weddingId: Id, userId: Id) {
  await connectDb();
  return WeddingMember.findOne({
    weddingId,
    userId,
    role: "owner",
    deletedAt: { $type: "date" },
  }).lean();
}

/** Members removed by the wedding deletion itself (not earlier leavers), for restore. */
export async function listMembersDeletedWithWedding(
  weddingId: Id,
  deletedAt: Date,
  session: ClientSession,
) {
  await connectDb();
  return WeddingMember.find({ weddingId, deletedAt, deletionReason: WEDDING_DELETED_REASON })
    .session(session)
    .lean();
}

export async function restoreMembers(weddingId: Id, memberIds: Id[], session: ClientSession) {
  await connectDb();
  await WeddingMember.updateMany(
    { weddingId, _id: { $in: memberIds }, deletedAt: { $type: "date" } },
    { $set: { deletedAt: null, deletedBy: null, deletionReason: null } },
    { session },
  );
}

/**
 * Which of these users already belong to a wedding, so they are not restored into this one. By
 * user rather than by wedding, like findActiveMembershipByUser: it asks about OTHER weddings.
 */
export async function findUsersWithActiveMembership(userIds: Id[], session: ClientSession) {
  await connectDb();
  const rows = await WeddingMember.find({ userId: { $in: userIds } })
    .select({ userId: 1 })
    .session(session)
    .lean();
  return new Set(rows.map((row) => row.userId.toString()));
}
