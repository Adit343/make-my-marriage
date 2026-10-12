import "server-only";
import { withTransaction } from "@/infrastructure/database/transaction";
import { getStorage, storageStatus } from "@/infrastructure/storage";
import {
  DOWNLOAD_URL_TTL_SECONDS,
  MAX_ALBUMS,
  WEDDING_STORAGE_QUOTA_BYTES,
} from "@/lib/constants/gallery";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { findEvent, listEvents as listEventRows } from "@/modules/events/event.repository";
import type { AlbumDto, GalleryDto, GallerySettingsDto } from "@/modules/gallery/gallery.dto";
import {
  albumPhotoStats,
  countAlbums,
  ensureGallery,
  listAlbumAssetKeys,
  findAlbum,
  findAsset,
  findAssetsByIds,
  findGallery,
  galleryUsage,
  insertAlbum,
  listAlbums as listAlbumRows,
  moveAlbumAssetsToRoot,
  revokeAlbumAccessTokens,
  softDeleteAlbum,
  softDeleteAlbumAssets,
  updateAlbum as updateAlbumRow,
  updateGallery as updateGalleryRow,
  type AlbumChanges,
  type GalleryChanges,
} from "@/modules/gallery/gallery.repository";
import type {
  CreateAlbumInput,
  DeleteAlbumInput,
  UpdateAlbumInput,
  UpdateGalleryInput,
} from "@/modules/gallery/gallery.schemas";
import type { WeddingAuth } from "@/modules/members/guards";
import { can } from "@/modules/members/permissions";
import { coupleNamesOf } from "@/modules/website/website.service";
import { findWedding } from "@/modules/weddings/wedding.repository";

// The gallery's settings and albums (API Design §12.1). Photos are in asset.service.ts and the
// shared links in access-token.service.ts. Photos are stored in Cloudflare R2 (Architecture
// Amendment A1); nothing here ever touches a file.

type GalleryRow = NonNullable<Awaited<ReturnType<typeof findGallery>>>;
type AlbumRow = NonNullable<Awaited<ReturnType<typeof findAlbum>>>;

export async function defaultGalleryTitle(weddingId: string): Promise<string> {
  const wedding = await findWedding(weddingId);
  if (!wedding) throw new AppError("NOT_FOUND");
  return `${coupleNamesOf(wedding)} Photos`.slice(0, 120);
}

/** The wedding's gallery, created the first time something is saved into it. */
export async function ensureWeddingGallery(auth: WeddingAuth): Promise<GalleryRow> {
  const existing = await findGallery(auth.weddingId);
  if (existing) return existing;
  return ensureGallery(auth.weddingId, {
    title: await defaultGalleryTitle(auth.weddingId),
    createdBy: auth.userId,
  });
}

/** A short-lived address that shows a stored photo (signing is local: no network call). */
export async function viewUrl(objectKey: string): Promise<string> {
  return getStorage().createDownloadUrl(objectKey, { expiresInSeconds: DOWNLOAD_URL_TTL_SECONDS });
}

async function coverUrlOf(weddingId: string, coverAssetId: string | null): Promise<string | null> {
  if (!coverAssetId) return null;
  const cover = await findAsset(weddingId, coverAssetId);
  return cover && cover.status === "active" ? viewUrl(cover.objectKey) : null;
}

// ---------------------------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------------------------

async function toGalleryDto(auth: WeddingAuth, row: GalleryRow | null): Promise<GalleryDto> {
  if (!row) {
    return {
      id: null,
      title: await defaultGalleryTitle(auth.weddingId),
      description: null,
      allowGuestUploads: false,
      requireUploadApproval: true,
      coverAssetId: null,
      coverUrl: null,
      version: 0,
    };
  }
  const coverAssetId = row.coverAssetId ? row.coverAssetId.toString() : null;
  return {
    id: row._id.toString(),
    title: row.title,
    description: row.description ?? null,
    allowGuestUploads: row.allowGuestUploads,
    requireUploadApproval: row.requireUploadApproval,
    coverAssetId,
    coverUrl: await coverUrlOf(auth.weddingId, coverAssetId),
    version: row.__v ?? 0,
  };
}

