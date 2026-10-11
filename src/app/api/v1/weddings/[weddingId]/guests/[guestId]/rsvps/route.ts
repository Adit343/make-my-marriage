import { route } from "@/lib/http/route";
import { requireWeddingAccess } from "@/modules/members/guards";
import { assignEventBody, guestParams } from "@/modules/guests/guest.schemas";
import { assignGuestToEvent, listGuestRsvps } from "@/modules/guests/guest.service";

// API Design §8.5. A guest's event assignments: the row existing means "invited to this event".

export const GET = route(
  { params: guestParams, auth: requireWeddingAccess("wedding:view") },
  async ({ auth, params }) => ({ data: await listGuestRsvps(auth, params.guestId) }),
);

export const POST = route(
  { params: guestParams, body: assignEventBody, auth: requireWeddingAccess("guests:edit") },
  async ({ auth, params, body }) => ({
    status: 201,
    data: await assignGuestToEvent(auth, params.guestId, body.eventId),
  }),
);
