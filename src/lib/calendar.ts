// Pure calendar and clock helpers behind the custom date and time pickers. Dates are "YYYY-MM-DD"
// strings and times "HH:mm" (24-hour) strings, the same shapes the API stores (DB Design §3.5), so
// no value ever passes through a JavaScript Date in the viewer's timezone.

export interface Ymd {
  y: number;
  /** 1 to 12 */
  m: number;
  d: number;
}

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** Sunday first, as printed Indian calendars and phones in India show them. */
export const WEEKDAYS = [
  { short: "Su", long: "Sunday" },
  { short: "Mo", long: "Monday" },
  { short: "Tu", long: "Tuesday" },
  { short: "We", long: "Wednesday" },
  { short: "Th", long: "Thursday" },
  { short: "Fr", long: "Friday" },
  { short: "Sa", long: "Saturday" },
] as const;

const pad = (value: number) => String(value).padStart(2, "0");

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** 0 = Sunday. */
export function weekdayOf(y: number, m: number, d: number): number {
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function toDateString({ y, m, d }: Ymd): string {
  return `${String(y).padStart(4, "0")}-${pad(m)}-${pad(d)}`;
}

/** Strict "YYYY-MM-DD" that is a real calendar day, else null. */
export function parseDate(value: string | null | undefined): Ymd | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null;
  return { y, m, d };
}

/** Moves by whole months, keeping the day where it exists (31 Jan + 1 month = 28/29 Feb). */
export function addMonths({ y, m, d }: Ymd, months: number): Ymd {
  const index = y * 12 + (m - 1) + months;
  const ny = Math.floor(index / 12);
  const nm = (index % 12) + 1;
  return { y: ny, m: nm, d: Math.min(d, daysInMonth(ny, nm)) };
}

export function addDaysTo({ y, m, d }: Ymd, days: number): Ymd {
  const moved = new Date(Date.UTC(y, m - 1, d + days));
  return { y: moved.getUTCFullYear(), m: moved.getUTCMonth() + 1, d: moved.getUTCDate() };
}

/** Always six rows of seven days, so the picker never changes height between months. */
export function monthGrid(y: number, m: number): Ymd[] {
  const lead = weekdayOf(y, m, 1);
  return Array.from({ length: 42 }, (_, index) => addDaysTo({ y, m, d: 1 }, index - lead));
}

/** Negative, zero or positive, like a sort comparator. Works because the format sorts as text. */
export function compareDates(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** The viewer's own calendar day (used only to mark "today" in the picker). */
export function todayString(now: Date = new Date()): string {
  return toDateString({ y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() });
}

/** "2027-02-14" → "14 Feb 2027". */
export function displayDate(value: string): string {
  const parsed = parseDate(value);
  if (!parsed) return "";
  return `${parsed.d} ${MONTH_NAMES[parsed.m - 1]!.slice(0, 3)} ${parsed.y}`;
}

export interface Hm {
  /** 0 to 23 */
  h: number;
  /** 0 to 59 */
  min: number;
}

/** Strict 24-hour "HH:mm", else null. */
export function parseTime(value: string | null | undefined): Hm | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value ?? "");
  if (!match) return null;
  const h = Number(match[1]);
  const min = Number(match[2]);
  if (h > 23 || min > 59) return null;
  return { h, min };
}

export function toTimeString({ h, min }: Hm): string {
  return `${pad(h)}:${pad(min)}`;
}

export type Meridiem = "AM" | "PM";

/** 24-hour to the 12-hour clock face: 0 → 12 AM, 12 → 12 PM, 15 → 3 PM. */
export function to12Hour(h: number): { hour: number; meridiem: Meridiem } {
  return { hour: h % 12 === 0 ? 12 : h % 12, meridiem: h >= 12 ? "PM" : "AM" };
}

export function from12Hour(hour: number, meridiem: Meridiem): number {
  return (hour % 12) + (meridiem === "PM" ? 12 : 0);
}

/** "07:00" → "7:00 AM", "18:30" → "6:30 PM". */
export function displayTime(value: string): string {
  const parsed = parseTime(value);
  if (!parsed) return "";
  const { hour, meridiem } = to12Hour(parsed.h);
  return `${hour}:${pad(parsed.min)} ${meridiem}`;
}

/** Splits "YYYY-MM-DDTHH:mm" (what the forms keep) into its two halves; a half may be empty. */
export function splitDateTime(value: string): { date: string; time: string } {
  const [date = "", time = ""] = value.split("T");
  return { date, time };
}

/** Joins the halves; empty until a date exists (a time alone is not a moment). */
export function joinDateTime(date: string, time: string): string {
  if (!date) return "";
  return `${date}T${time || "00:00"}`;
}
