import "server-only";
import type { Types } from "mongoose";
import { connectDb } from "@/infrastructure/database/connection";
import { PasswordResetToken } from "@/models/passwordResetToken.model";

type Id = Types.ObjectId | string;

export async function createResetToken(userId: Id, tokenHash: string, expiresAt: Date) {
  await connectDb();
  await PasswordResetToken.create({ userId, tokenHash, expiresAt });
}

/** Atomic single-use claim (DB Design §6.3): two clicks can never both succeed. */
export async function claimResetToken(tokenHash: string) {
  await connectDb();
  return PasswordResetToken.findOneAndUpdate(
    { tokenHash, usedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { usedAt: new Date() } },
  ).lean();
}

/** Only the newest link should work: retire every other unused token for the user. */
export async function retireOutstandingTokens(userId: Id): Promise<void> {
  await connectDb();
  await PasswordResetToken.updateMany({ userId, usedAt: null }, { $set: { usedAt: new Date() } });
}
