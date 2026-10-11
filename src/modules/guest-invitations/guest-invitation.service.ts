import "server-only";
import { randomUUID } from "node:crypto";
import { SEND_CHUNK_SIZE } from "@/lib/constants/invitations";
import type { EmailType, InviteChannel } from "@/lib/constants/enums";
import { getEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { venueLine } from "@/lib/events/format";
import { whatsappLink, whatsappMessage, type SendKind } from "@/lib/invitations/messages";
import { enforceRateLimit, RATE_LIMITS } from "@/modules/auth/rate-limit";
import { listEvents as listEventRows } from "@/modules/events/event.repository";
import { ensureLinkFor, inviteUrlFor } from "@/modules/guest-invitations/guest-link.service";
import type {
  InviteBatchInput,
  InviteGuestInput,
} from "@/modules/guest-invitations/guest-invitation.schemas";
import { findGuestsWithLinks, markGuestsInvited } from "@/modules/guests/guest.repository";
import { listRsvpsForGuests } from "@/modules/guests/rsvp.repository";
import type { WeddingAuth } from "@/modules/members/guards";
import { findGuestEmailLog } from "@/modules/notifications/email-log.repository";
import { sendEmail } from "@/modules/notifications/email.service";
import {
  guestInvitationEmail,
  rsvpReminderEmail,
  type GuestEmailEvent,
} from "@/modules/notifications/templates";
import { findWedding } from "@/modules/weddings/wedding.repository";

// Sending invitations and RSVP reminders (API Design §8.6 to §8.8, Architecture §29 to §31).
//
//   email     the app sends it (Resend; the console in development), one log row per recipient.
//   whatsapp  the app builds a pre-filled wa.me link; the MEMBER presses Send. No WhatsApp API, so
//             the app can never know it was sent: it only records that the member opened it.
//   manual    "I told them in person": just marks the guest invited.
//
// A failed email never undoes anything and never blocks the others: the response says who got it,
// who didn't, and who was skipped, and failures can be retried (without re-emailing the rest).

export type SendOutcome = "sent" | "failed" | "skipped" | "prepared" | "marked";

export interface SendResultItem {
  guestId: string;
  name: string;
  outcome: SendOutcome;
  /** Why a guest was skipped, in words a person can act on. */
  reason?: string;
  /** Why an email failed. The provider's message is shown outside production only. */
  error?: { code: string; message?: string };
  email?: string | null;
  inviteUrl?: string;
  whatsappUrl?: string;
}

export interface SendSummary {
  batchId: string;
  channel: InviteChannel;
  kind: SendKind;
  total: number;
  /** Emails delivered to the provider. */
  sent: number;
  failed: number;
  skipped: number;
  /** WhatsApp links prepared but not yet opened by the member (batch only). */
  prepared: number;
  /** Guests recorded as invited without an email (WhatsApp tapped, or told in person). */
  marked: number;
  failedGuestIds: string[];
  results: SendResultItem[];
}

type GuestRow = Awaited<ReturnType<typeof findGuestsWithLinks>>[number];
type EventRow = Awaited<ReturnType<typeof listEventRows>>[number];
type RsvpRow = Awaited<ReturnType<typeof listRsvpsForGuests>>[number];

const EMAIL_TYPE: Record<SendKind, EmailType> = {
  invitation: "guest_invitation",
  reminder: "rsvp_reminder",
};

function chunks<T>(items: T[], size: number): T[][] {
  const groups: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    groups.push(items.slice(index, index + size));
  }
  return groups;
}

/** "Sat, 13 Feb, 10:00 am": an event's moment in ITS timezone, so a destination wedding reads right. */
function whenLabel(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone,
  }).format(instant);
}

/** The provider's message is shown outside production only; in production it could name the operator's account. */
function failureFor(error: { code: string; message: string }) {
  return getEnv().NODE_ENV === "production"
    ? { code: error.code }
    : { code: error.code, message: error.message };
}

