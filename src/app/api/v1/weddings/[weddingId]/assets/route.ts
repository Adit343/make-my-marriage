import { route } from "@/lib/http/route";
import { galleryParams, listAssetsQuery } from "@/modules/gallery/gallery.schemas";
import { listAssets } from "@/modules/gallery/asset.service";
import { requireWeddingAccess } from "@/modules/members/guards";

// API Design §12.3. Every member sees the active photos; the approval queue (status=pending_review)
// is for owners and admins (the service checks).

export const GET = route(
  { params: galleryParams, query: listAssetsQuery, auth: requireWeddingAccess("wedding:view") },
  async ({ auth, query }) => {
    const { items, meta } = await listAssets(auth, query);
    return { data: items, meta };
  },
);