/** Settings and what is stored. Never creates the gallery (a GET must not write). */
export async function getGallerySettings(auth: WeddingAuth): Promise<GallerySettingsDto> {
  const [row, usage] = await Promise.all([
    findGallery(auth.weddingId),
    galleryUsage(auth.weddingId),
  ]);
  return {
    gallery: await toGalleryDto(auth, row),
    usage: {
      usedBytes: usage.usedBytes,
      quotaBytes: WEDDING_STORAGE_QUOTA_BYTES,
      photoCount: usage.photoCount,
      pendingReviewCount: usage.pendingReviewCount,
    },
    storage: storageStatus(),
  };
}

export async function updateGallerySettings(
  auth: WeddingAuth,
  input: UpdateGalleryInput,
): Promise<GalleryDto> {
  const { version, coverAssetId, ...rest } = input;
  const changes: GalleryChanges = { ...rest };
  if (coverAssetId !== undefined) {
    if (coverAssetId !== null) {
      const cover = await findAsset(auth.weddingId, coverAssetId);
      if (!cover || cover.status !== "active") throw new AppError("NOT_FOUND");
    }
    changes.coverAssetId = coverAssetId;
  }
  await ensureWeddingGallery(auth);
  const result = await updateGalleryRow(auth.weddingId, version, changes);
  if (result === "conflict") throw new AppError("VERSION_CONFLICT");
  if (result === "not_found") throw new AppError("NOT_FOUND");
  return toGalleryDto(auth, result);
}

// ---------------------------------------------------------------------------------------------
// Albums
// ---------------------------------------------------------------------------------------------

const canDeleteAlbum = (auth: WeddingAuth, album: { createdBy: { toString(): string } }) =>
  album.createdBy.toString() === auth.userId || can(auth.membership.role, "gallery:manage");

async function toAlbumDtos(auth: WeddingAuth, rows: AlbumRow[]): Promise<AlbumDto[]> {
  if (rows.length === 0) return [];
  const [stats, events] = await Promise.all([
    albumPhotoStats(auth.weddingId),
    listEventRows(auth.weddingId),
  ]);
  const statByAlbum = new Map(
    stats.filter((s) => s.albumId).map((s) => [s.albumId!.toString(), s]),
  );
  const eventName = new Map(events.map((event) => [event._id.toString(), event.name]));

  // Covers: the chosen photo, else the newest one in the album. One query for all of them.
  const coverIds = rows.map(
    (row) => row.coverAssetId ?? statByAlbum.get(row._id.toString())?.latestAssetId,
  );
  const covers = await findAssetsByIds(
    auth.weddingId,
    coverIds.filter((id): id is NonNullable<typeof id> => Boolean(id)),
  );
  const coverById = new Map(covers.map((cover) => [cover._id.toString(), cover]));

  return Promise.all(
    rows.map(async (row, index) => {
      const cover = coverIds[index] ? coverById.get(coverIds[index]!.toString()) : undefined;
      return {
        id: row._id.toString(),
        title: row.title,
        description: row.description ?? null,
        eventId: row.eventId ? row.eventId.toString() : null,
        eventName: row.eventId ? (eventName.get(row.eventId.toString()) ?? null) : null,
        defaultVisibility: row.defaultVisibility,
        coverAssetId: row.coverAssetId ? row.coverAssetId.toString() : null,
        coverUrl: cover && cover.status === "active" ? await viewUrl(cover.objectKey) : null,
        photoCount: statByAlbum.get(row._id.toString())?.count ?? 0,
        sortOrder: row.sortOrder ?? 0,
        createdBy: row.createdBy.toString(),
        canDelete: canDeleteAlbum(auth, row),
        version: row.__v ?? 0,
        createdAt: (row.createdAt ?? new Date(0)).toISOString(),
      };
    }),
  );
}

export async function listAlbums(auth: WeddingAuth): Promise<AlbumDto[]> {
  return toAlbumDtos(auth, await listAlbumRows(auth.weddingId));
}

