// The photo storage interface (Architecture §25, Amendment A1). The gallery never talks to
// Cloudflare R2 or the disk directly: it asks a StorageProvider. Production uses R2; development
// and tests use a disk-backed provider with the same behaviour, so no account is needed to build or
// test the gallery. A real S3 bucket would be one more implementation of this interface.

export interface StoredObjectInfo {
  sizeBytes: number;
  /** The Content-Type the uploader's browser sent, if any. */
  contentType: string | null;
}

export interface UploadUrlOptions {
  /** The type the browser will send with the file. */
  contentType: string;
  expiresInSeconds: number;
}

export interface DownloadUrlOptions {
  expiresInSeconds: number;
  /** Ask the browser to save the file under this name instead of showing it. */
  downloadAs?: string;
}

export interface StorageProvider {
  readonly name: "r2" | "local";
  /** A short-lived address the BROWSER sends the file to (PUT). The bytes never pass through our API. */
  createUploadUrl(key: string, options: UploadUrlOptions): Promise<string>;
  /** A short-lived address that shows (or downloads) the file. */
  createDownloadUrl(key: string, options: DownloadUrlOptions): Promise<string>;
  /** What was stored under a key, or null if nothing is there. */
  head(key: string): Promise<StoredObjectInfo | null>;
  /** The first `length` bytes of the file, or null if nothing is there. */
  readStart(key: string, length: number): Promise<Uint8Array | null>;
  /** Removes the file. Removing something already gone is not an error. */
  remove(key: string): Promise<void>;
}
