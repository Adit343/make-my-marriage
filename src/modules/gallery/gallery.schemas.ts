import { z } from "zod";
import { ASSET_STATUSES, MEDIA_VISIBILITIES } from "@/lib/constants/enums";
import {
  ALLOWED_PHOTO_TYPES,
  GALLERY_PAGE_SIZE,
  MAX_ALBUM_DESCRIPTION,
  MAX_ALBUM_TITLE,
  MAX_CAPTION,
  MAX_DISPLAY_NAME,
  MAX_FILE_NAME,
  MAX_GALLERY_DESCRIPTION,
  MAX_GALLERY_TITLE,
  MAX_IMAGE_DIMENSION,
  MAX_PHOTO_BYTES,
  MAX_TOKEN_LABEL,
  type AllowedPhotoType,
} from "@/lib/constants/gallery";
import { MAX_PAGE_SIZE } from "@/lib/http/pagination";
import { objectId } from "@/lib/validation/primitives";

// API Design §12. Strict objects: a key that is not listed here is a 400, so nothing private or
// internal (object keys, statuses a client may not set, who uploaded) can be written by a request.

export const galleryParams = z.object({ weddingId: objectId });
export const albumParams = z.object({ weddingId: objectId, albumId: objectId });
export const assetParams = z.object({ weddingId: objectId, assetId: objectId });
export const accessTokenParams = z.object({ weddingId: objectId, tokenId: objectId });

const photoTypes = Object.keys(ALLOWED_PHOTO_TYPES) as [AllowedPhotoType, ...AllowedPhotoType[]];

// ---- Gallery settings -----------------------------------------------------------------------

export const updateGalleryBody = z
  .strictObject({
    version: z.number().int().min(0),
    title: z.string().trim().min(1, "Give the gallery a title").max(MAX_GALLERY_TITLE),
    description: z.string().trim().max(MAX_GALLERY_DESCRIPTION).nullable(),
    allowGuestUploads: z.boolean(),
    requireUploadApproval: z.boolean(),
    coverAssetId: objectId.nullable(),
  })
  .partial()
  .required({ version: true })
  .refine((body) => Object.keys(body).length > 1, { message: "Nothing to update" });
export type UpdateGalleryInput = z.infer<typeof updateGalleryBody>;

// ---- Albums ---------------------------------------------------------------------------------

const albumTitle = z.string().trim().min(1, "Give the album a name").max(MAX_ALBUM_TITLE);
const albumDescription = z.string().trim().max(MAX_ALBUM_DESCRIPTION);

export const createAlbumBody = z.strictObject({
  title: albumTitle,
  description: albumDescription.optional(),
  eventId: objectId.nullable().optional(),
  defaultVisibility: z.enum(MEDIA_VISIBILITIES).optional(),
});
export type CreateAlbumInput = z.infer<typeof createAlbumBody>;

export const updateAlbumBody = z
  .strictObject({
    version: z.number().int().min(0),
    title: albumTitle,
    description: albumDescription.nullable(),
    eventId: objectId.nullable(),
    defaultVisibility: z.enum(MEDIA_VISIBILITIES),
    coverAssetId: objectId.nullable(),
  })
  .partial()
  .required({ version: true })
  .refine((body) => Object.keys(body).length > 1, { message: "Nothing to update" });
export type UpdateAlbumInput = z.infer<typeof updateAlbumBody>;

/** Deleting an album must say what happens to its photos: never a silent choice (API Design §12.1). */
export const deleteAlbumBody = z.strictObject({
  photos: z.enum(["move_to_root", "delete"]),
});
export type DeleteAlbumInput = z.infer<typeof deleteAlbumBody>;

// ---- Photos ---------------------------------------------------------------------------------

const fileName = z.string().trim().min(1).max(MAX_FILE_NAME);
const dimension = z.number().int().min(1).max(MAX_IMAGE_DIMENSION);