/** Why this guest can't be sent this, or null if they can. */
function skipReason(
  guest: GuestRow,
  rsvps: RsvpRow[],
  channel: InviteChannel,
  kind: SendKind,
): string | null {
  if (kind === "reminder") {
    if (guest.invitation?.status !== "invited") return "Hasn't been invited yet";
    if (!rsvps.some((rsvp) => rsvp.status === "pending")) {
      return "Has already replied to every event";
    }
  } else if (rsvps.length === 0) {
    return "Isn't invited to any event yet";
  }
  if (channel === "email" && !guest.email) return "No email address on file";
  if (channel === "whatsapp" && !guest.phone) return "No phone number on file";
  return null;
}

interface SendContext {
  weddingId: string;
  weddingTitle: string;
  eventsById: Map<string, EventRow>;
  rsvpsByGuest: Map<string, RsvpRow[]>;
}

function eventsFor(context: SendContext, guestId: string): GuestEmailEvent[] {
  return (context.rsvpsByGuest.get(guestId) ?? [])
    .map((rsvp) => context.eventsById.get(rsvp.eventId.toString()))
    .filter((event): event is EventRow => Boolean(event))
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
    .map((event) => ({
      name: event.name,
      when: whenLabel(event.startsAt, event.timezone),
      venue: venueLine(event.location),
    }));
}

async function deliverOne(
  context: SendContext,
  guest: GuestRow,
  input: { channel: InviteChannel; kind: SendKind; batchId: string; markWhatsapp: boolean },
): Promise<{ item: SendResultItem; mark: InviteChannel | null }> {
  const guestId = guest._id.toString();
  const base = { guestId, name: guest.name, email: guest.email ?? null };
  const rsvps = context.rsvpsByGuest.get(guestId) ?? [];

  const reason = skipReason(guest, rsvps, input.channel, input.kind);
  if (reason) return { item: { ...base, outcome: "skipped", reason }, mark: null };

  if (input.channel === "manual") {
    return { item: { ...base, outcome: "marked" }, mark: "manual" };
  }

  const { token } = await ensureLinkFor(context.weddingId, guest);
  const inviteUrl = inviteUrlFor(token);

  if (input.channel === "whatsapp") {
    const text = whatsappMessage({ guestName: guest.name, url: inviteUrl, kind: input.kind });
    const whatsappUrl = whatsappLink(guest.phone!, text);
    // Preparing a message is not sending it: only a member tapping "Open WhatsApp" marks the guest.
    return input.markWhatsapp
      ? { item: { ...base, outcome: "marked", inviteUrl, whatsappUrl }, mark: "whatsapp" }
      : { item: { ...base, outcome: "prepared", inviteUrl, whatsappUrl }, mark: null };
  }

  const template = input.kind === "reminder" ? rsvpReminderEmail : guestInvitationEmail;
  const result = await sendEmail({
    type: EMAIL_TYPE[input.kind],
    weddingId: context.weddingId,
    guestId,
    batchId: input.batchId,
    idempotencyKey: `${EMAIL_TYPE[input.kind]}:${guestId}:${input.batchId}`,
    to: guest.email!,
    ...template({
      guestName: guest.name,
      weddingTitle: context.weddingTitle,
      events: eventsFor(context, guestId),
      rsvpUrl: inviteUrl,
    }),
  });
  if (result.status === "failed") {
    return {
      item: { ...base, outcome: "failed", error: failureFor(result.error!) },
      mark: null,
    };
  }
  // A repeated request whose email already went out is reported as sent but not counted twice.
  return { item: { ...base, outcome: "sent" }, mark: result.duplicate ? null : "email" };
}

