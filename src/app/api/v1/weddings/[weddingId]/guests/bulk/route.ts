import { route } from "@/lib/http/route";
import { requireWeddingAccess } from "@/modules/members/guards";
import { bulkGuestsBody } from "@/modules/guests/guest.schemas";
import { bulkGuests } from "@/modules/guests/guest.service";
import { weddingParams } from "@/modules/weddings/wedding.schemas";

// Addition to API Design §8: the selection bar of the guest list (delete, change group) acts on up
// to 200 guests in one request. A stale selection fails as a whole (NOT_FOUND) instead of
// half-applying.

export const POST = route(
  { params: weddingParams, body: bulkGuestsBody, auth: requireWeddingAccess("guests:edit") },
  async ({ auth, body }) => ({ data: await bulkGuests(auth, body) }),
);
