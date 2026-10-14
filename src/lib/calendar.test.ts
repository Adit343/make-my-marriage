import { describe, expect, it } from "vitest";
import {
  addDaysTo,
  addMonths,
  displayDate,
  displayTime,
  from12Hour,
  joinDateTime,
  monthGrid,
  parseDate,
  parseTime,
  splitDateTime,
  to12Hour,
  toDateString,
  weekdayOf,
} from "@/lib/calendar";

describe("parseDate", () => {
  it("accepts real calendar days only", () => {
    expect(parseDate("2027-02-14")).toEqual({ y: 2027, m: 2, d: 14 });
    expect(parseDate("2028-02-29")).toEqual({ y: 2028, m: 2, d: 29 });
    expect(parseDate("2027-02-29")).toBeNull();
    expect(parseDate("2027-13-01")).toBeNull();
    expect(parseDate("2027-1-1")).toBeNull();
    expect(parseDate("")).toBeNull();
    expect(parseDate(undefined)).toBeNull();
  });
});

describe("addMonths", () => {
  it("keeps the day where it exists and clamps where it does not", () => {
    expect(addMonths({ y: 2027, m: 1, d: 31 }, 1)).toEqual({ y: 2027, m: 2, d: 28 });
    expect(addMonths({ y: 2028, m: 1, d: 31 }, 1)).toEqual({ y: 2028, m: 2, d: 29 });
    expect(addMonths({ y: 2027, m: 12, d: 15 }, 1)).toEqual({ y: 2028, m: 1, d: 15 });
    expect(addMonths({ y: 2027, m: 1, d: 15 }, -1)).toEqual({ y: 2026, m: 12, d: 15 });
    expect(addMonths({ y: 2027, m: 3, d: 10 }, 24)).toEqual({ y: 2029, m: 3, d: 10 });
  });
});

describe("addDaysTo and weekdayOf", () => {
  it("crosses month and year ends", () => {
    expect(addDaysTo({ y: 2027, m: 12, d: 31 }, 1)).toEqual({ y: 2028, m: 1, d: 1 });
    expect(addDaysTo({ y: 2027, m: 3, d: 1 }, -1)).toEqual({ y: 2027, m: 2, d: 28 });
  });
  it("numbers weekdays from Sunday", () => {
    expect(weekdayOf(2027, 2, 14)).toBe(0); // 14 Feb 2027 is a Sunday
    expect(weekdayOf(2027, 2, 15)).toBe(1);
  });
});

describe("monthGrid", () => {
  it("is always 42 days, starting on the Sunday on or before the 1st", () => {
    const grid = monthGrid(2027, 2);
    expect(grid).toHaveLength(42);
    expect(toDateString(grid[0]!)).toBe("2027-01-31");
    expect(grid.some((day) => toDateString(day) === "2027-02-28")).toBe(true);
    expect(monthGrid(2027, 8)).toHaveLength(42);
  });
});

describe("display helpers", () => {
  it("formats a date and a time for the field", () => {
    expect(displayDate("2027-02-14")).toBe("14 Feb 2027");
    expect(displayDate("nonsense")).toBe("");
    expect(displayTime("07:00")).toBe("7:00 AM");
    expect(displayTime("00:05")).toBe("12:05 AM");
    expect(displayTime("12:00")).toBe("12:00 PM");
    expect(displayTime("18:30")).toBe("6:30 PM");
  });
});

describe("clock conversion", () => {
  it("round-trips every hour of the day", () => {
    for (let h = 0; h < 24; h++) {
      const { hour, meridiem } = to12Hour(h);
      expect(from12Hour(hour, meridiem)).toBe(h);
    }
  });
  it("parses strict 24-hour times", () => {
    expect(parseTime("23:59")).toEqual({ h: 23, min: 59 });
    expect(parseTime("24:00")).toBeNull();
    expect(parseTime("9:00")).toBeNull();
  });
});

describe("date-time strings", () => {
  it("splits and joins the wall-clock value", () => {
    expect(splitDateTime("2027-02-14T10:30")).toEqual({ date: "2027-02-14", time: "10:30" });
    expect(splitDateTime("")).toEqual({ date: "", time: "" });
    expect(joinDateTime("2027-02-14", "10:30")).toBe("2027-02-14T10:30");
    expect(joinDateTime("2027-02-14", "")).toBe("2027-02-14T00:00");
    expect(joinDateTime("", "10:30")).toBe("");
  });
});
