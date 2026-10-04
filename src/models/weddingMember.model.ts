import { Schema, type InferSchemaType } from "mongoose";
import { MEMBER_RELATIONSHIPS, MEMBER_ROLES, MEMBER_STATUSES } from "@/lib/constants/enums";
import { softDeleteFields, softDeletePlugin } from "@/models/plugins/softDelete";
import { defineModel } from "@/models/shared/define-model";

// DB Design §6.5. The link between a person and a wedding; this is what makes
// "one user = one wedding" enforceable. `role` controls permissions; `relationship` is a display
// label only and controls nothing.

const weddingMemberSchema = new Schema(
  {
    weddingId: { type: Schema.Types.ObjectId, ref: "Wedding", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    role: { type: String, enum: MEMBER_ROLES, required: true },
    relationship: { type: String, enum: MEMBER_RELATIONSHIPS },
    /** Suspended members still occupy their one-wedding slot but fail authorization. */
    status: { type: String, enum: MEMBER_STATUSES, required: true, default: "active" },
    invitedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    joinedAt: { type: Date, required: true },
    ...softDeleteFields,
  },
  { collection: "weddingMembers", timestamps: true, optimisticConcurrency: true },
);

weddingMemberSchema.plugin(softDeletePlugin);

// One user = one ACTIVE wedding. Soft-deleted rows are outside the index, so leaving a wedding
// frees the user to join another. A violation surfaces as E11000 → 409 ALREADY_IN_WEDDING.
weddingMemberSchema.index(
  { userId: 1 },
  { unique: true, partialFilterExpression: { deletedAt: { $type: "null" } } },
);
weddingMemberSchema.index({ weddingId: 1 });
// Exactly one ACTIVE owner per wedding. Ownership transfer demotes before it promotes.
weddingMemberSchema.index(
  { weddingId: 1, role: 1 },
  { unique: true, partialFilterExpression: { role: "owner", deletedAt: { $type: "null" } } },
);

export type WeddingMemberRecord = InferSchemaType<typeof weddingMemberSchema>;
export const WeddingMember = defineModel("WeddingMember", weddingMemberSchema);
