import { route } from "@/lib/http/route";
import { requireSession } from "@/modules/auth/guards";
import { createWeddingBody } from "@/modules/weddings/wedding.schemas";
import { createWedding } from "@/modules/weddings/wedding.service";

// POST /api/v1/weddings — API Design §6.1. Wedding-scoped routes live under [weddingId]/.
export const POST = route(
  { body: createWeddingBody, auth: requireSession },
  async ({ body, auth }) => ({
    status: 201,
    data: await createWedding(auth, body),
  }),
);
