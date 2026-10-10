// Conversion between an instant and the wall-clock time a person types for it in an IANA
// timezone. Events are stored as UTC instants plus the timezone they are shown in (DB Design §3.5),
// so the event form must turn "13 Feb 2027, 07:30 PM in Asia/Kolkata" into the right instant and
// back. Uses Intl only — no date library.

const WALL_CLOCK = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

interface Parts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

function partsIn(instant: Date, timeZone: string): Parts {
  const formatted = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(instant);
  const read = (type: string) => Number(formatted.find((part) => part.type === type)?.value);
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
  };
}

function asUtcMillis(parts: Parts): number {
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
}

/** The wall-clock reading of an instant in a timezone, as "YYYY-MM-DDTHH:mm" (datetime-local). */
export function instantToWallClock(instant: Date, timeZone: string): string {
  const p = partsIn(instant, timeZone);
  const two = (value: number) => String(value).padStart(2, "0");
  return `${String(p.year).padStart(4, "0")}-${two(p.month)}-${two(p.day)}T${two(p.hour)}:${two(p.minute)}`;
}

/**
 * The instant at which a timezone's clocks read `wallClock` ("YYYY-MM-DDTHH:mm"), or null if the
 * text is not a valid date and time. A time that daylight saving skips (it never appears on the
 * clock) resolves to a real time within an hour of it rather than failing.
 */
export function wallClockToInstant(wallClock: string, timeZone: string): Date | null {
  const match = WALL_CLOCK.exec(wallClock);
  if (!match) return null;
  const wanted = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
  };
  const wantedMillis = asUtcMillis(wanted);
  // Reject impossible dates such as 31 February (Date.UTC would silently roll them over).
  const roundTrip = new Date(wantedMillis);
  if (
    roundTrip.getUTCFullYear() !== wanted.year ||
    roundTrip.getUTCMonth() !== wanted.month - 1 ||
    roundTrip.getUTCDate() !== wanted.day ||
    wanted.hour > 23 ||
    wanted.minute > 59
  ) {
    return null;
  }

  // First guess: treat the wall clock as UTC, then correct by how far the zone's clock is off.
  // A second pass settles the answer across a daylight-saving boundary.
  let guess = wantedMillis;
  for (let pass = 0; pass < 2; pass += 1) {
    const offset = asUtcMillis(partsIn(new Date(guess), timeZone)) - guess;
    guess = wantedMillis - offset;
  }
  return new Date(guess);
}
