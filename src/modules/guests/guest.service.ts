import "server-only";
import { z } from "zod";
import { withTransaction } from "@/infrastructure/database/transaction";
import { AppError } from "@/lib/errors";
import { decodeCursor, paginateByCursor, type CursorMeta } from "@/lib/http/pagination";
import { normalizeName } from "@/lib/text/normalize";
import { objectId } from "@/lib/validation/primitives";
import { listEvents as listEventRows } from "@/modules/events/event.repository";
import { findGroup } from "@/modules/guest-groups/guest-group.repository";
import {
  toGuestDetailDto,
  toGuestListItemDto,
  toRsvpDto,
  type GuestDetailDto,
  type GuestEventResponseDto,
  type GuestListItemDto,
  type RsvpDto,
} from "@/modules/guests/guest.dto";
import {
  countGuests,
  countGuestsByInviteStatus,
  findGuest,
  findGuestsByIds,
  insertGuest,
  listGuestsPage,
  setGroupForGuests,
  softDeleteGuest,
  softDeleteGuests,
  updateGuest as updateGuestRow,
  type GuestChanges,
  type GuestFilters,
} from "@/modules/guests/guest.repository";
import type {
  BulkGuestsInput,
  CreateGuestInput,
  ListGuestsQuery,
  RecordRsvpInput,
  UpdateGuestInput,
} from "@/modules/guests/guest.schemas";
import {
  countGuestsAwaitingReply,
  findGuestIdsByRsvp,
  findRsvp,
  headcountByEvent,
  insertRsvps,
  listRsvpsForGuest,
  listRsvpsForGuests,
  softDeleteRsvp,
  softDeleteRsvpsForGuestEvents,
  softDeleteRsvpsForGuests,
  updateRsvp,
} from "@/modules/guests/rsvp.repository";
import type { WeddingAuth } from "@/modules/members/guards";

// Guests (API Design §8.2 to §8.5). Everyone in the wedding can see and edit the guest list
// (permission guests:edit): a parent and the planner work on it together, and optimistic
// concurrency keeps their edits from silently overwriting each other. Guests are NOT app users:
// there is no account here, only a person the team is inviting.

type GuestRow = NonNullable<Awaited<ReturnType<typeof findGuest>>>;

const cursorPosition = z.object({ name: z.string(), id: objectId });

/** A cross-wedding id looks exactly like a missing one (DB Design §9.2 rule 1). */
async function assertGroupInWedding(auth: WeddingAuth, groupId: string) {
  if (!(await findGroup(auth.weddingId, groupId))) {
    throw new AppError("NOT_FOUND", { message: "That group isn't part of this wedding." });
  }
}

/** Loads the wedding's events once and checks every id is one of them. */
async function loadEventsFor(auth: WeddingAuth, eventIds: string[]) {
  const events = await listEventRows(auth.weddingId);
  const byId = new Map(events.map((event) => [event._id.toString(), event]));
  for (const id of eventIds) {
    if (!byId.has(id.toLowerCase())) {
      throw new AppError("NOT_FOUND", { message: "That event isn't part of this wedding." });
    }
  }
  return byId;
}

function businessRule(message: string): AppError {
  return new AppError("BUSINESS_RULE_VIOLATION", { message });
}

/** The guest with each event they are invited to and how they replied. */
async function toDetail(auth: WeddingAuth, guest: GuestRow): Promise<GuestDetailDto> {
  const [rsvps, events] = await Promise.all([
    listRsvpsForGuest(auth.weddingId, guest._id),
    listEventRows(auth.weddingId),
  ]);
  const byId = new Map(events.map((event) => [event._id.toString(), event]));
  const responses: GuestEventResponseDto[] = [];
  for (const rsvp of rsvps) {
    const event = byId.get(rsvp.eventId.toString());
    if (!event) continue; // the event was deleted: its rows are soft-deleted with it
    responses.push({
      ...toRsvpDto(rsvp),
      eventName: event.name,
      eventType: event.type,
      startsAt: event.startsAt.toISOString(),
      timezone: event.timezone,
    });
  }
  // Timeline order, like the events screen.
  responses.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return toGuestDetailDto(guest, responses);
}

