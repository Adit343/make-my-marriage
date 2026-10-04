import { afterEach, describe, expect, it, vi } from "vitest";
import { logger, redact } from "@/lib/logger";

describe("redact()", () => {
  it("masks sensitive keys at any depth", () => {
    expect(
      redact({
        email: "priya@gmail.com",
        password: "Str0ngPass!23",
        session: { tokenHash: "9f2c", userAgent: "Safari" },
        headers: [{ Authorization: "Bearer x", cookie: "mmm_session=abc" }],
        RESEND_API_KEY: "re_123",
        clientSecret: "shh",
      }),
    ).toEqual({
      email: "priya@gmail.com",
      password: "[REDACTED]",
      session: { tokenHash: "[REDACTED]", userAgent: "Safari" },
      headers: [{ Authorization: "[REDACTED]", cookie: "[REDACTED]" }],
      RESEND_API_KEY: "[REDACTED]",
      clientSecret: "[REDACTED]",
    });
  });

  it("serializes errors with their stack", () => {
    const result = redact(new Error("boom")) as Record<string, unknown>;
    expect(result).toMatchObject({ name: "Error", message: "boom" });
    expect(result.stack).toContain("boom");
  });
});

describe("logger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("writes one JSON line with level, event and timestamp", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    logger.warn("auth.login_failed", { userId: "u1", password: "nope" });

    const line = JSON.parse(spy.mock.calls[0]?.[0] as string);
    expect(line).toMatchObject({
      level: "WARN",
      event: "auth.login_failed",
      userId: "u1",
      password: "[REDACTED]",
    });
    expect(Date.parse(line.timestamp)).not.toBeNaN();
  });
});
