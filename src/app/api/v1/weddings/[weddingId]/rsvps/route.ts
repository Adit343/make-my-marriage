import { route } from "@/lib/http/route";
import { requireWeddingAccess } from "@/modules/members/guards";
import { headcountQuery } from "@/modules/guests/guest.schemas";
import { getEventHeadcount } from "@/modules/guests/guest.service";
import { weddingParams } from "@/modules/weddings/wedding.schemas";

// API Design §8.9. Replies and headcount for one event: who has not replied, how many for catering.

export const GET = route(
  { params: weddingParams, query: headcountQuery, auth: requireWeddingAccess("wedding:view") },
  async ({ auth, query }) => ({ data: await getEventHeadcount(auth, query.eventId) }),
);
