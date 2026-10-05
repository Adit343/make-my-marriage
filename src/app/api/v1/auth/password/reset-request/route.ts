import { runAfterResponse } from "@/lib/http/after-response";
import { route } from "@/lib/http/route";
import { normalizeEmail } from "@/lib/text/normalize";
import { resetRequestBody } from "@/modules/auth/auth.schemas";
import { requestPasswordReset } from "@/modules/auth/auth.service";
import { enforceRateLimit, RATE_LIMITS } from "@/modules/auth/rate-limit";

// POST /api/v1/auth/password/reset-request — API Design §4.6. Always 200 (no account enumeration):
// the account lookup and email run after the response, so even the response TIME is the same for
// registered and unregistered addresses.
export const POST = route({ body: resetRequestBody }, async ({ body }) => {
  await enforceRateLimit(`reset-request:${normalizeEmail(body.email)}`, RATE_LIMITS.resetRequest);
  await runAfterResponse(() => requestPasswordReset(body.email));
  return { data: null };
});
