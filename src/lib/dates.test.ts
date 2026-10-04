import { describe, expect, it } from "vitest";
import { daysUntil, formatCalendarDate, todayIn } from "@/lib/dates";

describe("calendar dates", () => {
  it("uses the wedding's timezone to decide what 'today' is", () => {
    // 20:00 UTC on 11 Dec is already 01:30 on 12 Dec in India.
    const now = new Date("2025-12-11T20:00:00Z");
    expect(todayIn("Asia/Kolkata", now)).toBe("2025-12-12");
    expect(todayIn("America/New_York", now)).toBe("2025-12-11");
  });

  it("counts whole days until the wedding, zero on the day and negative after", () => {
    const now = new Date("2025-09-29T06:00:00Z");
    expect(daysUntil("2025-12-12", "Asia/Kolkata", now)).toBe(74);
    expect(daysUntil("2025-09-29", "Asia/Kolkata", now)).toBe(0);
    expect(daysUntil("2025-09-28", "Asia/Kolkata", now)).toBe(-1);
  });

  it("formats calendar days without shifting them across timezones", () => {
    expect(formatCalendarDate("2025-12-12")).toBe("December 12, 2025");
    expect(formatCalendarDate("2027-02-01")).toBe("February 1, 2027");
  });
});
