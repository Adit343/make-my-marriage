import { route } from "@/lib/http/route";
import { revokeAccessToken } from "@/modules/gallery/access-token.service";
import { accessTokenParams } from "@/modules/gallery/gallery.schemas";
import { requireWeddingAccess } from "@/modules/members/guards";

// API Design §12.6. Revoking a link ends it at once; the row is removed 30 days later.

export const DELETE = route(
  { params: accessTokenParams, auth: requireWeddingAccess("gallery:manage") },
  async ({ auth, params }) => ({ data: await revokeAccessToken(auth, params.tokenId) }),
);
