import { Schema, type InferSchemaType } from "mongoose";
import { MAX_GALLERY_DESCRIPTION, MAX_GALLERY_TITLE } from "@/lib/constants/gallery";
import { softDeleteFields, softDeletePlugin } from "@/models/plugins/softDelete";
import { defineModel } from "@/models/shared/define-model";

// DB Design §6.17. The wedding's photo space and its settings: one per wedding, made the first time
// anything is saved into it. Authorization reads only galleryAssets.visibility (plus a link's
// scope); this document holds settings, albums hold a default visibility for new uploads.

const gallerySchema = new Schema(
  {
    weddingId: { type: Schema.Types.ObjectId, ref: "Wedding", required: true },
    title: { type: String, required: true, trim: true, minlength: 1, maxlength: MAX_GALLERY_TITLE },
    description: { type: String, trim: true, maxlength: MAX_GALLERY_DESCRIPTION },
    /** Whether guests holding an upload link may add photos. Off until the team turns it on. */
    allowGuestUploads: { type: Boolean, required: true, default: false },
    /** Guest uploads wait for a member to approve them. */
    requireUploadApproval: { type: Boolean, required: true, default: true },
    coverAssetId: { type: Schema.Types.ObjectId, ref: "GalleryAsset", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    ...softDeleteFields,
  },
  { collection: "galleries", timestamps: true, optimisticConcurrency: true },
);

gallerySchema.plugin(softDeletePlugin);

// One gallery per wedding (the unique partial index also makes "create if missing" race-safe).
gallerySchema.index(
  { weddingId: 1 },
  { unique: true, partialFilterExpression: { deletedAt: { $type: "null" } } },
);

export type GalleryRecord = InferSchemaType<typeof gallerySchema>;
export const Gallery = defineModel("Gallery", gallerySchema);
