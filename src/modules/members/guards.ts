import "server-only";
import type { MemberRole } from "@/lib/constants/enums";
import { AppError } from "@/lib/errors";
import type { AuthResolver } from "@/lib/http/route";
import { requireSession } from "@/modules/auth/guards";
import type { AuthContext } from "@/modules/auth/session.service";
import { findActiveMembershipByUser } from "@/modules/members/member.repository";
import { can, type Permission } from "@/modules/members/permissions";

// Authorization for wedding routes (Architecture §12, API Design §3.1):
//   requireSession (401) → membership of THIS wedding (403 NOT_A_MEMBER) → role (403 INSUFFICIENT_ROLE)
// The fourth check — the target resource belongs to the wedding (404) — happens in the service,
// through repositories that always take weddingId.

export interface WeddingAuth extends AuthContext {
  weddingId: string;
  membership: { id: string; role: MemberRole };
}

/**
 * Resolver for `/weddings/:weddingId/...` routes. The caller must be an active member of that
 * wedding whose role grants `permission`.
 */
export function requireWeddingAccess(
  permission: Permission,
): AuthResolver<WeddingAuth, { weddingId: string }> {
  return async (request, params) => {
    const auth = await requireSession(request);
    // One user = one wedding, so the user's only membership either is this wedding or isn't.
    const membership = await findActiveMembershipByUser(auth.userId);
    if (
      !membership ||
      membership.weddingId.toString() !== params.weddingId ||
      membership.status !== "active"
    ) {
      throw new AppError("NOT_A_MEMBER");
    }
    if (!can(membership.role, permission)) throw new AppError("INSUFFICIENT_ROLE");
    return {
      ...auth,
      weddingId: params.weddingId,
      membership: { id: membership._id.toString(), role: membership.role },
    };
  };
}
