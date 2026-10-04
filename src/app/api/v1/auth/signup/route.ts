import { getClientIp } from "@/lib/http/client-ip";
import { route } from "@/lib/http/route";
import { signupBody } from "@/modules/auth/auth.schemas";
import { signUp } from "@/modules/auth/auth.service";
import { enforceRateLimit, RATE_LIMITS } from "@/modules/auth/rate-limit";

// POST /api/v1/auth/signup — API Design §4.1
export const POST = route({ body: signupBody }, async ({ request, body }) => {
  await enforceRateLimit(`signup:${getClientIp(request)}`, RATE_LIMITS.signup);
  const { user, hasWedding, cookie } = await signUp(body, {
    userAgent: request.headers.get("user-agent"),
  });
  return { status: 201, data: { user, hasWedding }, cookies: [cookie] };
});
