import { route } from "@/lib/http/route";
import { requireWeddingAccess } from "@/modules/members/guards";
import { createGuestBody, listGuestsQuery } from "@/modules/guests/guest.schemas";
import { createGuest, listGuests } from "@/modules/guests/guest.service";
import { weddingParams } from "@/modules/weddings/wedding.schemas";

// API Design §8.2 and §8.3. Cursor-paginated A to Z; filters are an allow-list. Creating a guest
// also invites them to the events in `eventIds`.

export const GET = route(
  { params: weddingParams, query: listGuestsQuery, auth: requireWeddingAccess("wedding:view") },
  async ({ auth, query }) => {
    const { items, meta } = await listGuests(auth, query);
    return { data: items, meta };
  },
);

export const POST = route(
  { params: weddingParams, body: createGuestBody, auth: requireWeddingAccess("guests:edit") },
  async ({ auth, body }) => ({ status: 201, data: await createGuest(auth, body) }),
);
