import { Schema, type InferSchemaType } from "mongoose";
import { EVENT_TYPES } from "@/lib/constants/enums";
import { MAX_SCHEDULE_ITEMS, SCHEDULE_TIME_PATTERN } from "@/lib/constants/events";
import { softDeleteFields, softDeletePlugin } from "@/models/plugins/softDelete";
import { defineModel } from "@/models/shared/define-model";
import { locationSchema } from "@/models/shared/location";
import { wholeNumber } from "@/models/shared/validators";

// DB Design §6.7. A function within the wedding (Haldi, Sangeet, Reception…).
//
// `schedule[]` is the event's run-of-show: timed lines such as "7:00 AM Makeup". Owner decision
// (2026-10-10): embedded and bounded rather than a separate collection, because it is always read
// together with its event and never queried across weddings. A schedule item is NOT a task — a
// task is a to-do for a person; a schedule item is a line in the day's timeline.

const scheduleItemSchema = new Schema({
  time: { type: String, required: true, match: SCHEDULE_TIME_PATTERN },
  title: { type: String, required: true, trim: true, minlength: 1, maxlength: 200 },
  notes: { type: String, trim: true, maxlength: 500 },
  /** Whether the Phase 5 wedding website may show this line. */
  isPublic: { type: Boolean, required: true, default: false },
});

const eventSchema = new Schema(
  {
    weddingId: { type: Schema.Types.ObjectId, ref: "Wedding", required: true },
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 120 },
    type: { type: String, enum: EVENT_TYPES, required: true },
    /** UTC instant; shown in `timezone`. */
    startsAt: { type: Date, required: true },
    endsAt: {
      type: Date,
      default: null,
      validate: {
        validator(this: { startsAt?: Date | null }, value: Date | null) {
          return value == null || !this.startsAt || value.getTime() > this.startsAt.getTime();
        },
        message: "endsAt must be after startsAt",
      },
    },
    /** IANA name; defaults from the wedding, so a destination wedding abroad still displays right. */
    timezone: { type: String, required: true },
    location: { type: locationSchema },
    description: { type: String, trim: true, maxlength: 2000 },
    dressCode: { type: String, trim: true, maxlength: 200 },
    /** Manual ordering tie-breaker for events that start at the same time. */
    sortOrder: { type: Number, default: 0, validate: wholeNumber },
    /** Whether the Phase 5 website may show this event. */
    isPublic: { type: Boolean, required: true, default: false },
    schedule: {
      type: [scheduleItemSchema],
      default: [],
      validate: {
        validator: (items: unknown[]) => items.length <= MAX_SCHEDULE_ITEMS,
        message: `An event has at most ${MAX_SCHEDULE_ITEMS} schedule items`,
      },
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    ...softDeleteFields,
  },
  // Members edit the same event at the same time; stale saves are rejected (DB Design §3.7).
  { collection: "events", timestamps: true, optimisticConcurrency: true },
);

eventSchema.plugin(softDeletePlugin);

// "Timeline of events" (DB Design §8.3); also covers a plain { weddingId } lookup as its prefix.
eventSchema.index({ weddingId: 1, startsAt: 1 });

export type EventRecord = InferSchemaType<typeof eventSchema>;
export const Event = defineModel("Event", eventSchema);
