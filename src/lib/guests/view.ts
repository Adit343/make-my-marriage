import type {
  AgeCategory,
  DietaryPreference,
  GuestSide,
  InviteChannel,
  RsvpStatus,
} from "@/lib/constants/enums";
import { formatDayMonth } from "@/lib/dates";
import type { GuestInvitationDto, RsvpRefDto } from "@/modules/guests/guest.dto";

// How guests read on screen (Stitch "Guests List", "Add / Edit Guest" and "Guest Detail"): side
// labels use the couple's own names, the reply column summarises one or many events, the
// invitation column says what the sender did. Pure functions with no browser or server APIs, so
// they are unit-tested and render identically anywhere.

export interface Partners {
  one: string;
  two: string;
}

/** The couple's first names, from the wedding's `partners`; neutral words when not filled in. */
export function partnersOf(partners: { name: string }[]): Partners {
  return {
    one: partners[0]?.name.trim().split(/\s+/)[0] || "Partner one",
    two: partners[1]?.name.trim().split(/\s+/)[0] || "Partner two",
  };
}

/** "Aarav's side", "Diya's side", "Both". */
export function sideLabel(side: GuestSide, partners: Partners): string {
  if (side === "both") return "Both";
  const name = side === "partnerOne" ? partners.one : partners.two;
  return `${name}'s side`;
}

export const DIETARY_LABEL: Record<DietaryPreference, string> = {
  no_preference: "No preference",
  vegetarian: "Vegetarian",
  non_vegetarian: "Non-vegetarian",
  vegan: "Vegan",
  jain: "Jain",
  other: "Other",
};

/** The order the Stitch form lists them in. */
export const DIETARY_ORDER: DietaryPreference[] = [
  "vegetarian",
  "no_preference",
  "non_vegetarian",
  "vegan",
  "jain",
  "other",
];

export const AGE_LABEL: Record<AgeCategory, string> = {
  adult: "Adult",
  child: "Child",
  infant: "Infant",
};

export const RSVP_LABEL: Record<RsvpStatus, string> = {
  pending: "Pending",
  attending: "Attending",
  maybe: "Maybe",
  declined: "Declined",
};

export type ReplyTone = "attending" | "maybe" | "declined" | "pending" | "none";

export interface ReplyDisplay {
  tone: ReplyTone;
  label: string;
  /** People coming besides the guest ("+1"), for attending and maybe. */
  extra: number | null;
  /** Longer explanation for a tooltip. */
  hint?: string;
}

/**
 * The "RSVP" column. For one event: that event's reply, or "Not invited" when the guest isn't on it.
 * For all events: attending if they are coming to any, otherwise maybe, otherwise pending while any
 * reply is outstanding, otherwise declined; "No events" when they are not on any.
 */
export function replyDisplay(rsvps: RsvpRefDto[], eventId: string | null): ReplyDisplay {
  if (eventId) {
    const row = rsvps.find((rsvp) => rsvp.eventId === eventId);
    if (!row) return { tone: "none", label: "Not invited", extra: null };
    return fromRow(row);
  }
  if (rsvps.length === 0) return { tone: "none", label: "No events", extra: null };

  const attending = rsvps.filter((rsvp) => rsvp.status === "attending");
  const hint = `${attending.length} of ${rsvps.length} ${rsvps.length === 1 ? "event" : "events"} confirmed`;
  if (attending.length > 0) {
    const extra = Math.max(...attending.map((rsvp) => rsvp.attendingCount - 1));
    return {
      tone: "attending",
      label: RSVP_LABEL.attending,
      extra: extra > 0 ? extra : null,
      hint,
    };
  }
  if (rsvps.some((rsvp) => rsvp.status === "maybe")) {
    const extra = Math.max(
      ...rsvps.filter((rsvp) => rsvp.status === "maybe").map((rsvp) => rsvp.attendingCount - 1),
    );
    return { tone: "maybe", label: RSVP_LABEL.maybe, extra: extra > 0 ? extra : null, hint };
  }
  if (rsvps.some((rsvp) => rsvp.status === "pending")) {
    return { tone: "pending", label: RSVP_LABEL.pending, extra: null, hint };
  }
  return { tone: "declined", label: RSVP_LABEL.declined, extra: null, hint };
}

function fromRow(row: RsvpRefDto): ReplyDisplay {
  const extra = row.attendingCount > 1 ? row.attendingCount - 1 : null;
  switch (row.status) {
    case "attending":
      return { tone: "attending", label: RSVP_LABEL.attending, extra };
    case "maybe":
      return { tone: "maybe", label: RSVP_LABEL.maybe, extra };
    case "declined":
      return { tone: "declined", label: RSVP_LABEL.declined, extra: null };
    default:
      return { tone: "pending", label: RSVP_LABEL.pending, extra: null };
  }
}

const CHANNEL_LABEL: Record<InviteChannel, string> = {
  email: "Email",
  whatsapp: "WhatsApp",
  manual: "hand",
};

export interface InvitationDisplay {
  sent: boolean;
  /** "Sent via Email", "Sent via WhatsApp", "Not sent". */
  label: string;
  channel: InviteChannel | null;
  /** "8 Feb" in the wedding's timezone, or null. */
  dateLabel: string | null;
}

export function invitationDisplay(
  invitation: GuestInvitationDto,
  timeZone: string,
): InvitationDisplay {
  if (invitation.status !== "invited") {
    return { sent: false, label: "Not sent", channel: null, dateLabel: null };
  }
  const channel = invitation.lastChannel;
  return {
    sent: true,
    label: channel ? `Sent via ${CHANNEL_LABEL[channel]}` : "Invited",
    channel,
    dateLabel: invitation.lastSentAt ? shortDate(invitation.lastSentAt, timeZone) : null,
  };
}

/** "2027-02-08T05:00:00Z" → "8 Feb" as read in `timeZone`. */
export function shortDate(iso: string, timeZone: string): string {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
  return formatDayMonth(day);
}

/** "Today, 11:42 AM" or "8 Feb, 11:42 AM" for the detail screen's "Last updated". */
export function lastUpdatedLabel(iso: string, timeZone: string, now: Date = new Date()): string {
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(new Date(iso))
    .replace(/[  ]/g, " ");
  const dayOf = (instant: Date) => new Intl.DateTimeFormat("en-CA", { timeZone }).format(instant);
  const day = dayOf(new Date(iso)) === dayOf(now) ? "Today" : shortDate(iso, timeZone);
  return `${day}, ${time}`;
}

/** "3 min ago" style label for "Updated 4 mins ago". */
export function relativeAgo(then: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - then) / 1000));
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} ${minutes === 1 ? "min" : "mins"} ago`;
  const hours = Math.round(minutes / 60);
  return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
}

/** Up to `max` names then "+N more": the selection bar's "Aarav Trivedi, Ananya Joshi, +4 more". */
export function namesSummary(names: string[], max = 3): string {
  if (names.length <= max) return names.join(", ");
  return `${names.slice(0, max).join(", ")} +${names.length - max} more`;
}
