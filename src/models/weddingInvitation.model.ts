import { Schema, type InferSchemaType } from "mongoose";
import { INVITATION_ROLES, INVITATION_STATUSES, MEMBER_RELATIONSHIPS } from "@/lib/constants/enums";
import { normalizeEmail } from "@/lib/text/normalize";
import { normalizedFieldsPlugin } from "@/models/plugins/normalize";
import { defineModel } from "@/models/shared/define-model";

// DB Design §6.6. An invitation to join the planning team (not a guest invitation). Hash-only
// token: it is emailed once and is single-use. "Expired" is never stored — it is computed as
// status "pending" with expiresAt in the past, so no background job is needed. Rows are
// hard-deleted by TTL at purgeAt (expiry/accept/revoke + 30 days), not soft-deleted.

const weddingInvitationSchema = new Schema(
  {
    weddingId: { type: Schema.Types.ObjectId, ref: "Wedding", required: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    email: { type: String, required: true, trim: true, maxlength: 254 },
    emailNormalized: { type: String, required: true },
    /** Never "owner": ownership only moves by transfer. */
    role: { type: String, enum: INVITATION_ROLES, required: true },
    relationship: { type: String, enum: MEMBER_RELATIONSHIPS },
    message: { type: String, trim: true, maxlength: 500 },
    tokenHash: { type: String, required: true, select: false },
    status: { type: String, enum: INVITATION_STATUSES, required: true, default: "pending" },
    expiresAt: { type: Date, required: true },
    acceptedAt: { type: Date, default: null },
    acceptedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    revokedAt: { type: Date, default: null },
    revokedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    purgeAt: { type: Date, required: true },
  },
  { collection: "weddingInvitations", timestamps: true },
);

weddingInvitationSchema.plugin(normalizedFieldsPlugin, {
  fields: [{ source: "email", target: "emailNormalized", normalize: normalizeEmail }],
});

weddingInvitationSchema.index({ tokenHash: 1 }, { unique: true });
weddingInvitationSchema.index({ weddingId: 1, status: 1, createdAt: -1 });
// One pending invite per email per wedding. An expired-but-still-pending row counts too, so
// re-inviting must revoke the stale row in the same operation (DB Design §6.6 rule 3).
weddingInvitationSchema.index(
  { weddingId: 1, emailNormalized: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } },
);
weddingInvitationSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 });

export type WeddingInvitationRecord = InferSchemaType<typeof weddingInvitationSchema>;
export const WeddingInvitation = defineModel("WeddingInvitation", weddingInvitationSchema);
