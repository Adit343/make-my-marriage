import "server-only";
import {
  buildAuthorizationUrl,
  exchangeCodeForIdToken,
  verifyGoogleIdToken,
  type GoogleIdentity,
} from "@/infrastructure/oauth/google";
import { getEnv } from "@/lib/env";
import { seal, unseal } from "@/lib/crypto/seal";
import { generateToken, pkceChallenge, safeEqual } from "@/lib/crypto/tokens";
import { isDuplicateKeyError } from "@/lib/errors";
import { readCookie, type CookieToSet } from "@/lib/http/cookies";
import { logger } from "@/lib/logger";
import { startSession } from "@/modules/auth/session.service";
import {
  createUser,
  emailIsRegistered,
  findUserByEmail,
  findUserByGoogleSub,
  linkGoogleIdentity,
  recordLogin,
} from "@/modules/users/user.repository";

// Google sign-in (API Design §4.4). The state, PKCE verifier and nonce travel in a short-lived
// encrypted HttpOnly cookie (decision C8) rather than a new collection.

const OAUTH_COOKIE = "mmm_oauth";
/** Scoped so the cookie is only sent to /api/v1/auth/google and its /callback. */
const OAUTH_COOKIE_PATH = "/api/v1/auth/google";
const OAUTH_TTL_SECONDS = 10 * 60;
const SEAL_PURPOSE = "google-oauth";

/** Reasons surfaced to the login page as ?error=… (never provider details). */
export type GoogleSignInError =
  "oauth_unavailable" | "oauth_failed" | "email_exists_password" | "account_unavailable";

interface OAuthState {
  state: string;
  codeVerifier: string;
  nonce: string;
}

interface Outcome {
  redirect: string;
  cookies: CookieToSet[];
}

function oauthCookie(value: string, maxAge: number): CookieToSet {
  return {
    name: OAUTH_COOKIE,
    value,
    maxAge,
    path: OAUTH_COOKIE_PATH,
    httpOnly: true,
    secure: getEnv().NODE_ENV === "production",
    // Lax: the callback is a top-level GET navigation from Google, so the cookie is sent.
    sameSite: "Lax",
  };
}

function googleConfig() {
  const env = getEnv();
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return null;
  return {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    redirectUri: new URL("/api/v1/auth/google/callback", env.APP_URL).toString(),
    secret: env.SESSION_SECRET,
  };
}

function failure(reason: GoogleSignInError): Outcome {
  return { redirect: `/login?error=${reason}`, cookies: [oauthCookie("", 0)] };
}

export function startGoogleSignIn(): Outcome {
  const config = googleConfig();
  if (!config) return failure("oauth_unavailable");

  const stored: OAuthState = {
    state: generateToken(),
    codeVerifier: generateToken(),
    nonce: generateToken(),
  };
  return {
    redirect: buildAuthorizationUrl({
      clientId: config.clientId,
      redirectUri: config.redirectUri,
      state: stored.state,
      nonce: stored.nonce,
      codeChallenge: pkceChallenge(stored.codeVerifier),
    }),
    cookies: [
      oauthCookie(seal(stored, config.secret, SEAL_PURPOSE, OAUTH_TTL_SECONDS), OAUTH_TTL_SECONDS),
    ],
  };
}

export async function completeGoogleSignIn(
  request: Request,
  query: { code?: string; state?: string; error?: string },
): Promise<Outcome> {
  const config = googleConfig();
  if (!config) return failure("oauth_unavailable");
  if (query.error || !query.code || !query.state) return failure("oauth_failed");

  const sealed = readCookie(request, OAUTH_COOKIE);
  const stored = sealed ? unseal<OAuthState>(sealed, config.secret, SEAL_PURPOSE) : null;
  if (!stored || !safeEqual(stored.state, query.state)) return failure("oauth_failed");

  let identity: GoogleIdentity;
  try {
    const idToken = await exchangeCodeForIdToken({
      code: query.code,
      codeVerifier: stored.codeVerifier,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: config.redirectUri,
    });
    identity = await verifyGoogleIdToken(idToken, {
      clientId: config.clientId,
      nonce: stored.nonce,
    });
  } catch (error) {
    logger.warn("auth.google_verification_failed", { error });
    return failure("oauth_failed");
  }
  if (!identity.emailVerified) return failure("oauth_failed");

  const user = await resolveGoogleUser(identity);
  if (typeof user === "string") return failure(user);

  await recordLogin(user._id);
  const { cookie } = await startSession(user._id, {
    persistent: true,
    userAgent: request.headers.get("user-agent"),
  });
  return { redirect: "/dashboard", cookies: [oauthCookie("", 0), cookie] };
}

/**
 * Finds or creates the account for a verified Google identity. Pre-hijacking guard
 * (DB Design §6.1 rule 3): if the email already belongs to a PASSWORD account, never attach
 * Google to it automatically — whoever set that password could otherwise keep access.
 */
async function resolveGoogleUser(identity: GoogleIdentity) {
  const linked = await findUserByGoogleSub(identity.sub);
  if (linked) return linked.status === "active" ? linked : "account_unavailable";

  const existing = await findUserByEmail(identity.email, { withPassword: true });
  if (existing) {
    if (existing.passwordAuth) return "email_exists_password";
    if (existing.status !== "active") return "account_unavailable";
    await linkGoogleIdentity(existing._id, { sub: identity.sub, email: identity.email });
    return existing;
  }

  // A soft-deleted account keeps its email reserved until anonymization.
  if (await emailIsRegistered(identity.email)) return "account_unavailable";

  try {
    return await createUser({
      email: identity.email,
      name: identity.name,
      google: { sub: identity.sub, email: identity.email },
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) return "account_unavailable";
    throw error;
  }
}
