import { route } from "@/lib/http/route";
import { listSessions } from "@/modules/auth/auth.service";
import { requireSession } from "@/modules/auth/guards";

// GET /api/v1/auth/sessions — API Design §4.8: the caller's own active sessions.
export const GET = route({ auth: requireSession }, async ({ auth }) => ({
  data: await listSessions(auth),
}));
