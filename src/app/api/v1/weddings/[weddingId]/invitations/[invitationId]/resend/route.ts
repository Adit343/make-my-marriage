import { route } from "@/lib/http/route";
import { requireWeddingAccess } from "@/modules/members/guards";
import { invitationParams } from "@/modules/members/invitation.schemas";
import { resendInvitation } from "@/modules/members/invitation.service";

// POST .../invitations/:invitationId/resend — an addition to API Design §6.9, which tells the
// client to "resend instead" but defines no route. Rotates the token and emails the new link.
export const POST = route(
  { params: invitationParams, auth: requireWeddingAccess("members:manage") },
  async ({ auth, params }) => ({ data: await resendInvitation(auth, params.invitationId) }),
);
