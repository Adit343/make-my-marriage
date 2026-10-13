import { Schema, type InferSchemaType } from "mongoose";
import { ANALYTICS_EVENTS, ANALYTICS_RETENTION_DAYS } from "@/lib/constants/analytics";
import { defineModel } from "@/models/shared/define-model";
import { wholeNumber } from "@/models/shared/validators";

// Phase 7 step 7.7 (owner decision: in-house, minimal analytics). One row per event name per day
// holding a count. Nothing identifies a person, wedding, guest or request. An addition beyond the
// DB design's list, like rateLimitCounters; rows disappear by themselves after ANALYTICS_RETENTION_DAYS.

const analyticsCounterSchema = new Schema(
  {
    event: { type: String, enum: ANALYTICS_EVENTS, required: true },
    /** Calendar day in UTC, "YYYY-MM-DD". */
    day: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    count: { type: Number, required: true, default: 0, min: 0, validate: wholeNumber },
    /** The day's start, for the TTL index. */
    dayStart: { type: Date, required: true },
  },
  { collection: "analyticsCounters" },
);

analyticsCounterSchema.index({ event: 1, day: 1 }, { unique: true });
analyticsCounterSchema.index(
  { dayStart: 1 },
  { expireAfterSeconds: ANALYTICS_RETENTION_DAYS * 24 * 60 * 60 },
);

export type AnalyticsCounterRecord = InferSchemaType<typeof analyticsCounterSchema>;
export const AnalyticsCounter = defineModel("AnalyticsCounter", analyticsCounterSchema);
