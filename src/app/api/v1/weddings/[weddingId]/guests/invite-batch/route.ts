import { route } from "@/lib/http/route";
import { inviteBatchBody } from "@/modules/guest-invitations/guest-invitation.schemas";
import { inviteBatch } from "@/modules/guest-invitations/guest-invitation.service";
import { requireWeddingAccess } from "@/modules/members/guards";
import { weddingParams } from "@/modules/weddings/wedding.schemas";

// API Design §8.7. Up to 50 guests in one request, emailed in small groups (Architecture §29). The
// response says who was sent, who failed and who was skipped; repeating the request with the same
// `batchId` never emails a guest twice, so "retry the failures" is safe.

export const POST = route(
  { params: weddingParams, body: inviteBatchBody, auth: requireWeddingAccess("invitations:send") },
  async ({ auth, body }) => ({ data: await inviteBatch(auth, body) }),
);
