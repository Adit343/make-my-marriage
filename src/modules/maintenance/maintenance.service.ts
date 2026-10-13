import "server-only";
import { getStorage } from "@/infrastructure/storage";
import { ACCOUNT_ANONYMIZE_GRACE_DAYS } from "@/lib/constants/retention";
import { logger } from "@/lib/logger";
import {
  anonymizeUser,
  countWeddingRows,
  deleteAssetsByIds,
  deleteWeddingRows,
  findAnonymizableUsers,
  findAssetKeys,
  findPurgeableWeddings,
} from "@/modules/maintenance/maintenance.repository";

// The manual clean-up jobs (DB Design §10.3 and §10.4). A person runs them with
// `npm run db:purge-weddings` / `db:anonymize-users`; no worker, and never from a request.
// Both are dry runs unless `apply` is true.

const ASSET_PAGE = 200;

export interface MaintenanceOptions {
  now?: Date;
  apply: boolean;
  /** How many weddings (or accounts) to handle in one run. */
  limit?: number;
}

export interface WeddingPurgeResult {
  weddingId: string;
  title: string;
  /** Rows found (dry run) for each collection. */
  rows: Record<string, number>;
  filesRemoved: number;
  /** Set when the wedding was skipped: its rows were not deleted. */
  error?: string;
}

/**
 * Permanently removes soft-deleted weddings whose grace period is over: photo files first, then
 * every row the wedding owns. If a file cannot be removed the wedding's rows are kept (it stays
 * deleted and unreachable) and the failure is reported, so a re-run finishes the job.
 */
export async function purgeWeddings(options: MaintenanceOptions): Promise<WeddingPurgeResult[]> {
  const now = options.now ?? new Date();
  const weddings = await findPurgeableWeddings(now, options.limit ?? 25);
  const results: WeddingPurgeResult[] = [];

  for (const wedding of weddings) {
    const weddingId = String(wedding._id);
    const result: WeddingPurgeResult = {
      weddingId,
      title: wedding.title,
      rows: await countWeddingRows(weddingId),
      filesRemoved: 0,
    };
    results.push(result);
    if (!options.apply) continue;

    try {
      const storage = getStorage();
      for (;;) {
        const assets = await findAssetKeys(weddingId, ASSET_PAGE);
        if (assets.length === 0) break;
        for (const asset of assets) {
          await storage.remove(asset.objectKey);
          result.filesRemoved += 1;
        }
        await deleteAssetsByIds(
          weddingId,
          assets.map((asset) => asset._id),
        );
      }
      await deleteWeddingRows(weddingId);
      logger.info("maintenance.wedding_purged", { weddingId, filesRemoved: result.filesRemoved });
    } catch (error) {
      result.error = error instanceof Error ? error.message : "unknown error";
      logger.error("maintenance.wedding_purge_failed", { weddingId, message: result.error });
    }
  }
  return results;
}

/** Strips personal data from accounts deleted longer ago than the grace period. */
export async function anonymizeDeletedUsers(
  options: MaintenanceOptions,
): Promise<{ userIds: string[]; anonymized: number }> {
  const now = options.now ?? new Date();
  const cutoff = new Date(now.getTime() - ACCOUNT_ANONYMIZE_GRACE_DAYS * 24 * 60 * 60 * 1000);
  const users = await findAnonymizableUsers(cutoff, options.limit ?? 200);
  let anonymized = 0;
  if (options.apply) {
    for (const user of users) {
      if (await anonymizeUser(user._id)) anonymized += 1;
    }
    logger.info("maintenance.users_anonymized", { anonymized });
  }
  return { userIds: users.map((user) => String(user._id)), anonymized };
}
