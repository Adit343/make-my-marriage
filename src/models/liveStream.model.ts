import { Schema, type InferSchemaType } from "mongoose";
import { STREAM_PROVIDERS, STREAM_STATUSES } from "@/lib/constants/enums";
import { MAX_STREAM_DESCRIPTION, MAX_STREAM_TITLE, MAX_STREAM_URL } from "@/lib/constants/website";
import { softDeleteFields, softDeletePlugin } from "@/models/plugins/softDelete";
import { defineModel } from "@/models/shared/define-model";
import { secureLinkSchema } from "@/models/shared/secure-link";

// DB Design §6.16. A stream link for guests who can't attend. Make My Marriage never hosts video:
// the video plays on YouTube or Vimeo, and our page (/live/<token>) only embeds or links to it.
// `status` is set BY HAND by a member (no webhooks, no WebSockets in V1). Our token protects the
// page on our site, not the video: a guest who copies the YouTube address can still share it.

const liveStreamSchema = new Schema(
  {
    weddingId: { type: Schema.Types.ObjectId, ref: "Wedding", required: true },
    eventId: { type: Schema.Types.ObjectId, ref: "Event", default: null },
    provider: { type: String, enum: STREAM_PROVIDERS, required: true },
    streamUrl: {
      type: String,
      required: true,
      trim: true,
      maxlength: MAX_STREAM_URL,
      match: /^https:\/\//i,
    },
    title: { type: String, required: true, trim: true, minlength: 1, maxlength: MAX_STREAM_TITLE },
    description: { type: String, trim: true, maxlength: MAX_STREAM_DESCRIPTION },
    /** UTC instant, shown in the wedding's timezone. */
    startTime: { type: Date, required: true },
    status: { type: String, enum: STREAM_STATUSES, required: true, default: "scheduled" },
    /** The guest's watch link, /live/<token> (DB Design §5.3). */
    link: { type: secureLinkSchema },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    ...softDeleteFields,
  },
  { collection: "liveStreams", timestamps: true, optimisticConcurrency: true },
);

liveStreamSchema.plugin(softDeletePlugin);

liveStreamSchema.index({ weddingId: 1, startTime: 1 });
// Opening /live/<token>. Partial on $exists, not $type: a $type filter cannot serve an equality
// lookup (found with explain() on the guest link in Phase 3).
liveStreamSchema.index(
  { "link.tokenHash": 1 },
  { unique: true, partialFilterExpression: { "link.tokenHash": { $exists: true } } },
);

export type LiveStreamRecord = InferSchemaType<typeof liveStreamSchema>;
export const LiveStream = defineModel("LiveStream", liveStreamSchema);
