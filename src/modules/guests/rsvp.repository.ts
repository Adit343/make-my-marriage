import "server-only";
import { Types, type ClientSession } from "mongoose";
import { aggregateScoped } from "@/infrastructure/database/aggregate";
import { connectDb } from "@/infrastructure/database/connection";
import type { RsvpStatus } from "@/lib/constants/enums";
import { Rsvp } from "@/models/rsvp.model";

type Id = Types.ObjectId | string;

// RSVP rows: one per guest per event (DB Design §6.11). The row existing means "invited to this
// event"; its status is the reply. Every function takes weddingId first.

export interface RsvpChanges {
  status: RsvpStatus;
  attendingCount: number;
  note?: string | null;
  respondedAt: Date | null;
  respondedVia: "member" | null;
  respondedByUserId: Id | null;
}

/** Assigns a guest to events: one pending row each. The caller has checked the events exist. */
export async function insertRsvps(
  weddingId: Id,
  guestId: Id,
  eventIds: Id[],
  session?: ClientSession,
) {
  if (eventIds.length === 0) return [];
  await connectDb();
  const rows = await Rsvp.create(
    eventIds.map((eventId) => ({ weddingId, guestId, eventId })),
    { session, ordered: true },
  );
  return rows.map((row) => row.toObject());
}

export async function findRsvp(weddingId: Id, guestId: Id, eventId: Id) {
  await connectDb();
  return Rsvp.findOne({ weddingId, guestId, eventId }).lean();
}

export async function listRsvpsForGuest(weddingId: Id, guestId: Id) {
  await connectDb();
  return Rsvp.find({ weddingId, guestId }).sort({ _id: 1 }).lean();
}

/** ONE query for a whole page of guests (no N+1: DB Design §12.4 rule 4). */
export async function listRsvpsForGuests(weddingId: Id, guestIds: Id[]) {
  if (guestIds.length === 0) return [];
  await connectDb();
  return Rsvp.find({ weddingId, guestId: { $in: guestIds } }).lean();
}

/** Guests that have at least one RSVP row matching: the list's event and RSVP filters. */
export async function findGuestIdsByRsvp(
  weddingId: Id,
  match: { eventId?: string; status?: RsvpStatus },
): Promise<string[]> {
  await connectDb();
  const ids = await Rsvp.distinct("guestId", {
    weddingId,
    ...(match.eventId ? { eventId: match.eventId } : {}),
    ...(match.status ? { status: match.status } : {}),
  });
  return ids.map((id) => id.toString());
}

export async function updateRsvp(weddingId: Id, guestId: Id, eventId: Id, changes: RsvpChanges) {
  await connectDb();
  return Rsvp.findOneAndUpdate(
    { weddingId, guestId, eventId },
    { $set: changes },
    { returnDocument: "after" },
  )
    .lean()
    .exec();
}

export async function softDeleteRsvp(
  weddingId: Id,
  guestId: Id,
  eventId: Id,
  deletion: { by: Id; at: Date },
  session?: ClientSession,
): Promise<boolean> {
  await connectDb();
  const result = await Rsvp.updateOne(
    { weddingId, guestId, eventId },
    { $set: { deletedAt: deletion.at, deletedBy: deletion.by } },
    { session },
  );
  return result.modifiedCount === 1;
}

/** Removing a guest, or several, takes their RSVP rows with them (DB Design §6.10 rule 3). */
export async function softDeleteRsvpsForGuests(
  weddingId: Id,
  guestIds: Id[],
  deletion: { by: Id; at: Date },
  session: ClientSession,
): Promise<number> {
  await connectDb();
  const result = await Rsvp.updateMany(
    { weddingId, guestId: { $in: guestIds } },
    { $set: { deletedAt: deletion.at, deletedBy: deletion.by } },
    { session },
  );
  return result.modifiedCount;
}

