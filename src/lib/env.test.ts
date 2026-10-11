import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getEnv, resetEnvCacheForTests } from "@/lib/env";

const VALID = {
  APP_URL: "http://localhost:3000",
  MONGODB_URI: "mongodb://localhost:27017/mmm-test",
  SESSION_SECRET: "x".repeat(43),
  GOOGLE_CLIENT_ID: "",
  RESEND_API_KEY: "",
};

describe("getEnv()", () => {
  beforeEach(() => {
    resetEnvCacheForTests();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetEnvCacheForTests();
  });

  function stub(values: Record<string, string>) {
    for (const [key, value] of Object.entries(values)) vi.stubEnv(key, value);
  }

  it("parses a valid environment and treats empty optional values as unset", () => {
    stub(VALID);
    const env = getEnv();
    expect(env.MONGODB_URI).toBe(VALID.MONGODB_URI);
    expect(env.GOOGLE_CLIENT_ID).toBeUndefined();
    expect(env.RESEND_API_KEY).toBeUndefined();
  });

  it("names invalid variables without echoing their values", () => {
    stub({ ...VALID, SESSION_SECRET: "too-short-secret-value" });
    expect(() => getEnv()).toThrow(/SESSION_SECRET/);
    expect(() => getEnv()).not.toThrow(/too-short-secret-value/);
  });
});

describe("TOKEN_ENCRYPTION_KEY", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    resetEnvCacheForTests();
  });

  it("is optional outside production", () => {
    for (const [key, value] of Object.entries(VALID)) vi.stubEnv(key, value);
    vi.stubEnv("NODE_ENV", "development");
    resetEnvCacheForTests();
    expect(getEnv().TOKEN_ENCRYPTION_KEY).toBeUndefined();
  });

  it("is required in production and must be long enough", () => {
    for (const [key, value] of Object.entries(VALID)) vi.stubEnv(key, value);
    vi.stubEnv("NODE_ENV", "production");
    resetEnvCacheForTests();
    expect(() => getEnv()).toThrow(/TOKEN_ENCRYPTION_KEY/);
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", "short");
    resetEnvCacheForTests();
    expect(() => getEnv()).toThrow(/at least 32/);
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", "k".repeat(40));
    resetEnvCacheForTests();
    expect(getEnv().TOKEN_ENCRYPTION_KEY).toHaveLength(40);
  });
});