export async function listGuests(
  auth: WeddingAuth,
  query: ListGuestsQuery,
): Promise<{ items: GuestListItemDto[]; meta: CursorMeta }> {
  const { limit, cursor, search, eventId, rsvpStatus, ...rest } = query;
  const filters: GuestFilters = { ...rest };
  if (search) filters.namePrefix = normalizeName(search);

  if (eventId) await loadEventsFor(auth, [eventId]);
  if (eventId || rsvpStatus) {
    filters.idIn = await findGuestIdsByRsvp(auth.weddingId, { eventId, status: rsvpStatus });
    if (filters.idIn.length === 0) return { items: [], meta: { nextCursor: null, hasMore: false } };
  }
  if (filters.groupId && filters.groupId !== "none") {
    await assertGroupInWedding(auth, filters.groupId);
  }

  const after = cursor ? decodeCursor(cursor, cursorPosition) : undefined;
  const rows = await listGuestsPage(auth.weddingId, filters, { limit, after });
  const page = paginateByCursor(rows, limit, (row) => ({
    name: row.nameNormalized,
    id: row._id.toString(),
  }));

  // ONE query for the whole page's replies, never one per guest (DB Design §12.4 rule 4).
  const rsvps = await listRsvpsForGuests(
    auth.weddingId,
    page.items.map((row) => row._id),
  );
  const byGuest = new Map<string, typeof rsvps>();
  for (const rsvp of rsvps) {
    const key = rsvp.guestId.toString();
    byGuest.set(key, [...(byGuest.get(key) ?? []), rsvp]);
  }
  return {
    items: page.items.map((row) => toGuestListItemDto(row, byGuest.get(row._id.toString()) ?? [])),
    meta: page.meta,
  };
}

export async function getGuest(auth: WeddingAuth, guestId: string): Promise<GuestDetailDto> {
  const guest = await findGuest(auth.weddingId, guestId);
  if (!guest) throw new AppError("NOT_FOUND");
  return toDetail(auth, guest);
}

export async function createGuest(
  auth: WeddingAuth,
  input: CreateGuestInput,
): Promise<GuestDetailDto> {
  const { eventIds = [], groupId, ...fields } = input;
  if (groupId) await assertGroupInWedding(auth, groupId);
  await loadEventsFor(auth, eventIds);

  // The guest and their event assignments are saved together: no guest without the events they
  // were just invited to, and no assignment without a guest.
  const guest = await withTransaction(async (session) => {
    const created = await insertGuest(
      auth.weddingId,
      { ...fields, groupId: groupId ?? null, createdBy: auth.userId },
      session,
    );
    await insertRsvps(auth.weddingId, created._id, eventIds, session);
    return created;
  });
  return toDetail(auth, guest);
}

export async function updateGuest(
  auth: WeddingAuth,
  guestId: string,
  input: UpdateGuestInput,
): Promise<GuestDetailDto> {
  const existing = await findGuest(auth.weddingId, guestId);
  if (!existing) throw new AppError("NOT_FOUND");

  const { version, eventIds, ...rest } = input;
  if (rest.groupId) await assertGroupInWedding(auth, rest.groupId);
  if (eventIds) await loadEventsFor(auth, eventIds);

  const current = await listRsvpsForGuest(auth.weddingId, guestId);

  // Lowering plus-ones below a reply already recorded would leave an impossible headcount.
  if (rest.plusOnesAllowed !== undefined) {
    const kept = eventIds ? new Set(eventIds.map((id) => id.toLowerCase())) : null;
    const tooMany = current.find(
      (rsvp) =>
        (!kept || kept.has(rsvp.eventId.toString())) &&
        rsvp.attendingCount > 1 + rest.plusOnesAllowed!,
    );
    if (tooMany) {
      throw businessRule(
        `A recorded reply already counts ${tooMany.attendingCount} people. Update that reply first.`,
      );
    }
  }

  const changes: GuestChanges = { ...rest };

  const at = new Date();
  const updated = await withTransaction(async (session) => {
    const result = await updateGuestRow(auth.weddingId, guestId, version, changes, session);
    if (result === "conflict") throw new AppError("VERSION_CONFLICT");
    if (result === "not_found") throw new AppError("NOT_FOUND");

    if (eventIds) {
      const wanted = new Set(eventIds.map((id) => id.toLowerCase()));
      const have = new Set(current.map((rsvp) => rsvp.eventId.toString()));
      const toAdd = [...wanted].filter((id) => !have.has(id));
      const toRemove = [...have].filter((id) => !wanted.has(id));
      await insertRsvps(auth.weddingId, guestId, toAdd, session);
      await softDeleteRsvpsForGuestEvents(
        auth.weddingId,
        guestId,
        toRemove,
        { by: auth.userId, at },
        session,
      );
    }
    return result;
  });
  return toDetail(auth, updated);
}

