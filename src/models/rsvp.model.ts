import { Schema, type InferSchemaType } from "mongoose";
import { RESPONDED_VIA, RSVP_STATUSES } from "@/lib/constants/enums";
import { MAX_PLUS_ONES, MAX_RSVP_NOTE } from "@/lib/constants/guests";
import { softDeleteFields, softDeletePlugin } from "@/models/plugins/softDelete";
import { defineModel } from "@/models/shared/define-model";

// DB Design §6.11. One row per guest per event, doing two jobs at once:
//   1. assignment: the row EXISTS means "this guest is invited to this event";
//   2. response:   `status` says whether they replied.
// "Who has not replied to Haldi?" is then a plain `status: pending` filter.

const rsvpSchema = new Schema(
  {
    weddingId: { type: Schema.Types.ObjectId, ref: "Wedding", required: true },
    guestId: { type: Schema.Types.ObjectId, ref: "Guest", required: true },
    eventId: { type: Schema.Types.ObjectId, ref: "Event", required: true },
    status: { type: String, enum: RSVP_STATUSES, required: true, default: "pending" },
    /**
     * Everyone attending INCLUDING the guest. 0 unless attending or maybe. The service keeps it
     * within 1 + the guest's plusOnesAllowed (a business rule, so a 422, not a validation error).
     */
    attendingCount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: MAX_PLUS_ONES + 1,
      validate: Number.isInteger,
    },
    respondedAt: { type: Date, default: null },
    respondedVia: { type: String, enum: [...RESPONDED_VIA, null], default: null },
    respondedByUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    note: { type: String, trim: true, maxlength: MAX_RSVP_NOTE },
    ...softDeleteFields,
  },
  { collection: "rsvps", timestamps: true, optimisticConcurrency: true },
);

rsvpSchema.plugin(softDeletePlugin);

// One row per guest per event; also "events for this guest". Soft-deleted rows are ignored, so
// removing a guest from an event and adding them back works.
rsvpSchema.index(
  { guestId: 1, eventId: 1 },
  { unique: true, partialFilterExpression: { deletedAt: { $type: "null" } } },
);
// Headcount per event; "who has not replied".
rsvpSchema.index({ weddingId: 1, eventId: 1, status: 1 });

export type RsvpRecord = InferSchemaType<typeof rsvpSchema>;
export const Rsvp = defineModel("Rsvp", rsvpSchema);
