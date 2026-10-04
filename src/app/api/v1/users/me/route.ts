import { route } from "@/lib/http/route";
import { getCurrentUser } from "@/modules/auth/auth.service";
import { requireSession } from "@/modules/auth/guards";

// GET /api/v1/users/me — API Design §5.1. PATCH/DELETE arrive with step 1.6.
export const GET = route({ auth: requireSession }, async ({ auth }) => ({
  data: await getCurrentUser(auth),
}));
