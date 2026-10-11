import "server-only";
import { Error as MongooseError, type ClientSession, type Types } from "mongoose";
import { connectDb } from "@/infrastructure/database/connection";
import { aggregateScoped } from "@/infrastructure/database/aggregate";
import type { GuestSide } from "@/lib/constants/enums";
import { Guest } from "@/models/guest.model";
import { GuestGroup } from "@/models/guestGroup.model";

type Id = Types.ObjectId | string;

// Every function takes weddingId (DB Design §9.2). Soft-deleted groups are hidden by the plugin.

export interface NewGroup {
  name: string;
  side: GuestSide;
  notes?: string;
  createdBy: Id;
}

export interface GroupChanges {
  name?: string;
  side?: GuestSide;
  notes?: string | null;
}

/** MongoDB's duplicate-key error: the unique {weddingId, nameNormalized} index said no. */
export function isDuplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: number }).code === 11000;
}

export async function insertGroup(weddingId: Id, input: NewGroup) {
  await connectDb();
  const group = await GuestGroup.create({ ...input, weddingId });
  return group.toObject();
}

export async function findGroup(weddingId: Id, groupId: Id) {
  await connectDb();
  return GuestGroup.findOne({ _id: groupId, weddingId }).lean();
}

export async function listGroups(weddingId: Id) {
  await connectDb();
  return GuestGroup.find({ weddingId }).sort({ nameNormalized: 1, _id: 1 }).lean();
}

/** Live guests per group id (ungrouped guests are not counted). One aggregation for all groups. */
export async function countGuestsByGroup(weddingId: Id): Promise<Map<string, number>> {
  const rows = await aggregateScoped<{ _id: Types.ObjectId | null; count: number }>(
    Guest,
    weddingId,
    [{ $group: { _id: "$groupId", count: { $sum: 1 } } }],
  );
  const counts = new Map<string, number>();
  for (const row of rows) if (row._id) counts.set(row._id.toString(), row.count);
  return counts;
}

export async function updateGroup(
  weddingId: Id,
  groupId: Id,
  version: number,
  changes: GroupChanges,
): Promise<"conflict" | "not_found" | NonNullable<Awaited<ReturnType<typeof findGroup>>>> {
  await connectDb();
  const group = await GuestGroup.findOne({ _id: groupId, weddingId });
  if (!group) return "not_found";
  if (group.__v !== version) return "conflict";

  group.set(changes);
  try {
    await group.save();
  } catch (error) {
    if (error instanceof MongooseError.VersionError) return "conflict";
    throw error;
  }
  return group.toObject();
}

export async function softDeleteGroup(
  weddingId: Id,
  groupId: Id,
  deletion: { by: Id; at: Date },
  session: ClientSession,
): Promise<boolean> {
  await connectDb();
  const result = await GuestGroup.updateOne(
    { _id: groupId, weddingId },
    { $set: { deletedAt: deletion.at, deletedBy: deletion.by } },
    { session },
  );
  return result.modifiedCount === 1;
}
