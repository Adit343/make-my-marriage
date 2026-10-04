import { Schema, type InferSchemaType } from "mongoose";
import { EMAIL_STATUSES, EMAIL_TYPES } from "@/lib/constants/enums";
import { EMAIL_LOG_RETENTION_SECONDS } from "@/lib/constants/retention";
import { defineModel } from "@/models/shared/define-model";
import { wholeNumber } from "@/models/shared/validators";

// DB Design §6.21. A per-recipient receipt for each email sent, so failures can be retried
// without re-sending the successes. Never stores the rendered body or any token/link. Holds
// recipient addresses (personal data), hence the fixed retention window. Created in Phase 1
// because member invitations already send email (DB Design §13).

const emailErrorSchema = new Schema(
  {
    code: { type: String, maxlength: 100 },
    /** Sanitized provider message; never contains secrets or tokens. */
    message: { type: String, maxlength: 300 },
  },
  { _id: false },
);

const emailLogSchema = new Schema(
  {
    /** null only for account-level emails such as password reset. */
    weddingId: { type: Schema.Types.ObjectId, ref: "Wedding", default: null },
    type: { type: String, enum: EMAIL_TYPES, required: true },
    invitationId: { type: Schema.Types.ObjectId, ref: "WeddingInvitation", default: null },
    guestId: { type: Schema.Types.ObjectId, ref: "Guest", default: null },
    recipientEmail: { type: String, required: true, trim: true, maxlength: 254 },
    status: { type: String, enum: EMAIL_STATUSES, required: true },
    provider: { type: String, required: true },
    providerMessageId: { type: String, default: null },
    sentAt: { type: Date, default: null },
    error: { type: emailErrorSchema, default: null },
    /** Groups one "send" action, e.g. a batch of guest invitations. */
    batchId: { type: String, required: true },
    /** e.g. "guest_invitation:<guestId>:<batchId>" — stops double-sends on retry. */
    idempotencyKey: { type: String, default: null },
    attempts: { type: Number, required: true, default: 1, min: 1, validate: wholeNumber },
  },
  { collection: "emailLogs", timestamps: true },
);

emailLogSchema.index({ weddingId: 1, createdAt: -1 });
emailLogSchema.index({ batchId: 1 });
emailLogSchema.index(
  { idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } },
);
emailLogSchema.index({ invitationId: 1 }, { sparse: true });
emailLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: EMAIL_LOG_RETENTION_SECONDS });

export type EmailLogRecord = InferSchemaType<typeof emailLogSchema>;
export const EmailLog = defineModel("EmailLog", emailLogSchema);
