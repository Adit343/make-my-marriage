import "server-only";
import type { Types } from "mongoose";
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
