import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile, open } from "node:fs/promises";
import path from "node:path";
import { OBJECT_KEY_PATTERN } from "@/lib/gallery/files";
import type {
  DownloadUrlOptions,
  StorageProvider,
  StoredObjectInfo,
  UploadUrlOptions,
} from "@/infrastructure/storage/types";

// The development and test photo store: files on this machine's disk, addressed through our own
// /api/v1/storage/local route with signed, expiring links, so it behaves like R2 (the browser PUTs
// the file to a presigned address; viewing needs a presigned address too). It is never used in
// production and is switched off when R2 is configured. Files and their content types live under
// LOCAL_STORAGE_DIR (default .local-storage, which is git-ignored).

export interface LocalConfig {
  /** Where files are kept. */
  directory: string;
  /** Public origin of this app, to build links back to the route. */
  appUrl: string;
  /** Secret for signing links (derived from SESSION_SECRET by the caller). */
  secret: string;
}

export type LocalOperation = "put" | "get";

/** A key we made, resolved to a file inside `directory`; anything else is refused (path traversal). */
export function resolveLocalPath(directory: string, key: string): string | null {
  if (!OBJECT_KEY_PATTERN.test(key)) return null;
  const root = path.resolve(directory);
  const full = path.resolve(root, ...key.split("/"));
  return full.startsWith(root + path.sep) ? full : null;
}

function signature(
  secret: string,
  operation: LocalOperation,
  key: string,
  expires: number,
  contentType: string,
  downloadAs: string,
): string {
  return createHmac("sha256", secret)
    .update([operation, key, expires, contentType, downloadAs].join("\n"))
    .digest("base64url");
}

/** Checks a link the route received: right operation, not expired, signed by us. */
export function verifyLocalLink(
  secret: string,
  operation: LocalOperation,
  key: string,
  query: URLSearchParams,
  now = Date.now(),
): boolean {
  const expires = Number(query.get("exp"));
  const given = query.get("sig") ?? "";
  if (!Number.isFinite(expires) || expires * 1000 < now || query.get("op") !== operation) {
    return false;
  }
  const expected = signature(
    secret,
    operation,
    key,
    expires,
    query.get("ct") ?? "",
    query.get("dl") ?? "",
  );
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createLocalProvider(config: LocalConfig): StorageProvider {
  const link = (
    operation: LocalOperation,
    key: string,
    expiresInSeconds: number,
    contentType = "",
    downloadAs = "",
  ) => {
    const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const url = new URL(`/api/v1/storage/local/${key}`, config.appUrl);
    url.searchParams.set("op", operation);
    url.searchParams.set("exp", String(expires));
    if (contentType) url.searchParams.set("ct", contentType);
    if (downloadAs) url.searchParams.set("dl", downloadAs);
    url.searchParams.set(
      "sig",
      signature(config.secret, operation, key, expires, contentType, downloadAs),
    );
    return url.toString();
  };

  const fileOf = (key: string) => {
    const file = resolveLocalPath(config.directory, key);
    if (!file) throw new Error("Refused a storage key that is not one of ours");
    return file;
  };

  return {
    name: "local",

    async createUploadUrl(key: string, options: UploadUrlOptions) {
      fileOf(key);
      return link("put", key, options.expiresInSeconds, options.contentType);
    },

    async createDownloadUrl(key: string, options: DownloadUrlOptions) {
      fileOf(key);
      return link("get", key, options.expiresInSeconds, "", options.downloadAs ?? "");
    },

    async head(key: string): Promise<StoredObjectInfo | null> {
      const file = fileOf(key);
      try {
        const info = await stat(/*turbopackIgnore: true*/ file);
        let contentType: string | null = null;
        try {
          contentType =
            (await readFile(/*turbopackIgnore: true*/ `${file}.type`, "utf8")).trim() || null;
        } catch {
          contentType = null;
        }
        return { sizeBytes: info.size, contentType };
      } catch {
        return null;
      }
    },

    async readStart(key: string, length: number): Promise<Uint8Array | null> {
      const file = fileOf(key);
      try {
        const handle = await open(/*turbopackIgnore: true*/ file, "r");
        try {
          const buffer = Buffer.alloc(length);
          const { bytesRead } = await handle.read(buffer, 0, length, 0);
          return new Uint8Array(buffer.subarray(0, bytesRead));
        } finally {
          await handle.close();
        }
      } catch {
        return null;
      }
    },

    async remove(key: string): Promise<void> {
      const file = fileOf(key);
      await rm(/*turbopackIgnore: true*/ file, { force: true });
      await rm(/*turbopackIgnore: true*/ `${file}.type`, { force: true });
    },
  };
}

/** Writes an uploaded file and its content type (used by the local route, never by the gallery). */
export async function writeLocalObject(
  directory: string,
  key: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<boolean> {
  const file = resolveLocalPath(directory, key);
  if (!file) return false;
  await mkdir(/*turbopackIgnore: true*/ path.dirname(file), { recursive: true });
  await writeFile(/*turbopackIgnore: true*/ file, bytes);
  await writeFile(/*turbopackIgnore: true*/ `${file}.type`, contentType);
  return true;
}

/** Reads a stored file and its content type (used by the local route). */
export async function readLocalObject(
  directory: string,
  key: string,
): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  const file = resolveLocalPath(directory, key);
  if (!file) return null;
  try {
    const bytes = new Uint8Array(await readFile(/*turbopackIgnore: true*/ file));
    let contentType = "application/octet-stream";
    try {
      contentType =
        (await readFile(/*turbopackIgnore: true*/ `${file}.type`, "utf8")).trim() || contentType;
    } catch {
      /* keep the default */
    }
    return { bytes, contentType };
  } catch {
    return null;
  }
}
