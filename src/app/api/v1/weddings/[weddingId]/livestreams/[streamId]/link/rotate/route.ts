import { route } from "@/lib/http/route";
import { streamParams } from "@/modules/livestream/stream.schemas";
import { rotateStreamLink } from "@/modules/livestream/stream.service";
import { requireWeddingAccess } from "@/modules/members/guards";

// API Design §11. A brand-new watch link; the old one stops working at once.

export const POST = route(
  { params: streamParams, auth: requireWeddingAccess("livestream:edit") },
  async ({ auth, params }) => ({ data: await rotateStreamLink(auth, params.streamId) }),
);
