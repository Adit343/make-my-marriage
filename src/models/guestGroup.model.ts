import { Schema, type InferSchemaType } from "mongoose";
import { GUEST_SIDES } from "@/lib/constants/enums";
import { MAX_GROUP_NAME, MAX_GROUP_NOTES } from "@/lib/constants/guests";
import { normalizeName } from "@/lib/text/normalize";
import { normalizedFieldsPlugin } from "@/models/plugins/normalize";
import { softDeleteFields, softDeletePlugin } from "@/models/plugins/softDelete";
import { defineModel } from "@/models/shared/define-model";

// DB Design §6.9. A bucket for organising guests ("Sharma Family", "College Friends"). Deleting a
// group never deletes its guests: the caller picks where they go (see the guest-groups service).

const guestGroupSchema = new Schema(
  {
    weddingId: { type: Schema.Types.ObjectId, ref: "Wedding", required: true },
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: MAX_GROUP_NAME },
    nameNormalized: { type: String, required: true },
    side: { type: String, enum: GUEST_SIDES, required: true },
    /** Private to the team. */
    notes: { type: String, trim: true, maxlength: MAX_GROUP_NOTES },
    sortOrder: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    ...softDeleteFields,
  },
  { collection: "guestGroups", timestamps: true, optimisticConcurrency: true },
);

guestGroupSchema.plugin(softDeletePlugin);
guestGroupSchema.plugin(normalizedFieldsPlugin, {
  fields: [{ source: "name", target: "nameNormalized", normalize: normalizeName }],
});

// No two live groups with the same name in one wedding. Soft-deleted rows are ignored, so a
// deleted group's name can be used again.
guestGroupSchema.index(
  { weddingId: 1, nameNormalized: 1 },
  { unique: true, partialFilterExpression: { deletedAt: { $type: "null" } } },
);

export type GuestGroupRecord = InferSchemaType<typeof guestGroupSchema>;
export const GuestGroup = defineModel("GuestGroup", guestGroupSchema);
