import "server-only";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

// Google OAuth 2.0 / OpenID Connect, authorization-code flow with PKCE (Architecture §11).
// Protocol mechanics only; account rules live in modules/auth/google.service.ts.

const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

export function buildAuthorizationUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  nonce: string;
  codeChallenge: string;
}): string {
  const url = new URL(AUTHORIZE_URL);
  url.search = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state: input.state,
    nonce: input.nonce,
    code_challenge: input.codeChallenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  return url.toString();
}

/** Server-to-server code exchange; the client secret never reaches the browser. */
export async function exchangeCodeForIdToken(input: {
  code: string;
  codeVerifier: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<string> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: input.code,
      code_verifier: input.codeVerifier,
      client_id: input.clientId,
      client_secret: input.clientSecret,
      redirect_uri: input.redirectUri,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const body = (await response.json().catch(() => null)) as { id_token?: unknown } | null;
  if (!response.ok || typeof body?.id_token !== "string") {
    throw new Error(`Google token exchange failed (HTTP ${response.status})`);
  }
  return body.id_token;
}

export interface GoogleIdentity {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
}

let jwks: JWTVerifyGetKey | undefined;

/** Tests verify against a locally generated key set instead of Google's. */
export function setGoogleJwksForTests(keySet: JWTVerifyGetKey | undefined) {
  jwks = keySet;
}

/** Verifies signature, issuer, audience, expiry and the nonce we issued. */
export async function verifyGoogleIdToken(
  idToken: string,
  expected: { clientId: string; nonce: string },
): Promise<GoogleIdentity> {
  jwks ??= createRemoteJWKSet(new URL(JWKS_URL));
  const { payload } = await jwtVerify(idToken, jwks, {
    issuer: ISSUERS,
    audience: expected.clientId,
    algorithms: ["RS256"],
  });
  if (payload.nonce !== expected.nonce) throw new Error("Google ID token nonce mismatch");
  if (typeof payload.sub !== "string" || typeof payload.email !== "string") {
    throw new Error("Google ID token is missing sub or email");
  }
  const name = typeof payload.name === "string" && payload.name.trim() ? payload.name.trim() : null;
  return {
    sub: payload.sub,
    email: payload.email,
    emailVerified: payload.email_verified === true,
    name: (name ?? payload.email.split("@")[0] ?? "Guest").slice(0, 100),
  };
}
