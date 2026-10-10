import "server-only";
import { AppError } from "@/lib/errors";
import type { WeddingAuth } from "@/modules/members/guards";
import { can } from "@/modules/members/permissions";
import { findWedding } from "@/modules/weddings/wedding.repository";
import { toEventDto, type EventDto } from "@/modules/events/event.dto";
import {
  findEvent,
  insertEvent,
  listEvents as listEventRows,
  softDeleteEvent,
  updateEvent as updateEventRow,
  type EventChanges,
  type ScheduleItemInput,
} from "@/modules/events/event.repository";
import type { CreateEventInput, UpdateEventInput } from "@/modules/events/event.schemas";

// Events (API Design §7.1). Everyone in the wedding can see events and create them. Editing or
// deleting someone else's event needs events:manage-any (admin and owner): owner decision
// 2026-10-10. Routes check membership and events:edit; WHICH event is being touched is only known
// here, so the ownership rule lives in this file.

type EventRow = NonNullable<Awaited<ReturnType<typeof findEvent>>>;

function canManage(auth: WeddingAuth, event: { createdBy: { toString(): string } }): boolean {
  return (
    event.createdBy.toString() === auth.userId || can(auth.membership.role, "events:manage-any")
  );
}

function toDto(auth: WeddingAuth, event: EventRow): EventDto {
  return toEventDto(event, { canManage: canManage(auth, event) });
}

/** Timeline order: by time of day. Stable, so lines at the same time keep the order they were sent. */
function toScheduleRows(items: NonNullable<CreateEventInput["schedule"]>): ScheduleItemInput[] {
  return items
    .map((item) => ({
      ...(item.id ? { _id: item.id } : {}),
      time: item.time,
      title: item.title,
      ...(item.notes ? { notes: item.notes } : {}),
      isPublic: item.isPublic ?? false,
    }))
    .sort((a, b) => a.time.localeCompare(b.time));
}

function invalidEnd(): AppError {
  return new AppError("VALIDATION_ERROR", {
    details: [{ location: "body", path: "endsAt", message: "endsAt must be after startsAt" }],
  });
}

export async function listEvents(auth: WeddingAuth): Promise<EventDto[]> {
  const rows = await listEventRows(auth.weddingId);
  return rows.map((row) => toDto(auth, row));
}

export async function getEvent(auth: WeddingAuth, eventId: string): Promise<EventDto> {
  const event = await findEvent(auth.weddingId, eventId);
  if (!event) throw new AppError("NOT_FOUND");
  return toDto(auth, event);
}

export async function createEvent(auth: WeddingAuth, input: CreateEventInput): Promise<EventDto> {
  const wedding = await findWedding(auth.weddingId);
  if (!wedding) throw new AppError("NOT_FOUND");

  const { schedule, ...fields } = input;
  const event = await insertEvent(auth.weddingId, {
    ...fields,
    timezone: input.timezone ?? wedding.timezone,
    ...(schedule ? { schedule: toScheduleRows(schedule) } : {}),
    createdBy: auth.userId,
  });
  return toDto(auth, event);
}

export async function updateEvent(
  auth: WeddingAuth,
  eventId: string,
  input: UpdateEventInput,
): Promise<EventDto> {
  const existing = await findEvent(auth.weddingId, eventId);
  if (!existing) throw new AppError("NOT_FOUND");
  if (!canManage(auth, existing)) throw new AppError("INSUFFICIENT_ROLE");

  const { version, schedule, ...rest } = input;
  // The body check only sees fields that arrive together; here it is checked against the stored
  // values, so changing just one of the two cannot leave the event ending before it starts.
  const startsAt = rest.startsAt ?? existing.startsAt;
  const endsAt = rest.endsAt === undefined ? existing.endsAt : rest.endsAt;
  if (endsAt && endsAt.getTime() <= startsAt.getTime()) throw invalidEnd();

  const changes: EventChanges = {
    ...rest,
    ...(schedule ? { schedule: toScheduleRows(schedule) } : {}),
  };
  const result = await updateEventRow(auth.weddingId, eventId, version, changes);
  if (result === "conflict") throw new AppError("VERSION_CONFLICT");
  if (result === "not_found") throw new AppError("NOT_FOUND");
  return toDto(auth, result);
}

/**
 * Soft delete (DB Design §6.7 rule 1). Once RSVPs (Phase 3) and tasks/expenses exist, this is
 * also where they are soft-deleted / set to eventId null in the same transaction, and the
 * response reports how many rows were affected. None of those collections exist yet.
 */
export async function deleteEvent(auth: WeddingAuth, eventId: string) {
  const existing = await findEvent(auth.weddingId, eventId);
  if (!existing) throw new AppError("NOT_FOUND");
  if (!canManage(auth, existing)) throw new AppError("INSUFFICIENT_ROLE");

  const at = new Date();
  if (!(await softDeleteEvent(auth.weddingId, eventId, { by: auth.userId, at }))) {
    throw new AppError("NOT_FOUND");
  }
  return { id: eventId, deletedAt: at.toISOString() };
}
