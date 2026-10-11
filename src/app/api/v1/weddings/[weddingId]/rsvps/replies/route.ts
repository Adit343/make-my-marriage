import { route } from "@/lib/http/route";
import { repliesQuery } from "@/modules/guest-invitations/guest-invitation.schemas";
import { getEventReplies } from "@/modules/guest-invitations/invitation-overview.service";
import { requireWeddingAccess } from "@/modules/members/guards";
import { weddingParams } from "@/modules/weddings/wedding.schemas";

// Addition to API Design §8.9: the RSVP tracker's list. One event's replies guest by guest (who has
// answered, who hasn't, how many people), plus the headcount numbers.

export const GET = route(
  { params: weddingParams, query: repliesQuery, auth: requireWeddingAccess("wedding:view") },
  async ({ auth, query }) => ({ data: await getEventReplies(auth, query.eventId) }),
);
