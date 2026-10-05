import "server-only";
import { withTransaction } from "@/infrastructure/database/transaction";
import { AppError } from "@/lib/errors";
import { revokeAllSessions } from "@/modules/auth/session.repository";
import { clearedSessionCookie, type AuthContext } from "@/modules/auth/session.service";
import {
  countActiveMembers,
  findActiveMembershipByUser,
  softDeleteMember,
} from "@/modules/members/member.repository";
import { markUserDeleted, setName } from "@/modules/users/user.repository";
import { softDeleteWeddingAndMembers } from "@/modules/weddings/wedding.service";

export async function updateProfile(auth: AuthContext, input: { name: string }) {
  await setName(auth.userId, input.name);
}

/**
 * Account deletion (API Design §5.3, DB Design §10.4). Never silently chooses for an owner:
 *   - owner of a wedding with other members → blocked (transfer ownership, or delete the wedding)
 *   - sole owner → must pass deleteWedding=true, which deletes the wedding too (30-day grace)
 *   - any other member → simply leaves the wedding
 */
export async function deleteAccount(auth: AuthContext, options: { deleteWedding: boolean }) {
  const membership = await findActiveMembershipByUser(auth.userId);

  if (!membership) {
    await markUserDeleted(auth.userId);
  } else if (membership.role === "owner") {
    const activeMemberCount = await countActiveMembers(membership.weddingId);
    if (activeMemberCount > 1 || !options.deleteWedding) {
      throw new AppError("OWNER_MUST_RESOLVE_WEDDING", {
        details: { weddingId: membership.weddingId.toString(), activeMemberCount },
      });
    }
    await withTransaction(async (session) => {
      await softDeleteWeddingAndMembers(membership.weddingId, auth.userId, session);
      await markUserDeleted(auth.userId, session);
    });
  } else {
    await withTransaction(async (session) => {
      await softDeleteMember(
        membership.weddingId,
        membership._id,
        { by: auth.userId, reason: "account_deleted" },
        session,
      );
      await markUserDeleted(auth.userId, session);
    });
  }

  // Signed out everywhere; the rows themselves are removed by the sessions TTL index.
  await revokeAllSessions(auth.userId);
  return { data: { status: "deleted" as const }, cookies: [clearedSessionCookie()] };
}
