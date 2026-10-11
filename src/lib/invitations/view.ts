import type { RsvpStatus } from "@/lib/constants/enums";

// Labels and numbers for the Invitations screens (Stitch "Invitations Hub", "RSVP Tracker").
// Pure functions with no browser or server APIs, so they are unit-tested and read the same anywhere.

/** Whole-number percentage, 0 when there is nobody to count. */
export function percent(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.min(100, Math.round((part / whole) * 100));
}

export const REPLY_ORDER: RsvpStatus[] = ["attending", "declined", "maybe", "pending"];

/** Segment widths (percent of guests) for the stacked bar, in `REPLY_ORDER`. They add up to 100 (or 0). */
export function replySegments(byStatus: Record<RsvpStatus, number>): Record<RsvpStatus, number> {
  const total = REPLY_ORDER.reduce((sum, status) => sum + byStatus[status], 0);
  if (total === 0) return { attending: 0, declined: 0, maybe: 0, pending: 0 };
  return Object.fromEntries(
    REPLY_ORDER.map((status) => [status, (byStatus[status] / total) * 100]),
  ) as Record<RsvpStatus, number>;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** "today", "yesterday", "12 days ago": how long since an instant. */
export function agoWords(iso: string, now: number): string {
  const days = Math.floor((now - new Date(iso).getTime()) / DAY_MS);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

/** "Invited 12 days ago" / "Invited today", or "Not invited yet". */
export function invitedAgo(iso: string | null, now: number): string {
  return iso ? `Invited ${agoWords(iso, now)}` : "Not invited yet";
}

/** A short "22m ago", "2h ago", "Yesterday" or "8 Feb" for the latest-responses feed. */
export function feedWhen(iso: string, now: number, timeZone: string): string {
  const minutes = Math.round((now - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor((now - new Date(iso).getTime()) / DAY_MS);
  if (days === 1) return "Yesterday";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone }).format(
    new Date(iso),
  );
}

/** "Today, 11:30 AM", "Yesterday", "8 Feb": when a batch was sent, read in the wedding's timezone. */
export function batchWhen(iso: string, timeZone: string, now: Date): string {
  const day = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone }).format(date);
  const at = new Date(iso);
  const time = new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone,
  })
    .format(at)
    .toUpperCase();
  if (day(at) === day(now)) return `Today, ${time}`;
  if (day(at) === day(new Date(now.getTime() - DAY_MS))) return "Yesterday";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone }).format(at);
}

/** "11 Feb 2027, 11:30:14 IST" for the delivery log. */
export function logTimestamp(iso: string, timeZone: string): string {
  const at = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone,
    timeZoneName: "short",
  }).formatToParts(at);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("day")} ${get("month")} ${get("year")}, ${get("hour")}:${get("minute")}:${get("second")} ${get("timeZoneName")}`;
}

/** The delivery log's notes column: "mailbox_full: Mailbox full (552)" or "Delivered to the email provider". */
export function logNote(error: { code: string; message?: string } | null): string {
  if (!error) return "Delivered to the email provider";
  return error.message ? `${error.code}: ${error.message}` : error.code;
}

/** "1 person" / "2 people": the feed and recap wording. */
export function peopleLabel(count: number): string {
  return `${count} ${count === 1 ? "person" : "people"}`;
}
