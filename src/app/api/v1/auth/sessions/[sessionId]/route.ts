import { route } from "@/lib/http/route";
import { sessionParams } from "@/modules/auth/auth.schemas";
import { endSession } from "@/modules/auth/auth.service";
import { requireSession } from "@/modules/auth/guards";
import { clearedSessionCookie } from "@/modules/auth/session.service";

// DELETE /api/v1/auth/sessions/:sessionId — API Design §4.8 ("log out that old phone").
export const DELETE = route(
  { params: sessionParams, auth: requireSession },
  async ({ params, auth }) => {
    const { endedCurrent } = await endSession(auth, params.sessionId);
    return { data: null, cookies: endedCurrent ? [clearedSessionCookie()] : [] };
  },
);
