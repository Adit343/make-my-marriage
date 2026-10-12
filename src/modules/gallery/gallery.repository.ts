import "server-only";
import { Error as MongooseError, Types, type ClientSession } from "mongoose";
import { aggregateScoped } from "@/infrastructure/database/aggregate";
import { connectDb } from "@/infrastructure/database/connection";
import type { AssetStatus, MediaVisibility, UploaderKind } from "@/lib/constants/enums";
import { isDuplicateKeyError } from "@/lib/errors";
import { Gallery } from "@/models/gallery.model";
import { galleryTokenPurgeAt } from "@/lib/constants/retention";
import { GalleryAccessToken } from "@/models/galleryAccessToken.model";
import { GalleryAlbum } from "@/models/galleryAlbum.model";
import { GalleryAsset } from "@/models/galleryAsset.model";

type Id = Types.ObjectId | string;

// DB Design §6.17 to §6.20. Every wedding-owned function takes weddingId first (DB Design §9.2);
// the only lookup by token is findTokenByHash, used by the public gallery routes. Soft-deleted rows
// are hidden by the plugin (tokens are a hard-delete collection).

// ---------------------------------------------------------------------------------------------
// Gallery (settings)
// ---------------------------------------------------------------------------------------------

export interface GalleryChanges {
  title?: string;
  description?: string | null;
  allowGuestUploads?: boolean;
  requireUploadApproval?: boolean;
  coverAssetId?: Id | null;
}

export async function findGallery(weddingId: Id) {
  await connectDb();
  return Gallery.findOne({ weddingId }).lean();
}

/** The wedding's gallery, made on first use. Two simultaneous callers end up with the same one. */
export async function ensureGallery(weddingId: Id, defaults: { title: string; createdBy: Id }) {
  await connectDb();
  const existing = await Gallery.findOne({ weddingId }).lean();
  if (existing) return existing;
  try {
    const created = await Gallery.create({ weddingId, ...defaults });
    return created.toObject();
  } catch (error) {
    if (!isDuplicateKeyError(error, "weddingId")) throw error;
    const winner = await Gallery.findOne({ weddingId }).lean();
    if (winner) return winner;
    throw error;
  }
}

/** Optimistic concurrency (decision C5): the write only lands if the gallery is still at `version`. */
export async function updateGallery(
  weddingId: Id,
  version: number,
  changes: GalleryChanges,
): Promise<"conflict" | "not_found" | NonNullable<Awaited<ReturnType<typeof findGallery>>>> {
  await connectDb();
  const gallery = await Gallery.findOne({ weddingId });
  if (!gallery) return "not_found";
  if (gallery.__v !== version) return "conflict";
  gallery.set(changes);
  try {
    await gallery.save();
  } catch (error) {
    if (error instanceof MongooseError.VersionError) return "conflict";
    throw error;
  }
  return gallery.toObject();
}

/** A deleted photo can no longer be the gallery's or an album's cover. */
export async function clearCoverReferences(
  weddingId: Id,
  assetId: Id,
  session?: ClientSession,
): Promise<void> {
  await connectDb();
  await Gallery.updateMany(
    { weddingId, coverAssetId: assetId },
    { $set: { coverAssetId: null } },
    { session },
  );
  await GalleryAlbum.updateMany(
    { weddingId, coverAssetId: assetId },
    { $set: { coverAssetId: null } },
    { session },
  );
}

// ---------------------------------------------------------------------------------------------
// Albums
// ---------------------------------------------------------------------------------------------

export interface NewAlbum {
  galleryId: Id;
  title: string;
  description?: string;
  eventId?: Id | null;
  defaultVisibility?: MediaVisibility;
  createdBy: Id;
}

export interface AlbumChanges {
  title?: string;
  description?: string | null;
  eventId?: Id | null;
  defaultVisibility?: MediaVisibility;
  coverAssetId?: Id | null;
  sortOrder?: number;
}

export async function insertAlbum(weddingId: Id, input: NewAlbum) {
  await connectDb();
  const album = await GalleryAlbum.create({ ...input, weddingId });
  return album.toObject();
}

