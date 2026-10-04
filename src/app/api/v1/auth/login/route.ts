import { getClientIp } from "@/lib/http/client-ip";
import { route } from "@/lib/http/route";
import { normalizeEmail } from "@/lib/text/normalize";
import { loginBody } from "@/modules/auth/auth.schemas";
import { logIn } from "@/modules/auth/auth.service";
import { enforceRateLimit, RATE_LIMITS } from "@/modules/auth/rate-limit";

// POST /api/v1/auth/login — API Design §4.2
export const POST = route({ body: loginBody }, async ({ request, body }) => {
  await enforceRateLimit(
    `login:${getClientIp(request)}:${normalizeEmail(body.email)}`,
    RATE_LIMITS.login,
  );
  const { user, hasWedding, cookie } = await logIn(body, {
    userAgent: request.headers.get("user-agent"),
  });
  return { data: { user, hasWedding }, cookies: [cookie] };
});
