import { route } from "@/lib/http/route";
import { createStreamBody } from "@/modules/livestream/stream.schemas";
import { createStream, listStreams } from "@/modules/livestream/stream.service";
import { requireWeddingAccess } from "@/modules/members/guards";
import { weddingParams } from "@/modules/weddings/wedding.schemas";

// API Design §11. Every role may manage streams: whoever is at the venue can set one live.

export const GET = route(
  { params: weddingParams, auth: requireWeddingAccess("wedding:view") },
  async ({ auth }) => ({ data: await listStreams(auth) }),
);

export const POST = route(
  { params: weddingParams, body: createStreamBody, auth: requireWeddingAccess("livestream:edit") },
  async ({ auth, body }) => ({ status: 201, data: await createStream(auth, body) }),
);
