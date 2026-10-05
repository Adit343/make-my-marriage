import "server-only";
import type { ClientSession, Types } from "mongoose";
import { connectDb } from "@/infrastructure/database/connection";
import type { PasswordHash } from "@/lib/crypto/password";
import { normalizeEmail } from "@/lib/text/normalize";
import { User } from "@/models/user.model";

// Users are account-level, not wedding-owned, so lookups here are by user id or email rather than
// by weddingId (DB Design §9.2 applies to wedding-owned collections).

type Id = Types.ObjectId | string;

export async function findUserById(userId: Id) {
  await connectDb();
  return User.findOne({ _id: userId }).lean();
}

/** Display fields for a set of users in one query (avoids N+1 — DB Design §12.4 rule 4). */
export async function findUserSummaries(userIds: Id[]) {
  await connectDb();
  return User.find({ _id: { $in: userIds } })
    .select({ name: 1, email: 1 })
    .lean();
}

export async function findUserByEmail(email: string, options: { withPassword?: boolean } = {}) {
  await connectDb();
  const query = User.findOne({ emailNormalized: normalizeEmail(email) });
  if (options.withPassword) query.select("+passwordAuth");
  return query.lean();
}

/** Includes soft-deleted users: their emails stay reserved (DB Design §6.1 rule 4). */
export async function emailIsRegistered(email: string): Promise<boolean> {
  await connectDb();
  const count = await User.countDocuments({ emailNormalized: normalizeEmail(email) }).setOptions({
    withDeleted: true,
  });
  return count > 0;
}

export async function findUserByGoogleSub(sub: string) {
  await connectDb();
  return User.findOne({
    authProviders: { $elemMatch: { provider: "google", providerUserId: sub } },
  }).lean();
}

export async function findUserWithPassword(userId: Id) {
  await connectDb();
  return User.findOne({ _id: userId }).select("+passwordAuth").lean();
}

export async function createUser(input: {
  email: string;
  name: string;
  passwordAuth?: PasswordHash | null;
  google?: { sub: string; email: string };
}) {
  await connectDb();
  const now = new Date();
  const user = await User.create({
    email: input.email,
    name: input.name,
    passwordAuth: input.passwordAuth ?? null,
    authProviders: input.google
      ? [
          {
            provider: "google",
            providerUserId: input.google.sub,
            email: input.google.email,
            linkedAt: now,
          },
        ]
      : [],
    lastLoginAt: now,
  });
  return user.toObject();
}

export async function setPassword(userId: Id, passwordAuth: PasswordHash): Promise<void> {
  await connectDb();
  await User.updateOne({ _id: userId }, { $set: { passwordAuth } });
}

export async function linkGoogleIdentity(userId: Id, google: { sub: string; email: string }) {
  await connectDb();
  await User.updateOne(
    { _id: userId },
    {
      $push: {
        authProviders: {
          provider: "google",
          providerUserId: google.sub,
          email: google.email,
          linkedAt: new Date(),
        },
      },
    },
  );
}

export async function recordLogin(userId: Id): Promise<void> {
  await connectDb();
  await User.updateOne({ _id: userId }, { $set: { lastLoginAt: new Date() } });
}

export async function setName(userId: Id, name: string): Promise<void> {
  await connectDb();
  await User.updateOne({ _id: userId }, { $set: { name } });
}

/**
 * Account deletion, step one (DB Design §10.4): the row stays, so records that reference it by
 * createdBy keep working, and the email stays reserved. Anonymization is a later manual script.
 */
export async function markUserDeleted(userId: Id, session?: ClientSession): Promise<void> {
  await connectDb();
  await User.updateOne(
    { _id: userId },
    { $set: { status: "pending_deletion", deletedAt: new Date(), deletedBy: userId } },
    { session },
  );
}
