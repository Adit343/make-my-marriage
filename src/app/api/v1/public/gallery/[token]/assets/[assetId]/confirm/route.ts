import { getClientIp } from "@/lib/http/client-ip";
import { route } from "@/lib/http/route";
import { enforceRateLimit, RATE_LIMITS } from "@/modules/auth/rate-limit";
import { confirmUploadBody, publicAssetParams } from "@/modules/gallery/gallery.schemas";
import { confirmGuestUpload } from "@/modules/gallery/public-gallery.service";

// API Design §12.7. A guest confirms a photo that THEIR link announced; nobody else's can be touched.

export const POST = route(
  { params: publicAssetParams, body: confirmUploadBody },
  async ({ request, params, body }) => {
    await enforceRateLimit(`gallery-confirm:${getClientIp(request)}`, RATE_LIMITS.galleryUpload);
    return { data: await confirmGuestUpload(params.token, params.assetId, body) };
  },
);
