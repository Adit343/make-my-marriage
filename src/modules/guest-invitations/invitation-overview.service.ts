import "server-only";
import { z } from "zod";
import { RECENT_BATCHES_SHOWN } from "@/lib/constants/invitations";
import type {
  EmailStatus,
  EmailType,
  GuestInviteStatus,
  InviteChannel,
  RespondedVia,
  RsvpStatus,
} from "@/lib/constants/enums";
import { getEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { decodeCursor, encodeCursor, type CursorMeta } from "@/lib/http/pagination";
import { objectId } from "@/lib/validation/primitives";
import { listEvents as listEventRows } from "@/modules/events/event.repository";
import { listGroups } from "@/modules/guest-groups/guest-group.service";
import type { EmailLogsQuery } from "@/modules/guest-invitations/guest-invitation.schemas";
import {
  countGuests,
  countGuestsByInviteStatus,
  countGuestsWithoutContact,
  countInvitedByChannel,
  findGuestsByIds,
  listGuestsWithoutContact,
} from "@/modules/guests/guest.repository";
import { headcountByEvent, listRsvpsForEvent } from "@/modules/guests/rsvp.repository";
import type { WeddingAuth } from "@/modules/members/guards";
import {
  listGuestEmailLogsPage,
  listLatestFailures,
  listRecentBatches,
} from "@/modules/notifications/email-log.repository";

// What the Invitations screens read (Stitch "Invitations Hub", "RSVP Tracker"): the numbers and
// lists are computed from the real guests, replies and email logs (DB Design §9.4: nothing is
// stored twice). Every query is scoped to the wedding and indexed (DB Design §8.3).

export type GuestEmailError = { code: string; message?: string };

function errorFor(
  error: { code?: string | null; message?: string | null } | null | undefined,
): GuestEmailError | null {
  if (!error?.code) return null;
  // The provider's message may name the operator's account: show it outside production only.
  return getEnv().NODE_ENV === "production"
    ? { code: error.code }
    : { code: error.code, ...(error.message ? { message: error.message } : {}) };
}

/** How many guests with no contact details the overview names (the rest are one click away). */
const NO_CONTACT_SHOWN = 3;

export interface InvitationsOverview {
  totals: { guests: number; invited: number; notInvited: number; noContact: number };
  /** Replies received across all events: the "RSVP responses" tab's count. */
  responseCount: number;
  /** The first few guests nobody can reach, A to Z. */
  noContactGuests: { id: string; name: string; label: string | null }[];
  channels: Record<InviteChannel, number>;
  failures: {
    guestId: string;
    logId: string;
    name: string;
    email: string;
    kind: "invitation" | "reminder";
    error: GuestEmailError | null;
    failedAt: string;
  }[];
  batches: {
    batchId: string;
    at: string;
    kind: "invitation" | "reminder";
    total: number;
    sent: number;
    failed: number;
  }[];
}

export async function getInvitationsOverview(auth: WeddingAuth): Promise<InvitationsOverview> {
  const [guests, byStatus, noContact, channels, failures, batches, headcounts, unreachable] =
    await Promise.all([
      countGuests(auth.weddingId),
      countGuestsByInviteStatus(auth.weddingId),
      countGuestsWithoutContact(auth.weddingId),
      countInvitedByChannel(auth.weddingId),
      listLatestFailures(auth.weddingId),
      listRecentBatches(auth.weddingId, RECENT_BATCHES_SHOWN),
      headcountByEvent(auth.weddingId),
      listGuestsWithoutContact(auth.weddingId, NO_CONTACT_SHOWN),
    ]);

  // A failure is still "needs attention" only until the guest is reached another way afterwards
  // (WhatsApp, in person, or a successful retry that updates the failed row).
  const failedGuests = new Map(
    (
      await findGuestsByIds(
        auth.weddingId,
        failures.map((failure) => failure.guestId),
      )
    ).map((guest) => [guest._id.toString(), guest]),
  );
  const open = failures.flatMap((failure) => {
    const guest = failedGuests.get(failure.guestId);
    if (!guest) return []; // deleted since
    const reachedLater =
      guest.invitation?.lastSentAt &&
      guest.invitation.lastSentAt.getTime() > failure.failedAt.getTime();
    if (reachedLater) return [];
    return [
      {
        guestId: failure.guestId,
        logId: failure.logId,
        name: guest.name,
        email: failure.recipientEmail,
        kind: failure.type === "rsvp_reminder" ? ("reminder" as const) : ("invitation" as const),
        error: errorFor(failure.error),
        failedAt: failure.failedAt.toISOString(),
      },
    ];
  });

  const responseCount = headcounts.reduce(
    (sum, row) => sum + row.byStatus.attending + row.byStatus.declined + row.byStatus.maybe,
    0,
  );

  return {
    totals: { guests, invited: byStatus.invited, notInvited: byStatus.not_invited, noContact },
    responseCount,
    noContactGuests: unreachable.map((guest) => ({
      id: guest._id.toString(),
      name: guest.name,
      label: guest.relationLabel ?? null,
    })),
    channels,
    failures: open,
    batches: batches.map((batch) => ({
      batchId: batch.batchId,
      at: batch.at.toISOString(),
      kind: batch.type === "rsvp_reminder" ? "reminder" : "invitation",
      total: batch.total,
      sent: batch.sent,
      failed: batch.failed,
    })),
  };
}

// ---------------------------------------------------------------------------------------------
// Delivery log (API Design §13)
// ---------------------------------------------------------------------------------------------

export interface EmailLogDto {
  id: string;
  type: EmailType;
  status: EmailStatus;
  recipientEmail: string;
  guestId: string | null;
  guestName: string | null;
  batchId: string;
  attempts: number;
  sentAt: string | null;
  createdAt: string;
  error: GuestEmailError | null;
}

const logCursor = z.object({ at: z.string(), id: objectId });

export async function listEmailLogs(
  auth: WeddingAuth,
  query: EmailLogsQuery,
): Promise<{ items: EmailLogDto[]; meta: CursorMeta }> {
  const { limit, cursor, ...filters } = query;
  const after = cursor ? decodeCursor(cursor, logCursor) : undefined;
  const rows = await listGuestEmailLogsPage(auth.weddingId, filters, { limit, after });
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  const guestIds = [
    ...new Set(page.flatMap((row) => (row.guestId ? [row.guestId.toString()] : []))),
  ];
  const guests = guestIds.length > 0 ? await findGuestsByIds(auth.weddingId, guestIds) : [];
  const names = new Map(guests.map((guest) => [guest._id.toString(), guest.name]));

  const last = page[page.length - 1];
  return {
    items: page.map((row) => ({
      id: row._id.toString(),
      type: row.type,
      status: row.status,
      recipientEmail: row.recipientEmail,
      guestId: row.guestId ? row.guestId.toString() : null,
      guestName: row.guestId ? (names.get(row.guestId.toString()) ?? null) : null,
      batchId: row.batchId,
      attempts: row.attempts,
      sentAt: row.sentAt ? row.sentAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      error: errorFor(row.error),
    })),
    meta: {
      hasMore,
      nextCursor:
        hasMore && last
          ? encodeCursor({ at: last.createdAt.toISOString(), id: last._id.toString() })
          : null,
    },
  };
}

// ---------------------------------------------------------------------------------------------
// RSVP tracker (Stitch "RSVP Tracker"): one event's replies, guest by guest
// ---------------------------------------------------------------------------------------------

/** The tracker lists up to this many guests of one event (a safety stop, like the tasks screen). */
const TRACKER_LIMIT = 2000;

export interface EventReplyRow {
  guestId: string;
  name: string;
  groupName: string | null;
  email: string | null;
  phone: string | null;
  plusOnesAllowed: number;
  invitationStatus: GuestInviteStatus;
  invitedAt: string | null;
  invitedVia: InviteChannel | null;
  status: RsvpStatus;
  attendingCount: number;
  note: string | null;
  respondedAt: string | null;
  respondedVia: RespondedVia | null;
}

export interface EventReplies {
  eventId: string;
  byStatus: Record<RsvpStatus, number>;
  /** Everyone coming, plus-ones included: the catering number. */
  totalAttendingCount: number;
  rows: EventReplyRow[];
}

export async function getEventReplies(auth: WeddingAuth, eventId: string): Promise<EventReplies> {
  const events = await listEventRows(auth.weddingId);
  if (!events.some((event) => event._id.toString() === eventId.toLowerCase())) {
    throw new AppError("NOT_FOUND", { message: "That event isn't part of this wedding." });
  }

  const [rsvps, [counts], groups] = await Promise.all([
    listRsvpsForEvent(auth.weddingId, eventId),
    headcountByEvent(auth.weddingId, eventId),
    listGroups(auth),
  ]);
  const shown = rsvps.slice(0, TRACKER_LIMIT);
  const guests = await findGuestsByIds(
    auth.weddingId,
    shown.map((rsvp) => rsvp.guestId.toString()),
  );
  const guestById = new Map(guests.map((guest) => [guest._id.toString(), guest]));
  const groupNames = new Map(groups.map((group) => [group.id, group.name]));

  const rows: EventReplyRow[] = [];
  for (const rsvp of shown) {
    const guest = guestById.get(rsvp.guestId.toString());
    if (!guest) continue; // deleted: its rows are soft-deleted with it
    rows.push({
      guestId: guest._id.toString(),
      name: guest.name,
      groupName: guest.groupId ? (groupNames.get(guest.groupId.toString()) ?? null) : null,
      email: guest.email ?? null,
      phone: guest.phone ?? null,
      plusOnesAllowed: guest.plusOnesAllowed,
      invitationStatus: guest.invitation?.status ?? "not_invited",
      invitedAt: guest.invitation?.lastSentAt ? guest.invitation.lastSentAt.toISOString() : null,
      invitedVia: guest.invitation?.lastChannel ?? null,
      status: rsvp.status,
      attendingCount: rsvp.attendingCount,
      note: rsvp.note ?? null,
      respondedAt: rsvp.respondedAt ? rsvp.respondedAt.toISOString() : null,
      respondedVia: rsvp.respondedVia ?? null,
    });
  }
  rows.sort((a, b) => a.name.localeCompare(b.name));

  return {
    eventId,
    byStatus: counts?.byStatus ?? { pending: 0, attending: 0, declined: 0, maybe: 0 },
    totalAttendingCount: counts?.attendingCount ?? 0,
    rows,
  };
}
