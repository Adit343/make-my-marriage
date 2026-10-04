// Calendar-day helpers. Wedding dates are stored as "YYYY-MM-DD" (DB Design §3.5) and must be
// read in the wedding's own timezone, so "today" is computed there rather than in UTC.

const DAY_MS = 24 * 60 * 60 * 1000;

/** Today's calendar date ("YYYY-MM-DD") in an IANA timezone. */
export function todayIn(timezone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function dayNumber(isoDate: string): number {
  const [year, month, day] = isoDate.split("-").map(Number);
  return Date.UTC(year!, month! - 1, day!) / DAY_MS;
}

/** Whole days from today (in `timezone`) until `isoDate`: 0 on the day, negative afterwards. */
export function daysUntil(isoDate: string, timezone: string, now: Date = new Date()): number {
  return dayNumber(isoDate) - dayNumber(todayIn(timezone, now));
}

/** "2025-12-12" → "December 12, 2025" (the format used across the Stitch designs). */
export function formatCalendarDate(isoDate: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${isoDate}T00:00:00Z`));
}
