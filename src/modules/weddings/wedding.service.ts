import "server-only";
import { withTransaction } from "@/infrastructure/database/transaction";
import { AppError, isDuplicateKeyError } from "@/lib/errors";
import type { AuthContext } from "@/modules/auth/session.service";
import {
  createOwnerMembership,
  findActiveMembershipByUser,
} from "@/modules/members/member.repository";
import { toWeddingDto } from "@/modules/weddings/wedding.dto";
import { findWedding, insertWedding } from "@/modules/weddings/wedding.repository";
import type { CreateWeddingInput } from "@/modules/weddings/wedding.schemas";

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
