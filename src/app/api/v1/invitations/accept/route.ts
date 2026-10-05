import { route } from "@/lib/http/route";
import { requireSession } from "@/modules/auth/guards";
import { acceptInvitationBody } from "@/modules/members/invitation.schemas";
import { acceptInvitation } from "@/modules/members/invitation.service";

// POST /api/v1/invitations/accept — API Design §6.11. Needs a session: sign up or log in first.
export const POST = route(
  { body: acceptInvitationBody, auth: requireSession },
  async ({ auth, body }) => ({ data: await acceptInvitation(auth, body.token) }),
);
