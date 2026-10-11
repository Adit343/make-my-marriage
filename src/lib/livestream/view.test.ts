import { describe, expect, it } from "vitest";
import { startedAgoLabel, startsInLabel, zoneLabel } from "@/lib/livestream/view";

const NOW = new Date("2027-02-12T04:00:00Z");
const at = (isoOffsetMs: number) => new Date(NOW.getTime() + isoOffsetMs);
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe("startsInLabel", () => {
  it("reads like the design: days and hours, hours and minutes, minutes", () => {
    expect(startsInLabel(at(2 * DAY + 3 * HOUR + 10 * MIN), NOW)).toBe("Starts in 2 days 3 hours");
    expect(startsInLabel(at(1 * DAY), NOW)).toBe("Starts in 1 day");
    expect(startsInLabel(at(1 * DAY + 1 * HOUR), NOW)).toBe("Starts in 1 day 1 hour");
    expect(startsInLabel(at(3 * HOUR + 20 * MIN), NOW)).toBe("Starts in 3 hours 20 minutes");
    expect(startsInLabel(at(2 * HOUR), NOW)).toBe("Starts in 2 hours");
    expect(startsInLabel(at(12 * MIN), NOW)).toBe("Starts in 12 minutes");
    expect(startsInLabel(at(1 * MIN + 30_000), NOW)).toBe("Starts in 1 minute");
  });

  it("says it is starting soon once it is due or late, never a negative time", () => {
    expect(startsInLabel(at(30_000), NOW)).toBe("Starting soon");
    expect(startsInLabel(at(0), NOW)).toBe("Starting soon");
    expect(startsInLabel(at(-2 * HOUR), NOW)).toBe("Starting soon");
  });

  it("accepts an ISO string", () => {
    expect(startsInLabel("2027-02-12T05:00:00Z", NOW)).toBe("Starts in 1 hour");
  });
});

describe("startedAgoLabel", () => {
  it("gives the largest sensible unit", () => {
    expect(startedAgoLabel(at(-10_000), NOW)).toBe("Started just now");
    expect(startedAgoLabel(at(-25 * MIN), NOW)).toBe("Started 25 minutes ago");
    expect(startedAgoLabel(at(-1 * MIN), NOW)).toBe("Started 1 minute ago");
    expect(startedAgoLabel(at(-3 * HOUR), NOW)).toBe("Started 3 hours ago");
    expect(startedAgoLabel(at(-2 * DAY), NOW)).toBe("Started 2 days ago");
  });
});

describe("zoneLabel", () => {
  it("names the zone with its offset from UTC", () => {
    expect(zoneLabel("Asia/Kolkata", NOW)).toBe("IST (UTC+5:30)");
    expect(zoneLabel("UTC", NOW)).toMatch(/\(UTC\)$/);
    expect(zoneLabel("America/New_York", NOW)).toMatch(/\(UTC-5\)$/);
    expect(zoneLabel("Asia/Dubai", NOW)).toMatch(/\(UTC\+4\)$/);
  });

  it("follows daylight saving at that moment", () => {
    expect(zoneLabel("America/New_York", new Date("2027-07-01T12:00:00Z"))).toMatch(/\(UTC-4\)$/);
    expect(zoneLabel("Europe/London", new Date("2027-07-01T12:00:00Z"))).toMatch(/\(UTC\+1\)$/);
  });
});