/** Deleting an event takes its RSVP rows with it (DB Design §6.7 rule 1). */
export async function softDeleteRsvpsForEvent(
  weddingId: Id,
  eventId: Id,
  deletion: { by: Id; at: Date },
  session: ClientSession,
): Promise<number> {
  await connectDb();
  const result = await Rsvp.updateMany(
    { weddingId, eventId },
    { $set: { deletedAt: deletion.at, deletedBy: deletion.by } },
    { session },
  );
  return result.modifiedCount;
}

/** Soft-deletes the rows of events a guest is being taken off: one query for the whole set. */
export async function softDeleteRsvpsForGuestEvents(
  weddingId: Id,
  guestId: Id,
  eventIds: Id[],
  deletion: { by: Id; at: Date },
  session?: ClientSession,
): Promise<number> {
  if (eventIds.length === 0) return 0;
  await connectDb();
  const result = await Rsvp.updateMany(
    { weddingId, guestId, eventId: { $in: eventIds } },
    { $set: { deletedAt: deletion.at, deletedBy: deletion.by } },
    { session },
  );
  return result.modifiedCount;
}

export interface EventHeadcount {
  eventId: string;
  byStatus: Record<RsvpStatus, number>;
  /** Everyone attending (including plus-ones): the catering number. */
  attendingCount: number;
}

/**
 * Replies per event, from one aggregation over {weddingId, eventId, status}: how many guests are
 * in each state and how many people are coming (DB Design §6.11 "Headcount for catering").
 */
export async function headcountByEvent(weddingId: Id, eventId?: string): Promise<EventHeadcount[]> {
  const rows = await aggregateScoped<{
    _id: { eventId: Types.ObjectId; status: RsvpStatus };
    count: number;
    people: number;
  }>(Rsvp, weddingId, [
    ...(eventId ? [{ $match: { eventId: new Types.ObjectId(eventId) } }] : []),
    {
      $group: {
        _id: { eventId: "$eventId", status: "$status" },
        count: { $sum: 1 },
        people: { $sum: "$attendingCount" },
      },
    },
  ]);

  const byEvent = new Map<string, EventHeadcount>();
  for (const row of rows) {
    const key = row._id.eventId.toString();
    const entry = byEvent.get(key) ?? {
      eventId: key,
      byStatus: { pending: 0, attending: 0, declined: 0, maybe: 0 },
      attendingCount: 0,
    };
    entry.byStatus[row._id.status] = row.count;
    if (row._id.status === "attending") entry.attendingCount = row.people;
    byEvent.set(key, entry);
  }
  return [...byEvent.values()];
}

export interface GuestReplyCounts {
  guestId: string;
  attending: number;
  maybe: number;
  pending: number;
  declined: number;
}

/** For every invited guest, how many of their events are in each state: one aggregation. */
export async function replyCountsByGuest(weddingId: Id): Promise<GuestReplyCounts[]> {
  const rows = await aggregateScoped<{ _id: Types.ObjectId } & Record<RsvpStatus, number>>(
    Rsvp,
    weddingId,
    [
      {
        $group: {
          _id: "$guestId",
          attending: { $sum: { $cond: [{ $eq: ["$status", "attending"] }, 1, 0] } },
          maybe: { $sum: { $cond: [{ $eq: ["$status", "maybe"] }, 1, 0] } },
          pending: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
          declined: { $sum: { $cond: [{ $eq: ["$status", "declined"] }, 1, 0] } },
        },
      },
    ],
  );
  return rows.map((row) => ({
    guestId: row._id.toString(),
    attending: row.attending,
    maybe: row.maybe,
    pending: row.pending,
    declined: row.declined,
  }));
}

/** How many distinct guests have a pending reply (optionally for one event). */
export async function countGuestsAwaitingReply(weddingId: Id, eventId?: string): Promise<number> {
  const ids = await findGuestIdsByRsvp(weddingId, { eventId, status: "pending" });
  return ids.length;
}
