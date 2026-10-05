import { describe, expect, it } from "vitest";
import { describeUserAgent, lastActiveLabel } from "@/lib/user-agent";

describe("describeUserAgent", () => {
  it.each([
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36",
      "Chrome on Windows",
      "laptop",
    ],
    [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/129.0 Safari/537.36 Edg/129.0",
      "Edge on Windows",
      "laptop",
    ],
    [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15",
      "Safari on macOS",
      "laptop",
    ],
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1",
      "Safari on iOS",
      "phone",
    ],
    [
      "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1",
      "Safari on iOS",
      "tablet",
    ],
    [
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/129.0 Mobile Safari/537.36",
      "Chrome on Android",
      "phone",
    ],
    [
      "Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0",
      "Firefox on Linux",
      "laptop",
    ],
  ])("%s", (ua, label, kind) => {
    expect(describeUserAgent(ua)).toEqual({ label, kind });
  });

  it("falls back for missing or unknown agents", () => {
    expect(describeUserAgent(null).label).toBe("Unknown device");
    expect(describeUserAgent("curl/8.0").label).toBe("Unknown device");
    expect(describeUserAgent("vitest").label).toBe("Unknown device");
  });
});

describe("lastActiveLabel", () => {
  const now = new Date("2026-10-05T12:00:00Z");
  const ago = (ms: number) => new Date(now.getTime() - ms);
  it("reads naturally at each scale", () => {
    expect(lastActiveLabel(ago(60_000), now)).toBe("Active now");
    expect(lastActiveLabel(ago(30 * 60_000), now)).toBe("Last active 30 minutes ago");
    expect(lastActiveLabel(ago(3_600_000), now)).toBe("Last active 1 hour ago");
    expect(lastActiveLabel(ago(2 * 3_600_000), now)).toBe("Last active 2 hours ago");
    expect(lastActiveLabel(ago(3 * 24 * 3_600_000), now)).toBe("Last active 3 days ago");
  });
});
