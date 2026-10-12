import "server-only";
import { randomBytes } from "node:crypto";
import { Types } from "mongoose";
import { withTransaction } from "@/infrastructure/database/transaction";
import { getStorage } from "@/infrastructure/storage";
import type { AssetStatus, MediaVisibility } from "@/lib/constants/enums";
import {
  DOWNLOAD_URL_TTL_SECONDS,
  MAX_PHOTO_BYTES,
  UPLOAD_URL_TTL_SECONDS,
  WEDDING_STORAGE_QUOTA_BYTES,
  type AllowedPhotoType,
} from "@/lib/constants/gallery";
import { AppError } from "@/lib/errors";
import {
  buildObjectKey,
  declaredMatchesSniffed,
  formatBytes,
  sanitizeFileName,
  sniffPhotoType,
} from "@/lib/gallery/files";
import { logger } from "@/lib/logger";
import { decodeCursor, paginateByCursor, type CursorMeta } from "@/lib/http/pagination";
import { z } from "zod";
import { objectId } from "@/lib/validation/primitives";
import type { AssetDto, UploadTicketDto } from "@/modules/gallery/gallery.dto";
import {
  clearCoverReferences,
  findAlbum,
  findAsset,
  galleryUsage,
  insertPendingAsset,
  listAssetsPage,
  removePendingAsset,
  softDeleteAsset,
  transitionAsset,
  updateAsset as updateAssetRow,
  type AssetChanges,
} from "@/modules/gallery/gallery.repository";
import type {
  ConfirmUploadInput,
  ListAssetsQuery,
  ModerateInput,
  UpdateAssetInput,
  UploadUrlInput,
} from "@/modules/gallery/gallery.schemas";
import { ensureWeddingGallery } from "@/modules/gallery/gallery.service";
import type { WeddingAuth } from "@/modules/members/guards";
import { can } from "@/modules/members/permissions";
import { findUserSummaries } from "@/modules/users/user.repository";

// Photos (API Design §12.2 to §12.5). The file bytes never pass through this API: the browser sends
// them straight to the photo store with a short-lived presigned address, then asks us to "confirm".
// Confirm reads the stored object back (its size and its first bytes) and refuses anything that is
// not the photo that was announced. See Architecture §25 and Amendment A1.

type AssetRow = NonNullable<Awaited<ReturnType<typeof findAsset>>>;

/** Enough bytes to recognise every accepted photo type. */
const SNIFF_BYTES = 32;

const cursorPosition = z.object({ id: objectId });

// ---------------------------------------------------------------------------------------------
// Uploading
// ---------------------------------------------------------------------------------------------

/** Refuses an upload that would take the wedding past its storage allowance. */
export async function assertRoomFor(weddingId: string, bytes: number): Promise<number> {
  const { usedBytes } = await galleryUsage(weddingId);
  if (usedBytes + bytes > WEDDING_STORAGE_QUOTA_BYTES) {
    throw new AppError("BUSINESS_RULE_VIOLATION", {
      message: `This wedding's photo storage is full (${formatBytes(WEDDING_STORAGE_QUOTA_BYTES)}). Delete some photos to make room.`,
      details: { code: "STORAGE_FULL" },
    });
  }
  return WEDDING_STORAGE_QUOTA_BYTES - usedBytes - bytes;
}

/**
 * Announces a photo and gives out the one-time address to send it to. Used for members (here) and
 * for guests with a link (public-gallery.service.ts). The row starts as `pending_upload`; if the
 * upload never happens the database's TTL index removes it after a day.
 */
export async function createPendingUpload(args: {
  weddingId: string;
  galleryId: Types.ObjectId;
  albumId: Types.ObjectId | null;
  uploadedBy: { kind: "member" | "guest"; userId?: string; displayName?: string };
  viaTokenId?: Types.ObjectId | null;
  visibility: MediaVisibility;
  file: { fileName: string; mimeType: AllowedPhotoType; sizeBytes: number };
}): Promise<UploadTicketDto> {
  const { weddingId, file } = args;
  const storage = getStorage(); // fails early, before a row exists, if photos can't be stored
  const remaining = await assertRoomFor(weddingId, file.sizeBytes);

  const assetId = new Types.ObjectId();
  const objectKey = buildObjectKey(
    weddingId,
    assetId.toString(),
    randomBytes(18).toString("base64url"),
    file.mimeType,
  );
  await insertPendingAsset(weddingId, {
    _id: assetId,
    galleryId: args.galleryId,
    albumId: args.albumId,
    uploadedBy: args.uploadedBy,
    viaTokenId: args.viaTokenId ?? null,
    objectKey,
    fileName: sanitizeFileName(file.fileName),
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    visibility: args.visibility,
  });
  const uploadUrl = await storage.createUploadUrl(objectKey, {
    contentType: file.mimeType,
    expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
  });
  return {
    assetId: assetId.toString(),
    uploadUrl,
    method: "PUT",
    headers: { "Content-Type": file.mimeType },
    expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
    maxBytes: MAX_PHOTO_BYTES,
    remainingBytes: remaining,
  };
}