/** Soft delete; the guest's RSVP rows go with them, in the same transaction (DB Design §6.10 rule 3). */
export async function deleteGuest(auth: WeddingAuth, guestId: string) {
  const existing = await findGuest(auth.weddingId, guestId);
  if (!existing) throw new AppError("NOT_FOUND");

  const at = new Date();
  const rsvpsRemoved = await withTransaction(async (session) => {
    if (!(await softDeleteGuest(auth.weddingId, guestId, { by: auth.userId, at }, session))) {
      throw new AppError("NOT_FOUND");
    }
    return softDeleteRsvpsForGuests(auth.weddingId, [guestId], { by: auth.userId, at }, session);
  });
  return { id: guestId, deletedAt: at.toISOString(), rsvpsRemoved };
}

/** Delete several guests, or move them to a group, from the list's selection bar. */
export async function bulkGuests(auth: WeddingAuth, input: BulkGuestsInput) {
  const ids = [...new Set(input.guestIds.map((id) => id.toLowerCase()))];
  // Any id that is not a live guest of THIS wedding fails the whole request, so a stale selection
  // never half-applies.
  const found = await findGuestsByIds(auth.weddingId, ids);
  if (found.length !== ids.length) {
    throw new AppError("NOT_FOUND", { message: "One of those guests is no longer on the list." });
  }

  if (input.action === "set-group") {
    if (input.groupId) await assertGroupInWedding(auth, input.groupId);
    const affected = await setGroupForGuests(auth.weddingId, ids, input.groupId);
    // Every selected guest is counted: the update also touches updatedAt on each of them.
    return { action: input.action, requested: ids.length, affected };
  }

  const at = new Date();
  const result = await withTransaction(async (session) => {
    const deleted = await softDeleteGuests(auth.weddingId, ids, { by: auth.userId, at }, session);
    const rsvpsRemoved = await softDeleteRsvpsForGuests(
      auth.weddingId,
      ids,
      { by: auth.userId, at },
      session,
    );
    return { deleted, rsvpsRemoved };
  });
  return {
    action: input.action,
    requested: ids.length,
    affected: result.deleted,
    rsvpsRemoved: result.rsvpsRemoved,
  };
}

// ---------------------------------------------------------------------------------------------
// Event assignment and replies (the guest's RSVP rows)
// ---------------------------------------------------------------------------------------------

export async function listGuestRsvps(auth: WeddingAuth, guestId: string): Promise<RsvpDto[]> {
  if (!(await findGuest(auth.weddingId, guestId))) throw new AppError("NOT_FOUND");
  const rows = await listRsvpsForGuest(auth.weddingId, guestId);
  return rows.map(toRsvpDto);
}

/** Invites the guest to one more event: a pending RSVP row. */
export async function assignGuestToEvent(
  auth: WeddingAuth,
  guestId: string,
  eventId: string,
): Promise<RsvpDto> {
  if (!(await findGuest(auth.weddingId, guestId))) throw new AppError("NOT_FOUND");
  await loadEventsFor(auth, [eventId]);
  if (await findRsvp(auth.weddingId, guestId, eventId)) {
    throw new AppError("CONFLICT", { message: "This guest is already invited to that event." });
  }
  const [row] = await insertRsvps(auth.weddingId, guestId, [eventId]);
  return toRsvpDto(row!);
}

