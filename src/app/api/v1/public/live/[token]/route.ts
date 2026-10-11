import { getClientIp } from "@/lib/http/client-ip";
import { route } from "@/lib/http/route";
import { enforceRateLimit, RATE_LIMITS } from "@/modules/auth/rate-limit";
import { liveTokenParams } from "@/modules/livestream/stream.schemas";
import { getPublicLive } from "@/modules/livestream/stream.service";

// API Design §11. The guest watch page's data, with the watch link as the credential. Every
// unusable link (unknown, replaced, stream or wedding deleted) is the same 403 INVALID_TOKEN.

export const GET = route({ params: liveTokenParams }, async ({ request, params }) => {
  await enforceRateLimit(`live-lookup:${getClientIp(request)}`, RATE_LIMITS.liveLookup);
  return { data: await getPublicLive(params.token) };
});