export async function findAlbum(weddingId: Id, albumId: Id) {
  await connectDb();
  return GalleryAlbum.findOne({ _id: albumId, weddingId }).lean();
}

export async function listAlbums(weddingId: Id) {
  await connectDb();
  return GalleryAlbum.find({ weddingId }).sort({ sortOrder: 1, _id: 1 }).limit(500).lean();
}

export async function countAlbums(weddingId: Id): Promise<number> {
  await connectDb();
  return GalleryAlbum.countDocuments({ weddingId });
}

export async function updateAlbum(
  weddingId: Id,
  albumId: Id,
  version: number,
  changes: AlbumChanges,
): Promise<"conflict" | "not_found" | NonNullable<Awaited<ReturnType<typeof findAlbum>>>> {
  await connectDb();
  const album = await GalleryAlbum.findOne({ _id: albumId, weddingId });
  if (!album) return "not_found";
  if (album.__v !== version) return "conflict";
  album.set(changes);
  try {
    await album.save();
  } catch (error) {
    if (error instanceof MongooseError.VersionError) return "conflict";
    throw error;
  }
  return album.toObject();
}

export async function softDeleteAlbum(
  weddingId: Id,
  albumId: Id,
  deletion: { by: Id; at: Date },
  session?: ClientSession,
): Promise<boolean> {
  await connectDb();
  const result = await GalleryAlbum.updateOne(
    { _id: albumId, weddingId },
    { $set: { deletedAt: deletion.at, deletedBy: deletion.by } },
    { session },
  );
  return result.modifiedCount === 1;
}

/** Deleting an event keeps its albums: they just stop being linked to it. */
export async function unlinkAlbumsFromEvent(
  weddingId: Id,
  eventId: Id,
  session?: ClientSession,
): Promise<number> {
  await connectDb();
  const result = await GalleryAlbum.updateMany(
    { weddingId, eventId },
    { $set: { eventId: null } },
    { session },
  );
  return result.modifiedCount;
}

/** Per album: how many visible photos, and the newest one (its fallback cover). */
export async function albumPhotoStats(
  weddingId: Id,
): Promise<{ albumId: Types.ObjectId | null; count: number; latestAssetId: Types.ObjectId }[]> {
  const rows = await aggregateScoped<{
    _id: Types.ObjectId | null;
    count: number;
    latest: Types.ObjectId;
  }>(GalleryAsset, weddingId, [
    { $match: { status: "active" } },
    { $sort: { _id: -1 } },
    { $group: { _id: "$albumId", count: { $sum: 1 }, latest: { $first: "$_id" } } },
  ]);
  return rows.map((row) => ({ albumId: row._id, count: row.count, latestAssetId: row.latest }));
}

// ---------------------------------------------------------------------------------------------
// Photos
// ---------------------------------------------------------------------------------------------

export interface NewPendingAsset {
  _id: Types.ObjectId;
  galleryId: Id;
  albumId: Id | null;
  uploadedBy: { kind: UploaderKind; userId?: Id | null; guestId?: Id | null; displayName?: string };
  viaTokenId?: Id | null;
  objectKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  visibility: MediaVisibility;
}

export interface AssetChanges {
  caption?: string | null;
  visibility?: MediaVisibility;
  albumId?: Id | null;
  isFavorite?: boolean;
}

export interface AssetFilter {
  /** An album id, "root" for photos with no album, or undefined for every album. */
  albumId?: Id | "root";
  status: AssetStatus;
  /** Only the visibilities a guest may see. */
  visibilities?: MediaVisibility[];
  favoritesOnly?: boolean;
}

export async function insertPendingAsset(weddingId: Id, input: NewPendingAsset) {
  await connectDb();
  const asset = await GalleryAsset.create({ ...input, weddingId, status: "pending_upload" });
  return asset.toObject();
}

export async function findAsset(weddingId: Id, assetId: Id) {
  await connectDb();
  return GalleryAsset.findOne({ _id: assetId, weddingId }).lean();
}

