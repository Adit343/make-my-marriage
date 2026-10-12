// Limits for the photo gallery (DB Design §6.17 to §6.20, Architecture §25 and Amendment A1).
// Shared by the Zod request schemas, the Mongoose models, the storage checks and the screens.

/** One photo. Phone photos are normally 2 to 8 MB; HEIC and large JPEGs can reach 12. */
export const MAX_PHOTO_BYTES = 15 * 1024 * 1024;
/** Everything one wedding may store (owner decision 2026-10-11: sized for Cloudflare R2's free tier). */
export const WEDDING_STORAGE_QUOTA_BYTES = 2 * 1024 * 1024 * 1024;

/** The photo types accepted in V1 (no video), with the file extension each is stored under. */
export const ALLOWED_PHOTO_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
} as const;
export type AllowedPhotoType = keyof typeof ALLOWED_PHOTO_TYPES;

/** An upload link works this long: enough for a slow connection, short enough to be useless later. */
export const UPLOAD_URL_TTL_SECONDS = 10 * 60;
/** A photo's view or download link works this long. */
export const DOWNLOAD_URL_TTL_SECONDS = 60 * 60;
/** Uploads never confirmed are removed from the database after this long (the TTL index). */
export const PENDING_UPLOAD_TTL_SECONDS = 24 * 60 * 60;

export const MAX_GALLERY_TITLE = 120;
export const MAX_GALLERY_DESCRIPTION = 1000;
export const MAX_ALBUM_TITLE = 100;
export const MAX_ALBUM_DESCRIPTION = 500;
export const MAX_ALBUMS = 100;
export const MAX_CAPTION = 300;
export const MAX_FILE_NAME = 255;
export const MAX_TOKEN_LABEL = 80;
export const MAX_DISPLAY_NAME = 60;
export const MAX_IMAGE_DIMENSION = 30_000;

export const GALLERY_PAGE_SIZE = 30;
