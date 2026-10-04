import { describe, expect, it } from "vitest";
import { getClientIp } from "@/lib/http/client-ip";
import { readCookie, serializeCookie } from "@/lib/http/cookies";

describe("cookies", () => {
  it("reads one cookie out of a header with several", () => {
    const request = new Request("http://localhost/", {
      headers: { cookie: "theme=dark; mmm_session=abc%2Bdef; other=1" },
    });
    expect(readCookie(request, "mmm_session")).toBe("abc+def");
    expect(readCookie(request, "missing")).toBeUndefined();
  });

  it("serializes secure defaults: HttpOnly and SameSite=Lax on path /", () => {
    expect(serializeCookie({ name: "a", value: "b c", maxAge: 60, secure: true })).toBe(
      "a=b%20c; Path=/; Max-Age=60; HttpOnly; Secure; SameSite=Lax",
    );
  });

  it("omits Max-Age for browser-session cookies and expires deleted ones", () => {
    expect(serializeCookie({ name: "a", value: "b" })).not.toContain("Max-Age");
    expect(serializeCookie({ name: "a", value: "", maxAge: 0 })).toContain(
      "Max-Age=0; Expires=Thu, 01 Jan 1970",
    );
  });
});

describe("getClientIp", () => {
  it("uses the first x-forwarded-for entry, then x-real-ip, then 'unknown'", () => {
    const ip = (headers: Record<string, string>) =>
      getClientIp(new Request("http://x/", { headers }));
    expect(ip({ "x-forwarded-for": "203.0.113.4, 10.0.0.1" })).toBe("203.0.113.4");
    expect(ip({ "x-real-ip": "198.51.100.7" })).toBe("198.51.100.7");
    expect(ip({})).toBe("unknown");
  });
});
