import { route } from "@/lib/http/route";
import { emailLogParams } from "@/modules/guest-invitations/guest-invitation.schemas";
import { retryEmailLog } from "@/modules/guest-invitations/guest-invitation.service";
import { requireWeddingAccess } from "@/modules/members/guards";

// API Design §13. Re-sends ONE failed email; the same log row is updated (not duplicated) and an
// email that already went out can't be sent twice.

export const POST = route(
  { params: emailLogParams, auth: requireWeddingAccess("invitations:logs") },
  async ({ auth, params }) => ({ data: await retryEmailLog(auth, params.logId) }),
);
