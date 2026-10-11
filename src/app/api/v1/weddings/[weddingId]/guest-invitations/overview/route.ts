import { route } from "@/lib/http/route";
import { getInvitationsOverview } from "@/modules/guest-invitations/invitation-overview.service";
import { requireWeddingAccess } from "@/modules/members/guards";
import { weddingParams } from "@/modules/weddings/wedding.schemas";

// Addition to API Design §8: the Invitations overview in one call: coverage by channel, guests
// nobody can reach, emails that failed and the latest send batches.

export const GET = route(
  { params: weddingParams, auth: requireWeddingAccess("wedding:view") },
  async ({ auth }) => ({ data: await getInvitationsOverview(auth) }),
);