async function run(
  auth: WeddingAuth,
  input: {
    guestIds: string[];
    channel: InviteChannel;
    kind: SendKind;
    batchId?: string;
    markWhatsapp: boolean;
  },
): Promise<SendSummary> {
  const ids = [...new Set(input.guestIds.map((id) => id.toLowerCase()))];
  // One query for every guest; an id outside this wedding is simply absent, which looks exactly
  // like a deleted guest (DB Design §9.2). A stale selection fails whole instead of half-sending.
  const guests = await findGuestsWithLinks(auth.weddingId, ids);
  if (guests.length !== ids.length) {
    throw new AppError("NOT_FOUND", { message: "One of those guests is no longer on the list." });
  }
  const byId = new Map(guests.map((guest) => [guest._id.toString(), guest]));

  const [wedding, events, rsvps] = await Promise.all([
    findWedding(auth.weddingId),
    listEventRows(auth.weddingId),
    listRsvpsForGuests(auth.weddingId, ids),
  ]);
  const rsvpsByGuest = new Map<string, RsvpRow[]>();
  for (const rsvp of rsvps) {
    const key = rsvp.guestId.toString();
    rsvpsByGuest.set(key, [...(rsvpsByGuest.get(key) ?? []), rsvp]);
  }
  const context: SendContext = {
    weddingId: auth.weddingId,
    weddingTitle: wedding?.title ?? "our wedding",
    eventsById: new Map(events.map((event) => [event._id.toString(), event])),
    rsvpsByGuest,
  };

  const batchId = input.batchId ?? randomUUID();
  const results: SendResultItem[] = [];
  const toMark: Record<"email" | "whatsapp" | "manual", string[]> = {
    email: [],
    whatsapp: [],
    manual: [],
  };

  // Small controlled groups (Architecture §29): each group is one rate-limit count and runs
  // together; the next starts when it finishes.
  for (const group of chunks(ids, SEND_CHUNK_SIZE)) {
    await enforceRateLimit(`guest-send:${auth.weddingId}`, RATE_LIMITS.guestSend);
    const done = await Promise.all(
      group.map((id) =>
        deliverOne(context, byId.get(id)!, {
          channel: input.channel,
          kind: input.kind,
          batchId,
          markWhatsapp: input.markWhatsapp,
        }),
      ),
    );
    for (const { item, mark } of done) {
      results.push(item);
      if (mark) toMark[mark].push(item.guestId);
    }
  }

  const at = new Date();
  await Promise.all(
    (["email", "whatsapp", "manual"] as const).map((channel) =>
      markGuestsInvited(auth.weddingId, toMark[channel], channel, at),
    ),
  );

  const count = (outcome: SendOutcome) => results.filter((item) => item.outcome === outcome).length;
  return {
    batchId,
    channel: input.channel,
    kind: input.kind,
    total: results.length,
    sent: count("sent"),
    failed: count("failed"),
    skipped: count("skipped"),
    prepared: count("prepared"),
    marked: count("marked"),
    failedGuestIds: results.filter((item) => item.outcome === "failed").map((item) => item.guestId),
    results,
  };
}

/**
 * Send to up to 50 guests. WhatsApp here only PREPARES the links (nothing is marked); the member
 * taps each one, which calls inviteGuest and records it. Email is sent, manual is recorded.
 */
export function inviteBatch(auth: WeddingAuth, input: InviteBatchInput): Promise<SendSummary> {
  return run(auth, { ...input, markWhatsapp: false });
}

/** One guest. WhatsApp here is the member's tap: it records them as invited and returns the link. */
export async function inviteGuest(
  auth: WeddingAuth,
  guestId: string,
  input: InviteGuestInput,
): Promise<SendSummary> {
  return run(auth, { guestIds: [guestId], ...input, markWhatsapp: true });
}

/** Retries ONE failed email from the delivery log; the same log row is updated, not duplicated. */
export async function retryEmailLog(auth: WeddingAuth, logId: string): Promise<SendSummary> {
  const log = await findGuestEmailLog(auth.weddingId, logId);
  if (!log) throw new AppError("NOT_FOUND");
  if (log.status === "sent") {
    throw new AppError("BUSINESS_RULE_VIOLATION", { message: "This email was already delivered." });
  }
  if (!log.guestId) {
    throw new AppError("BUSINESS_RULE_VIOLATION", { message: "This email can't be retried." });
  }
  return run(auth, {
    guestIds: [log.guestId.toString()],
    channel: "email",
    kind: log.type === "rsvp_reminder" ? "reminder" : "invitation",
    // The log's own batch: its idempotency key matches, so this updates the failed row.
    batchId: log.batchId,
    markWhatsapp: false,
  });
}