export const uploadUrlBody = z.strictObject({
  albumId: objectId.nullable().optional(),
  fileName,
  mimeType: z.enum(photoTypes, { error: "Only JPEG, PNG, WebP and HEIC photos can be uploaded" }),
  sizeBytes: z
    .number()
    .int()
    .min(1)
    .max(MAX_PHOTO_BYTES, `Photos can be up to ${MAX_PHOTO_BYTES / (1024 * 1024)} MB`),
});
export type UploadUrlInput = z.infer<typeof uploadUrlBody>;

/** The browser reports the photo's size in pixels once it has loaded it (no server processing in V1). */
export const confirmUploadBody = z.strictObject({
  width: dimension.optional(),
  height: dimension.optional(),
});
export type ConfirmUploadInput = z.infer<typeof confirmUploadBody>;

const pageLimit = z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(GALLERY_PAGE_SIZE);

export const listAssetsQuery = z.strictObject({
  limit: pageLimit,
  cursor: z.string().min(1).max(512).optional(),
  /** An album id, or "root" for photos that are in no album. Leave out for every photo. */
  albumId: z.union([objectId, z.literal("root")]).optional(),
  /** Members see active photos; owners and admins can also open the approval queue. */
  status: z.enum(ASSET_STATUSES).optional(),
  favorite: z.literal("true").optional(),
});
export type ListAssetsQuery = z.infer<typeof listAssetsQuery>;

export const updateAssetBody = z
  .strictObject({
    version: z.number().int().min(0),
    caption: z.string().trim().max(MAX_CAPTION).nullable(),
    visibility: z.enum(MEDIA_VISIBILITIES),
    albumId: objectId.nullable(),
    isFavorite: z.boolean(),
  })
  .partial()
  .required({ version: true })
  .refine((body) => Object.keys(body).length > 1, { message: "Nothing to update" });
export type UpdateAssetInput = z.infer<typeof updateAssetBody>;

export const moderateBody = z.strictObject({ decision: z.enum(["approve", "reject"]) });
export type ModerateInput = z.infer<typeof moderateBody>;

// ---- Shared links (and QR codes) ------------------------------------------------------------

export const createAccessTokenBody = z
  .strictObject({
    /** null or left out = the whole gallery. */
    albumId: objectId.nullable().optional(),
    label: z.string().trim().max(MAX_TOKEN_LABEL).optional(),
    permissions: z.strictObject({
      canView: z.boolean(),
      canUpload: z.boolean(),
      canDownload: z.boolean(),
    }),
    expiresAt: z.iso
      .datetime({ offset: true })
      .transform((value) => new Date(value))
      .nullable()
      .optional(),
  })
  .refine((body) => body.permissions.canView || body.permissions.canUpload, {
    message: "A link must let guests view or upload photos",
    path: ["permissions"],
  })
  // An unparseable date already failed above; refinements still run, so only check real dates.
  .refine((body) => !(body.expiresAt instanceof Date) || body.expiresAt.getTime() > Date.now(), {
    message: "The expiry must be in the future",
    path: ["expiresAt"],
  });
export type CreateAccessTokenInput = z.infer<typeof createAccessTokenBody>;

// ---- What a guest with a link may send ------------------------------------------------------

/** Loose on the token's shape on purpose: ANY unusable link is the same INVALID_TOKEN answer. */
export const publicGalleryParams = z.object({ token: z.string().min(1).max(200) });
export const publicAssetParams = z.object({
  token: z.string().min(1).max(200),
  assetId: objectId,
});
export const publicListQuery = z.strictObject({
  limit: pageLimit,
  cursor: z.string().min(1).max(512).optional(),
});
export type PublicListQuery = z.infer<typeof publicListQuery>;

export const publicUploadUrlBody = z.strictObject({
  fileName,
  mimeType: uploadUrlBody.shape.mimeType,
  sizeBytes: uploadUrlBody.shape.sizeBytes,
  displayName: z.string().trim().max(MAX_DISPLAY_NAME).optional(),
});
export type PublicUploadUrlInput = z.infer<typeof publicUploadUrlBody>;
