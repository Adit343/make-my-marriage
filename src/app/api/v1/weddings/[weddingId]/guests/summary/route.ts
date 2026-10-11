import { route } from "@/lib/http/route";
import { requireWeddingAccess } from "@/modules/members/guards";
import { summaryQuery } from "@/modules/guests/guest.schemas";
import { getGuestSummary } from "@/modules/guests/guest.service";
import { weddingParams } from "@/modules/weddings/wedding.schemas";

// Addition to API Design §8: the four numbers above the guest list, for the whole wedding or for
// one event (`?eventId=`).

export const GET = route(
  { params: weddingParams, query: summaryQuery, auth: requireWeddingAccess("wedding:view") },
  async ({ auth, query }) => ({ data: await getGuestSummary(auth, query.eventId) }),
);
