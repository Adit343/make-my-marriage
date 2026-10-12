/* eslint-disable @typescript-eslint/no-explicit-any -- response bodies are asserted on */
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, vi } from "vitest";
import { GET as publicGalleryRoute } from "@/app/api/v1/public/gallery/[token]/route";
import { POST as publicConfirmRoute } from "@/app/api/v1/public/gallery/[token]/assets/[assetId]/confirm/route";
import { POST as publicUploadUrlRoute } from "@/app/api/v1/public/gallery/[token]/upload-url/route";
import {
  GET as localGetRoute,
  PUT as localPutRoute,
} from "@/app/api/v1/storage/local/[...key]/route";
import { DELETE as revokeTokenRoute } from "@/app/api/v1/weddings/[weddingId]/access-tokens/[tokenId]/route";
import {
  GET as listTokensRoute,
  POST as createTokenRoute,
} from "@/app/api/v1/weddings/[weddingId]/access-tokens/route";
import {
  DELETE as deleteAlbumRoute,
  PATCH as patchAlbumRoute,
} from "@/app/api/v1/weddings/[weddingId]/albums/[albumId]/route";
import {
  GET as listAlbumsRoute,
  POST as createAlbumRoute,
} from "@/app/api/v1/weddings/[weddingId]/albums/route";
import { POST as confirmRoute } from "@/app/api/v1/weddings/[weddingId]/assets/[assetId]/confirm/route";
import { POST as moderateRoute } from "@/app/api/v1/weddings/[weddingId]/assets/[assetId]/moderate/route";
import {
  DELETE as deleteAssetRoute,
  PATCH as patchAssetRoute,
} from "@/app/api/v1/weddings/[weddingId]/assets/[assetId]/route";
import { POST as uploadUrlRoute } from "@/app/api/v1/weddings/[weddingId]/assets/upload-url/route";
import { GET as listAssetsRoute } from "@/app/api/v1/weddings/[weddingId]/assets/route";
import {
  GET as getGalleryRoute,
  PATCH as patchGalleryRoute,
} from "@/app/api/v1/weddings/[weddingId]/gallery/route";
import { resetEnvCacheForTests } from "@/lib/env";
import { call } from "../../setup/http";
import type { TestMember } from "../../setup/wedding";

export { createEvent } from "../invitations/helpers-events";

// ---- A throwaway photo store ----------------------------------------------------------------

/** Keeps uploaded test photos in a temp folder that is removed afterwards. Call after setupTestDatabase(). */
export function withTempPhotoStore() {
  let dir = "";
  beforeAll(() => {
    dir = mkdtempSync(path.join(os.tmpdir(), "mmm-photos-"));
    vi.stubEnv("LOCAL_STORAGE_DIR", dir);
    resetEnvCacheForTests();
  });
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });
  return () => dir;
}

// ---- Photo bytes ----------------------------------------------------------------------------

const pad = (head: number[], size: number) => {
  const bytes = new Uint8Array(Math.max(size, head.length));
  bytes.set(head);
  return bytes;
};
const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0));

export const jpegBytes = (size = 2048) =>
  pad([0xff, 0xd8, 0xff, 0xe0, 0, 16, ...ascii("JFIF")], size);
