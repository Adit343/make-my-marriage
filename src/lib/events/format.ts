import { daysUntil } from "@/lib/dates";
import { instantToWallClock } from "@/lib/zoned-time";

// How events read on screen (Stitch "Events Timeline" and "Event Detail"): date block, time range
// in the event's own timezone, duration, venue line. Pure functions, so the server renders the
// exact strings the browser would — pages compute them once and pass plain text down.

/** Intl puts a narrow no-break space before AM/PM; plain spaces are easier to compare and copy. */
const plain = (text: string) => text.replace(/[  ]/g, " ");

export function timeZoneAbbreviation(timeZone: string, at: Date): string {
  const part = new Intl.DateTimeFormat("en-IN", { timeZone, timeZoneName: "short" })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName");
  return part?.value ?? timeZone;
}

/** "02:00 PM", or "2:00 PM" with `padHour: false` (the detail screen). */
export function formatClock(instant: Date, timeZone: string, padHour = true): string {
  return plain(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: padHour ? "2-digit" : "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(instant),
  );
}

function isMidnight(instant: Date, timeZone: string): boolean {
  return instantToWallClock(instant, timeZone).endsWith("T00:00");
}

/**
 * "02:00 PM – 06:00 PM IST", "07:30 PM – Midnight IST", or just "02:00 PM IST" when the event has
 * no end time.
 */
export function formatTimeRange(
  startsAt: Date,
  endsAt: Date | null,
  timeZone: string,
  padHour = true,
): string {
  const zone = timeZoneAbbreviation(timeZone, startsAt);
  const start = formatClock(startsAt, timeZone, padHour);
  if (!endsAt) return `${start} ${zone}`;
  const end = isMidnight(endsAt, timeZone) ? "Midnight" : formatClock(endsAt, timeZone, padHour);
  return `${start} – ${end} ${zone}`;
}

export function formatDuration(startsAt: Date, endsAt: Date | null): string | null {
  if (!endsAt) return null;
  const minutes = Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000);
  if (minutes <= 0) return null;
  if (minutes < 60) return `${minutes} Min`;
  if (minutes >= 24 * 60 && minutes % (24 * 60) === 0) {
    const days = minutes / (24 * 60);
    return `${days} ${days === 1 ? "Day" : "Days"}`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const hourText = `${hours} ${hours === 1 ? "Hour" : "Hours"}`;
  return rest === 0 ? hourText : `${hourText} ${rest} Min`;
}

/** The calendar block on a timeline card: 13 / FEB 2027 / Saturday. */
export function formatDateBlock(startsAt: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "numeric",
    month: "short",
    year: "numeric",
    weekday: "long",
  }).formatToParts(startsAt);
  const read = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    day: read("day"),
    monthYear: `${read("month")} ${read("year")}`.toUpperCase(),
    weekday: read("weekday"),
  };
}

/** "Saturday, 13 February 2027" */
export function formatLongDate(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
    .format(instant)
    .replace(/^(\w+) /, "$1, ");
}

/** The calendar day an instant falls on in a timezone, "YYYY-MM-DD". */
export function calendarDayIn(instant: Date, timeZone: string): string {
  return instantToWallClock(instant, timeZone).slice(0, 10);
}

interface LocationLike {
  label?: string | null;
  address?: {
    line1?: string | null;
    line2?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
  } | null;
}

/** The one-line venue on a timeline card: "The Courtyard, Dumas Road, Surat". */
export function venueLine(location: unknown): string | null {
  const place = (location ?? {}) as LocationLike;
  const pieces = [place.label, place.address?.line1, place.address?.city]
    .map((piece) => piece?.trim())
    .filter((piece): piece is string => Boolean(piece));
  const unique = pieces.filter(
    (piece, index) =>
      pieces.findIndex((other) => other.toLowerCase() === piece.toLowerCase()) === index,
  );
  return unique.length > 0 ? unique.join(", ") : null;
}

/** The full address for the detail screen: "14 Bungalow Road, Piplod, Surat, Gujarat 395007". */
export function fullAddress(location: unknown): string | null {
  const address = ((location ?? {}) as LocationLike).address;
  if (!address) return null;
  const regionLine = [address.state, address.postalCode]
    .map((piece) => piece?.trim())
    .filter(Boolean)
    .join(" ");
  const pieces = [address.line1, address.line2, address.city, regionLine]
    .map((piece) => piece?.trim())
    .filter((piece): piece is string => Boolean(piece));
  return pieces.length > 0 ? pieces.join(", ") : null;
}

/** A Google Maps link for a venue; coordinates and place id win over free text. */
export function mapsUrl(location: unknown): string | null {
  const place = (location ?? {}) as LocationLike & {
    coordinates?: { latitude: number; longitude: number } | null;
    placeId?: string | null;
  };
  const text = [place.label, fullAddress(location)].filter(Boolean).join(", ");
  const base = "https://www.google.com/maps/search/?api=1";
  if (place.coordinates) {
    return `${base}&query=${place.coordinates.latitude},${place.coordinates.longitude}`;
  }
  if (!text) return null;
  const withPlace = place.placeId ? `&query_place_id=${encodeURIComponent(place.placeId)}` : "";
  return `${base}&query=${encodeURIComponent(text)}${withPlace}`;
}

/** "First event in 118 days" style label for the summary strip. */
export function nextEventLabel(
  events: { startsAt: Date; endsAt: Date | null; timezone: string }[],
  now: Date = new Date(),
): { text: string; strong: string } {
  const upcoming = events.filter(
    (event) => (event.endsAt ?? event.startsAt).getTime() >= now.getTime(),
  );
  const first = upcoming[0];
  if (!first)
    return { text: "", strong: events.length === 0 ? "No events yet" : "All events have passed" };
  const lead = upcoming.length === events.length ? "First event" : "Next event";
  const days = daysUntil(calendarDayIn(first.startsAt, first.timezone), first.timezone, now);
  if (days <= 0) return { text: `${lead} is `, strong: "today" };
  if (days === 1) return { text: `${lead} is `, strong: "tomorrow" };
  return { text: `${lead} in `, strong: `${days} days` };
}
