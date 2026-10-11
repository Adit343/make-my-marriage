import { route } from "@/lib/http/route";
import { requireWeddingAccess } from "@/modules/members/guards";
import { guestParams, updateGuestBody } from "@/modules/guests/guest.schemas";
import { deleteGuest, getGuest, updateGuest } from "@/modules/guests/guest.service";

// API Design §8.4. GET returns the full private shape (notes, address, replies per event). DELETE
// soft-deletes the guest and their RSVP rows together.

export const GET = route(
  { params: guestParams, auth: requireWeddingAccess("wedding:view") },
  async ({ auth, params }) => ({ data: await getGuest(auth, params.guestId) }),
);

export const PATCH = route(
  { params: guestParams, body: updateGuestBody, auth: requireWeddingAccess("guests:edit") },
  async ({ auth, params, body }) => ({ data: await updateGuest(auth, params.guestId, body) }),
);

export const DELETE = route(
  { params: guestParams, auth: requireWeddingAccess("guests:edit") },
  async ({ auth, params }) => ({ data: await deleteGuest(auth, params.guestId) }),
);
