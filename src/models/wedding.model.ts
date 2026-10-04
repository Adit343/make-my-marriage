import { Schema, type InferSchemaType } from "mongoose";
import { WEDDING_STATUSES } from "@/lib/constants/enums";
import { softDeleteFields, softDeletePlugin } from "@/models/plugins/softDelete";
import { defineModel } from "@/models/shared/define-model";
import { locationSchema } from "@/models/shared/location";
import { ISO_DATE_PATTERN, wholeNumber } from "@/models/shared/validators";

// DB Design §6.4. The root every other record points to. There is no ownerUserId: the owner is
// the weddingMembers row with role "owner" (exactly one, enforced by an index there).

const partnerSchema = new Schema(
  { name: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 } },
  { _id: false },
);

const weddingSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 1, maxlength: 120 },
    /** Neutral "partners" so the model works for any couple. */
    partners: {
      type: [partnerSchema],
      default: [],
      validate: {
        validator: (partners: unknown[]) => partners.length <= 2,
        message: "A wedding has at most 2 partners",
      },
    },
    /** Main date as "YYYY-MM-DD"; may be undecided at creation. */
    weddingDate: { type: String, default: null, match: ISO_DATE_PATTERN },
    timezone: { type: String, required: true, default: "Asia/Kolkata" },
    currency: { type: String, required: true, default: "INR", match: /^[A-Z]{3}$/ },
    location: { type: locationSchema },
    budgetTotalMinor: { type: Number, default: null, min: 0, validate: wholeNumber },
    status: { type: String, enum: WEDDING_STATUSES, required: true, default: "planning" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    /** Set on soft delete: the earliest time the purge script may remove it (DB Design §10.3). */
    purgeAfter: { type: Date, default: null },
    ...softDeleteFields,
  },
  // Collaborative document: concurrent edits are guarded by __v (decision C5).
  { collection: "weddings", timestamps: true, optimisticConcurrency: true },
);

weddingSchema.plugin(softDeletePlugin);

weddingSchema.index(
  { purgeAfter: 1 },
  { partialFilterExpression: { purgeAfter: { $type: "date" } } },
);

export type WeddingRecord = InferSchemaType<typeof weddingSchema>;
export const Wedding = defineModel("Wedding", weddingSchema);
