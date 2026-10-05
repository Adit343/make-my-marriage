import "server-only";
import { Error as MongooseError, type ClientSession, type Types } from "mongoose";
import { connectDb } from "@/infrastructure/database/connection";
import { Wedding } from "@/models/wedding.model";
import type { CreateWeddingInput } from "@/modules/weddings/wedding.schemas";

type Id = Types.ObjectId | string;

export async function insertWedding(
  input: Omit<CreateWeddingInput, "relationship"> & { createdBy: Id },
  session: ClientSession,
) {
  const [wedding] = await Wedding.create([input], { session });
  return wedding!.toObject();
}

export async function findWedding(weddingId: Id) {
  await connectDb();
  return Wedding.findOne({ _id: weddingId }).lean();
}

export interface WeddingChanges {
  title?: string;
  partners?: { name: string }[];
  weddingDate?: string | null;
  timezone?: string;
  currency?: string;
  location?: unknown;
  budgetTotalMinor?: number | null;
  status?: "planning" | "completed" | "archived";
}

/**
 * Optimistic concurrency (decision C5, DB Design §3.7): the write only lands if the wedding is
 * still at the version the client last read. Mongoose's save() adds the same guard against a
 * write that sneaks in between our read and save.
 */
export async function updateWedding(
  weddingId: Id,
  version: number,
  changes: WeddingChanges,
): Promise<"conflict" | "not_found" | NonNullable<Awaited<ReturnType<typeof findWedding>>>> {
  await connectDb();
  const wedding = await Wedding.findOne({ _id: weddingId });
  if (!wedding) return "not_found";
  if (wedding.__v !== version) return "conflict";

  wedding.set(changes);
  try {
    await wedding.save();
  } catch (error) {
    if (error instanceof MongooseError.VersionError) return "conflict";
    throw error;
  }
  return wedding.toObject();
}

/** Soft delete with a grace period (DB Design §10.3). False if it was already deleted. */
export async function softDeleteWedding(
  weddingId: Id,
  deletion: { by: Id; at: Date; purgeAfter: Date },
  session: ClientSession,
): Promise<boolean> {
  await connectDb();
  const result = await Wedding.updateOne(
    { _id: weddingId },
    {
      $set: {
        deletedAt: deletion.at,
        deletedBy: deletion.by,
        status: "archived",
        purgeAfter: deletion.purgeAfter,
      },
    },
    { session },
  );
  return result.modifiedCount === 1;
}

/** A soft-deleted wedding, for restore flows (filters on deletedAt, so the plugin steps aside). */
export async function findDeletedWedding(weddingId: Id) {
  await connectDb();
  return Wedding.findOne({ _id: weddingId, deletedAt: { $type: "date" } }).lean();
}

/** Only inside the grace period; restored weddings go back to "planning". */
export async function restoreWedding(weddingId: Id, session: ClientSession): Promise<boolean> {
  await connectDb();
  const result = await Wedding.updateOne(
    { _id: weddingId, deletedAt: { $type: "date" }, purgeAfter: { $gt: new Date() } },
    {
      $set: {
        deletedAt: null,
        deletedBy: null,
        deletionReason: null,
        purgeAfter: null,
        status: "planning",
      },
    },
    { session },
  );
  return result.modifiedCount === 1;
}
