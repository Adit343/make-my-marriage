import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, securityHeaders } from "@/lib/security-headers";

const directive = (policy: string, name: string) =>
  policy
    .split("; ")
    .find((part) => part.startsWith(`${name} `))
    ?.slice(name.length + 1)
    .split(" ") ?? [];

describe("contentSecurityPolicy", () => {
  const production = contentSecurityPolicy({ development: false });
  const development = contentSecurityPolicy({ development: true });

  it("forbids framing, plugins, <base> hijacking and off-site form posts", () => {
    expect(directive(production, "frame-ancestors")).toEqual(["'none'"]);
    expect(directive(production, "object-src")).toEqual(["'none'"]);
    expect(directive(production, "base-uri")).toEqual(["'self'"]);
    expect(directive(production, "form-action")).toEqual(["'self'"]);
    expect(directive(production, "default-src")).toEqual(["'self'"]);
  });

  it("allows only Google Fonts as a third party", () => {
    expect(directive(production, "style-src")).toContain("https://fonts.googleapis.com");
    expect(directive(production, "font-src")).toContain("https://fonts.gstatic.com");
    const origins = production.match(/https?:\/\/[^\s;]+/g) ?? [];
    expect(origins.sort()).toEqual(["https://fonts.googleapis.com", "https://fonts.gstatic.com"]);
    expect(production).not.toContain("*");
  });

  it("keeps eval and websockets out of production", () => {
    expect(directive(production, "script-src")).not.toContain("'unsafe-eval'");
    expect(directive(production, "connect-src")).toEqual(["'self'"]);
    expect(production).toContain("upgrade-insecure-requests");
    expect(directive(development, "script-src")).toContain("'unsafe-eval'");
    expect(development).not.toContain("upgrade-insecure-requests");
  });
});

describe("securityHeaders", () => {
  it("sends the full set on every response", () => {
    const keys = securityHeaders({ development: false }).map((header) => header.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        "Strict-Transport-Security",
        "X-Content-Type-Options",
        "X-Frame-Options",
        "Referrer-Policy",
        "Content-Security-Policy",
        "Permissions-Policy",
        "Cross-Origin-Opener-Policy",
      ]),
    );
  });
});
