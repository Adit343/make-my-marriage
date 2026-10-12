import { Schema, type InferSchemaType } from "mongoose";
import {
  ASSET_STATUSES,
  MEDIA_TYPES,
  MEDIA_VISIBILITIES,
  UPLOADER_KINDS,
} from "@/lib/constants/enums";
import {
  ALLOWED_PHOTO_TYPES,
  MAX_CAPTION,
  MAX_DISPLAY_NAME,
  MAX_FILE_NAME,
  MAX_IMAGE_DIMENSION,
  MAX_PHOTO_BYTES,
  PENDING_UPLOAD_TTL_SECONDS,
} from "@/lib/constants/gallery";
import { OBJECT_KEY_PATTERN } from "@/lib/gallery/files";
import { softDeleteFields, softDeletePlugin } from "@/models/plugins/softDelete";
import { defineModel } from "@/models/shared/define-model";
import { wholeNumber } from "@/models/shared/validators";

// DB Design §6.19. One row per photo: its catalog card. The file itself is in Cloudflare R2
// (Architecture Amendment A1); only metadata lives here. V1 holds photos only.

const uploadedBySchema = new Schema(
  {
    kind: { type: String, enum: UPLOADER_KINDS, required: true },
    /** Set for a member upload. */
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    /** Set when a guest upload came through a personal gallery link. */
    guestId: { type: Schema.Types.ObjectId, ref: "Guest", default: null },
    /** What a guest typed as their name; shown to the team only. */
    displayName: { type: String, trim: true, maxlength: MAX_DISPLAY_NAME },
  },
  { _id: false },
);

const galleryAssetSchema = new Schema(
  {
    weddingId: { type: Schema.Types.ObjectId, ref: "Wedding", required: true },
    galleryId: { type: Schema.Types.ObjectId, ref: "Gallery", required: true },
    /** null = the gallery's root (no album). */
    albumId: { type: Schema.Types.ObjectId, ref: "GalleryAlbum", default: null },
    uploadedBy: { type: uploadedBySchema, required: true },
    /** For a guest upload: which gallery link was used, so only that link can confirm it. */
    viaTokenId: { type: Schema.Types.ObjectId, ref: "GalleryAccessToken", default: null },
    /** Server-generated, never built from user input. */
    objectKey: { type: String, required: true, match: OBJECT_KEY_PATTERN },
    /** The uploader's file name, sanitised; display only. */
    fileName: { type: String, required: true, trim: true, maxlength: MAX_FILE_NAME },
    mimeType: { type: String, required: true, enum: Object.keys(ALLOWED_PHOTO_TYPES) },
    mediaType: { type: String, enum: MEDIA_TYPES, required: true, default: "image" },
    sizeBytes: {
      type: Number,
      required: true,
      min: 1,
      max: MAX_PHOTO_BYTES,
      validate: wholeNumber,
    },
    /** As reported by the uploader's browser: there is no server-side image processing in V1. */
    width: { type: Number, default: null, min: 1, max: MAX_IMAGE_DIMENSION, validate: wholeNumber },
    height: {
      type: Number,
      default: null,
      min: 1,
      max: MAX_IMAGE_DIMENSION,
      validate: wholeNumber,
    },
    caption: { type: String, trim: true, maxlength: MAX_CAPTION },
    visibility: { type: String, enum: MEDIA_VISIBILITIES, required: true, default: "private" },
    status: { type: String, enum: ASSET_STATUSES, required: true, default: "pending_upload" },
    /** The team's favourites (PRD §26). */
    isFavorite: { type: Boolean, required: true, default: false },
    ...softDeleteFields,
  },
  { collection: "galleryAssets", timestamps: true, optimisticConcurrency: true },
);

galleryAssetSchema.plugin(softDeletePlugin);

galleryAssetSchema.index({ objectKey: 1 }, { unique: true });
// "Photos in an album, newest first" (cursor pagination).
galleryAssetSchema.index({ weddingId: 1, albumId: 1, status: 1, _id: -1 });
// "Every photo of the wedding" (all albums), newest first.
galleryAssetSchema.index({ weddingId: 1, status: 1, _id: -1 });
// The moderation queue, and the storage total (every non-deleted photo of a wedding by status).
galleryAssetSchema.index({ weddingId: 1, status: 1, createdAt: 1 });
// Favourites, newest first. Partial: only favourites are indexed.
galleryAssetSchema.index(
  { weddingId: 1, _id: -1 },
  { name: "weddingId_1__id_-1_favorites", partialFilterExpression: { isFavorite: true } },
);
// Uploads that were never confirmed disappear after a day (the file, if any, is cleaned up by the
// bucket's lifecycle rule or the purge script: DB Design §6.19).
galleryAssetSchema.index(
  { createdAt: 1 },
  {
    name: "createdAt_1_pending_ttl",
    expireAfterSeconds: PENDING_UPLOAD_TTL_SECONDS,
    partialFilterExpression: { status: "pending_upload" },
  },
);

export type GalleryAssetRecord = InferSchemaType<typeof galleryAssetSchema>;
export const GalleryAsset = defineModel("GalleryAsset", galleryAssetSchema);
