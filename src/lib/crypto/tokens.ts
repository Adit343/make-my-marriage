import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

// Opaque tokens for sessions, invitations and reset links (DB Design §3.5): 32 random bytes,
// base64url for the user, SHA-256 hex for storage. SHA-256 is enough here (unlike passwords)
// because a 256-bit random token has nothing to brute-force.

export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Constant-time string comparison for secrets such as OAuth state values. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

/** PKCE S256 code challenge for a verifier (RFC 7636). */
export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier, "ascii").digest("base64url");
}
