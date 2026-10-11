import type { StreamStatus } from "@/lib/constants/enums";
import { timeZoneAbbreviation } from "@/lib/events/format";

export const STREAM_STATUS_LABEL: Record<StreamStatus, string> = {
  scheduled: "Scheduled",
  live: "Live",
  ended: "Ended",
  cancelled: "Cancelled",
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const unit = (value: number, word: string) => `${value} ${word}${value === 1 ? "" : "s"}`;

/**
 * "Starts in 2 days 3 hours", "Starts in 3 hours 20 minutes", "Starts in 12 minutes", or
 * "Starting soon" once it is due (the stream is set live by hand, so it can start a little late).
 */
export function startsInLabel(startTime: Date | string, now: Date = new Date()): string {
  const ms = new Date(startTime).getTime() - now.getTime();
  if (ms <= MINUTE) return "Starting soon";
  const days = Math.floor(ms / DAY);
  const hours = Math.floor((ms % DAY) / HOUR);
  const minutes = Math.floor((ms % HOUR) / MINUTE);
  if (days > 0) {
    return `Starts in ${unit(days, "day")}${hours > 0 ? ` ${unit(hours, "hour")}` : ""}`;
  }
  if (hours > 0) {
    return `Starts in ${unit(hours, "hour")}${minutes > 0 ? ` ${unit(minutes, "minute")}` : ""}`;
  }
  return `Starts in ${unit(minutes, "minute")}`;
}

/** "Started 25 minutes ago" for the manager's live card. */
export function startedAgoLabel(startTime: Date | string, now: Date = new Date()): string {
  const ms = now.getTime() - new Date(startTime).getTime();
  if (ms < MINUTE) return "Started just now";
  if (ms < HOUR) return `Started ${unit(Math.floor(ms / MINUTE), "minute")} ago`;
  if (ms < DAY) return `Started ${unit(Math.floor(ms / HOUR), "hour")} ago`;
  return `Started ${unit(Math.floor(ms / DAY), "day")} ago`;
}

/** "IST (UTC+5:30)": the zone's short name and its offset from UTC at that moment. */
export function zoneLabel(timezone: string, at: Date): string {
  const offset =
    new Intl.DateTimeFormat("en-US", { timeZone: timezone, timeZoneName: "longOffset" })
      .formatToParts(at)
      .find((part) => part.type === "timeZoneName")?.value ?? "GMT";
  // "GMT+05:30" → "UTC+5:30", "GMT-04:00" → "UTC-4", "GMT" → "UTC".
  const tidy = offset
    .replace("GMT", "UTC")
    .replace(/([+-])0(\d)/, "$1$2")
    .replace(/:00$/, "");
  return `${timeZoneAbbreviation(timezone, at)} (${tidy})`;
}
