import "server-only";
import { Error as MongooseError, type ClientSession, type Types } from "mongoose";
import { connectDb } from "@/infrastructure/database/connection";
import type { StreamProvider, StreamStatus } from "@/lib/constants/enums";
import { LiveStream } from "@/models/liveStream.model";

type Id = Types.ObjectId | string;

// DB Design §6.16. Wedding-owned: every function but the public lookup by token takes weddingId.
// `link.tokenHash` and `link.tokenEnc` are never selected unless asked for.

export interface StoredStreamLink {
  tokenHash: string;
  tokenEnc: string;
  createdAt: Date;
  expiresAt: Date | null;
  revokedAt: Date | null;
}

export interface NewStream {
  eventId: Id | null;
  provider: StreamProvider;
  streamUrl: string;
  title: string;
  description?: string;
  startTime: Date;
  status: StreamStatus;
  link: StoredStreamLink;
  createdBy: Id;
}

export interface StreamChanges {
  eventId?: Id | null;
  provider?: StreamProvider;
  streamUrl?: string;
  title?: string;
  description?: string | null;
  startTime?: Date;
  status?: StreamStatus;
}

export async function insertStream(weddingId: Id, input: NewStream) {
  await connectDb();
  const stream = await LiveStream.create({ ...input, weddingId });
  return stream.toObject();
}

/** Soonest first (the index is { weddingId, startTime }); each stream with its encrypted link. */
export async function listStreams(weddingId: Id) {
  await connectDb();
  return LiveStream.find({ weddingId })
    .select("+link.tokenEnc")
    .sort({ startTime: 1, _id: 1 })
    .limit(200)
    .lean();
}

export async function findStream(weddingId: Id, streamId: Id) {
  await connectDb();
  return LiveStream.findOne({ _id: streamId, weddingId }).select("+link.tokenEnc").lean();
}

export async function countStreams(weddingId: Id): Promise<number> {
  await connectDb();
  return LiveStream.countDocuments({ weddingId });
}

/** Optimistic concurrency (decision C5): the write only lands if the stream is still at `version`. */
export async function updateStream(
  weddingId: Id,
  streamId: Id,
  version: number,
  changes: StreamChanges,
): Promise<"conflict" | "not_found" | NonNullable<Awaited<ReturnType<typeof findStream>>>> {
  await connectDb();
  const stream = await LiveStream.findOne({ _id: streamId, weddingId });
  if (!stream) return "not_found";
  if (stream.__v !== version) return "conflict";

  stream.set(changes);
  try {
    await stream.save();
  } catch (error) {
    if (error instanceof MongooseError.VersionError) return "conflict";
    throw error;
  }
  return (await findStream(weddingId, streamId)) ?? "not_found";
}

/** A brand-new link; the old token stops working at once because only the new hash is kept. */
export async function setStreamLink(weddingId: Id, streamId: Id, link: StoredStreamLink) {
  await connectDb();
  return LiveStream.findOneAndUpdate(
    { _id: streamId, weddingId },
    { $set: { link } },
    { returnDocument: "after" },
  )
    .select("+link.tokenEnc")
    .lean()
    .exec();
}

/** False if the stream does not exist in this wedding or is already deleted. */
export async function softDeleteStream(
  weddingId: Id,
  streamId: Id,
  deletion: { by: Id; at: Date },
  session?: ClientSession,
): Promise<boolean> {
  await connectDb();
  const result = await LiveStream.updateOne(
    { _id: streamId, weddingId },
    { $set: { deletedAt: deletion.at, deletedBy: deletion.by } },
    { session },
  );
  return result.modifiedCount === 1;
}

/** Deleting an event keeps its streams: they just stop being linked to it. */
export async function unlinkStreamsFromEvent(
  weddingId: Id,
  eventId: Id,
  session?: ClientSession,
): Promise<number> {
  await connectDb();
  const result = await LiveStream.updateMany(
    { weddingId, eventId },
    { $set: { eventId: null } },
    { session },
  );
  return result.modifiedCount;
}

/**
 * The ONE stream lookup that is by token instead of by wedding: a guest opening /live/<token> has
 * no session and no wedding in the address (DB Design §8.3). The service then checks the link and
 * the wedding are still usable. Soft-deleted streams are never found (the plugin filters them).
 */
export async function findStreamByTokenHash(tokenHash: string) {
  await connectDb();
  return LiveStream.findOne({ "link.tokenHash": tokenHash }).lean();
}