export async function findAssetsByIds(weddingId: Id, assetIds: Id[]) {
  if (assetIds.length === 0) return [];
  await connectDb();
  return GalleryAsset.find({ weddingId, _id: { $in: assetIds } }).lean();
}

/** Newest first. `limit + 1` rows so the caller can tell whether there is another page. */
export async function listAssetsPage(
  weddingId: Id,
  filter: AssetFilter,
  page: { limit: number; afterId?: Id },
) {
  await connectDb();
  const query: Record<string, unknown> = { weddingId, status: filter.status };
  if (filter.albumId === "root") query.albumId = null;
  else if (filter.albumId) query.albumId = filter.albumId;
  if (filter.visibilities) query.visibility = { $in: filter.visibilities };
  if (filter.favoritesOnly) query.isFavorite = true;
  if (page.afterId) query._id = { $lt: new Types.ObjectId(page.afterId.toString()) };
  return GalleryAsset.find(query)
    .sort({ _id: -1 })
    .limit(page.limit + 1)
    .lean();
}

export async function updateAsset(
  weddingId: Id,
  assetId: Id,
  version: number,
  changes: AssetChanges,
): Promise<"conflict" | "not_found" | NonNullable<Awaited<ReturnType<typeof findAsset>>>> {
  await connectDb();
  const asset = await GalleryAsset.findOne({ _id: assetId, weddingId });
  if (!asset) return "not_found";
  if (asset.__v !== version) return "conflict";
  asset.set(changes);
  try {
    await asset.save();
  } catch (error) {
    if (error instanceof MongooseError.VersionError) return "conflict";
    throw error;
  }
  return asset.toObject();
}

/**
 * Moves a photo from one status to another only if it is still in `from` (so a double click or two
 * moderators cannot both win). Returns the updated photo, or null if it was no longer in `from`.
 */
export async function transitionAsset(
  weddingId: Id,
  assetId: Id,
  from: AssetStatus,
  to: AssetStatus,
  extra: { sizeBytes?: number; width?: number | null; height?: number | null } = {},
) {
  await connectDb();
  return GalleryAsset.findOneAndUpdate(
    { _id: assetId, weddingId, status: from },
    { $set: { status: to, ...extra }, $inc: { __v: 1 } },
    { returnDocument: "after" },
  ).lean();
}

/** A rejected or never-completed upload leaves nothing behind: the pending row is removed outright. */
export async function removePendingAsset(weddingId: Id, assetId: Id): Promise<void> {
  await connectDb();
  await GalleryAsset.deleteOne({ _id: assetId, weddingId, status: "pending_upload" });
}

export async function softDeleteAsset(
  weddingId: Id,
  assetId: Id,
  deletion: { by: Id; at: Date },
  session?: ClientSession,
): Promise<boolean> {
  await connectDb();
  const result = await GalleryAsset.updateOne(
    { _id: assetId, weddingId },
    { $set: { deletedAt: deletion.at, deletedBy: deletion.by } },
    { session },
  );
  return result.modifiedCount === 1;
}

/** The stored files of an album's photos (so deleting the album can remove them too). */
export async function listAlbumAssetKeys(weddingId: Id, albumId: Id): Promise<string[]> {
  await connectDb();
  const rows = await GalleryAsset.find({ weddingId, albumId }).select({ objectKey: 1 }).lean();
  return rows.map((row) => row.objectKey);
}

export async function moveAlbumAssetsToRoot(
  weddingId: Id,
  albumId: Id,
  session?: ClientSession,
): Promise<number> {
  await connectDb();
  const result = await GalleryAsset.updateMany(
    { weddingId, albumId },
    { $set: { albumId: null } },
    { session },
  );
  return result.modifiedCount;
}

export async function softDeleteAlbumAssets(
  weddingId: Id,
  albumId: Id,
  deletion: { by: Id; at: Date },
  session?: ClientSession,
): Promise<number> {
  await connectDb();
  const result = await GalleryAsset.updateMany(
    { weddingId, albumId },
    { $set: { deletedAt: deletion.at, deletedBy: deletion.by } },
    { session },
  );
  return result.modifiedCount;
}

