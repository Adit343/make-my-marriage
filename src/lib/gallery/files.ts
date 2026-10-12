import { ALLOWED_PHOTO_TYPES, MAX_FILE_NAME, type AllowedPhotoType } from "@/lib/constants/gallery";

// Checks on uploaded photos that need no server or database: which types are accepted, what a real
// file of each type starts with, how object keys and file names are made safe. The "confirm" step
// uses these on the first bytes of the stored object, so a file renamed to .jpg or declared as a
// photo when it is something else is rejected (Architecture §25, file-upload security).

export function isAllowedPhotoType(value: string): value is AllowedPhotoType {
  return Object.hasOwn(ALLOWED_PHOTO_TYPES, value);
}

export function extensionFor(type: AllowedPhotoType): string {
  return ALLOWED_PHOTO_TYPES[type];
}

/** The brands a HEIC or HEIF file declares in its "ftyp" box. */
const HEIF_BRANDS = new Set([
  "heic",
  "heix",
  "heim",
  "heis",
  "hevc",
  "hevx",
  "hevm",
  "hevs",
  "mif1",
  "msf1",
]);

const ascii = (bytes: Uint8Array, from: number, to: number) =>
  String.fromCharCode(...bytes.subarray(from, to));

/**
 * What a file really is, from its first bytes: "image/jpeg", "image/png", "image/webp" or
 * "image/heic" (HEIC and HEIF share one container), or null for anything else.
 */
export function sniffPhotoType(bytes: Uint8Array): AllowedPhotoType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    ascii(bytes, 1, 4) === "PNG" &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") {
    return "image/webp";
  }
  if (bytes.length >= 12 && ascii(bytes, 4, 8) === "ftyp" && HEIF_BRANDS.has(ascii(bytes, 8, 12))) {
    return "image/heic";
  }
  return null;
}

/** True if the declared type is what the bytes really are (HEIC and HEIF are interchangeable). */
export function declaredMatchesSniffed(declared: AllowedPhotoType, sniffed: AllowedPhotoType) {
  const heif = (type: AllowedPhotoType) => type === "image/heic" || type === "image/heif";
  return declared === sniffed || (heif(declared) && heif(sniffed));
}

/** An object key for a photo: built only from ids the server made and a random part. */
export function buildObjectKey(
  weddingId: string,
  assetId: string,
  random: string,
  type: AllowedPhotoType,
): string {
  return `weddings/${weddingId}/gallery/${assetId}/${random}.${extensionFor(type)}`;
}

/** The shape every object key we create has; anything else is refused before it touches storage. */
export const OBJECT_KEY_PATTERN =
  /^weddings\/[a-f0-9]{24}\/gallery\/[a-f0-9]{24}\/[A-Za-z0-9_-]{16,64}\.(?:jpg|png|webp|heic|heif)$/;

/**
 * A file name safe to store and show: no path parts, no control characters, no markup brackets,
 * trimmed to the limit. Display only, it never influences where a file is stored.
 */
export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base
    .replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "");
  const limited = cleaned.slice(0, MAX_FILE_NAME).trim();
  return limited || "photo";
}

/** Bytes as "3.2 MB" or "1.4 GB" for the storage meter. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value >= 100 || Number.isInteger(value) ? Math.round(value) : value.toFixed(1)} ${units[index]}`;
}
