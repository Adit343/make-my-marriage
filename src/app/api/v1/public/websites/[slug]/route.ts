import { getClientIp } from "@/lib/http/client-ip";
import { route } from "@/lib/http/route";
import { enforceRateLimit, RATE_LIMITS } from "@/modules/auth/rate-limit";
import { publicSlugParams } from "@/modules/website/website.schemas";
import { getPublicWebsite } from "@/modules/website/website.service";

// API Design §10.3. The public wedding site: no account, no token. The response is a hand-built
// whitelist; a draft, a deleted site or wedding, or an address nobody uses are all the same 404.

export const GET = route({ params: publicSlugParams }, async ({ request, params }) => {
  await enforceRateLimit(`site-lookup:${getClientIp(request)}`, RATE_LIMITS.siteLookup);
  return { data: await getPublicWebsite(params.slug) };
});
