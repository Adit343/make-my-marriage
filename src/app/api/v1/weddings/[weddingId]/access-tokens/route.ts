import { route } from "@/lib/http/route";
import { createAccessToken, listAccessTokens } from "@/modules/gallery/access-token.service";
import { createAccessTokenBody, galleryParams } from "@/modules/gallery/gallery.schemas";
import { requireWeddingAccess } from "@/modules/members/guards";

// API Design §12.6. Shared gallery links and QR codes: owners and admins only.

export const GET = route(
  { params: galleryParams, auth: requireWeddingAccess("gallery:manage") },
  async ({ auth }) => ({ data: await listAccessTokens(auth) }),
);

export const POST = route(
  {
    params: galleryParams,
    body: createAccessTokenBody,
    auth: requireWeddingAccess("gallery:manage"),
  },
  async ({ auth, body }) => ({ status: 201, data: await createAccessToken(auth, body) }),
);
