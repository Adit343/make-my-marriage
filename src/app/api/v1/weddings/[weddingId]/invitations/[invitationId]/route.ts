import { route } from "@/lib/http/route";
import { requireWeddingAccess } from "@/modules/members/guards";
import { invitationParams } from "@/modules/members/invitation.schemas";
import { revokeInvitationFor } from "@/modules/members/invitation.service";

// DELETE = revoke. The row is kept (status "revoked") and purged by TTL 30 days later.
export const DELETE = route(
  { params: invitationParams, auth: requireWeddingAccess("members:manage") },
  async ({ auth, params }) => ({ data: await revokeInvitationFor(auth, params.invitationId) }),
);
