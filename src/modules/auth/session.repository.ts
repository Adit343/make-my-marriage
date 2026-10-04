import "server-only";
import type { Types } from "mongoose";
import { connectDb } from "@/infrastructure/database/connection";
import { Session } from "@/models/session.model";

type Id = Types.ObjectId | string;

export async function createSession(input: {
  userId: Id;
  tokenHash: string;
  expiresAt: Date;
  persistent: boolean;
  userAgent?: string | null;
}) {
  await connectDb();
  const session = await Session.create({
    userId: input.userId,
    tokenHash: input.tokenHash,
    expiresAt: input.expiresAt,
    lastUsedAt: new Date(),
    persistent: input.persistent,
    userAgent: input.userAgent?.slice(0, 300) ?? undefined,
  });
  return session.toObject();
}

/** Valid = not revoked and not expired. TTL deletion lags, so expiry is checked here too. */
export async function findValidSession(tokenHash: string) {
  await connectDb();
  return Session.findOne({ tokenHash, revokedAt: null, expiresAt: { $gt: new Date() } }).lean();
}

export async function touchSession(sessionId: Id, expiresAt: Date): Promise<void> {
  await connectDb();
  await Session.updateOne({ _id: sessionId }, { $set: { lastUsedAt: new Date(), expiresAt } });
}

/** Scoped to the owner so one user can never revoke another user's session. */
export async function revokeSession(userId: Id, sessionId: Id): Promise<boolean> {
  await connectDb();
  const result = await Session.updateOne(
    { _id: sessionId, userId, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );
  return result.modifiedCount > 0;
}

export async function revokeAllSessions(userId: Id, options: { except?: Id } = {}) {
  await connectDb();
  const filter: Record<string, unknown> = { userId, revokedAt: null };
  if (options.except) filter._id = { $ne: options.except };
  await Session.updateMany(filter, { $set: { revokedAt: new Date() } });
}

export async function listActiveSessions(userId: Id) {
  await connectDb();
  return Session.find({ userId, revokedAt: null, expiresAt: { $gt: new Date() } })
    .sort({ lastUsedAt: -1 })
    .lean();
}
