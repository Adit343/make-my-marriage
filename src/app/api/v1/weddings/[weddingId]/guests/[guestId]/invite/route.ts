import { route } from "@/lib/http/route";
import { inviteGuestBody } from "@/modules/guest-invitations/guest-invitation.schemas";
import { inviteGuest } from "@/modules/guest-invitations/guest-invitation.service";
import { guestParams } from "@/modules/guests/guest.schemas";
import { requireWeddingAccess } from "@/modules/members/guards";

// API Design §8.6. email: the app sends it. whatsapp: records that the member opened the pre-filled
// message and returns the wa.me link (the member presses Send; there is no WhatsApp API). manual:
// records "told in person".

export const POST = route(
  { params: guestParams, body: inviteGuestBody, auth: requireWeddingAccess("invitations:send") },
  async ({ auth, params, body }) => ({ data: await inviteGuest(auth, params.guestId, body) }),
);
