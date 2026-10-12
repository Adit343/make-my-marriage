import { route } from "@/lib/http/route";
import { createAlbumBody, galleryParams } from "@/modules/gallery/gallery.schemas";
import { createAlbum, listAlbums } from "@/modules/gallery/gallery.service";
import { requireWeddingAccess } from "@/modules/members/guards";

// API Design §12.1. Every role can see and make albums.

export const GET = route(
  { params: galleryParams, auth: requireWeddingAccess("wedding:view") },
  async ({ auth }) => ({ data: await listAlbums(auth) }),
);

export const POST = route(
  { params: galleryParams, body: createAlbumBody, auth: requireWeddingAccess("gallery:edit") },
  async ({ auth, body }) => ({ status: 201, data: await createAlbum(auth, body) }),
);
