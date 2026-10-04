import { afterEach, describe, expect, it, vi } from "vitest";
import {
  hashPassword,
  needsRehash,
  verifyAgainstDummy,
  verifyPassword,
} from "@/lib/crypto/password";
import { seal, unseal } from "@/lib/crypto/seal";
import { generateToken, hashToken } from "@/lib/crypto/tokens";

describe("tokens", () => {
  it("generates 256-bit base64url tokens and hashes them deterministically", () => {
    const token = generateToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(generateToken()).not.toBe(token);
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(token)).toBe(hashToken(token));
  });
});

describe("password hashing", () => {
  it("verifies the right password and rejects others", async () => {
    const stored = await hashPassword("Str0ngPass!23");
    expect(stored).toMatchObject({
      algorithm: "scrypt",
      version: 1,
      params: { N: 32768, r: 8, p: 1, keyLen: 64 },
    });
    expect(await verifyPassword("Str0ngPass!23", stored)).toBe(true);
    expect(await verifyPassword("Str0ngPass!24", stored)).toBe(false);
  });

  it("salts every hash", async () => {
    const [a, b] = await Promise.all([
      hashPassword("same-password"),
      hashPassword("same-password"),
    ]);
    expect(a.hash).not.toBe(b.hash);
  });

  it("treats Unicode-equivalent passwords as the same password", async () => {
    const stored = await hashPassword("José-password");
    expect(await verifyPassword("José-password", stored)).toBe(true);
  });

  it("flags hashes made with older parameters for upgrade", async () => {
    const stored = await hashPassword("whatever-password");
    expect(needsRehash(stored)).toBe(false);
    expect(needsRehash({ ...stored, version: 0 })).toBe(true);
  });

  it("always fails the dummy verification used for unknown accounts", async () => {
    expect(await verifyAgainstDummy("anything")).toBe(false);
  });
});

describe("seal / unseal", () => {
  const secret = "x".repeat(43);

  afterEach(() => {
    vi.useRealTimers();
  });

  it("round-trips a payload", () => {
    const sealed = seal({ state: "abc", verifier: "def" }, secret, "oauth", 600);
    expect(unseal(sealed, secret, "oauth")).toEqual({ state: "abc", verifier: "def" });
  });

  it("rejects tampering, the wrong purpose, the wrong secret and expiry", () => {
    const sealed = seal({ state: "abc" }, secret, "oauth", 600);
    const parts = sealed.split(".");
    const ciphertext = parts[3]!;
    const changed = `${ciphertext[0] === "A" ? "B" : "A"}${ciphertext.slice(1)}`;
    const flipped = [parts[0], parts[1], parts[2], changed].join(".");

    expect(unseal(flipped, secret, "oauth")).toBeNull();
    expect(unseal(sealed, secret, "other-purpose")).toBeNull();
    expect(unseal(sealed, "y".repeat(43), "oauth")).toBeNull();
    expect(unseal("garbage", secret, "oauth")).toBeNull();

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 601_000);
    expect(unseal(sealed, secret, "oauth")).toBeNull();
  });
});
