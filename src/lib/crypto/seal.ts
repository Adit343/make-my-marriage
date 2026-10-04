import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

// Authenticated encryption (AES-256-GCM) for small server-only payloads that must round-trip
// through the browser — the Google OAuth state/PKCE cookie (decision C8). The key is derived from
// SESSION_SECRET with HKDF, separately per purpose, so one secret never doubles as two keys.

const VERSION = "v1";

function deriveKey(secret: string, purpose: string): Buffer {
  return Buffer.from(hkdfSync("sha256", secret, "make-my-marriage", purpose, 32));
}

export function seal(
  payload: unknown,
  secret: string,
  purpose: string,
  ttlSeconds: number,
): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(secret, purpose), iv);
  const body = JSON.stringify({ payload, exp: Date.now() + ttlSeconds * 1000 });
  const ciphertext = Buffer.concat([cipher.update(body, "utf8"), cipher.final()]);
  return [VERSION, iv, cipher.getAuthTag(), ciphertext]
    .map((part) => (typeof part === "string" ? part : part.toString("base64url")))
    .join(".");
}

/** Returns the payload, or null if the value is malformed, tampered with or expired. */
export function unseal<T>(sealed: string, secret: string, purpose: string): T | null {
  const [version, iv, tag, ciphertext] = sealed.split(".");
  if (version !== VERSION || !iv || !tag || !ciphertext) return null;
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      deriveKey(secret, purpose),
      Buffer.from(iv, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    const body = Buffer.concat([
      decipher.update(Buffer.from(ciphertext, "base64url")),
      decipher.final(),
    ]).toString("utf8");
    const { payload, exp } = JSON.parse(body) as { payload: T; exp: number };
    return Date.now() < exp ? payload : null;
  } catch {
    return null;
  }
}
