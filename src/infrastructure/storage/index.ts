import "server-only";
import { createHash } from "node:crypto";
import path from "node:path";
import { createLocalProvider } from "@/infrastructure/storage/local";
import { createR2Provider } from "@/infrastructure/storage/r2";
import type { StorageProvider } from "@/infrastructure/storage/types";
import { getEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";

export type { StorageProvider } from "@/infrastructure/storage/types";

// Which photo store this process uses (Architecture Amendment A1):
//   all four R2_* variables set  -> Cloudflare R2
//   none set, not production      -> files on this machine's disk (development and tests)
//   none set, production          -> no store: the gallery says so instead of losing photos on a
//                                    server whose disk is temporary ...unless LOCAL_STORAGE_DIR is
//                                    set, which is a deliberate opt-in for trying a production build
//                                    on your own machine (the folder is then yours to keep)
// Tests can swap in their own provider.

let override: StorageProvider | null = null;
let cached: { key: string; provider: StorageProvider } | null = null;

export function setStorageForTests(provider: StorageProvider | null) {
  override = provider;
  cached = null;
}

/** The directory and signing secret the local store (and its route) use. */
export function localStorageSettings() {
  const env = getEnv();
  return {
    // Development only: the opt-out comment keeps the build from tracing the whole project.
    directory: path.resolve(
      /*turbopackIgnore: true*/ env.LOCAL_STORAGE_DIR ?? path.join(process.cwd(), ".local-storage"),
    ),
    appUrl: env.APP_URL,
    // A separate secret for these links, derived so SESSION_SECRET itself is never used raw.
    secret: createHash("sha256").update(`local-storage:${env.SESSION_SECRET}`).digest("base64url"),
  };
}

/** What the screens may say about the store, without exposing any setting. */
export function storageStatus(): { configured: boolean; kind: "r2" | "local" | "none" } {
  if (override) return { configured: true, kind: override.name };
  const env = getEnv();
  if (env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET) {
    return { configured: true, kind: "r2" };
  }
  const diskAllowed = env.NODE_ENV !== "production" || Boolean(env.LOCAL_STORAGE_DIR);
  return diskAllowed ? { configured: true, kind: "local" } : { configured: false, kind: "none" };
}

export function getStorage(): StorageProvider {
  if (override) return override;
  const env = getEnv();
  const status = storageStatus();
  if (!status.configured) {
    throw new AppError("INTERNAL_ERROR", {
      message: "Photo storage isn't set up on this server yet.",
    });
  }
  const key = `${status.kind}:${env.R2_BUCKET ?? ""}:${env.LOCAL_STORAGE_DIR ?? ""}`;
  if (cached?.key === key) return cached.provider;
  const provider =
    status.kind === "r2"
      ? createR2Provider({
          accountId: env.R2_ACCOUNT_ID!,
          accessKeyId: env.R2_ACCESS_KEY_ID!,
          secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
          bucket: env.R2_BUCKET!,
        })
      : createLocalProvider(localStorageSettings());
  cached = { key, provider };
  return provider;
}