export interface GalleryUsage {
  usedBytes: number;
  photoCount: number;
  pendingReviewCount: number;
}

/**
 * What the wedding is storing. Photos waiting to be uploaded count at their declared size (they
 * hold the space); rejected ones were removed. Computed, never stored (DB Design §9.4).
 */
export async function galleryUsage(weddingId: Id): Promise<GalleryUsage> {
  const rows = await aggregateScoped<{ _id: AssetStatus; bytes: number; count: number }>(
    GalleryAsset,
    weddingId,
    [
      { $match: { status: { $in: ["pending_upload", "pending_review", "active"] } } },
      { $group: { _id: "$status", bytes: { $sum: "$sizeBytes" }, count: { $sum: 1 } } },
    ],
  );
  const by = new Map(rows.map((row) => [row._id, row]));
  return {
    usedBytes: rows.reduce((sum, row) => sum + row.bytes, 0),
    photoCount: (by.get("active")?.count ?? 0) + (by.get("pending_review")?.count ?? 0),
    pendingReviewCount: by.get("pending_review")?.count ?? 0,
  };
}

// ---------------------------------------------------------------------------------------------
// Shared links (and QR codes)
// ---------------------------------------------------------------------------------------------

export interface NewAccessToken {
  galleryId: Id;
  albumId: Id | null;
  tokenHash: string;
  tokenEnc: string;
  label?: string;
  permissions: { canView: boolean; canUpload: boolean; canDownload: boolean };
  expiresAt: Date | null;
  purgeAt: Date | null;
  createdBy: Id;
}

export async function insertAccessToken(weddingId: Id, input: NewAccessToken) {
  await connectDb();
  const token = await GalleryAccessToken.create({ ...input, weddingId });
  return token.toObject();
}

/** Every link of the wedding, newest first, with its encrypted token so the link can be shown again. */
export async function listAccessTokens(weddingId: Id) {
  await connectDb();
  return GalleryAccessToken.find({ weddingId })
    .select("+tokenEnc")
    .sort({ _id: -1 })
    .limit(200)
    .lean();
}

export async function findAccessToken(weddingId: Id, tokenId: Id) {
  await connectDb();
  return GalleryAccessToken.findOne({ _id: tokenId, weddingId }).select("+tokenEnc").lean();
}

/**
 * The ONE token lookup that is by token instead of by wedding: a guest opening /gallery/<token> has
 * no session and no wedding in the address (DB Design §8.3). The service then checks the link, the
 * gallery, the album and the wedding are still usable.
 */
export async function findAccessTokenByHash(tokenHash: string) {
  await connectDb();
  return GalleryAccessToken.findOne({ tokenHash }).lean();
}

/** Revokes one link (it is kept 30 days, then removed). Null if it does not exist in this wedding. */
export async function revokeAccessToken(weddingId: Id, tokenId: Id, by: Id, at: Date) {
  await connectDb();
  const revoked = await GalleryAccessToken.findOneAndUpdate(
    { _id: tokenId, weddingId, revokedAt: null },
    { $set: { revokedAt: at, revokedBy: by, purgeAt: galleryTokenPurgeAt(at) } },
    { returnDocument: "after" },
  )
    .select("+tokenEnc")
    .lean();
  return revoked ?? (await findAccessToken(weddingId, tokenId));
}

/** An album that is deleted takes its links with it. */
export async function revokeAlbumAccessTokens(
  weddingId: Id,
  albumId: Id,
  by: Id,
  at: Date,
  session?: ClientSession,
): Promise<number> {
  await connectDb();
  const result = await GalleryAccessToken.updateMany(
    { weddingId, albumId, revokedAt: null },
    { $set: { revokedAt: at, revokedBy: by, purgeAt: galleryTokenPurgeAt(at) } },
    { session },
  );
  return result.modifiedCount;
}
