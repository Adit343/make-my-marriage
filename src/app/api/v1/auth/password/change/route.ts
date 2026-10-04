import { route } from "@/lib/http/route";
import { passwordChangeBody } from "@/modules/auth/auth.schemas";
import { changePassword } from "@/modules/auth/auth.service";
import { requireSession } from "@/modules/auth/guards";
import { enforceRateLimit, RATE_LIMITS } from "@/modules/auth/rate-limit";

// POST /api/v1/auth/password/change — API Design §4.5
export const POST = route(
  { body: passwordChangeBody, auth: requireSession },
  async ({ body, auth }) => {
    await enforceRateLimit(`password-change:${auth.userId}`, RATE_LIMITS.passwordChange);
    await changePassword(auth, body);
    return { data: null };
  },
);
