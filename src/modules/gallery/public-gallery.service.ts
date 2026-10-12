import "server-only";
import { getStorage } from "@/infrastructure/storage";
import { hashToken } from "@/lib/crypto/tokens";
import { DOWNLOAD_URL_TTL_SECONDS } from "@/lib/constants/gallery";
import { AppError } from "@/lib/errors";
import { decodeCursor, paginateByCursor, type CursorMeta } from "@/lib/http/pagination";
import { z } from "zod";
import { objectId } from "@/lib/validation/primitives";
import { createPendingUpload, finalizeUpload } from "@/modules/gallery/asset.service";
import { tokenStatus } from "@/modules/gallery/access-token.service";
import {
  findAccessTokenByHash,
  findAlbum,
  findAsset,
  findGallery,
  listAssetsPage,
} from "@/modules/gallery/gallery.repository";
import type {
  ConfirmUploadInput,
  PublicListQuery,
  PublicUploadUrlInput,
} from "@/modules/gallery/gallery.schemas";
import { coupleNamesOf } from "@/modules/website/website.service";
import { findWedding } from "@/modules/weddings/wedding.repository";

// What a guest with a shared link sees and may do (API Design §12.7, DB Design §11.2). No account:
// the link is the credential. Everything returned is a hand-built whitelist: a photo's id, a
// short-lived address, its caption and size in pixels. Never who uploaded it, its stored name or
// key, the wedding's id, or the state of anyone's moderation.

const cursorPosition = z.object({ id: objectId });

export interface PublicPhoto {
  id: string;
  url: string;
  /** Only when the link allows downloads. */
  downloadUrl: string | null;
  caption: string | null;
  width: number | null;
  height: number | null;
}

export interface PublicGallery {
  coupleNames: string;
  /** The gallery's title, or the album's when the link opens a single album. */
  title: string;
  albumTitle: string | null;
  canView: boolean;
  /** The link allows uploads AND the gallery has guest uploads switched on. */
  canUpload: boolean;
  canDownload: boolean;
  /** Uploaded photos wait for approval before they appear. */
  uploadsNeedApproval: boolean;
  photos: PublicPhoto[];
}

/** One answer for every way a link can be unusable: unknown, revoked, expired, or anything deleted. */
const invalidLink = () => new AppError("INVALID_TOKEN");

async function resolveLink(token: string) {
  const link = await findAccessTokenByHash(hashToken(token));
  if (!link || tokenStatus(link) !== "active") throw invalidLink();
  // A deleted wedding hides everything under it, public links included (DB Design §10.3).
  const wedding = await findWedding(link.weddingId);
  const gallery = await findGallery(link.weddingId);
  if (!wedding || !gallery) throw invalidLink();
  const album = link.albumId ? await findAlbum(link.weddingId, link.albumId) : null;
  if (link.albumId && !album) throw invalidLink();
  return { link, wedding, gallery, album };
}

export async function getPublicGallery(
  token: string,
  query: PublicListQuery,
): Promise<{ data: PublicGallery; meta: CursorMeta }> {
  const { link, wedding, gallery, album } = await resolveLink(token);
  const weddingId = link.weddingId.toString();
  const { canView, canUpload, canDownload } = link.permissions;

  let photos: PublicPhoto[] = [];
  let meta: CursorMeta = { nextCursor: null, hasMore: false };
  if (canView) {
    const after = query.cursor ? decodeCursor(query.cursor, cursorPosition).id : undefined;
    const rows = await listAssetsPage(
      weddingId,
      {
        status: "active",
        // Guests never see photos kept private to the team.
        visibilities: ["guests", "public"],
        ...(album ? { albumId: album._id } : {}),
      },
      { limit: query.limit, afterId: after },
    );
    const page = paginateByCursor(rows, query.limit, (row) => ({ id: row._id.toString() }));
    meta = page.meta;
    const storage = getStorage();
    photos = await Promise.all(
      page.items.map(async (row) => ({
        id: row._id.toString(),
        url: await storage.createDownloadUrl(row.objectKey, {
          expiresInSeconds: DOWNLOAD_URL_TTL_SECONDS,
        }),
        downloadUrl: canDownload
          ? await storage.createDownloadUrl(row.objectKey, {
              expiresInSeconds: DOWNLOAD_URL_TTL_SECONDS,
              downloadAs: row.fileName,
            })
          : null,
        caption: row.caption ?? null,
        width: row.width ?? null,
        height: row.height ?? null,
      })),
    );
  }

  return {
    data: {
      coupleNames: coupleNamesOf(wedding),
      title: album?.title ?? gallery.title,
      albumTitle: album?.title ?? null,
      canView,
      canUpload: canUpload && gallery.allowGuestUploads,
      canDownload,
      uploadsNeedApproval: gallery.requireUploadApproval,
      photos,
    },
    meta,
  };
}

/** Announces a guest's photo. The link must allow uploads and the gallery must have them on. */
export async function requestGuestUploadUrl(token: string, input: PublicUploadUrlInput) {
  const { link, gallery, album } = await resolveLink(token);
  if (!link.permissions.canUpload || !gallery.allowGuestUploads) {
    throw new AppError("BUSINESS_RULE_VIOLATION", {
      message: "Uploading photos isn't turned on for this link.",
    });
  }
  return createPendingUpload({
    weddingId: link.weddingId.toString(),
    galleryId: gallery._id,
    albumId: album?._id ?? null,
    uploadedBy: { kind: "guest", ...(input.displayName ? { displayName: input.displayName } : {}) },
    viaTokenId: link._id,
    // A guest's photo is meant for guests; it stays hidden until approved when approval is on.
    visibility: "guests",
    file: { fileName: input.fileName, mimeType: input.mimeType, sizeBytes: input.sizeBytes },
  });
}

/** Confirms a photo this very link announced; nobody else's pending upload can be touched. */
export async function confirmGuestUpload(
  token: string,
  assetId: string,
  input: ConfirmUploadInput,
) {
  const { link, gallery } = await resolveLink(token);
  const weddingId = link.weddingId.toString();
  const asset = await findAsset(weddingId, assetId);
  if (
    !asset ||
    asset.uploadedBy.kind !== "guest" ||
    asset.viaTokenId?.toString() !== link._id.toString()
  ) {
    throw new AppError("NOT_FOUND");
  }
  const finalStatus = gallery.requireUploadApproval ? "pending_review" : "active";
  if (asset.status === "pending_upload") {
    const done = await finalizeUpload(weddingId, asset, input, finalStatus);
    return { id: done._id.toString(), awaitingApproval: done.status === "pending_review" };
  }
  if (asset.status === "pending_review" || asset.status === "active") {
    return { id: assetId, awaitingApproval: asset.status === "pending_review" };
  }
  throw new AppError("NOT_FOUND");
}