/** Takes the guest off an event; any reply recorded for it goes with the row. */
export async function unassignGuestFromEvent(auth: WeddingAuth, guestId: string, eventId: string) {
  if (!(await findGuest(auth.weddingId, guestId))) throw new AppError("NOT_FOUND");
  const at = new Date();
  if (!(await softDeleteRsvp(auth.weddingId, guestId, eventId, { by: auth.userId, at }))) {
    throw new AppError("NOT_FOUND");
  }
  return { guestId, eventId, removedAt: at.toISOString() };
}

/**
 * A member records a reply by hand, for example after a phone call. `attendingCount` is everyone
 * coming, the guest included, and cannot exceed 1 plus the guest's plus-ones (a business rule:
 * 422, not a validation error). Declined and pending replies count nobody.
 */
export async function recordRsvp(
  auth: WeddingAuth,
  guestId: string,
  eventId: string,
  input: RecordRsvpInput,
): Promise<RsvpDto> {
  const guest = await findGuest(auth.weddingId, guestId);
  if (!guest) throw new AppError("NOT_FOUND");
  const existing = await findRsvp(auth.weddingId, guestId, eventId);
  if (!existing) throw new AppError("NOT_FOUND");

  const comes = input.status === "attending" || input.status === "maybe";
  const attendingCount = comes ? (input.attendingCount ?? Math.max(existing.attendingCount, 1)) : 0;
  if (comes && (attendingCount < 1 || attendingCount > 1 + guest.plusOnesAllowed)) {
    throw businessRule(
      guest.plusOnesAllowed === 0
        ? "This guest can't bring anyone: the count can only be 1."
        : `The count must be between 1 and ${1 + guest.plusOnesAllowed} (the guest plus ${guest.plusOnesAllowed} allowed).`,
    );
  }

  const pending = input.status === "pending";
  const updated = await updateRsvp(auth.weddingId, guestId, eventId, {
    status: input.status,
    attendingCount,
    note: input.note === undefined ? (existing.note ?? null) : input.note,
    respondedAt: pending ? null : new Date(),
    respondedVia: pending ? null : "member",
    respondedByUserId: pending ? null : auth.userId,
  });
  if (!updated) throw new AppError("NOT_FOUND");
  return toRsvpDto(updated);
}

// ---------------------------------------------------------------------------------------------
// Numbers for the Guests screen
// ---------------------------------------------------------------------------------------------

export interface GuestSummary {
  totalGuests: number;
  /** People expected: for one event, its attending headcount; for all events, the busiest event's. */
  expectedHeadcount: number;
  unsentInvitations: number;
  /** Guests with at least one reply still pending (for the chosen event, if any). */
  awaitingResponse: number;
}

export async function getGuestSummary(auth: WeddingAuth, eventId?: string): Promise<GuestSummary> {
  if (eventId) await loadEventsFor(auth, [eventId]);
  const [totalGuests, inviteCounts, headcounts, awaitingResponse] = await Promise.all([
    countGuests(auth.weddingId),
    countGuestsByInviteStatus(auth.weddingId),
    headcountByEvent(auth.weddingId, eventId),
    countGuestsAwaitingReply(auth.weddingId, eventId),
  ]);
  return {
    totalGuests,
    expectedHeadcount: Math.max(0, ...headcounts.map((row) => row.attendingCount)),
    unsentInvitations: inviteCounts.not_invited,
    awaitingResponse,
  };
}

/** API Design §8.9: replies and headcount for one event. */
export async function getEventHeadcount(auth: WeddingAuth, eventId: string) {
  await loadEventsFor(auth, [eventId]);
  const [row] = await headcountByEvent(auth.weddingId, eventId);
  return {
    eventId,
    byStatus: row?.byStatus ?? { pending: 0, attending: 0, declined: 0, maybe: 0 },
    totalAttendingCount: row?.attendingCount ?? 0,
  };
}
