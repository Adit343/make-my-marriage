import type { AssetStatus, MediaVisibility, UploaderKind } from "@/lib/constants/enums";

// Member-facing gallery shapes (API Design §12). What a GUEST sees is built separately and by hand
// (public-gallery.service.ts): none of these are ever returned to a guest.

export interface GalleryDto {
  /** null until the first photo, album or setting is saved (a GET never creates it). */
  id: string | null;
  title: string;
  description: string | null;
  allowGuestUploads: boolean;
  requireUploadApproval: boolean;
  coverAssetId: string | null;
  coverUrl: string | null;
  version: number;
}

export interface GallerySettingsDto {
  gallery: GalleryDto;
  usage: {
    usedBytes: number;
    quotaBytes: number;
    photoCount: number;
    /** Guest photos waiting for an owner or admin. */
    pendingReviewCount: number;
  };
  /** Whether photos can be stored on this server at all, and where. */
  storage: { configured: boolean; kind: "r2" | "local" | "none" };
}

export interface AlbumDto {
  id: string;
  title: string;
  description: string | null;
  eventId: string | null;
  eventName: string | null;
  defaultVisibility: MediaVisibility;
  coverAssetId: string | null;
  /** The chosen cover, else the newest photo; null for an empty album. */
  coverUrl: string | null;
  photoCount: number;
  sortOrder: number;
  createdBy: string;
  /** Whether THIS viewer may delete the album. */
  canDelete: boolean;
  version: number;
  createdAt: string;
}

export interface AssetDto {
  id: string;
  albumId: string | null;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  caption: string | null;
  visibility: MediaVisibility;
  status: AssetStatus;
  isFavorite: boolean;
  uploadedBy: { kind: UploaderKind; name: string | null };
  /** Whether THIS viewer may delete the photo. */
  canDelete: boolean;
  /** A short-lived address that shows the photo. */
  url: string;
  /** A short-lived address that saves the photo under its own name. */
  downloadUrl: string;
  version: number;
  createdAt: string;
}

export interface UploadTicketDto {
  assetId: string;
  /** Send the file here with PUT, with the headers below. The bytes never pass through this API. */
  uploadUrl: string;
  method: "PUT";
  headers: Record<string, string>;
  expiresInSeconds: number;
  maxBytes: number;
  remainingBytes: number;
}

export interface AccessTokenDto {
  id: string;
  albumId: string | null;
  albumTitle: string | null;
  label: string | null;
  permissions: { canView: boolean; canUpload: boolean; canDownload: boolean };
  status: "active" | "revoked" | "expired";
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  /** The same link every time (shown again from the encrypted copy); null if it can no longer be read. */
  shareUrl: string | null;
}
