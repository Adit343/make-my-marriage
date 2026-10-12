import { apiRequest, apiRequestWithMeta } from "@/lib/client/api-client";
import type { MediaVisibility } from "@/lib/constants/enums";
import {
  ALLOWED_PHOTO_TYPES,
  MAX_PHOTO_BYTES,
  type AllowedPhotoType,
} from "@/lib/constants/gallery";
import type {
  AccessTokenDto,
  AlbumDto,
  AssetDto,
  GalleryDto,
  UploadTicketDto,
} from "@/modules/gallery/gallery.dto";
import type { PublicGallery } from "@/modules/gallery/public-gallery.service";

// Browser calls to the gallery API (API Design §12). Photo bytes never go through our API: the
// browser asks for a signed address, sends the file straight to the photo store, then confirms.

const base = (weddingId: string) => `/api/v1/weddings/${weddingId}`;

export interface AssetPage {
  items: AssetDto[];
  nextCursor: string | null;
}

export async function fetchAssets(
  weddingId: string,
  query: {
    albumId?: string | "root";
    status?: "active" | "pending_review";
    favorite?: boolean;
    visibility?: MediaVisibility;
    cursor?: string | null;
    limit?: number;
  },
  signal?: AbortSignal,
): Promise<AssetPage> {
  const params = new URLSearchParams();
  if (query.albumId) params.set("albumId", query.albumId);
  if (query.status) params.set("status", query.status);
  if (query.favorite) params.set("favorite", "true");
  if (query.visibility) params.set("visibility", query.visibility);
  if (query.cursor) params.set("cursor", query.cursor);
  if (query.limit) params.set("limit", String(query.limit));
  const suffix = params.size > 0 ? `?${params}` : "";
  const { data, meta } = await apiRequestWithMeta<AssetDto[]>(
    `${base(weddingId)}/assets${suffix}`,
    {
      signal,
    },
  );
  return { items: data, nextCursor: (meta.nextCursor as string | null | undefined) ?? null };
}

export function updateAsset(
  weddingId: string,
  assetId: string,
  version: number,
  changes: {
    caption?: string | null;
    visibility?: MediaVisibility;
    albumId?: string | null;
    isFavorite?: boolean;
  },
) {
  return apiRequest<AssetDto>(`${base(weddingId)}/assets/${assetId}`, {
    method: "PATCH",
    body: { version, ...changes },
  });
}

export function deleteAsset(weddingId: string, assetId: string) {
  return apiRequest<{ id: string }>(`${base(weddingId)}/assets/${assetId}`, { method: "DELETE" });
}

export function moderateAsset(weddingId: string, assetId: string, decision: "approve" | "reject") {
  return apiRequest<AssetDto>(`${base(weddingId)}/assets/${assetId}/moderate`, {
    method: "POST",
    body: { decision },
  });
}

// ---- Albums ---------------------------------------------------------------------------------

export interface AlbumInput {
  title: string;
  description: string | null;
  eventId: string | null;
  defaultVisibility: MediaVisibility;
  coverAssetId?: string | null;
}

export function createAlbum(weddingId: string, input: AlbumInput) {
  return apiRequest<AlbumDto>(`${base(weddingId)}/albums`, {
    method: "POST",
    body: {
      title: input.title,
      eventId: input.eventId,
      defaultVisibility: input.defaultVisibility,
      ...(input.description ? { description: input.description } : {}),
    },
  });
}

export function updateAlbum(
  weddingId: string,
  albumId: string,
  version: number,
  changes: Partial<AlbumInput>,
) {
  return apiRequest<AlbumDto>(`${base(weddingId)}/albums/${albumId}`, {
    method: "PATCH",
    body: { version, ...changes },
  });
}

export function deleteAlbum(weddingId: string, albumId: string, photos: "move_to_root" | "delete") {
  return apiRequest<{ id: string }>(`${base(weddingId)}/albums/${albumId}`, {
    method: "DELETE",
    body: { photos },
  });
}

// ---- Settings and links ---------------------------------------------------------------------

export function updateGallery(
  weddingId: string,
  version: number,
  changes: { allowGuestUploads?: boolean; requireUploadApproval?: boolean },
) {
  return apiRequest<GalleryDto>(`${base(weddingId)}/gallery`, {
    method: "PATCH",
    body: { version, ...changes },
  });
}

export interface LinkInput {
  albumId: string | null;
  label: string;
  permissions: { canView: boolean; canUpload: boolean; canDownload: boolean };
  /** An ISO instant, or null for a link that never expires. */
  expiresAt: string | null;
}

export function createLink(weddingId: string, input: LinkInput) {
  return apiRequest<AccessTokenDto>(`${base(weddingId)}/access-tokens`, {
    method: "POST",
    body: {
      albumId: input.albumId,
      ...(input.label ? { label: input.label } : {}),
      permissions: input.permissions,
      expiresAt: input.expiresAt,
    },
  });
}

