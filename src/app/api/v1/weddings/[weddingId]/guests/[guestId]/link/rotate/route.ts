import { route } from "@/lib/http/route";
import { rotateGuestLink } from "@/modules/guest-invitations/guest-link.service";
import { guestParams } from "@/modules/guests/guest.schemas";
import { requireWeddingAccess } from "@/modules/members/guards";

// API Design §8.8. A brand-new link; the old one stops working at once (for a link that may have leaked).

export const POST = route(
  { params: guestParams, auth: requireWeddingAccess("invitations:send") },
  async ({ auth, params }) => ({ data: await rotateGuestLink(auth, params.guestId) }),
);
