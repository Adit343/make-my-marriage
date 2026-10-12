import { getClientIp } from "@/lib/http/client-ip";
import { route } from "@/lib/http/route";
import { enforceRateLimit, RATE_LIMITS } from "@/modules/auth/rate-limit";
import { publicGalleryParams, publicListQuery } from "@/modules/gallery/gallery.schemas";
import { getPublicGallery } from "@/modules/gallery/public-gallery.service";

// API Design §12.7. A guest with a shared link, no account. Every unusable link (unknown, revoked,
// expired, anything deleted) is the same 403 INVALID_TOKEN.

export const GET = route(
  { params: publicGalleryParams, query: publicListQuery },
  async ({ request, params, query }) => {
    await enforceRateLimit(`gallery-lookup:${getClientIp(request)}`, RATE_LIMITS.galleryLookup);
    const { data, meta } = await getPublicGallery(params.token, query);
    return { data, meta };
  },
);
