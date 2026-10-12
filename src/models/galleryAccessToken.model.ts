import { Schema, type InferSchemaType } from "mongoose";
import { MAX_TOKEN_LABEL } from "@/lib/constants/gallery";
import { defineModel } from "@/models/shared/define-model";

// DB Design §6.20. A shareable gallery or album link (also the content of a QR code). The token is
// never stored in the clear: `tokenHash` is the lookup, `tokenEnc` (AES-256-GCM) lets the team show
// the SAME link or QR code again. This is a HARD-delete collection (Architecture §24): a revoked or
// expired link stays for 30 days, then the TTL index removes it. There is no per-view counter.

const permissionsSchema = new Schema(
  {
    canView: { type: Boolean, required: true, default: true },
    canUpload: { type: Boolean, required: true, default: false },
    canDownload: { type: Boolean, required: true, default: true },
  },
  { _id: false },
);

const galleryAccessTokenSchema = new Schema(
  {
    weddingId: { type: Schema.Types.ObjectId, ref: "Wedding", required: true },
    galleryId: { type: Schema.Types.ObjectId, ref: "Gallery", required: true },
    /** null = the whole gallery. */
    albumId: { type: Schema.Types.ObjectId, ref: "GalleryAlbum", default: null },
    tokenHash: { type: String, required: true, select: false },
    tokenEnc: { type: String, required: true, select: false },
    label: { type: String, trim: true, maxlength: MAX_TOKEN_LABEL },
    permissions: { type: permissionsSchema, required: true },
    /** Set for a personal (per-guest) link; unused by the screens so far. */
    guestId: { type: Schema.Types.ObjectId, ref: "Guest", default: null },
    expiresAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
    revokedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    /** Revoke or expiry time plus 30 days: when the TTL index may remove the row. */
    purgeAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { collection: "galleryAccessTokens", timestamps: true },
);

galleryAccessTokenSchema.index({ tokenHash: 1 }, { unique: true });
galleryAccessTokenSchema.index({ weddingId: 1, galleryId: 1 });
// "A wedding's links, newest first". Found with explain(): without it MongoDB walked the global _id
// index and read every wedding's links to find one wedding's (DB Design §8.1 rule 5).
galleryAccessTokenSchema.index({ weddingId: 1, _id: -1 });
galleryAccessTokenSchema.index(
  { purgeAt: 1 },
  { expireAfterSeconds: 0, partialFilterExpression: { purgeAt: { $type: "date" } } },
);

export type GalleryAccessTokenRecord = InferSchemaType<typeof galleryAccessTokenSchema>;
export const GalleryAccessToken = defineModel("GalleryAccessToken", galleryAccessTokenSchema);
