import { route } from "@/lib/http/route";
import { createEventBody } from "@/modules/events/event.schemas";
import { createEvent, listEvents } from "@/modules/events/event.service";
import { requireWeddingAccess } from "@/modules/members/guards";
import { weddingParams } from "@/modules/weddings/wedding.schemas";

// API Design §7.1. Not paginated: a wedding has a handful of events.

export const GET = route(
  { params: weddingParams, auth: requireWeddingAccess("wedding:view") },
  async ({ auth }) => ({ data: await listEvents(auth) }),
);

export const POST = route(
  { params: weddingParams, body: createEventBody, auth: requireWeddingAccess("events:edit") },
  async ({ auth, body }) => ({ status: 201, data: await createEvent(auth, body) }),
);
