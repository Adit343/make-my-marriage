import { getClientIp } from "@/lib/http/client-ip";
import { route } from "@/lib/http/route";
import { submitRsvpBody, publicTokenParams } from "@/modules/guest-invitations/public-rsvp.schemas";
import { getPublicRsvp, submitPublicRsvp } from "@/modules/guest-invitations/public-rsvp.service";
import { enforceRateLimit, RATE_LIMITS } from "@/modules/auth/rate-limit";

// API Design §8.10. A guest with their personal link, no account. Every unusable link (unknown,
// revoked, guest or wedding deleted) is the same 403 INVALID_TOKEN.

export const GET = route({ params: publicTokenParams }, async ({ request, params }) => {
  await enforceRateLimit(`rsvp-lookup:${getClientIp(request)}`, RATE_LIMITS.rsvpLookup);
  return { data: await getPublicRsvp(params.token) };
});

export const PATCH = route(
  { params: publicTokenParams, body: submitRsvpBody },
  async ({ request, params, body }) => {
    await enforceRateLimit(`rsvp-submit:${getClientIp(request)}`, RATE_LIMITS.rsvpSubmit);
    return { data: await submitPublicRsvp(params.token, body) };
  },
);
