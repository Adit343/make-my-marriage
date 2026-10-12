import { route } from "@/lib/http/route";
import { assetParams, confirmUploadBody } from "@/modules/gallery/gallery.schemas";
import { confirmUpload } from "@/modules/gallery/asset.service";
import { requireWeddingAccess } from "@/modules/members/guards";

// API Design §12.2, step 3. The server reads the stored file back and refuses anything that is not
// the photo that was announced.

export const POST = route(
  { params: assetParams, body: confirmUploadBody, auth: requireWeddingAccess("gallery:edit") },
  async ({ auth, params, body }) => ({ data: await confirmUpload(auth, params.assetId, body) }),
);
