import { getClientIp } from "@/lib/http/client-ip";
import { route } from "@/lib/http/route";
import { enforceRateLimit, RATE_LIMITS } from "@/modules/auth/rate-limit";
import { tokenParams } from "@/modules/members/invitation.schemas";
import { previewInvitation } from "@/modules/members/invitation.service";

// GET /api/v1/public/invitations/:token — API Design §6.9. No session; 200 { valid: false } for
// any unusable link, because an expired-link page is a normal outcome, not a client error.
export const GET = route({ params: tokenParams }, async ({ request, params }) => {
  await enforceRateLimit(`invitation-lookup:${getClientIp(request)}`, RATE_LIMITS.invitationLookup);
  return { data: await previewInvitation(params.token) };
});
