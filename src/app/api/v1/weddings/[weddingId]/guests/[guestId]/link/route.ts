import { route } from "@/lib/http/route";
import { createGuestLink, getGuestLink } from "@/modules/guest-invitations/guest-link.service";
import { guestParams } from "@/modules/guests/guest.schemas";
import { requireWeddingAccess } from "@/modules/members/guards";

// API Design §8.8. GET only reads: it returns the guest's link, or null if they have none yet.
// POST (an addition: a GET must never write, API Design §2.9) creates it if missing and returns the
// SAME link every time after that, which is what "Copy invite link" needs.

export const GET = route(
  { params: guestParams, auth: requireWeddingAccess("wedding:view") },
  async ({ auth, params }) => ({ data: await getGuestLink(auth, params.guestId) }),
);

export const POST = route(
  { params: guestParams, auth: requireWeddingAccess("invitations:send") },
  async ({ auth, params }) => ({ data: await createGuestLink(auth, params.guestId) }),
);
