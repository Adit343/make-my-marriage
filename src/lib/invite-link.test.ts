import { describe, expect, it } from "vitest";
import { joinPath, parseInviteToken } from "@/lib/invite-link";

const TOKEN = "Abc123_-".repeat(5); // 40 chars, base64url

describe("parseInviteToken", () => {
  it("accepts a bare token and a full link, with or without trailing noise", () => {
    expect(parseInviteToken(TOKEN)).toBe(TOKEN);
    expect(parseInviteToken(`  ${TOKEN}\n`)).toBe(TOKEN);
    expect(parseInviteToken(`https://app.example.com/join/${TOKEN}`)).toBe(TOKEN);
    expect(parseInviteToken(`https://app.example.com/join/${TOKEN}/`)).toBe(TOKEN);
    expect(parseInviteToken(`http://localhost:3000/join/${TOKEN}?utm=x#top`)).toBe(TOKEN);
  });

  it("rejects anything else", () => {
    for (const value of [
      "",
      "short",
      "has spaces in it but is long enough to pass length",
      `${TOKEN}/../etc`,
      `https://evil.example/redirect?to=/join/${TOKEN}x/y`,
      "javascript:alert(1)",
      undefined,
      null,
      42,
      ["a"],
    ]) {
      expect(parseInviteToken(value), String(value)).toBeUndefined();
    }
  });
});

describe("joinPath", () => {
  it("only ever builds an in-app /join/<token> path", () => {
    expect(joinPath(TOKEN)).toBe(`/join/${TOKEN}`);
    expect(joinPath(`https://evil.example/join/${TOKEN}`)).toBe(`/join/${TOKEN}`);
    expect(joinPath("//evil.example")).toBeUndefined();
  });
});
