import { route } from "@/lib/http/route";
import { assetParams, moderateBody } from "@/modules/gallery/gallery.schemas";
import { moderateAsset } from "@/modules/gallery/asset.service";
import { requireWeddingAccess } from "@/modules/members/guards";

// API Design §12.5. Approving or rejecting a guest's photo is gatekeeping, for owners and admins.

export const POST = route(
  { params: assetParams, body: moderateBody, auth: requireWeddingAccess("gallery:manage") },
  async ({ auth, params, body }) => ({ data: await moderateAsset(auth, params.assetId, body) }),
);
