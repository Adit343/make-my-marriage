import { getClientIp } from "@/lib/http/client-ip";
import { route } from "@/lib/http/route";
import { resetConfirmBody } from "@/modules/auth/auth.schemas";
import { confirmPasswordReset } from "@/modules/auth/auth.service";
import { enforceRateLimit, RATE_LIMITS } from "@/modules/auth/rate-limit";

// POST /api/v1/auth/password/reset-confirm — API Design §4.7 (INVALID_TOKEN is 403, decision C4).
export const POST = route({ body: resetConfirmBody }, async ({ request, body }) => {
  await enforceRateLimit(`reset-confirm:${getClientIp(request)}`, RATE_LIMITS.resetConfirm);
  await confirmPasswordReset(body);
  return { data: null };
});
