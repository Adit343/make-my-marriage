import type { DietaryPreference, EventType, RsvpStatus } from "@/lib/constants/enums";
import { EVENT_TYPE_LABEL } from "@/lib/events/view";
import type { IconName } from "@/components/ui/icon";

// What the guest's RSVP page (Stitch "Guest-Facing RSVP Page") shows: every date is formatted here,
// on the server, in each event's own timezone, so the browser never reformats it (server and
// browser could otherwise disagree and break hydration). Pure functions, unit-tested.

export interface RsvpEventView {
  eventId: string;
  name: string;
  typeLabel: string;
  icon: IconName;
  /** "Saturday, 13 February, 10:00 AM" in the event's timezone. */
  when: string;
  /** "Saturday morning": the recap line on the confirmation. */
  dayPart: string;
  venue: string | null;
  mapsUrl: string | null;
  dressCode: string | null;
  status: RsvpStatus;
  attendingCount: number;
  note: string | null;
}

export interface RsvpPageView {
  coupleNames: string;
  guestName: string;
  firstName: string;
  plusOnesAllowed: number;
  dietaryPreference: DietaryPreference | null;
  hasResponded: boolean;
  events: RsvpEventView[];
}

const EVENT_ICON: Record<EventType, IconName> = {
  mehendi: "palette",
  haldi: "wb_sunny",
  sangeet: "nightlife",
  engagement: "celebration",
  ceremony: "favorite",
  reception: "celebration",
  other: "celebration",
};

/** "Saturday, 13 February, 10:00 AM" for an instant, read in `timeZone`. */
export function formatWhen(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone,
  }).formatToParts(instant);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const period = get("dayPeriod").toUpperCase();
  return `${get("weekday")}, ${get("day")} ${get("month")}, ${get("hour")}:${get("minute")} ${period}`;
}

/** "Saturday morning", "Saturday evening": a short recap label. */
export function dayPartLabel(instant: Date, timeZone: string): string {
  const weekday = new Intl.DateTimeFormat("en-IN", { weekday: "long", timeZone }).format(instant);
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone }).format(instant),
  );
  const part = hour < 12 ? "morning" : hour < 17 ? "afternoon" : hour < 21 ? "evening" : "night";
  return `${weekday} ${part}`;
}

/** The public RSVP API's response (see PublicRsvp in the guest-invitations module). */
export interface PublicRsvpData {
  weddingTitle: string;
  coupleNames: string;
  guest: { name: string; plusOnesAllowed: number; dietaryPreference: DietaryPreference | null };
  events: {
    eventId: string;
    name: string;
    type: EventType;
    startsAt: string;
    timezone: string;
    venue: string | null;
    mapsUrl: string | null;
    dressCode: string | null;
    status: RsvpStatus;
    attendingCount: number;
    note: string | null;
  }[];
  hasResponded: boolean;
}

export function toRsvpPageView(data: PublicRsvpData): RsvpPageView {
  return {
    coupleNames: data.coupleNames,
    guestName: data.guest.name,
    firstName: data.guest.name.trim().split(/\s+/)[0] || data.guest.name,
    plusOnesAllowed: data.guest.plusOnesAllowed,
    dietaryPreference: data.guest.dietaryPreference,
    hasResponded: data.hasResponded,
    events: data.events.map((event) => {
      const startsAt = new Date(event.startsAt);
      return {
        eventId: event.eventId,
        name: event.name,
        typeLabel: EVENT_TYPE_LABEL[event.type],
        icon: EVENT_ICON[event.type],
        when: formatWhen(startsAt, event.timezone),
        dayPart: dayPartLabel(startsAt, event.timezone),
        venue: event.venue,
        mapsUrl: event.mapsUrl,
        dressCode: event.dressCode,
        status: event.status,
        attendingCount: event.attendingCount,
        note: event.note,
      };
    }),
  };
}

/** "Yes, 2 people", "Maybe", "No", "Not answered yet": the confirmation's right-hand label. */
export function answerLabel(status: RsvpStatus, attendingCount: number): string {
  if (status === "attending") {
    return attendingCount > 1 ? `Yes, ${attendingCount} people` : "Yes, 1 person";
  }
  if (status === "maybe") return "Maybe";
  if (status === "declined") return "No";
  return "Not answered yet";
}
