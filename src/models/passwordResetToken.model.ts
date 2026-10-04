import { Schema, type InferSchemaType } from "mongoose";
import { defineModel } from "@/models/shared/define-model";

// DB Design §6.3 (in V1 scope per decision D2). Short-lived, single-use; only the hash is stored.
// Claim it atomically: findOneAndUpdate({ tokenHash, usedAt: null, expiresAt: { $gt: now } }).

const passwordResetTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    tokenHash: { type: String, required: true, select: false },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { collection: "passwordResetTokens", timestamps: { createdAt: true, updatedAt: false } },
);

passwordResetTokenSchema.index({ tokenHash: 1 }, { unique: true });
passwordResetTokenSchema.index({ userId: 1 });
passwordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type PasswordResetTokenRecord = InferSchemaType<typeof passwordResetTokenSchema>;
export const PasswordResetToken = defineModel("PasswordResetToken", passwordResetTokenSchema);
