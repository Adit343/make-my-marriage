import "server-only";
import { withTransaction } from "@/infrastructure/database/transaction";
import type { ClientSession, Types } from "mongoose";
import { WEDDING_PURGE_GRACE_DAYS } from "@/lib/constants/retention";
import { AppError, isDuplicateKeyError } from "@/lib/errors";
import type { AuthContext } from "@/modules/auth/session.service";
import type { WeddingAuth } from "@/modules/members/guards";
import {
  createOwnerMembership,
  findActiveMembershipByUser,
  findDeletedOwnerMembership,
  findUsersWithActiveMembership,
  listMembersDeletedWithWedding,
  restoreMembers,
  softDeleteAllMembers,
  WEDDING_DELETED_REASON,
} from "@/modules/members/member.repository";
import { toWeddingDto } from "@/modules/weddings/wedding.dto";
import {
  findDeletedWedding,
  findWedding,
  insertWedding,
  restoreWedding as restoreWeddingRow,
  softDeleteWedding,
  updateWedding as updateWeddingRow,
} from "@/modules/weddings/wedding.repository";
import type { CreateWeddingInput, UpdateWeddingInput } from "@/modules/weddings/wedding.schemas";

type Id = Types.ObjectId | string;

/** The signed-in user's wedding and role, or null if they haven't created or joined one. */
export async function getMyWedding(auth: AuthContext) {
  const membership = await findActiveMembershipByUser(auth.userId);
  if (!membership) return null;
  const wedding = await findWedding(membership.weddingId);
  if (!wedding) return null;
  return { wedding: toWeddingDto(wedding), role: membership.role };
}

/**
 * Creates a wedding and its owner membership together (DB Design §9.3): never one without the
 * other. "One user = one wedding" is checked up front for a friendly error and enforced by the
 * weddingMembers.userId unique index, which catches the race between two simultaneous requests.
 */
export async function createWedding(auth: AuthContext, input: CreateWeddingInput) {
  if (await findActiveMembershipByUser(auth.userId)) {
    throw new AppError("ALREADY_IN_WEDDING");
  }

  const { relationship, ...weddingFields } = input;
  try {
    return await withTransaction(async (session) => {
      const wedding = await insertWedding({ ...weddingFields, createdBy: auth.userId }, session);
      const membership = await createOwnerMembership(
        { weddingId: wedding._id, userId: auth.userId, relationship },
        session,
      );
      return {
        wedding: toWeddingDto(wedding),
        membership: { id: membership._id.toString(), role: membership.role },
      };
    });
  } catch (error) {
    if (isDuplicateKeyError(error, "userId")) throw new AppError("ALREADY_IN_WEDDING");
    throw error;
  }
}

export async function getWeddingFor(auth: WeddingAuth) {
  const wedding = await findWedding(auth.weddingId);
  if (!wedding) throw new AppError("NOT_FOUND");
  return { wedding: toWeddingDto(wedding), membership: auth.membership };
}

export async function updateWeddingDetails(auth: WeddingAuth, input: UpdateWeddingInput) {
  const { version, ...changes } = input;
  const result = await updateWeddingRow(auth.weddingId, version, changes);
  if (result === "conflict") throw new AppError("VERSION_CONFLICT");
  if (result === "not_found") throw new AppError("NOT_FOUND");
  return toWeddingDto(result);
}

/**
 * The write half of DB Design §10.3 step 1: hide the wedding (grace period, then purgeable) and end
 * every membership so each person's one-wedding slot is free. Children (guests, expenses…) are not
 * touched: every request path is gated on the wedding being live, so they become unreachable at
 * once. Runs inside the caller's transaction (also used by account deletion).
 */
export async function softDeleteWeddingAndMembers(
  weddingId: Id,
  deletedBy: Id,
  session: ClientSession,
) {
  const at = new Date();
  const purgeAfter = new Date(at.getTime() + WEDDING_PURGE_GRACE_DAYS * 24 * 60 * 60 * 1000);
  if (!(await softDeleteWedding(weddingId, { by: deletedBy, at, purgeAfter }, session))) {
    throw new AppError("NOT_FOUND");
  }
  await softDeleteAllMembers(
    weddingId,
    { by: deletedBy, at, reason: WEDDING_DELETED_REASON },
    session,
  );
  return {
    id: weddingId.toString(),
    deletedAt: at.toISOString(),
    purgeAfter: purgeAfter.toISOString(),
  };
}

/** API Design §6.3. The caller must retype the title; recoverable for 30 days. */
export async function deleteWedding(auth: WeddingAuth, confirm: string) {
  const wedding = await findWedding(auth.weddingId);
  if (!wedding) throw new AppError("NOT_FOUND");
  if (confirm.trim() !== wedding.title) {
    throw new AppError("VALIDATION_ERROR", {
      details: [
        {
          location: "body",
          path: "confirm",
          message: "Type the wedding's title exactly to confirm",
        },
      ],
    });
  }
  return withTransaction((session) =>
    softDeleteWeddingAndMembers(auth.weddingId, auth.userId, session),
  );
}

/**
 * API Design §6.4 / DB Design §10.3 step 3. Only the former owner, only inside the grace period.
 * Brings back the owner and the other members who were removed by the deletion — except anyone who
 * has since joined a different wedding (their one-wedding slot is taken).
 */
export async function restoreWedding(auth: AuthContext, weddingId: string) {
  const wedding = await findDeletedWedding(weddingId);
  const inGracePeriod = wedding?.purgeAfter && wedding.purgeAfter.getTime() > Date.now();
  if (!wedding || !wedding.deletedAt || !inGracePeriod) throw new AppError("NOT_FOUND");
  const formerOwner = await findDeletedOwnerMembership(weddingId, auth.userId);
  if (!formerOwner) throw new AppError("NOT_FOUND");
  if (await findActiveMembershipByUser(auth.userId)) throw new AppError("ALREADY_IN_WEDDING");

  const deletedAt = wedding.deletedAt;
  let restoredMemberCount = 0;
  try {
    await withTransaction(async (session) => {
      if (!(await restoreWeddingRow(weddingId, session))) throw new AppError("NOT_FOUND");
      const candidates = await listMembersDeletedWithWedding(weddingId, deletedAt, session);
      const taken = await findUsersWithActiveMembership(
        candidates.map((member) => member.userId),
        session,
      );
      const restorable = candidates.filter((member) => !taken.has(member.userId.toString()));
      if (!restorable.some((member) => member._id.equals(formerOwner._id))) {
        throw new AppError("ALREADY_IN_WEDDING");
      }
      await restoreMembers(
        weddingId,
        restorable.map((member) => member._id),
        session,
      );
      restoredMemberCount = restorable.length;
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) throw new AppError("ALREADY_IN_WEDDING");
    throw error;
  }

  const restored = await findWedding(weddingId);
  if (!restored) throw new AppError("NOT_FOUND");
  return {
    wedding: toWeddingDto(restored),
    membership: { id: formerOwner._id.toString(), role: "owner" as const },
    restoredMemberCount,
  };
}