export const pngBytes = (size = 2048) => pad([0x89, ...ascii("PNG"), 0x0d, 0x0a, 0x1a, 0x0a], size);
export const webpBytes = (size = 2048) =>
  pad([...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WEBP")], size);
export const heicBytes = (size = 2048) =>
  pad([0, 0, 0, 24, ...ascii("ftyp"), ...ascii("heic")], size);
export const notAPhoto = (size = 2048) =>
  pad(ascii("<html><script>alert(1)</script></html>"), size);

// ---- The "browser": sends bytes to the signed address, and fetches a photo back -------------

/** PUTs a file to the address an upload ticket gave, the way a browser would. */
export async function putToStore(
  uploadUrl: string,
  bytes: Uint8Array,
  headers: Record<string, string> = {},
) {
  const url = new URL(uploadUrl);
  const key = decodeURIComponent(url.pathname.replace("/api/v1/storage/local/", "")).split("/");
  const response = await localPutRoute(
    new Request(uploadUrl, { method: "PUT", headers, body: bytes as BodyInit }),
    { params: Promise.resolve({ key }) },
  );
  return response.status;
}

export async function getFromStore(viewUrl: string) {
  const url = new URL(viewUrl);
  const key = decodeURIComponent(url.pathname.replace("/api/v1/storage/local/", "")).split("/");
  const response = await localGetRoute(new Request(viewUrl), { params: Promise.resolve({ key }) });
  return {
    status: response.status,
    bytes: new Uint8Array(await response.arrayBuffer()),
    headers: response.headers,
  };
}

// ---- Member requests ------------------------------------------------------------------------

export const getGallery = (weddingId: string, who: TestMember) =>
  call(getGalleryRoute, { method: "GET", cookie: who.cookie, params: { weddingId } });
export const patchGallery = (weddingId: string, who: TestMember, body: Record<string, unknown>) =>
  call(patchGalleryRoute, { method: "PATCH", cookie: who.cookie, params: { weddingId }, body });

export const listAlbums = (weddingId: string, who: TestMember) =>
  call(listAlbumsRoute, { method: "GET", cookie: who.cookie, params: { weddingId } });
export const addAlbum = (weddingId: string, who: TestMember, body: Record<string, unknown>) =>
  call(createAlbumRoute, { cookie: who.cookie, params: { weddingId }, body });
export const patchAlbum = (
  weddingId: string,
  albumId: string,
  who: TestMember,
  body: Record<string, unknown>,
) =>
  call(patchAlbumRoute, {
    method: "PATCH",
    cookie: who.cookie,
    params: { weddingId, albumId },
    body,
  });
export const removeAlbum = (
  weddingId: string,
  albumId: string,
  who: TestMember,
  body: Record<string, unknown> = { photos: "move_to_root" },
) =>
  call(deleteAlbumRoute, {
    method: "DELETE",
    cookie: who.cookie,
    params: { weddingId, albumId },
    body,
  });

export async function makeAlbum(
  weddingId: string,
  who: TestMember,
  body: Record<string, unknown> = {},
) {
  const result = await addAlbum(weddingId, who, { title: "Haldi Moments", ...body });
  if (result.status !== 201) throw new Error(JSON.stringify(result.json));
  return result.json.data as Record<string, any>;
}

export const listAssets = (weddingId: string, who: TestMember, query = "") =>
  call(listAssetsRoute, {
    method: "GET",
    path: `/api/test${query}`,
    cookie: who.cookie,
    params: { weddingId },
  });

export const requestUpload = (weddingId: string, who: TestMember, body: Record<string, unknown>) =>
  call(uploadUrlRoute, { cookie: who.cookie, params: { weddingId }, body });

export const confirmUploadOf = (
  weddingId: string,
  assetId: string,
  who: TestMember,
  body: Record<string, unknown> = {},
) => call(confirmRoute, { cookie: who.cookie, params: { weddingId, assetId }, body });

export interface UploadOptions {
  bytes?: Uint8Array;
  mimeType?: string;
  fileName?: string;
  albumId?: string | null;
  declaredSize?: number;
  dimensions?: { width: number; height: number };
}

/** The whole member upload: ask, send the bytes, confirm. Returns the confirmed photo. */
export async function uploadPhoto(weddingId: string, who: TestMember, options: UploadOptions = {}) {
  const bytes = options.bytes ?? jpegBytes();
  const mimeType = options.mimeType ?? "image/jpeg";
  const ticket = await requestUpload(weddingId, who, {
    fileName: options.fileName ?? "IMG_2041.jpg",
    mimeType,
    sizeBytes: options.declaredSize ?? bytes.length,
    ...(options.albumId !== undefined ? { albumId: options.albumId } : {}),
  });
  if (ticket.status !== 200) throw new Error(JSON.stringify(ticket.json));
  const stored = await putToStore(ticket.json.data.uploadUrl, bytes, { "content-type": mimeType });
  if (stored !== 200) throw new Error(`store refused the upload: ${stored}`);
  const confirmed = await confirmUploadOf(
    weddingId,
    ticket.json.data.assetId,
    who,
    options.dimensions ?? {},
  );
  if (confirmed.status !== 200) throw new Error(JSON.stringify(confirmed.json));
  return confirmed.json.data as Record<string, any>;
}

export const patchAsset = (
  weddingId: string,
  assetId: string,
  who: TestMember,
  body: Record<string, unknown>,
) =>
  call(patchAssetRoute, {
    method: "PATCH",
    cookie: who.cookie,
    params: { weddingId, assetId },
    body,
  });
export const removeAsset = (weddingId: string, assetId: string, who: TestMember) =>
  call(deleteAssetRoute, { method: "DELETE", cookie: who.cookie, params: { weddingId, assetId } });
export const moderate = (
  weddingId: string,
  assetId: string,
  who: TestMember,
  decision: "approve" | "reject",
) =>
  call(moderateRoute, { cookie: who.cookie, params: { weddingId, assetId }, body: { decision } });

export const listTokens = (weddingId: string, who: TestMember) =>
  call(listTokensRoute, { method: "GET", cookie: who.cookie, params: { weddingId } });
export const addToken = (weddingId: string, who: TestMember, body: Record<string, unknown> = {}) =>
  call(createTokenRoute, {
    cookie: who.cookie,
    params: { weddingId },
    body: { permissions: { canView: true, canUpload: false, canDownload: true }, ...body },
  });
export async function makeToken(
  weddingId: string,
  who: TestMember,
  body: Record<string, unknown> = {},
): Promise<Record<string, any> & { token: string }> {
  const result = await addToken(weddingId, who, body);
  if (result.status !== 201) throw new Error(JSON.stringify(result.json));
  const data = result.json.data as Record<string, any>;
  return { ...data, token: data.shareUrl.split("/gallery/")[1] as string };
}
export const revoke = (weddingId: string, tokenId: string, who: TestMember) =>
  call(revokeTokenRoute, { method: "DELETE", cookie: who.cookie, params: { weddingId, tokenId } });

// ---- Guest requests -------------------------------------------------------------------------

export const publicGallery = (token: string, query = "", ip?: string) =>
  call(publicGalleryRoute, {
    method: "GET",
    path: `/api/test${query}`,
    params: { token },
    ip,
  });
export const guestUploadUrl = (token: string, body: Record<string, unknown>, ip?: string) =>
  call(publicUploadUrlRoute, { params: { token }, body, ip });
export const guestConfirm = (
  token: string,
  assetId: string,
  body: Record<string, unknown> = {},
  ip?: string,
) => call(publicConfirmRoute, { params: { token, assetId }, body, ip });

/** A guest's whole upload through a link. */
export async function guestUploadPhoto(
  token: string,
  options: UploadOptions & { displayName?: string } = {},
) {
  const bytes = options.bytes ?? jpegBytes();
  const mimeType = options.mimeType ?? "image/jpeg";
  const ticket = await guestUploadUrl(token, {
    fileName: options.fileName ?? "guest.jpg",
    mimeType,
    sizeBytes: bytes.length,
    ...(options.displayName ? { displayName: options.displayName } : {}),
  });
  if (ticket.status !== 200) throw new Error(JSON.stringify(ticket.json));
  await putToStore(ticket.json.data.uploadUrl, bytes, { "content-type": mimeType });
  const confirmed = await guestConfirm(token, ticket.json.data.assetId, options.dimensions ?? {});
  return { ticket: ticket.json.data, confirmed };
}
