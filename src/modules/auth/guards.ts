import "server-only";
import { AppError } from "@/lib/errors";
import { readCookie } from "@/lib/http/cookies";
import { resolveSession, SESSION_COOKIE, type AuthContext } from "@/modules/auth/session.service";

// Auth resolvers for route({ auth }). Membership/role guards for wedding routes arrive in step 1.6.

/** 401 AUTHENTICATION_REQUIRED unless the request carries a valid session cookie. */
export async function requireSession(request: Request): Promise<AuthContext> {
  const auth = await resolveSession(readCookie(request, SESSION_COOKIE));
  if (!auth) throw new AppError("AUTHENTICATION_REQUIRED");
  return auth;
}

/** The session if there is one, otherwise null (e.g. logout is idempotent). */
export async function optionalSession(request: Request): Promise<AuthContext | null> {
  return resolveSession(readCookie(request, SESSION_COOKIE));
}