/** An event the album is linked to must belong to this wedding (a stranger's id is a plain 404). */
async function requireEvent(weddingId: string, eventId: string) {
  const event = await findEvent(weddingId, eventId);
  if (!event) throw new AppError("NOT_FOUND");
  return event._id;
}

export async function createAlbum(auth: WeddingAuth, input: CreateAlbumInput): Promise<AlbumDto> {
  if ((await countAlbums(auth.weddingId)) >= MAX_ALBUMS) {
    throw new AppError("BUSINESS_RULE_VIOLATION", {
      message: `A gallery can have at most ${MAX_ALBUMS} albums.`,
    });
  }
  const eventId = input.eventId ? await requireEvent(auth.weddingId, input.eventId) : null;
  const gallery = await ensureWeddingGallery(auth);
  const row = await insertAlbum(auth.weddingId, {
    galleryId: gallery._id,
    title: input.title,
    ...(input.description ? { description: input.description } : {}),
    eventId,
    ...(input.defaultVisibility ? { defaultVisibility: input.defaultVisibility } : {}),
    createdBy: auth.userId,
  });
  return (await toAlbumDtos(auth, [row]))[0]!;
}

export async function updateAlbum(
  auth: WeddingAuth,
  albumId: string,
  input: UpdateAlbumInput,
): Promise<AlbumDto> {
  const { version, eventId, coverAssetId, ...rest } = input;
  const changes: AlbumChanges = { ...rest };
  if (eventId !== undefined) {
    changes.eventId = eventId === null ? null : await requireEvent(auth.weddingId, eventId);
  }
  if (coverAssetId !== undefined) {
    if (coverAssetId !== null) {
      const cover = await findAsset(auth.weddingId, coverAssetId);
      if (!cover || cover.status !== "active") throw new AppError("NOT_FOUND");
    }
    changes.coverAssetId = coverAssetId;
  }
  const result = await updateAlbumRow(auth.weddingId, albumId, version, changes);
  if (result === "conflict") throw new AppError("VERSION_CONFLICT");
  if (result === "not_found") throw new AppError("NOT_FOUND");
  return (await toAlbumDtos(auth, [result]))[0]!;
}

/**
 * Soft delete. The caller must choose what happens to the album's photos (API Design §12.1): move
 * them to the gallery root or delete them with it. Links that opened only this album stop working.
 * Everything happens in one transaction, and the photo files of deleted photos are removed after.
 */
export async function deleteAlbum(auth: WeddingAuth, albumId: string, input: DeleteAlbumInput) {
  const album = await findAlbum(auth.weddingId, albumId);
  if (!album) throw new AppError("NOT_FOUND");
  if (!canDeleteAlbum(auth, album)) throw new AppError("INSUFFICIENT_ROLE");

  const at = new Date();
  const deletion = { by: auth.userId, at };
  const keysToRemove =
    input.photos === "delete" ? await listAlbumAssetKeys(auth.weddingId, albumId) : [];
  const result = await withTransaction(async (session) => {
    if (!(await softDeleteAlbum(auth.weddingId, albumId, deletion, session))) {
      throw new AppError("NOT_FOUND");
    }
    const photos =
      input.photos === "move_to_root"
        ? { moved: await moveAlbumAssetsToRoot(auth.weddingId, albumId, session), removed: 0 }
        : {
            moved: 0,
            removed: await softDeleteAlbumAssets(auth.weddingId, albumId, deletion, session),
          };
    await revokeAlbumAccessTokens(auth.weddingId, albumId, auth.userId, at, session);
    return photos;
  });
  // Deleted photos' files go too (see deleteAsset); a failure here only leaves a file to purge.
  const storage = getStorage();
  await Promise.all(
    keysToRemove.map((key) =>
      storage.remove(key).catch((error) => logger.warn("gallery.cleanup_failed", { error })),
    ),
  );
  return {
    id: albumId,
    deletedAt: at.toISOString(),
    photosMoved: result.moved,
    photosRemoved: result.removed,
  };
}
