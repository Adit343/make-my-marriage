import { route } from "@/lib/http/route";
import { streamParams, updateStreamBody } from "@/modules/livestream/stream.schemas";
import { deleteStream, updateStream } from "@/modules/livestream/stream.service";
import { requireWeddingAccess } from "@/modules/members/guards";

// API Design §11. `status` (scheduled, live, ended, cancelled) is set by hand with PATCH: there are
// no webhooks or WebSockets in V1.

export const PATCH = route(
  { params: streamParams, body: updateStreamBody, auth: requireWeddingAccess("livestream:edit") },
  async ({ auth, params, body }) => ({ data: await updateStream(auth, params.streamId, body) }),
);

export const DELETE = route(
  { params: streamParams, auth: requireWeddingAccess("livestream:edit") },
  async ({ auth, params }) => ({ data: await deleteStream(auth, params.streamId) }),
);
