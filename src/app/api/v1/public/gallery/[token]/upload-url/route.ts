import { getClientIp } from "@/lib/http/client-ip";
import { route } from "@/lib/http/route";
import { enforceRateLimit, RATE_LIMITS } from "@/modules/auth/rate-limit";
import { publicGalleryParams, publicUploadUrlBody } from "@/modules/gallery/gallery.schemas";
import { requestGuestUploadUrl } from "@/modules/gallery/public-gallery.service";

// API Design §12.7. A guest announces a photo. Limited per visitor and per link.

export const POST = route(
  { params: publicGalleryParams, body: publicUploadUrlBody },
  async ({ request, params, body }) => {
    await enforceRateLimit(`gallery-upload:${getClientIp(request)}`, RATE_LIMITS.galleryUpload);
    await enforceRateLimit(`gallery-upload-link:${params.token}`, RATE_LIMITS.galleryUploadLink);
    return { data: await requestGuestUploadUrl(params.token, body) };
  },
);
