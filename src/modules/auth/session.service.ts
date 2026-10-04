import "server-only";
import type { Types } from "mongoose";
import { getEnv } from "@/lib/env";
import { generateToken, hashToken } from "@/lib/crypto/tokens";
import type { CookieToSet } from "@/lib/http/cookies";
import { createSession, findValidSession, touchSession } from "@/modules/auth/session.repository";
import { findUserById } from "@/modules/users/user.repository";

// Server-side sessions (Architecture §10): an opaque random token in an HttpOnly cookie, its
// SHA-256 hash in MongoDB. "Remember me" sessions last 30 days; others end with the browser
// session and expire server-side after 12 hours of inactivity. Both windows roll forward on use.

export const SESSION_COOKIE = "mmm_session";

const PERSISTENT_TTL_SECONDS = 30 * 24 * 60 * 60;
const BROWSER_TTL_SECONDS = 12 * 60 * 60;
/** lastUsedAt is written at most this often (DB Design §6.2: avoid a write per request). */
const TOUCH_INTERVAL_MS = 10 * 60 * 1000;

export interface AuthContext {
  userId: string;
  sessionId: string;
  user: { id: string; email: string; name: string };
}

function ttlSeconds(persistent: boolean) {
  return persistent ? PERSISTENT_TTL_SECONDS : BROWSER_TTL_SECONDS;
}

function isProduction() {
  return getEnv().NODE_ENV === "production";
}

function sessionCookie(token: string, persistent: boolean): CookieToSet {
  return {
    name: SESSION_COOKIE,
    value: token,
    // No Max-Age = the cookie ends when the browser session does.
    maxAge: persistent ? PERSISTENT_TTL_SECONDS : undefined,
    path: "/",
    httpOnly: true,
    secure: isProduction(),
    sameSite: "Lax",
  };
}

export function clearedSessionCookie(): CookieToSet {
  return {
    name: SESSION_COOKIE,
    value: "",
    maxAge: 0,
    path: "/",
    httpOnly: true,
    secure: isProduction(),
  };
}

export async function startSession(
  userId: Types.ObjectId | string,
  options: { persistent: boolean; userAgent?: string | null },
): Promise<{ cookie: CookieToSet }> {
  const token = generateToken();
  await createSession({
    userId,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + ttlSeconds(options.persistent) * 1000),
    persistent: options.persistent,
    userAgent: options.userAgent,
  });
  return { cookie: sessionCookie(token, options.persistent) };
}

/** Returns the caller's identity, or null for a missing/expired/revoked session or inactive user. */
export async function resolveSession(token: string | undefined): Promise<AuthContext | null> {
  if (!token) return null;
  const session = await findValidSession(hashToken(token));
  if (!session) return null;

  const user = await findUserById(session.userId);
  if (!user || user.status !== "active") return null;

  if (Date.now() - session.lastUsedAt.getTime() > TOUCH_INTERVAL_MS) {
    await touchSession(session._id, new Date(Date.now() + ttlSeconds(session.persistent) * 1000));
  }

  return {
    userId: user._id.toString(),
    sessionId: session._id.toString(),
    user: { id: user._id.toString(), email: user.email, name: user.name },
  };
}
