import { getClientIp } from "@/lib/http/client-ip";
import { route } from "@/lib/http/route";
import { startGoogleSignIn } from "@/modules/auth/google.service";
import { enforceRateLimit, RATE_LIMITS } from "@/modules/auth/rate-limit";

// GET /api/v1/auth/google — API Design §4.4: redirects the browser to Google.
export const GET = route({}, async ({ request }) => {
  await enforceRateLimit(`google-start:${getClientIp(request)}`, RATE_LIMITS.googleStart);
  return startGoogleSignIn();
});
