import { route } from "@/lib/http/route";
import { requireSession } from "@/modules/auth/guards";
import { weddingParams } from "@/modules/weddings/wedding.schemas";
import { restoreWedding } from "@/modules/weddings/wedding.service";

// POST /api/v1/weddings/:weddingId/restore — API Design §6.4. The one wedding route that does not
// use requireWeddingAccess: the caller's membership was ended by the deletion, so the service
// proves they are the former owner instead.
export const POST = route(
  { params: weddingParams, auth: requireSession },
  async ({ auth, params }) => ({ data: await restoreWedding(auth, params.weddingId) }),
);
