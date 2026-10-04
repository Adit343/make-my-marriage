import { route } from "@/lib/http/route";
import { normalizeEmail } from "@/lib/text/normalize";
import { resetRequestBody } from "@/modules/auth/auth.schemas";
import { requestPasswordReset } from "@/modules/auth/auth.service";
import { enforceRateLimit, RATE_LIMITS } from "@/modules/auth/rate-limit";

// POST /api/v1/auth/password/reset-request — API Design §4.6. Always 200 (no account enumeration).
export const POST = route({ body: resetRequestBody }, async ({ body }) => {
  await enforceRateLimit(`reset-request:${normalizeEmail(body.email)}`, RATE_LIMITS.resetRequest);
  await requestPasswordReset(body.email);
  return { data: null };
});
