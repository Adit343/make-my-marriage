import { route } from "@/lib/http/route";
import { requireWeddingAccess } from "@/modules/members/guards";
import { guestEventParams, recordRsvpBody } from "@/modules/guests/guest.schemas";
import { recordRsvp, unassignGuestFromEvent } from "@/modules/guests/guest.service";

// Addition to API Design §8.5: record a reply by hand ("Record response manually") and take a
// guest off an event.

export const PATCH = route(
  { params: guestEventParams, body: recordRsvpBody, auth: requireWeddingAccess("guests:edit") },
  async ({ auth, params, body }) => ({
    data: await recordRsvp(auth, params.guestId, params.eventId, body),
  }),
);

export const DELETE = route(
  { params: guestEventParams, auth: requireWeddingAccess("guests:edit") },
  async ({ auth, params }) => ({
    data: await unassignGuestFromEvent(auth, params.guestId, params.eventId),
  }),
);
