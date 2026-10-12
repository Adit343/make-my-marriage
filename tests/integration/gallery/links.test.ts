/* eslint-disable @typescript-eslint/no-explicit-any -- response bodies are asserted on */
import { existsSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { GalleryAccessToken } from "@/models/galleryAccessToken.model";
import { clearCollections, setupTestDatabase } from "../../setup/database";
import { addMember, setupWedding } from "../../setup/wedding";
import { deleteWedding, describeWedding } from "../experience/helpers";
import {
  addToken,
  getFromStore,
  getGallery,
  guestConfirm,
  guestUploadPhoto,
  guestUploadUrl,
  jpegBytes,
  listAssets,
  listTokens,
  makeAlbum,
  makeToken,
  moderate,
  notAPhoto,
  patchAsset,
  patchGallery,
  publicGallery,
  putToStore,
  removeAlbum,
  revoke,
  uploadPhoto,
  withTempPhotoStore,
} from "./helpers";

setupTestDatabase();
const storeDir = withTempPhotoStore();
beforeEach(clearCollections);

async function setup() {
  const wedding = await setupWedding("Aarav & Diya's Wedding");
  await describeWedding(wedding.weddingId, wedding.owner);
  const admin = await addMember(wedding.weddingId, "admin");
  const member = await addMember(wedding.weddingId);
  return { ...wedding, admin, member };
}

/** Turns guest uploads on (with or without approval). */
async function allowGuests(weddingId: string, who: any, requireUploadApproval = true) {
  const current = (await getGallery(weddingId, who)).json.data.gallery;
  const result = await patchGallery(weddingId, who, {
    version: current.version,
    allowGuestUploads: true,
    requireUploadApproval,
  });
  if (result.status !== 200) throw new Error(JSON.stringify(result.json));
}

/** A photo the team shared with guests. */
async function sharedPhoto(weddingId: string, who: any, options: Record<string, unknown> = {}) {
  const photo = await uploadPhoto(weddingId, who, options);
  const shared = await patchAsset(weddingId, photo.id, who, {
    version: photo.version,
    visibility: "guests",
  });
  return shared.json.data as Record<string, any>;
}

describe("shared links", () => {
  it("are made by owners and admins, and show the same link every time", async () => {
    const { weddingId, owner, admin, member } = await setup();
    expect((await addToken(weddingId, member)).status).toBe(403);
    const made = await makeToken(weddingId, owner, { label: "Family WhatsApp group" });
    expect(made).toMatchObject({
      label: "Family WhatsApp group",
      albumId: null,
      status: "active",
      permissions: { canView: true, canUpload: false, canDownload: true },
      expiresAt: null,
    });
    expect(made.shareUrl).toMatch(/^http:\/\/localhost:3000\/gallery\/[A-Za-z0-9_-]{43}$/);
    const listed = (await listTokens(weddingId, admin)).json.data as any[];
    expect(listed).toHaveLength(1);
    expect(listed[0].shareUrl).toBe(made.shareUrl);
    expect((await listTokens(weddingId, member)).status).toBe(403);
  });

  it("can open one album only, and the album's name is shown", async () => {
    const { weddingId, owner } = await setup();
    const album = await makeAlbum(weddingId, owner, { title: "Reception" });
    const link = await makeToken(weddingId, owner, { albumId: album.id, label: "Reception QR" });
    expect(link).toMatchObject({ albumId: album.id, albumTitle: "Reception" });
    const stranger = await setupWedding();
    const foreign = await makeAlbum(stranger.weddingId, stranger.owner);
    expect((await addToken(weddingId, owner, { albumId: foreign.id })).status).toBe(404);
  });

  it("must let guests view or upload, expire in the future, and use known keys only", async () => {
    const { weddingId, owner } = await setup();
    const permissions = (canView: boolean, canUpload: boolean, canDownload = true) => ({
      canView,
      canUpload,
      canDownload,
    });
    for (const body of [
      { permissions: permissions(false, false) },
      { permissions: permissions(true, false), expiresAt: "2020-01-01T00:00:00Z" },
      { permissions: permissions(true, false), expiresAt: "tomorrow" },
      { permissions: permissions(true, false), label: "x".repeat(81) },
      { permissions: permissions(true, false), tokenHash: "x" },
      { permissions: { canView: true } },
    ]) {
      expect((await addToken(weddingId, owner, body)).status, JSON.stringify(body)).toBe(400);
    }
  });

  it("can only allow uploads when the gallery has guest uploads switched on", async () => {
    const { weddingId, owner } = await setup();
    const body = { permissions: { canView: false, canUpload: true, canDownload: false } };
    const refused = await addToken(weddingId, owner, body);
    expect(refused.status).toBe(422);
    expect(refused.json.error.message).toContain("guest uploads");
    await allowGuests(weddingId, owner);
    expect((await addToken(weddingId, owner, body)).status).toBe(201);
  });

  it("can be revoked at once, twice without harm, and only by owners and admins", async () => {
    const { weddingId, owner, member } = await setup();
    const link = await makeToken(weddingId, owner);
    expect((await publicGallery(link.token)).status).toBe(200);
    expect((await revoke(weddingId, link.id, member)).status).toBe(403);

    const revoked = await revoke(weddingId, link.id, owner);
    expect(revoked.status).toBe(200);
    expect(revoked.json.data).toMatchObject({ status: "revoked", shareUrl: null });
    expect((await revoke(weddingId, link.id, owner)).status).toBe(200);
    const denied = await publicGallery(link.token);
    expect(denied.status).toBe(403);
    expect(denied.json.error.code).toBe("INVALID_TOKEN");
    // It is kept for 30 days before the database removes it.
    const row: any = await GalleryAccessToken.findById(link.id).lean();
    expect(row.purgeAt.getTime()).toBeGreaterThan(Date.now() + 29 * 86400_000);
  });

  it("stop working when they expire", async () => {
    const { weddingId, owner } = await setup();
    const link = await makeToken(weddingId, owner);
    await GalleryAccessToken.updateOne(
      { _id: link.id },
      { $set: { expiresAt: new Date(Date.now() - 1000) } },
    );
    expect((await publicGallery(link.token)).status).toBe(403);
    const listed = (await listTokens(weddingId, owner)).json.data[0];
    expect(listed).toMatchObject({ status: "expired", shareUrl: null });
  });

  it("belong to their own wedding", async () => {
    const { weddingId, owner } = await setup();
    const link = await makeToken(weddingId, owner);
    const stranger = await setupWedding();
    expect((await listTokens(weddingId, stranger.owner)).status).toBe(403);
    expect((await revoke(stranger.weddingId, link.id, stranger.owner)).status).toBe(404);
    expect((await publicGallery(link.token)).status).toBe(200); // untouched
  });

  it("die with an album that is deleted", async () => {
    const { weddingId, owner } = await setup();
    const album = await makeAlbum(weddingId, owner);
    const link = await makeToken(weddingId, owner, { albumId: album.id });
    expect((await publicGallery(link.token)).status).toBe(200);
    await removeAlbum(weddingId, album.id, owner);
    expect((await publicGallery(link.token)).status).toBe(403);
  });
});

describe("what a guest sees through a link", () => {
  it("is only the active photos shared with guests, as a hand-built whitelist", async () => {
    const { weddingId, owner } = await setup();
    const shared = await sharedPhoto(weddingId, owner);
    const hidden = await uploadPhoto(weddingId, owner); // private to the team
    const link = await makeToken(weddingId, owner);

    const result = await publicGallery(link.token);
    expect(result.status).toBe(200);
    const data = result.json.data;
    expect(data).toMatchObject({
      coupleNames: "Aarav & Diya",
      title: "Aarav & Diya Photos",
      albumTitle: null,
      canView: true,
      canUpload: false,
      canDownload: true,
      uploadsNeedApproval: true,
    });
    expect(data.photos).toHaveLength(1);
    expect(Object.keys(data.photos[0]).sort()).toEqual(
      ["caption", "downloadUrl", "height", "id", "url", "width"].sort(),
    );
    expect(data.photos[0].id).toBe(shared.id);
    expect((await getFromStore(data.photos[0].url)).status).toBe(200);

    // The signed photo addresses necessarily contain the storage path (which holds ids); every
    // OTHER field must be free of them, so the addresses are taken out before looking.
    const withoutAddresses = {
      ...result.json,
      data: {
        ...result.json.data,
        photos: result.json.data.photos.map((p: any) => ({ ...p, url: null, downloadUrl: null })),
      },
    };
    const body = JSON.stringify(withoutAddresses);
    for (const forbidden of [
      hidden.id,
      weddingId,
      owner.user.id,
      owner.user.email,
      "objectKey",
      "uploadedBy",
      "fileName",
      "tokenHash",
      "tokenEnc",
      "viaTokenId",
      "weddingId",
      "deletedAt",
      "isFavorite",
      "visibility",
      "status",
    ]) {
      expect(body, forbidden).not.toContain(forbidden);
    }
  });

  it("is limited to the album when the link opens one album", async () => {
    const { weddingId, owner } = await setup();
    const reception = await makeAlbum(weddingId, owner, { title: "Reception" });
    const inside = await sharedPhoto(weddingId, owner, { albumId: reception.id });
    await sharedPhoto(weddingId, owner); // shared, but in no album
    const link = await makeToken(weddingId, owner, { albumId: reception.id });
    const data = (await publicGallery(link.token)).json.data;
    expect(data.title).toBe("Reception");
    expect(data.albumTitle).toBe("Reception");
    expect(data.photos.map((p: any) => p.id)).toEqual([inside.id]);
  });

  it("hides the download address unless the link allows downloads", async () => {
    const { weddingId, owner } = await setup();
    await sharedPhoto(weddingId, owner);
    const link = await makeToken(weddingId, owner, {
      permissions: { canView: true, canUpload: false, canDownload: false },
    });
    const data = (await publicGallery(link.token)).json.data;
    expect(data.canDownload).toBe(false);
    expect(data.photos[0].downloadUrl).toBeNull();
  });

  it("shows no photos on an upload-only link", async () => {
    const { weddingId, owner } = await setup();
    await allowGuests(weddingId, owner);
    await sharedPhoto(weddingId, owner);
    const link = await makeToken(weddingId, owner, {
      permissions: { canView: false, canUpload: true, canDownload: false },
    });
    const data = (await publicGallery(link.token)).json.data;
    expect(data).toMatchObject({ canView: false, canUpload: true, photos: [] });
  });

  it("pages by cursor, newest first, without repeating", async () => {
    const { weddingId, owner } = await setup();
    const ids: string[] = [];
    for (let i = 0; i < 5; i += 1) ids.push((await sharedPhoto(weddingId, owner)).id);
    const link = await makeToken(weddingId, owner);
    const seen: string[] = [];
    let cursor = "";
    for (let page = 0; page < 5; page += 1) {
      const result = await publicGallery(link.token, `?limit=2${cursor}`);
      seen.push(...result.json.data.photos.map((p: any) => p.id));
      if (!result.json.meta.hasMore) break;
      cursor = `&cursor=${result.json.meta.nextCursor}`;
    }
    expect(seen).toEqual([...ids].reverse());
    expect((await publicGallery(link.token, "?cursor=nonsense")).status).toBe(400);
  });

  it("answers the same 403 for unknown, altered and guessed links", async () => {
    const { weddingId, owner } = await setup();
    const link = await makeToken(weddingId, owner);
    const answers = await Promise.all(
      [
        "x",
        `${link.token}x`,
        link.token.slice(0, -1),
        link.token.toUpperCase(),
        "507f1f77bcf86cd799439011",
      ].map((candidate) => publicGallery(candidate)),
    );
    for (const answer of answers) {
      expect(answer.status).toBe(403);
      expect(answer.json.error.code).toBe("INVALID_TOKEN");
    }
    expect(new Set(answers.map((a) => JSON.stringify(a.json))).size).toBe(1);
  });

  it("goes dark when the wedding is deleted", async () => {
    const { weddingId, owner, title } = await setup();
    const link = await makeToken(weddingId, owner);
    expect((await publicGallery(link.token)).status).toBe(200);
    expect((await deleteWedding(weddingId, owner, title)).status).toBe(200);
    expect((await publicGallery(link.token)).status).toBe(403);
  });

  it("is rate limited per visitor", async () => {
    const { weddingId, owner } = await setup();
    const link = await makeToken(weddingId, owner);
    const ip = "203.0.113.55";
    let last = 0;
    for (let i = 0; i < 125; i += 1) last = (await publicGallery(link.token, "", ip)).status;
    expect(last).toBe(429);
    expect((await publicGallery(link.token, "", "203.0.113.56")).status).toBe(200);
  });
});

describe("guest uploads", () => {
  it("need the link to allow them AND the gallery to have them switched on", async () => {
    const { weddingId, owner } = await setup();
    const viewOnly = await makeToken(weddingId, owner);
    const refusedLink = await guestUploadUrl(viewOnly.token, {
      fileName: "a.jpg",
      mimeType: "image/jpeg",
      sizeBytes: 100,
    });
    expect(refusedLink.status).toBe(422);

    await allowGuests(weddingId, owner);
    const uploadLink = await makeToken(weddingId, owner, {
      permissions: { canView: true, canUpload: true, canDownload: true },
    });
    expect((await publicGallery(uploadLink.token)).json.data.canUpload).toBe(true);
    // Switching guest uploads off again stops an existing link at once.
    const current = (await getGallery(weddingId, owner)).json.data.gallery;
    await patchGallery(weddingId, owner, { version: current.version, allowGuestUploads: false });
    expect((await publicGallery(uploadLink.token)).json.data.canUpload).toBe(false);
    const stopped = await guestUploadUrl(uploadLink.token, {
      fileName: "a.jpg",
      mimeType: "image/jpeg",
      sizeBytes: 100,
    });
    expect(stopped.status).toBe(422);
  });

  it("wait for approval, and appear for guests once an owner or admin approves them", async () => {
    const { weddingId, owner, admin, member } = await setup();
    await allowGuests(weddingId, owner);
    const link = await makeToken(weddingId, owner, {
      permissions: { canView: true, canUpload: true, canDownload: true },
    });
    const { confirmed } = await guestUploadPhoto(link.token, { displayName: "Rahul S." });
    expect(confirmed.status).toBe(200);
    expect(confirmed.json.data).toEqual({ id: expect.any(String), awaitingApproval: true });
    const id = confirmed.json.data.id;

    // Not visible to guests, not in the normal list; waiting in the queue with the guest's name.
    expect((await publicGallery(link.token)).json.data.photos).toEqual([]);
    expect((await listAssets(weddingId, member)).json.data).toEqual([]);
    const queue = (await listAssets(weddingId, admin, "?status=pending_review")).json.data as any[];
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({
      id,
      status: "pending_review",
      visibility: "guests",
      uploadedBy: { kind: "guest", name: "Rahul S." },
    });
    expect((await getGallery(weddingId, owner)).json.data.usage.pendingReviewCount).toBe(1);

    expect((await moderate(weddingId, id, member, "approve")).status).toBe(403);
    const approved = await moderate(weddingId, id, admin, "approve");
    expect(approved.status).toBe(200);
    expect(approved.json.data.status).toBe("active");
    expect((await publicGallery(link.token)).json.data.photos.map((p: any) => p.id)).toEqual([id]);
    expect((await moderate(weddingId, id, admin, "approve")).status).toBe(422); // no longer waiting
  });

  it("are removed, file and all, when rejected", async () => {
    const { weddingId, owner } = await setup();
    await allowGuests(weddingId, owner);
    const link = await makeToken(weddingId, owner, {
      permissions: { canView: true, canUpload: true, canDownload: true },
    });
    const { ticket, confirmed } = await guestUploadPhoto(link.token);
    const file = path.join(
      storeDir(),
      ...new URL(ticket.uploadUrl).pathname.replace("/api/v1/storage/local/", "").split("/"),
    );
    expect(existsSync(file)).toBe(true);
    const rejected = await moderate(weddingId, confirmed.json.data.id, owner, "reject");
    expect(rejected.json.data.status).toBe("rejected");
    expect(existsSync(file)).toBe(false);
    expect((await publicGallery(link.token)).json.data.photos).toEqual([]);
    // Rejected photos no longer take up space.
    expect((await getGallery(weddingId, owner)).json.data.usage.usedBytes).toBe(0);
  });

  it("show at once when the gallery does not require approval", async () => {
    const { weddingId, owner } = await setup();
    await allowGuests(weddingId, owner, false);
    const link = await makeToken(weddingId, owner, {
      permissions: { canView: true, canUpload: true, canDownload: true },
    });
    const { confirmed } = await guestUploadPhoto(link.token);
    expect(confirmed.json.data.awaitingApproval).toBe(false);
    expect((await publicGallery(link.token)).json.data.photos).toHaveLength(1);
  });

  it("land in the album of an album link", async () => {
    const { weddingId, owner, admin } = await setup();
    await allowGuests(weddingId, owner, false);
    const album = await makeAlbum(weddingId, owner, { title: "Reception" });
    const link = await makeToken(weddingId, owner, {
      albumId: album.id,
      permissions: { canView: true, canUpload: true, canDownload: false },
    });
    await guestUploadPhoto(link.token);
    const inAlbum = (await listAssets(weddingId, admin, `?albumId=${album.id}`)).json.data as any[];
    expect(inAlbum).toHaveLength(1);
  });

  it("can only confirm photos their own link announced", async () => {
    const { weddingId, owner } = await setup();
    await allowGuests(weddingId, owner);
    const permissions = { canView: true, canUpload: true, canDownload: true };
    const one = await makeToken(weddingId, owner, { permissions });
    const two = await makeToken(weddingId, owner, { permissions });
    const ticket = (
      await guestUploadUrl(one.token, {
        fileName: "a.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 2048,
      })
    ).json.data;
    await putToStore(ticket.uploadUrl, jpegBytes());
    expect((await guestConfirm(two.token, ticket.assetId)).status).toBe(404);
    expect((await guestConfirm(one.token, ticket.assetId)).status).toBe(200);
    // Confirming again is harmless; a member's photo can never be confirmed through a link.
    expect((await guestConfirm(one.token, ticket.assetId)).status).toBe(200);
    const mine = await uploadPhoto(weddingId, owner);
    expect((await guestConfirm(one.token, mine.id)).status).toBe(404);
  });

  it("are checked like any upload: only real photos are kept", async () => {
    const { weddingId, owner } = await setup();
    await allowGuests(weddingId, owner);
    const link = await makeToken(weddingId, owner, {
      permissions: { canView: true, canUpload: true, canDownload: true },
    });
    const ticket = (
      await guestUploadUrl(link.token, {
        fileName: "evil.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 2048,
      })
    ).json.data;
    await putToStore(ticket.uploadUrl, notAPhoto());
    const result = await guestConfirm(link.token, ticket.assetId);
    expect(result.status).toBe(422);
    expect((await listAssets(weddingId, owner, "?status=pending_review")).json.data).toEqual([]);
  });

  it("cannot set anything but a name, a file and a size", async () => {
    const { weddingId, owner } = await setup();
    await allowGuests(weddingId, owner);
    const link = await makeToken(weddingId, owner, {
      permissions: { canView: true, canUpload: true, canDownload: true },
    });
    const base = { fileName: "a.jpg", mimeType: "image/jpeg", sizeBytes: 100 };
    for (const extra of [
      { visibility: "public" },
      { status: "active" },
      { albumId: "aaaaaaaaaaaaaaaaaaaaaaaa" },
      { objectKey: "weddings/x" },
      { displayName: "x".repeat(61) },
    ]) {
      expect(
        (await guestUploadUrl(link.token, { ...base, ...extra })).status,
        JSON.stringify(extra),
      ).toBe(400);
    }
    expect((await guestUploadUrl(link.token, { ...base, mimeType: "image/gif" })).status).toBe(400);
    expect((await guestUploadUrl("not-a-link", base)).status).toBe(403);
  });

  it("share the wedding's storage allowance", async () => {
    const { weddingId, owner } = await setup();
    await allowGuests(weddingId, owner);
    const link = await makeToken(weddingId, owner, {
      permissions: { canView: true, canUpload: true, canDownload: true },
    });
    const big = { fileName: "big.jpg", mimeType: "image/jpeg", sizeBytes: 15 * 1024 * 1024 };
    let last = 0;
    for (let i = 0; i < 137; i += 1)
      last = (await guestUploadUrl(link.token, big, `198.51.100.${i % 200}`)).status;
    expect(last).toBe(422);
  });

  it("are rate limited per visitor", async () => {
    const { weddingId, owner } = await setup();
    await allowGuests(weddingId, owner);
    const link = await makeToken(weddingId, owner, {
      permissions: { canView: true, canUpload: true, canDownload: true },
    });
    const small = { fileName: "a.jpg", mimeType: "image/jpeg", sizeBytes: 100 };
    const ip = "203.0.113.99";
    let last = 0;
    for (let i = 0; i < 62; i += 1) last = (await guestUploadUrl(link.token, small, ip)).status;
    expect(last).toBe(429);
    expect((await guestUploadUrl(link.token, small, "203.0.113.100")).status).toBe(200);
  });
});

describe("privacy of the team's responses", () => {
  it("never hands out hashes, encrypted tokens or storage keys", async () => {
    const { weddingId, owner } = await setup();
    await sharedPhoto(weddingId, owner);
    await makeToken(weddingId, owner);
    const bodies = [
      (await getGallery(weddingId, owner)).json,
      (await listAssets(weddingId, owner)).json,
      (await listTokens(weddingId, owner)).json,
    ].map((json) => JSON.stringify(json));
    for (const body of bodies) {
      for (const forbidden of [
        "tokenHash",
        "tokenEnc",
        "objectKey",
        "viaTokenId",
        "deletedAt",
        "__v",
      ]) {
        expect(body, forbidden).not.toContain(forbidden);
      }
    }
  });
});
