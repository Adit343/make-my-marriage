import { route } from "@/lib/http/route";
import { endOtherSessions, listSessions } from "@/modules/auth/auth.service";
import { requireSession } from "@/modules/auth/guards";

// GET /api/v1/auth/sessions — API Design §4.8: the caller's own active sessions.
export const GET = route({ auth: requireSession }, async ({ auth }) => ({
  data: await listSessions(auth),
}));

// DELETE /api/v1/auth/sessions — "Sign out all other sessions" (Stitch Settings screen). An
// addition to API Design §4.8; the current session is kept.
export const DELETE = route({ auth: requireSession }, async ({ auth }) => {
  await endOtherSessions(auth);
  return { data: null };
});
