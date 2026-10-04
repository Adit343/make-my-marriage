import { route } from "@/lib/http/route";
import { requireSession } from "@/modules/auth/guards";
import { createWeddingBody } from "@/modules/weddings/wedding.schemas";
import { createWedding } from "@/modules/weddings/wedding.service";

// POST /api/v1/weddings — API Design §6.1. Built in step 1.5 because signup creates the wedding
// right after the account; the rest of the wedding routes arrive in step 1.6.
export const POST = route(
  { body: createWeddingBody, auth: requireSession },
  async ({ body, auth }) => ({
    status: 201,
    data: await createWedding(auth, body),
  }),
);
