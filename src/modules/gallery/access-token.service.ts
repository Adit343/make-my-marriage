import "server-only";
import { decryptSecret, encryptSecret } from "@/lib/crypto/secret-box";
import { generateToken, hashToken } from "@/lib/crypto/tokens";
import { getEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import type { AccessTokenDto } from "@/modules/gallery/gallery.dto";
import {
  findAccessToken,
  findAlbum,
  insertAccessToken,
  listAccessTokens as listAccessTokenRows,
  listAlbums as listAlbumRows,
  revokeAccessToken as revokeAccessTokenRow,
} from "@/modules/gallery/gallery.repository";
import type { CreateAccessTokenInput } from "@/modules/gallery/gallery.schemas";
import { ensureWeddingGallery } from "@/modules/gallery/gallery.service";
import type { WeddingAuth } from "@/modules/members/guards";
import { galleryTokenPurgeAt } from "@/lib/constants/retention";

// Shared gallery links and their QR codes (API Design §12.6). Owners and admins only
// (gallery:manage). A link lets guests view and/or upload photos with no account. Like a guest's
// RSVP link, only the SHA-256 of the token is used for lookup and an encrypted copy lets the team
// show the SAME link (and QR code) again. Revoking is immediate; the row is removed 30 days later.

type TokenRow = NonNullable<Awaited<ReturnType<typeof findAccessToken>>>;

function encryptionKey(): string {
  const env = getEnv();
  return env.TOKEN_ENCRYPTION_KEY ?? env.SESSION_SECRET;
}

export function galleryUrlFor(token: string): string {
  return new URL(`/gallery/${token}`, getEnv().APP_URL).toString();
}

export function tokenStatus(
  row: { revokedAt?: Date | null; expiresAt?: Date | null },
  now = new Date(),
): AccessTokenDto["status"] {
  if (row.revokedAt) return "revoked";
  if (row.expiresAt && row.expiresAt.getTime() <= now.getTime()) return "expired";
  return "active";
}

function shareUrlOf(row: TokenRow): string | null {
  if (tokenStatus(row) !== "active" || !row.tokenEnc) return null;
  const token = decryptSecret(row.tokenEnc, encryptionKey());
  return token ? galleryUrlFor(token) : null;
}

function toDto(row: TokenRow, albumTitles: Map<string, string>): AccessTokenDto {
  return {
    id: row._id.toString(),
    albumId: row.albumId ? row.albumId.toString() : null,
    albumTitle: row.albumId ? (albumTitles.get(row.albumId.toString()) ?? null) : null,
    label: row.label ?? null,
    permissions: {
      canView: row.permissions.canView,
      canUpload: row.permissions.canUpload,
      canDownload: row.permissions.canDownload,
    },
    status: tokenStatus(row),
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
    createdAt: (row.createdAt ?? new Date(0)).toISOString(),
    shareUrl: shareUrlOf(row),
  };
}

async function albumTitleMap(weddingId: string) {
  return new Map(
    (await listAlbumRows(weddingId)).map((album) => [album._id.toString(), album.title]),
  );
}

export async function listAccessTokens(auth: WeddingAuth): Promise<AccessTokenDto[]> {
  const [rows, titles] = await Promise.all([
    listAccessTokenRows(auth.weddingId),
    albumTitleMap(auth.weddingId),
  ]);
  return rows.map((row) => toDto(row, titles));
}

export async function createAccessToken(
  auth: WeddingAuth,
  input: CreateAccessTokenInput,
): Promise<AccessTokenDto> {
  const album = input.albumId ? await findAlbum(auth.weddingId, input.albumId) : null;
  if (input.albumId && !album) throw new AppError("NOT_FOUND");
  const gallery = await ensureWeddingGallery(auth);
  if (input.permissions.canUpload && !gallery.allowGuestUploads) {
    throw new AppError("BUSINESS_RULE_VIOLATION", {
      message: "Turn on guest uploads in the gallery settings before making an upload link.",
    });
  }

  const token = generateToken();
  const expiresAt = input.expiresAt ?? null;
  const row = await insertAccessToken(auth.weddingId, {
    galleryId: gallery._id,
    albumId: album?._id ?? null,
    tokenHash: hashToken(token),
    tokenEnc: encryptSecret(token, encryptionKey()),
    ...(input.label ? { label: input.label } : {}),
    permissions: input.permissions,
    expiresAt,
    // An expiring link may be removed 30 days after it expires.
    purgeAt: expiresAt ? galleryTokenPurgeAt(expiresAt) : null,
    createdBy: auth.userId,
  });
  // The creation response also carries the link: it is the only place the plain token is known
  // without decrypting, and it is the same link the list shows from then on.
  return {
    ...toDto(row as TokenRow, new Map(album ? [[album._id.toString(), album.title]] : [])),
    shareUrl: galleryUrlFor(token),
  };
}

/** Revokes a link at once (it is removed 30 days later). Revoking twice is harmless. */
export async function revokeAccessToken(
  auth: WeddingAuth,
  tokenId: string,
): Promise<AccessTokenDto> {
  const row = await revokeAccessTokenRow(auth.weddingId, tokenId, auth.userId, new Date());
  if (!row) throw new AppError("NOT_FOUND");
  return toDto(row, await albumTitleMap(auth.weddingId));
}
