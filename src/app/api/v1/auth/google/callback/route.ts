import { route } from "@/lib/http/route";
import { googleCallbackQuery } from "@/modules/auth/auth.schemas";
import { completeGoogleSignIn } from "@/modules/auth/google.service";

// GET /api/v1/auth/google/callback — API Design §4.4. Always answers with a redirect: to the
// dashboard on success, to /login?error=… otherwise (no provider details in the URL).
export const GET = route({ query: googleCallbackQuery }, async ({ request, query }) =>
  completeGoogleSignIn(request, query),
);
