import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "@/lib/crypto/secret-box";

const KEY = "k".repeat(40);

describe("secret box", () => {
  it("round-trips a value and never repeats the ciphertext", () => {
    const a = encryptSecret("my-token", KEY);
    const b = encryptSecret("my-token", KEY);
    expect(a).not.toContain("my-token");
    expect(a).not.toBe(b);
    expect(decryptSecret(a, KEY)).toBe("my-token");
  });

  it("returns null for the wrong key, tampering or garbage", () => {
    const sealed = encryptSecret("my-token", KEY);
    expect(decryptSecret(sealed, "z".repeat(40))).toBeNull();
    expect(decryptSecret(sealed.slice(0, -2) + "AA", KEY)).toBeNull();
    expect(decryptSecret("nope", KEY)).toBeNull();
    expect(decryptSecret("", KEY)).toBeNull();
  });
});
