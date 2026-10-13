import { describe, expect, it } from "vitest";
import { assertSameOrigin } from "@/lib/http/origin";

const req = (method: string, origin?: string) =>
  new Request("https://app.example.com/api/v1/x", {
    method,
    headers: origin === undefined ? {} : { origin },
  });

describe("assertSameOrigin", () => {
  it("allows reads from anywhere", () => {
    expect(() => assertSameOrigin(req("GET", "https://evil.example"), null)).not.toThrow();
  });
  it("allows writes with no Origin header", () => {
    expect(() => assertSameOrigin(req("POST"), null)).not.toThrow();
  });
  it("allows writes from this site or the configured app address", () => {
    expect(() => assertSameOrigin(req("POST", "https://app.example.com"), null)).not.toThrow();
    expect(() =>
      assertSameOrigin(req("DELETE", "https://www.example.com"), "https://www.example.com/"),
    ).not.toThrow();
  });
  it("refuses cross-site and opaque origins on writes", () => {
    for (const method of ["POST", "PATCH", "PUT", "DELETE"]) {
      expect(() => assertSameOrigin(req(method, "https://evil.example"), null)).toThrow(
        /Cross-site/,
      );
    }
    expect(() => assertSameOrigin(req("POST", "null"), null)).toThrow(/Cross-site/);
  });
});
