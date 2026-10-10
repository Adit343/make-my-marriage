import { route } from "@/lib/http/route";
import { eventParams, updateEventBody } from "@/modules/events/event.schemas";
import { deleteEvent, getEvent, updateEvent } from "@/modules/events/event.service";
import { requireWeddingAccess } from "@/modules/members/guards";

// API Design §7.1. PATCH and DELETE are open to every role at the route; the service then allows
// members only on events they created (admin and owner: any event).

export const GET = route(
  { params: eventParams, auth: requireWeddingAccess("wedding:view") },
  async ({ auth, params }) => ({ data: await getEvent(auth, params.eventId) }),
);

export const PATCH = route(
  { params: eventParams, body: updateEventBody, auth: requireWeddingAccess("events:edit") },
  async ({ auth, params, body }) => ({ data: await updateEvent(auth, params.eventId, body) }),
);

export const DELETE = route(
  { params: eventParams, auth: requireWeddingAccess("events:edit") },
  async ({ auth, params }) => ({ data: await deleteEvent(auth, params.eventId) }),
);
