import { describe, expect, it } from "vitest";
import { instantToWallClock, wallClockToInstant } from "@/lib/zoned-time";

describe("wallClockToInstant", () => {
  it("reads India time (UTC+5:30, no daylight saving)", () => {
    expect(wallClockToInstant("2027-02-13T19:30", "Asia/Kolkata")?.toISOString()).toBe(
      "2027-02-13T14:00:00.000Z",
    );
  });

  it("reads Dubai, London and New York, including their winter/summer offsets", () => {
    expect(wallClockToInstant("2027-02-13T10:00", "Asia/Dubai")?.toISOString()).toBe(
      "2027-02-13T06:00:00.000Z",
    );
    expect(wallClockToInstant("2027-02-13T10:00", "Europe/London")?.toISOString()).toBe(
      "2027-02-13T10:00:00.000Z",
    );
    expect(wallClockToInstant("2027-07-13T10:00", "Europe/London")?.toISOString()).toBe(
      "2027-07-13T09:00:00.000Z",
    );
    expect(wallClockToInstant("2027-02-13T10:00", "America/New_York")?.toISOString()).toBe(
      "2027-02-13T15:00:00.000Z",
    );
    expect(wallClockToInstant("2027-07-13T10:00", "America/New_York")?.toISOString()).toBe(
      "2027-07-13T14:00:00.000Z",
    );
  });

  it("handles midnight and a late-night time", () => {
    expect(wallClockToInstant("2027-02-14T00:00", "Asia/Kolkata")?.toISOString()).toBe(
      "2027-02-13T18:30:00.000Z",
    );
    expect(wallClockToInstant("2027-02-13T23:59", "Asia/Kolkata")?.toISOString()).toBe(
      "2027-02-13T18:29:00.000Z",
    );
  });

  it("resolves a time that daylight saving skips to a real nearby time rather than failing", () => {
    // 2027-03-14 02:30 does not exist in New York; clocks jump from 02:00 to 03:00.
    const instant = wallClockToInstant("2027-03-14T02:30", "America/New_York");
    expect(instant).not.toBeNull();
    const shown = instantToWallClock(instant!, "America/New_York");
    expect(["2027-03-14T01:30", "2027-03-14T03:30"]).toContain(shown);
  });

  it.each(["", "2027-02-13", "2027-02-13 19:30", "2027-02-30T10:00", "2027-02-13T24:00", "x"])(
    "returns null for %j",
    (text) => {
      expect(wallClockToInstant(text, "Asia/Kolkata")).toBeNull();
    },
  );
});

describe("instantToWallClock", () => {
  it("is the inverse of wallClockToInstant", () => {
    for (const zone of ["Asia/Kolkata", "Asia/Dubai", "Europe/London", "America/New_York"]) {
      const wall = "2027-02-13T19:30";
      const instant = wallClockToInstant(wall, zone)!;
      expect(instantToWallClock(instant, zone)).toBe(wall);
    }
  });

  it("shows the same instant differently in different zones", () => {
    const instant = new Date("2027-02-13T14:00:00Z");
    expect(instantToWallClock(instant, "Asia/Kolkata")).toBe("2027-02-13T19:30");
    expect(instantToWallClock(instant, "Asia/Dubai")).toBe("2027-02-13T18:00");
  });
});
