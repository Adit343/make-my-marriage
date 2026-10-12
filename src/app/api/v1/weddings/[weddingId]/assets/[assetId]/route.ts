import { route } from "@/lib/http/route";
import { assetParams, updateAssetBody } from "@/modules/gallery/gallery.schemas";
import { deleteAsset, updateAsset } from "@/modules/gallery/asset.service";
import { requireWeddingAccess } from "@/modules/members/guards";

// API Design §12.4. Every role may caption, favourite, move and change who can see a photo; a member
// deletes only photos they uploaded (the service checks; owners and admins any).

export const PATCH = route(
  { params: assetParams, body: updateAssetBody, auth: requireWeddingAccess("gallery:edit") },
  async ({ auth, params, body }) => ({ data: await updateAsset(auth, params.assetId, body) }),
);

export const DELETE = route(
  { params: assetParams, auth: requireWeddingAccess("gallery:edit") },
  async ({ auth, params }) => ({ data: await deleteAsset(auth, params.assetId) }),
);