export async function requestUploadUrl(
  auth: WeddingAuth,
  input: UploadUrlInput,
): Promise<UploadTicketDto> {
  const album = input.albumId ? await findAlbum(auth.weddingId, input.albumId) : null;
  if (input.albumId && !album) throw new AppError("NOT_FOUND");
  const gallery = await ensureWeddingGallery(auth);
  return createPendingUpload({
    weddingId: auth.weddingId,
    galleryId: gallery._id,
    albumId: album?._id ?? null,
    uploadedBy: { kind: "member", userId: auth.userId },
    visibility: album?.defaultVisibility ?? "private",
    file: { fileName: input.fileName, mimeType: input.mimeType, sizeBytes: input.sizeBytes },
  });
}

/**
 * Checks what was really stored against what was announced, then moves the photo out of
 * `pending_upload`. A photo that is missing, larger than announced, or not the photo it claims to be
 * is deleted from the store and its pending row removed (422), so nothing odd is ever kept.
 */
export async function finalizeUpload(
  weddingId: string,
  asset: AssetRow,
  dimensions: ConfirmUploadInput,
  finalStatus: Extract<AssetStatus, "active" | "pending_review">,
): Promise<AssetRow> {
  const storage = getStorage();
  const reject = async (message: string): Promise<never> => {
    await storage.remove(asset.objectKey).catch((error) => {
      logger.warn("gallery.cleanup_failed", { error });
    });
    await removePendingAsset(weddingId, asset._id);
    throw new AppError("BUSINESS_RULE_VIOLATION", { message });
  };

  const info = await storage.head(asset.objectKey);
  if (!info) {
    // Nothing arrived (yet). Keep the row: the upload address is still valid for a few minutes.
    throw new AppError("BUSINESS_RULE_VIOLATION", {
      message: "The photo didn't arrive. Please try uploading it again.",
    });
  }
  if (info.sizeBytes < 1 || info.sizeBytes > MAX_PHOTO_BYTES || info.sizeBytes > asset.sizeBytes) {
    return reject("That file is larger than the photo that was announced, so it was removed.");
  }
  const start = await storage.readStart(asset.objectKey, SNIFF_BYTES);
  const sniffed = start ? sniffPhotoType(start) : null;
  if (!sniffed || !declaredMatchesSniffed(asset.mimeType as AllowedPhotoType, sniffed)) {
    return reject("That file isn't a JPEG, PNG, WebP or HEIC photo, so it was removed.");
  }

  const updated = await transitionAsset(weddingId, asset._id, "pending_upload", finalStatus, {
    sizeBytes: info.sizeBytes,
    width: dimensions.width ?? null,
    height: dimensions.height ?? null,
  });
  // Someone confirmed it at the same moment: theirs is the result.
  return updated ?? (await findAsset(weddingId, asset._id)) ?? asset;
}

export async function confirmUpload(
  auth: WeddingAuth,
  assetId: string,
  input: ConfirmUploadInput,
): Promise<AssetDto> {
  const asset = await findAsset(auth.weddingId, assetId);
  if (!asset || asset.uploadedBy.kind !== "member") throw new AppError("NOT_FOUND");
  const mine = asset.uploadedBy.userId?.toString() === auth.userId;
  if (!mine && !can(auth.membership.role, "gallery:manage")) {
    throw new AppError("INSUFFICIENT_ROLE");
  }
  if (asset.status === "active" || asset.status === "pending_review") {
    return (await toAssetDtos(auth, [asset]))[0]!; // confirming twice is harmless
  }
  if (asset.status !== "pending_upload") throw new AppError("NOT_FOUND");
  const done = await finalizeUpload(auth.weddingId, asset, input, "active");
  return (await toAssetDtos(auth, [done]))[0]!;
}

// ---------------------------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------------------------

const canDeleteAsset = (auth: WeddingAuth, asset: AssetRow) =>
  asset.uploadedBy.userId?.toString() === auth.userId ||
  can(auth.membership.role, "gallery:manage");

export async function toAssetDtos(auth: WeddingAuth, rows: AssetRow[]): Promise<AssetDto[]> {
  if (rows.length === 0) return [];
  const storage = getStorage();
  const userIds = [
    ...new Set(
      rows.flatMap((row) => (row.uploadedBy.userId ? [row.uploadedBy.userId.toString()] : [])),
    ),
  ];
  const users = userIds.length > 0 ? await findUserSummaries(userIds) : [];
  const nameOf = new Map(users.map((user) => [user._id.toString(), user.name]));

  return Promise.all(
    rows.map(async (row) => ({
      id: row._id.toString(),
      albumId: row.albumId ? row.albumId.toString() : null,
      fileName: row.fileName,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      width: row.width ?? null,
      height: row.height ?? null,
      caption: row.caption ?? null,
      visibility: row.visibility,
      status: row.status,
      isFavorite: row.isFavorite,
      uploadedBy: {
        kind: row.uploadedBy.kind,
        name:
          row.uploadedBy.kind === "member"
            ? (nameOf.get(row.uploadedBy.userId?.toString() ?? "") ?? null)
            : (row.uploadedBy.displayName ?? null),
      },
      canDelete: canDeleteAsset(auth, row),
      url: await storage.createDownloadUrl(row.objectKey, {
        expiresInSeconds: DOWNLOAD_URL_TTL_SECONDS,
      }),
      downloadUrl: await storage.createDownloadUrl(row.objectKey, {
        expiresInSeconds: DOWNLOAD_URL_TTL_SECONDS,
        downloadAs: row.fileName,
      }),
      version: row.__v ?? 0,
      createdAt: (row.createdAt ?? new Date(0)).toISOString(),
    })),
  );
}