export function revokeLink(weddingId: string, tokenId: string) {
  return apiRequest<AccessTokenDto>(`${base(weddingId)}/access-tokens/${tokenId}`, {
    method: "DELETE",
  });
}

// ---- Uploading ------------------------------------------------------------------------------

/** Why a file can't be uploaded, or null if it can. Checked before anything is sent. */
export function checkPhotoFile(file: { name: string; type: string; size: number }): string | null {
  if (!photoTypeOf(file)) return "this file type isn't supported";
  if (file.size > MAX_PHOTO_BYTES) {
    return `file is larger than ${MAX_PHOTO_BYTES / (1024 * 1024)} MB`;
  }
  if (file.size === 0) return "the file is empty";
  return null;
}

/** The photo type from the file's own type, or its extension (HEIC files often have no type). */
export function photoTypeOf(file: { name: string; type: string }): AllowedPhotoType | null {
  const declared = file.type.toLowerCase();
  if (declared in ALLOWED_PHOTO_TYPES) return declared as AllowedPhotoType;
  const extension = file.name.toLowerCase().split(".").pop() ?? "";
  const byExtension: Record<string, AllowedPhotoType> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    heic: "image/heic",
    heif: "image/heif",
  };
  return byExtension[extension] ?? null;
}

/** The photo's size in pixels, when this browser can read it (not for HEIC outside Safari). */
export async function readDimensions(
  file: File,
): Promise<{ width: number; height: number } | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size.width > 0 && size.height > 0 ? size : null;
  } catch {
    return null;
  }
}

/** PUTs the file to its signed address and reports progress (fetch can't report upload progress). */
function sendToStore(
  ticket: UploadTicketDto,
  file: File,
  onProgress: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open(ticket.method, ticket.uploadUrl);
    for (const [name, value] of Object.entries(ticket.headers))
      request.setRequestHeader(name, value);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    request.onload = () =>
      request.status >= 200 && request.status < 300
        ? resolve()
        : reject(new Error("The photo store refused the file"));
    request.onerror = () => reject(new Error("connection lost"));
    request.onabort = () => reject(new Error("cancelled"));
    signal?.addEventListener("abort", () => request.abort(), { once: true });
    request.send(file);
  });
}

export interface UploadRoute {
  /** Ask for a signed address. */
  requestTicket: (file: File, type: AllowedPhotoType) => Promise<UploadTicketDto>;
  /** Tell the server the file arrived. */
  confirm: (
    assetId: string,
    size: { width: number; height: number } | null,
  ) => Promise<{ status: string }>;
}

/** The three steps for one photo: ticket, bytes straight to the store, confirm. */
export async function uploadPhoto(
  route: UploadRoute,
  file: File,
  onProgress: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<{ status: string; assetId: string }> {
  const type = photoTypeOf(file);
  if (!type) throw new Error("this file type isn't supported");
  const [ticket, size] = await Promise.all([route.requestTicket(file, type), readDimensions(file)]);
  await sendToStore(ticket, file, onProgress, signal);
  const done = await route.confirm(ticket.assetId, size);
  return { status: done.status, assetId: ticket.assetId };
}

/** Upload routes for a team member and for a guest with a link. */
export function memberUploadRoute(weddingId: string, albumId: string | null): UploadRoute {
  return {
    requestTicket: (file, type) =>
      apiRequest<UploadTicketDto>(`${base(weddingId)}/assets/upload-url`, {
        method: "POST",
        body: { albumId, fileName: file.name, mimeType: type, sizeBytes: file.size },
      }),
    confirm: (assetId, size) =>
      apiRequest<{ status: string }>(`${base(weddingId)}/assets/${assetId}/confirm`, {
        method: "POST",
        body: size ?? {},
      }),
  };
}

export function guestUploadRoute(token: string, displayName: string): UploadRoute {
  const root = `/api/v1/public/gallery/${encodeURIComponent(token)}`;
  return {
    requestTicket: (file, type) =>
      apiRequest<UploadTicketDto>(`${root}/upload-url`, {
        method: "POST",
        body: {
          fileName: file.name,
          mimeType: type,
          sizeBytes: file.size,
          ...(displayName ? { displayName } : {}),
        },
      }),
    confirm: async (assetId, size) => {
      const done = await apiRequest<{ awaitingApproval: boolean }>(
        `${root}/assets/${assetId}/confirm`,
        { method: "POST", body: size ?? {} },
      );
      return { status: done.awaitingApproval ? "pending_review" : "active" };
    },
  };
}

// ---- A guest's view -------------------------------------------------------------------------

export async function fetchGuestGallery(
  token: string,
  cursor: string | null,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({ limit: "30" });
  if (cursor) params.set("cursor", cursor);
  const { data, meta } = await apiRequestWithMeta<PublicGallery>(
    `/api/v1/public/gallery/${encodeURIComponent(token)}?${params}`,
    { signal },
  );
  return { gallery: data, nextCursor: (meta.nextCursor as string | null | undefined) ?? null };
}
