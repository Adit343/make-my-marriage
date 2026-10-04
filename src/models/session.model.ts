import { Schema, type InferSchemaType } from "mongoose";
import { defineModel } from "@/models/shared/define-model";

// DB Design §6.2. One document per logged-in browser. The cookie holds a random token; only its
// SHA-256 hash is stored. Hard-deleted by TTL once expired. IP addresses are deliberately not kept.

const sessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    tokenHash: { type: String, required: true, select: false },
    /** Rolling expiry. Validity is also checked in code: TTL deletion lags by up to ~60 s. */
    expiresAt: { type: Date, required: true },
    /** Throttled to ~10-minute updates to avoid a write per request. */
    lastUsedAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    /** "Remember me": a long-lived cookie and a longer rolling window. */
    persistent: { type: Boolean, required: true, default: false },
    userAgent: { type: String, maxlength: 300 },
  },
  { collection: "sessions", timestamps: { createdAt: true, updatedAt: false } },
);

sessionSchema.index({ tokenHash: 1 }, { unique: true });
sessionSchema.index({ userId: 1 });
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type SessionRecord = InferSchemaType<typeof sessionSchema>;
export const Session = defineModel("Session", sessionSchema);
