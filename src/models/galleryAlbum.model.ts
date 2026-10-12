import { Schema, type InferSchemaType } from "mongoose";
import { MEDIA_VISIBILITIES } from "@/lib/constants/enums";
import { MAX_ALBUM_DESCRIPTION, MAX_ALBUM_TITLE } from "@/lib/constants/gallery";
import { softDeleteFields, softDeletePlugin } from "@/models/plugins/softDelete";
import { defineModel } from "@/models/shared/define-model";
import { wholeNumber } from "@/models/shared/validators";

// DB Design §6.18. A folder, often tied to an event ("Haldi Moments").

const galleryAlbumSchema = new Schema(
  {
    weddingId: { type: Schema.Types.ObjectId, ref: "Wedding", required: true },
    galleryId: { type: Schema.Types.ObjectId, ref: "Gallery", required: true },
    title: { type: String, required: true, trim: true, minlength: 1, maxlength: MAX_ALBUM_TITLE },
    description: { type: String, trim: true, maxlength: MAX_ALBUM_DESCRIPTION },
    eventId: { type: Schema.Types.ObjectId, ref: "Event", default: null },
    /** Applied to new member uploads only; each photo keeps its own visibility afterwards. */
    defaultVisibility: {
      type: String,
      enum: MEDIA_VISIBILITIES,
      required: true,
      default: "private",
    },
    coverAssetId: { type: Schema.Types.ObjectId, ref: "GalleryAsset", default: null },
    sortOrder: { type: Number, default: 0, validate: wholeNumber },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    ...softDeleteFields,
  },
  { collection: "galleryAlbums", timestamps: true, optimisticConcurrency: true },
);

galleryAlbumSchema.plugin(softDeletePlugin);

galleryAlbumSchema.index({ weddingId: 1, galleryId: 1, sortOrder: 1 });
galleryAlbumSchema.index({ weddingId: 1, eventId: 1 });

export type GalleryAlbumRecord = InferSchemaType<typeof galleryAlbumSchema>;
export const GalleryAlbum = defineModel("GalleryAlbum", galleryAlbumSchema);
