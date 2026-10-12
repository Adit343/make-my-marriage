import { route } from "@/lib/http/route";
import { updateGalleryBody, galleryParams } from "@/modules/gallery/gallery.schemas";
import { getGallerySettings, updateGallerySettings } from "@/modules/gallery/gallery.service";
import { requireWeddingAccess } from "@/modules/members/guards";

// API Design §12.1. Every member can read the settings and what is stored (a GET never creates the
// gallery); changing them is for owners and admins (gallery:manage).

export const GET = route(
  { params: galleryParams, auth: requireWeddingAccess("wedding:view") },
  async ({ auth }) => ({ data: await getGallerySettings(auth) }),
);

export const PATCH = route(
  { params: galleryParams, body: updateGalleryBody, auth: requireWeddingAccess("gallery:manage") },
  async ({ auth, body }) => ({ data: await updateGallerySettings(auth, body) }),
);
