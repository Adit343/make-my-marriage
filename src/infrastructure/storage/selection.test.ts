import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getStorage, setStorageForTests, storageStatus } from "@/infrastructure/storage";
import { getEnv, resetEnvCacheForTests } from "@/lib/env";

// Which photo store a server uses (Architecture Amendment A1): R2 when all four settings exist,
// the disk store in development and tests, and no store at all in production without R2.

const BASE = {
  APP_URL: "http://localhost:3000",
  MONGODB_URI: "mongodb://localhost:27017/mmm-test",
  SESSION_SECRET: "x".repeat(43),
  TOKEN_ENCRYPTION_KEY: "y".repeat(43),
  R2_ACCOUNT_ID: "",
  R2_ACCESS_KEY_ID: "",
  R2_SECRET_ACCESS_KEY: "",
  R2_BUCKET: "",
  LOCAL_STORAGE_DIR: "",
};
const R2 = {
  R2_ACCOUNT_ID: "abc123",
  R2_ACCESS_KEY_ID: "AKIA",
  R2_SECRET_ACCESS_KEY: "secret",
  R2_BUCKET: "photos",
};

function stub(values: Record<string, string>) {
  for (const [key, value] of Object.entries({ ...BASE, ...values })) vi.stubEnv(key, value);
  resetEnvCacheForTests();
}

describe("choosing the photo store", () => {
  beforeEach(() => setStorageForTests(null));
  afterEach(() => {
    vi.unstubAllEnvs();
    resetEnvCacheForTests();
    setStorageForTests(null);
  });

  it("uses the disk store in development and tests when R2 is not set", () => {
    stub({ NODE_ENV: "development" });
    expect(storageStatus()).toEqual({ configured: true, kind: "local" });
    expect(getStorage().name).toBe("local");
    stub({ NODE_ENV: "test" });
    expect(getStorage().name).toBe("local");
  });

  it("uses R2 whenever all four settings are present, in any mode", () => {
    for (const mode of ["development", "production"]) {
      stub({ NODE_ENV: mode, ...R2 });
      expect(storageStatus(), mode).toEqual({ configured: true, kind: "r2" });
      expect(getStorage().name, mode).toBe("r2");
    }
  });

  it("has no store in production without R2, and says so instead of using a temporary disk", () => {
    stub({ NODE_ENV: "production" });
    expect(storageStatus()).toEqual({ configured: false, kind: "none" });
    expect(() => getStorage()).toThrow("Photo storage isn't set up on this server yet.");
  });

  it("refuses a half-filled R2 setting, naming the variable but not its value", () => {
    stub({ NODE_ENV: "development", R2_ACCOUNT_ID: "abc123", R2_BUCKET: "photos" });
    expect(() => getEnv()).toThrow(/R2_BUCKET.*all of R2_ACCOUNT_ID/);
    expect(() => getEnv()).not.toThrow(/abc123/);
  });

  it("lets tests swap in their own store", () => {
    stub({ NODE_ENV: "production" });
    const fake = { name: "local" } as ReturnType<typeof getStorage>;
    setStorageForTests(fake);
    expect(getStorage()).toBe(fake);
    expect(storageStatus().configured).toBe(true);
  });

  it("gives the local store a signing secret that is not the session secret", async () => {
    stub({ NODE_ENV: "development" });
    const { localStorageSettings } = await import("@/infrastructure/storage");
    const settings = localStorageSettings();
    expect(settings.secret).not.toContain("x".repeat(10));
    expect(settings.secret).toHaveLength(43);
  });
});
