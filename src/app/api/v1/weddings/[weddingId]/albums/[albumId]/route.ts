import { route } from "@/lib/http/route";
import { albumParams, deleteAlbumBody, updateAlbumBody } from "@/modules/gallery/gallery.schemas";
import { deleteAlbum, updateAlbum } from "@/modules/gallery/gallery.service";
import { requireWeddingAccess } from "@/modules/members/guards";

// API Design §12.1. Every role may edit an album; deleting needs a choice about its photos, and a
// member may delete only albums they made (the service checks; owners and admins any).

export const PATCH = route(
  { params: albumParams, body: updateAlbumBody, auth: requireWeddingAccess("gallery:edit") },
  async ({ auth, params, body }) => ({ data: await updateAlbum(auth, params.albumId, body) }),
);

export const DELETE = route(
  { params: albumParams, body: deleteAlbumBody, auth: requireWeddingAccess("gallery:edit") },
  async ({ auth, params, body }) => ({ data: await deleteAlbum(auth, params.albumId, body) }),
);
