import "server-only";
import { AwsClient } from "aws4fetch";
import type {
  DownloadUrlOptions,
  StorageProvider,
  StoredObjectInfo,
  UploadUrlOptions,
} from "@/infrastructure/storage/types";

// Cloudflare R2 through its S3-compatible API (Architecture Amendment A1). Requests are signed with
// aws4fetch (no AWS SDK, no AWS account). The bucket is private: the browser only ever gets
// short-lived presigned addresses, and the server's own reads (HEAD, first bytes, delete) are
// signed with the bucket-scoped API token.

const REQUEST_TIMEOUT_MS = 8000;

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

/** Each path segment encoded; our keys are plain, but never trust that to stay true. */
const encodeKey = (key: string) => key.split("/").map(encodeURIComponent).join("/");

export function createR2Provider(config: R2Config): StorageProvider {
  const client = new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    service: "s3",
    region: "auto",
    // aws4fetch retries 10 times with back-off by default; a failing store should fail fast so the
    // request can report it (one retry covers a dropped connection).
    retries: 1,
  });
  const origin = `https://${config.accountId}.r2.cloudflarestorage.com`;
  const urlFor = (key: string) => new URL(`${origin}/${config.bucket}/${encodeKey(key)}`);

  /** A presigned URL: the signature lives in the query string, so a plain browser request works. */
  async function presign(
    method: "GET" | "PUT",
    key: string,
    expiresInSeconds: number,
    extra: Record<string, string> = {},
  ): Promise<string> {
    const url = urlFor(key);
    url.searchParams.set("X-Amz-Expires", String(expiresInSeconds));
    for (const [name, value] of Object.entries(extra)) url.searchParams.set(name, value);
    const signed = await client.sign(new Request(url, { method }), { aws: { signQuery: true } });
    return signed.url;
  }

  const send = (key: string, init: RequestInit) =>
    client.fetch(urlFor(key).toString(), {
      ...init,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

  return {
    name: "r2",

    createUploadUrl(key: string, options: UploadUrlOptions) {
      // The content type is checked when the upload is confirmed (the bytes are read back), not
      // trusted from the browser.
      return presign("PUT", key, options.expiresInSeconds);
    },

    createDownloadUrl(key: string, options: DownloadUrlOptions) {
      const extra: Record<string, string> = {};
      if (options.downloadAs) {
        // Header-safe: our sanitised names have no quotes or control characters.
        const name = options.downloadAs.replace(/"/g, "");
        extra["response-content-disposition"] =
          `attachment; filename="${name.replace(/[^\x20-\x7e]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(name)}`;
      }
      return presign("GET", key, options.expiresInSeconds, extra);
    },

    async head(key: string): Promise<StoredObjectInfo | null> {
      const response = await send(key, { method: "HEAD" });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`R2 HEAD failed with status ${response.status}`);
      return {
        sizeBytes: Number(response.headers.get("content-length") ?? 0),
        contentType: response.headers.get("content-type"),
      };
    },

    async readStart(key: string, length: number): Promise<Uint8Array | null> {
      const response = await send(key, { headers: { Range: `bytes=0-${length - 1}` } });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`R2 GET failed with status ${response.status}`);
      return new Uint8Array(await response.arrayBuffer()).subarray(0, length);
    },

    async remove(key: string): Promise<void> {
      const response = await send(key, { method: "DELETE" });
      if (!response.ok && response.status !== 404) {
        throw new Error(`R2 DELETE failed with status ${response.status}`);
      }
    },
  };
}
