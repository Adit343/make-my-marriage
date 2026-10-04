import { Schema, type InferSchemaType } from "mongoose";
import { defineModel } from "@/models/shared/define-model";
import { wholeNumber } from "@/models/shared/validators";

// API Design §14.3 (approved as decision D5): fixed-window counters for the sensitive auth
// endpoints — login, signup, password reset, OAuth start — without Redis. Vercel's platform
// protection is the first line of defence; these give precise, portable per-endpoint limits.
//
// The bucket key (e.g. "login:<ip>:<email>") is stored only as a SHA-256 hash: counters must
// not become a log of IP addresses and emails (the sessions collection keeps no IPs either).
// Increment with findOneAndUpdate({ keyHash, windowStart }, { $inc: { count: 1 } }, { upsert }).

const rateLimitCounterSchema = new Schema(
  {
    keyHash: { type: String, required: true },
    windowStart: { type: Date, required: true },
    count: { type: Number, required: true, default: 0, min: 0, validate: wholeNumber },
    /** windowStart + window length; the TTL index removes the row after that. */
    expiresAt: { type: Date, required: true },
  },
  { collection: "rateLimitCounters" },
);

rateLimitCounterSchema.index({ keyHash: 1, windowStart: 1 }, { unique: true });
rateLimitCounterSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type RateLimitCounterRecord = InferSchemaType<typeof rateLimitCounterSchema>;
export const RateLimitCounter = defineModel("RateLimitCounter", rateLimitCounterSchema);
