import "server-only";
import { Error as MongooseError, type Types } from "mongoose";
import { connectDb } from "@/infrastructure/database/connection";
import type { EventType } from "@/lib/constants/enums";
import type { LocationInput } from "@/lib/validation/location";
import { Event } from "@/models/event.model";

type Id = Types.ObjectId | string;

// Every function takes weddingId (DB Design §9.2): there is no way to read or change an event
// without naming the wedding it must belong to. Soft-deleted events are hidden by the plugin.

export interface ScheduleItemInput {
  _id?: string;
  time: string;
  title: string;
  notes?: string;
  isPublic: boolean;
}

export interface NewEvent {
  name: string;
  type: EventType;
  startsAt: Date;
  endsAt?: Date | null;
  timezone: string;
  location?: LocationInput;
  description?: string;
  dressCode?: string;
  sortOrder?: number;
  isPublic?: boolean;
  schedule?: ScheduleItemInput[];
  createdBy: Id;
}

export interface EventChanges {
  name?: string;
  type?: EventType;
  startsAt?: Date;
  endsAt?: Date | null;
  timezone?: string;
  location?: LocationInput | null;
  description?: string | null;
  dressCode?: string | null;
  sortOrder?: number;
  isPublic?: boolean;
  schedule?: ScheduleItemInput[];
}

export async function insertEvent(weddingId: Id, input: NewEvent) {
  await connectDb();
  const event = await Event.create({ ...input, weddingId });
  return event.toObject();
}

/** The timeline, soonest first; `sortOrder` then `_id` keep same-time events in a stable order. */
export async function listEvents(weddingId: Id) {
  await connectDb();
  return Event.find({ weddingId }).sort({ startsAt: 1, sortOrder: 1, _id: 1 }).lean();
}

export async function findEvent(weddingId: Id, eventId: Id) {
  await connectDb();
  return Event.findOne({ _id: eventId, weddingId }).lean();
}

/**
 * Optimistic concurrency (decision C5, DB Design §3.7): the write only lands if the event is still
 * at the version the client last read. save() adds the same guard against a write that sneaks in
 * between our read and our save.
 */
export async function updateEvent(
  weddingId: Id,
  eventId: Id,
  version: number,
  changes: EventChanges,
): Promise<"conflict" | "not_found" | NonNullable<Awaited<ReturnType<typeof findEvent>>>> {
  await connectDb();
  const event = await Event.findOne({ _id: eventId, weddingId });
  if (!event) return "not_found";
  if (event.__v !== version) return "conflict";

  event.set(changes);
  try {
    await event.save();
  } catch (error) {
    if (error instanceof MongooseError.VersionError) return "conflict";
    throw error;
  }
  return event.toObject();
}

/** False if the event does not exist in this wedding or is already deleted. */
export async function softDeleteEvent(
  weddingId: Id,
  eventId: Id,
  deletion: { by: Id; at: Date },
): Promise<boolean> {
  await connectDb();
  const result = await Event.updateOne(
    { _id: eventId, weddingId },
    { $set: { deletedAt: deletion.at, deletedBy: deletion.by } },
  );
  return result.modifiedCount === 1;
}

export async function countEvents(weddingId: Id): Promise<number> {
  await connectDb();
  return Event.countDocuments({ weddingId });
}

/** The soonest event that has not finished yet (one that is under way counts). */
export async function findNextEvent(weddingId: Id, now: Date) {
  await connectDb();
  return Event.findOne({
    weddingId,
    $or: [{ startsAt: { $gte: now } }, { endsAt: { $gte: now } }],
  })
    .sort({ startsAt: 1, sortOrder: 1, _id: 1 })
    .lean();
}
