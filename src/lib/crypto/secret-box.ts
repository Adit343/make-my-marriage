import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

// Reversible encryption (AES-256-GCM) for secrets the server must be able to show again, such as a
// guest's RSVP link token (DB Design §5.3, `tokenEnc`). Unlike seal(), there is no expiry. The key
// is derived with HKDF from TOKEN_ENCRYPTION_KEY, so the raw value is never used directly.
// Format: "v1.<iv>.<authTag>.<ciphertext>" (base64url).

const VERSION = "v1";

function deriveKey(secret: string): Buffer {
  return Buffer.from(hkdfSync("sha256", secret, "make-my-marriage", "guest-link-token", 32));
}

export function encryptSecret(plaintext: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(secret), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [
    VERSION,
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

/** The plaintext, or null if the value is malformed, tampered with, or encrypted under another key. */
export function decryptSecret(sealed: string, secret: string): string | null {
  const [version, iv, tag, ciphertext] = sealed.split(".");
  if (version !== VERSION || !iv || !tag || !ciphertext) return null;
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      deriveKey(secret),
      Buffer.from(iv, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}
