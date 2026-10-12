import { route } from "@/lib/http/route";
import { galleryParams, uploadUrlBody } from "@/modules/gallery/gallery.schemas";
import { requestUploadUrl } from "@/modules/gallery/asset.service";
import { requireWeddingAccess } from "@/modules/members/guards";

// API Design §12.2, step 1. Announces a photo and returns the short-lived address the BROWSER sends
// the file to. The file never passes through this API.

export const POST = route(
  { params: galleryParams, body: uploadUrlBody, auth: requireWeddingAccess("gallery:edit") },
  async ({ auth, body }) => ({ data: await requestUploadUrl(auth, body) }),
);
