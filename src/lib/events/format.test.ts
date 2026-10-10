import { describe, expect, it } from "vitest";
import {
  calendarDayIn,
  formatClock,
  formatDateBlock,
  formatDuration,
  formatLongDate,
  formatScheduleTime,
  formatTimeRange,
  fullAddress,
  mapsUrl,
  nextEventLabel,
  venueLine,
} from "@/lib/events/format";

const IST = "Asia/Kolkata";
const at = (iso: string) => new Date(iso);

describe("times in the event's own timezone", () => {
  it("shows a time range with the zone's abbreviation", () => {
    // 2027-02-12 14:00–18:00 IST
    expect(formatTimeRange(at("2027-02-12T08:30:00Z"), at("2027-02-12T12:30:00Z"), IST)).toBe(
      "02:00 PM – 06:00 PM IST",
    );
  });

  it("says Midnight when the event ends at 12:00 AM", () => {
    // 19:30 IST → 00:00 IST next day
    expect(formatTimeRange(at("2027-02-13T14:00:00Z"), at("2027-02-13T18:30:00Z"), IST)).toBe(
      "07:30 PM – Midnight IST",
    );
  });

  it("shows only the start when there is no end, and drops the leading zero on request", () => {
    expect(formatTimeRange(at("2027-02-13T04:30:00Z"), null, IST)).toBe("10:00 AM IST");
    expect(
      formatTimeRange(at("2027-02-13T04:30:00Z"), at("2027-02-13T07:30:00Z"), IST, false),
    ).toBe("10:00 AM – 1:00 PM IST");
    expect(formatClock(at("2027-02-13T07:30:00Z"), IST, false)).toBe("1:00 PM");
  });

  it("uses the event's zone, not the server's", () => {
    expect(formatClock(at("2027-02-13T14:00:00Z"), "Asia/Dubai")).toBe("06:00 PM");
    expect(formatClock(at("2027-02-13T14:00:00Z"), IST)).toBe("07:30 PM");
  });
});

describe("dates", () => {
  it("builds the timeline date block", () => {
    expect(formatDateBlock(at("2027-02-12T08:30:00Z"), IST)).toEqual({
      day: "12",
      monthYear: "FEB 2027",
      weekday: "Friday",
    });
  });

  it("puts a late-evening event on the day it happens in its own zone", () => {
    // 23:30 IST on the 13th is still the 13th, though it is 18:00 UTC.
    expect(formatDateBlock(at("2027-02-13T18:00:00Z"), IST).day).toBe("13");
    expect(calendarDayIn(at("2027-02-13T18:30:00Z"), IST)).toBe("2027-02-14");
  });

  it("writes the long date like the detail screen", () => {
    expect(formatLongDate(at("2027-02-13T04:30:00Z"), IST)).toBe("Saturday, 13 February 2027");
  });
});

describe("formatDuration", () => {
  const start = at("2027-02-13T04:30:00Z");
  const after = (minutes: number) => new Date(start.getTime() + minutes * 60_000);

  it.each([
    [45, "45 Min"],
    [60, "1 Hour"],
    [180, "3 Hours"],
    [210, "3 Hours 30 Min"],
    [24 * 60, "1 Day"],
    [48 * 60, "2 Days"],
  ])("%i minutes → %s", (minutes, text) => {
    expect(formatDuration(start, after(minutes))).toBe(text);
  });

  it("has no duration without an end or for an end before the start", () => {
    expect(formatDuration(start, null)).toBeNull();
    expect(formatDuration(start, after(-5))).toBeNull();
  });
});

describe("venue text", () => {
  const location = {
    label: "Family Home",
    address: {
      line1: "14 Bungalow Road, Piplod",
      city: "Surat",
      state: "Gujarat",
      postalCode: "395007",
    },
  };

  it("joins the venue name, street and city once", () => {
    expect(venueLine(location)).toBe("Family Home, 14 Bungalow Road, Piplod, Surat");
    expect(venueLine({ label: "Surat", address: { city: "surat" } })).toBe("Surat");
  });

  it("is null when there is no venue", () => {
    expect(venueLine(null)).toBeNull();
    expect(venueLine({})).toBeNull();
  });

  it("writes the full address and a maps link", () => {
    expect(fullAddress(location)).toBe("14 Bungalow Road, Piplod, Surat, Gujarat 395007");
    expect(mapsUrl(location)).toBe(
      "https://www.google.com/maps/search/?api=1&query=Family%20Home%2C%2014%20Bungalow%20Road%2C%20Piplod%2C%20Surat%2C%20Gujarat%20395007",
    );
    expect(mapsUrl({ coordinates: { latitude: 21.1415, longitude: 72.7712 } })).toContain(
      "query=21.1415,72.7712",
    );
    expect(mapsUrl(null)).toBeNull();
  });
});

describe("nextEventLabel", () => {
  const now = at("2027-01-01T06:30:00Z");
  const event = (startsAt: string, endsAt: string | null = null) => ({
    startsAt: at(startsAt),
    endsAt: endsAt ? at(endsAt) : null,
    timezone: IST,
  });

  it("counts days to the first event", () => {
    expect(nextEventLabel([event("2027-02-12T08:30:00Z")], now)).toEqual({
      text: "First event in ",
      strong: "42 days",
    });
  });

  it("says Next event once some have passed, and today/tomorrow near the date", () => {
    expect(
      nextEventLabel([event("2026-12-20T08:30:00Z"), event("2027-01-02T08:30:00Z")], now),
    ).toEqual({ text: "Next event is ", strong: "tomorrow" });
    expect(nextEventLabel([event("2027-01-01T10:30:00Z")], now)).toEqual({
      text: "First event is ",
      strong: "today",
    });
  });

  it("copes with no events and with all events passed", () => {
    expect(nextEventLabel([], now).strong).toBe("No events yet");
    expect(nextEventLabel([event("2026-12-20T08:30:00Z")], now).strong).toBe(
      "All events have passed",
    );
  });
});

describe("formatScheduleTime", () => {
  it.each([
    ["07:00", "7:00 AM"],
    ["09:30", "9:30 AM"],
    ["12:00", "12:00 PM"],
    ["13:05", "1:05 PM"],
    ["00:00", "12:00 AM"],
    ["23:59", "11:59 PM"],
  ])("%s → %s", (time, label) => {
    expect(formatScheduleTime(time)).toBe(label);
  });
});