export async function listAssets(
  auth: WeddingAuth,
  query: ListAssetsQuery,
): Promise<{ items: AssetDto[]; meta: CursorMeta }> {
  const status = query.status ?? "active";
  if (status === "pending_upload") {
    throw new AppError("VALIDATION_ERROR", { message: "That status can't be listed" });
  }
  // Waiting and rejected guest photos are for whoever approves them.
  if (status !== "active" && !can(auth.membership.role, "gallery:manage")) {
    throw new AppError("INSUFFICIENT_ROLE");
  }
  const after = query.cursor ? decodeCursor(query.cursor, cursorPosition).id : undefined;
  const rows = await listAssetsPage(
    auth.weddingId,
    {
      status,
      ...(query.albumId ? { albumId: query.albumId } : {}),
      ...(query.favorite ? { favoritesOnly: true } : {}),
    },
    { limit: query.limit, afterId: after },
  );
  const page = paginateByCursor(rows, query.limit, (row) => ({ id: row._id.toString() }));
  return { items: await toAssetDtos(auth, page.items), meta: page.meta };
}

// ---------------------------------------------------------------------------------------------
// Changing and removing
// ---------------------------------------------------------------------------------------------

export async function updateAsset(
  auth: WeddingAuth,
  assetId: string,
  input: UpdateAssetInput,
): Promise<AssetDto> {
  const { version, albumId, ...rest } = input;
  const existing = await findAsset(auth.weddingId, assetId);
  if (!existing || !["active", "pending_review"].includes(existing.status)) {
    throw new AppError("NOT_FOUND");
  }
  const changes: AssetChanges = { ...rest };
  if (albumId !== undefined) {
    if (albumId !== null && !(await findAlbum(auth.weddingId, albumId))) {
      throw new AppError("NOT_FOUND");
    }
    changes.albumId = albumId;
  }
  const result = await updateAssetRow(auth.weddingId, assetId, version, changes);
  if (result === "conflict") throw new AppError("VERSION_CONFLICT");
  if (result === "not_found") throw new AppError("NOT_FOUND");
  return (await toAssetDtos(auth, [result]))[0]!;
}

/**
 * Soft delete (the row stays, hidden). The photo can no longer be a cover. Unlike other records,
 * the stored FILE is removed too: there is no way to restore a single photo, and keeping the file
 * would silently use up the wedding's storage allowance (decided 2026-10-11, Phase 6).
 */
export async function deleteAsset(auth: WeddingAuth, assetId: string) {
  const asset = await findAsset(auth.weddingId, assetId);
  if (!asset || asset.status === "pending_upload") throw new AppError("NOT_FOUND");
  if (!canDeleteAsset(auth, asset)) throw new AppError("INSUFFICIENT_ROLE");

  const at = new Date();
  await withTransaction(async (session) => {
    if (!(await softDeleteAsset(auth.weddingId, assetId, { by: auth.userId, at }, session))) {
      throw new AppError("NOT_FOUND");
    }
    await clearCoverReferences(auth.weddingId, assetId, session);
  });
  await getStorage()
    .remove(asset.objectKey)
    .catch((error) => logger.warn("gallery.cleanup_failed", { error }));
  return { id: assetId, deletedAt: at.toISOString() };
}

/** Approve (becomes visible to guests with a link) or reject (removed) a guest's photo. */
export async function moderateAsset(
  auth: WeddingAuth,
  assetId: string,
  input: ModerateInput,
): Promise<AssetDto> {
  const to = input.decision === "approve" ? "active" : "rejected";
  const result = await transitionAsset(auth.weddingId, assetId, "pending_review", to);
  if (!result) {
    const existing = await findAsset(auth.weddingId, assetId);
    if (!existing) throw new AppError("NOT_FOUND");
    throw new AppError("BUSINESS_RULE_VIOLATION", {
      message: "That photo is not waiting for approval.",
    });
  }
  if (to === "rejected") {
    await getStorage()
      .remove(result.objectKey)
      .catch((error) => logger.warn("gallery.cleanup_failed", { error }));
  }
  return (await toAssetDtos(auth, [result]))[0]!;
}
