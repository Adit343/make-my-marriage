import { route } from "@/lib/http/route";
import { requireWeddingAccess } from "@/modules/members/guards";
import { invitationParams } from "@/modules/members/invitation.schemas";
import { regenerateInvitationLink } from "@/modules/members/invitation.service";

// POST .../invitations/:invitationId/link — an addition to API Design §6.9 for the Team screen's
// "Copy invite link": issues a fresh link without sending an email; the old link stops working.
export const POST = route(
  { params: invitationParams, auth: requireWeddingAccess("members:manage") },
  async ({ auth, params }) => ({ data: await regenerateInvitationLink(auth, params.invitationId) }),
);
