/* eslint-disable @typescript-eslint/no-explicit-any -- response bodies are asserted on */
import { existsSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { MAX_PHOTO_BYTES, WEDDING_STORAGE_QUOTA_BYTES } from "@/lib/constants/gallery";
import { clearCollections, setupTestDatabase } from "../../setup/database";
import { addMember, setupWedding } from "../../setup/wedding";
import { describeWedding } from "../experience/helpers";
import {
  addAlbum,
  confirmUploadOf,
  createEvent,
  getFromStore,
  getGallery,
  heicBytes,
  jpegBytes,
  listAlbums,
  listAssets,
  makeAlbum,
  notAPhoto,
  patchAlbum,
  patchAsset,
  patchGallery,
  pngBytes,
  putToStore,
  removeAlbum,
  removeAsset,
  requestUpload,
  uploadPhoto,
  withTempPhotoStore,
  webpBytes,
} from "./helpers";

setupTestDatabase();
const storeDir = withTempPhotoStore();
// Every test starts from an empty database, so photos and limits never leak between them.
beforeEach(clearCollections);

async function setup() {
  const wedding = await setupWedding("Aarav & Diya's Wedding");
  await describeWedding(wedding.weddingId, wedding.owner);
  const admin = await addMember(wedding.weddingId, "admin");
  const member = await addMember(wedding.weddingId);
  return { ...wedding, admin, member };
}

/** Where the development photo store keeps the file behind an upload address. */
const fileOf = (uploadUrl: string) =>
  path.join(
    storeDir(),
    ...decodeURIComponent(new URL(uploadUrl).pathname.replace("/api/v1/storage/local/", "")).split(
      "/",
    ),
  );

describe("gallery settings", () => {
  it("shows defaults and what is stored without creating anything", async () => {
    const { weddingId, owner, member } = await setup();
    for (const who of [owner, member]) {
      const result = await getGallery(weddingId, who);
      expect(result.status).toBe(200);
      expect(result.json.data).toMatchObject({
        gallery: {
          id: null,
          title: "Aarav & Diya Photos",
          allowGuestUploads: false,
          requireUploadApproval: true,
          coverAssetId: null,
          version: 0,
        },
        usage: {
          usedBytes: 0,
          quotaBytes: WEDDING_STORAGE_QUOTA_BYTES,
          photoCount: 0,
          pendingReviewCount: 0,
        },
        storage: { configured: true, kind: "local" },
      });
    }
    // A GET never creates the gallery (API Design §2.9).
    expect((await getGallery(weddingId, owner)).json.data.gallery.id).toBeNull();
  });

  it("is changed by owners and admins only, with optimistic concurrency", async () => {
    const { weddingId, owner, admin, member } = await setup();
    expect((await patchGallery(weddingId, member, { version: 0, title: "Mine" })).status).toBe(403);

    const first = await patchGallery(weddingId, owner, {
      version: 0,
      title: "Our wedding photos",
      description: "Everyone's memories",
      allowGuestUploads: true,
      requireUploadApproval: false,
    });
    expect(first.status).toBe(200);
    expect(first.json.data).toMatchObject({
      title: "Our wedding photos",
      description: "Everyone's memories",
      allowGuestUploads: true,
      requireUploadApproval: false,
    });
    expect(first.json.data.id).toEqual(expect.any(String));

    const stale = await patchGallery(weddingId, admin, { version: 0, title: "Late edit" });
    expect(stale.status).toBe(409);
    expect(stale.json.error.code).toBe("VERSION_CONFLICT");
    expect(
      (await patchGallery(weddingId, admin, { version: first.json.data.version, title: "Ok" }))
        .status,
    ).toBe(200);
  });

  it("rejects bad input and unknown keys", async () => {
    const { weddingId, owner } = await setup();
    for (const body of [
      { version: 0, title: "  " },
      { version: 0, title: "x".repeat(121) },
      { version: 0, allowGuestUploads: "yes" },
      { version: 0, weddingId: "000000000000000000000000" },
      { version: 0 },
    ]) {
      expect((await patchGallery(weddingId, owner, body)).status, JSON.stringify(body)).toBe(400);
    }
  });

  it("takes a cover only from an active photo of this wedding", async () => {
    const { weddingId, owner } = await setup();
    const photo = await uploadPhoto(weddingId, owner);
    const other = await setupWedding();
    const foreign = await uploadPhoto(other.weddingId, other.owner);
    const ok = await patchGallery(weddingId, owner, { version: 0, coverAssetId: photo.id });
    expect(ok.status).toBe(200);
    expect(ok.json.data.coverAssetId).toBe(photo.id);
    expect(ok.json.data.coverUrl).toContain("/api/v1/storage/local/");
    const bad = await patchGallery(weddingId, owner, {
      version: ok.json.data.version,
      coverAssetId: foreign.id,
    });
    expect(bad.status).toBe(404);
  });

  it("keeps each wedding's gallery to itself", async () => {
    const { weddingId } = await setup();
    const stranger = await setupWedding();
    const read = await getGallery(weddingId, stranger.owner);
    expect(read.status).toBe(403);
    expect(read.json.error.code).toBe("NOT_A_MEMBER");
  });
});

describe("albums", () => {
  it("are made by any role, with the creator able to delete them", async () => {
    const { weddingId, member } = await setup();
    const album = await makeAlbum(weddingId, member, { description: "Morning rituals" });
    expect(album).toMatchObject({
      title: "Haldi Moments",
      description: "Morning rituals",
      defaultVisibility: "private",
      photoCount: 0,
      coverUrl: null,
      eventId: null,
      canDelete: true,
    });
    const list = (await listAlbums(weddingId, member)).json.data as any[];
    expect(list.map((a) => a.id)).toEqual([album.id]);
  });

  it("links an event of this wedding, and refuses a stranger's", async () => {
    const { weddingId, owner } = await setup();
    const eventId = await createEvent(weddingId, owner, { name: "Haldi" });
    const album = await makeAlbum(weddingId, owner, { eventId });
    expect(album).toMatchObject({ eventId, eventName: "Haldi" });
    const other = await setupWedding();
    const foreign = await createEvent(other.weddingId, other.owner, { name: "Theirs" });
    expect((await addAlbum(weddingId, owner, { title: "x", eventId: foreign })).status).toBe(404);
  });

  it("rejects bad input", async () => {
    const { weddingId, owner } = await setup();
    for (const body of [
      { title: " " },
      { title: "x".repeat(101) },
      { title: "ok", defaultVisibility: "everyone" },
      { title: "ok", galleryId: "1" },
      { title: "ok", description: "x".repeat(501) },
    ]) {
      expect((await addAlbum(weddingId, owner, body)).status, JSON.stringify(body)).toBe(400);
    }
  });

  it("show their photo count and the newest photo as the cover", async () => {
    const { weddingId, owner } = await setup();
    const album = await makeAlbum(weddingId, owner);
    await uploadPhoto(weddingId, owner, { albumId: album.id });
    const newest = await uploadPhoto(weddingId, owner, {
      albumId: album.id,
      bytes: pngBytes(),
      mimeType: "image/png",
    });
    await uploadPhoto(weddingId, owner); // in no album
    const [listed] = (await listAlbums(weddingId, owner)).json.data as any[];
    expect(listed.photoCount).toBe(2);
    expect(listed.coverUrl).toBeTruthy();
    const cover = await getFromStore(listed.coverUrl);
    expect([...cover.bytes.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]); // the PNG, the newest
    expect(newest.albumId).toBe(album.id);
  });

  it("can be edited by any role and are protected from stale edits", async () => {
    const { weddingId, owner, member } = await setup();
    const album = await makeAlbum(weddingId, owner);
    const edited = await patchAlbum(weddingId, album.id, member, {
      version: album.version,
      title: "Haldi Morning",
      defaultVisibility: "guests",
    });
    expect(edited.status).toBe(200);
    expect(edited.json.data).toMatchObject({ title: "Haldi Morning", defaultVisibility: "guests" });
    const stale = await patchAlbum(weddingId, album.id, owner, {
      version: album.version,
      title: "Late",
    });
    expect(stale.status).toBe(409);
    expect(
      (await patchAlbum(weddingId, album.id, owner, { version: 99, eventId: null })).status,
    ).toBe(409);
  });

  it("need a choice about their photos when deleted (move to the gallery, or delete)", async () => {
    const { weddingId, owner } = await setup();
    const album = await makeAlbum(weddingId, owner);
    const photo = await uploadPhoto(weddingId, owner, { albumId: album.id });

    expect((await removeAlbum(weddingId, album.id, owner, {})).status).toBe(400);
    expect((await removeAlbum(weddingId, album.id, owner, { photos: "burn" })).status).toBe(400);
    const moved = await removeAlbum(weddingId, album.id, owner, { photos: "move_to_root" });
    expect(moved.status).toBe(200);
    expect(moved.json.data).toMatchObject({ photosMoved: 1, photosRemoved: 0 });
    expect((await listAlbums(weddingId, owner)).json.data).toEqual([]);
    const root = (await listAssets(weddingId, owner, "?albumId=root")).json.data as any[];
    expect(root.map((p) => p.id)).toEqual([photo.id]);

    const second = await makeAlbum(weddingId, owner, { title: "Sangeet" });
    const gone = await uploadPhoto(weddingId, owner, { albumId: second.id });
    const removed = await removeAlbum(weddingId, second.id, owner, { photos: "delete" });
    expect(removed.json.data).toMatchObject({ photosMoved: 0, photosRemoved: 1 });
    expect((await listAssets(weddingId, owner)).json.data.map((p: any) => p.id)).toEqual([
      photo.id,
    ]);
    expect(gone.id).toBeTruthy();
    expect((await removeAlbum(weddingId, second.id, owner)).status).toBe(404);
  });

  it("can be deleted by their maker or an owner or admin, not by another member", async () => {
    const { weddingId, admin, member } = await setup();
    const other = await addMember(weddingId);
    const mine = await makeAlbum(weddingId, member);
    expect((await removeAlbum(weddingId, mine.id, other)).status).toBe(403);
    const seen = (await listAlbums(weddingId, other)).json.data[0];
    expect(seen.canDelete).toBe(false);
    expect((await removeAlbum(weddingId, mine.id, member)).status).toBe(200);
    const again = await makeAlbum(weddingId, member);
    expect((await removeAlbum(weddingId, again.id, admin)).status).toBe(200);
  });

  it("answers 404 for another wedding's album", async () => {
    const { weddingId, owner } = await setup();
    const album = await makeAlbum(weddingId, owner);
    const stranger = await setupWedding();
    expect(
      (await patchAlbum(stranger.weddingId, album.id, stranger.owner, { version: 0, title: "x" }))
        .status,
    ).toBe(404);
    expect((await removeAlbum(stranger.weddingId, album.id, stranger.owner)).status).toBe(404);
  });

  it("are limited to 100 per gallery", async () => {
    const { weddingId, owner } = await setup();
    for (let i = 0; i < 100; i += 1) await makeAlbum(weddingId, owner, { title: `Album ${i}` });
    const over = await addAlbum(weddingId, owner, { title: "One too many" });
    expect(over.status).toBe(422);
    expect(over.json.error.code).toBe("BUSINESS_RULE_VIOLATION");
  });

  it("stop being linked to an event that is deleted", async () => {
    const { weddingId, owner } = await setup();
    const eventId = await createEvent(weddingId, owner, { name: "Haldi" });
    const album = await makeAlbum(weddingId, owner, { eventId });
    const { removeEvent } = await import("../experience/helpers");
    const removed = await removeEvent(weddingId, eventId, owner);
    expect(removed.json.data.albumsUnlinked).toBe(1);
    const [listed] = (await listAlbums(weddingId, owner)).json.data as any[];
    expect(listed).toMatchObject({ id: album.id, eventId: null, eventName: null });
  });
});

describe("uploading a photo", () => {
  it("takes it from announcement to a viewable photo, with the bytes going straight to the store", async () => {
    const { weddingId, owner } = await setup();
    const bytes = jpegBytes(4096);
    const photo = await uploadPhoto(weddingId, owner, {
      bytes,
      fileName: "IMG_2041.jpg",
      dimensions: { width: 4032, height: 3024 },
    });
    expect(photo).toMatchObject({
      albumId: null,
      fileName: "IMG_2041.jpg",
      mimeType: "image/jpeg",
      sizeBytes: 4096,
      width: 4032,
      height: 3024,
      caption: null,
      visibility: "private",
      status: "active",
      isFavorite: false,
      uploadedBy: { kind: "member" },
      canDelete: true,
    });
    const viewed = await getFromStore(photo.url);
    expect(viewed.status).toBe(200);
    expect(viewed.headers.get("content-type")).toBe("image/jpeg");
    expect(viewed.bytes).toEqual(bytes);
    const download = await getFromStore(photo.downloadUrl);
    expect(download.headers.get("content-disposition")).toContain(
      'attachment; filename="IMG_2041.jpg"',
    );
  });

  it("accepts JPEG, PNG, WebP and HEIC", async () => {
    const { weddingId, owner } = await setup();
    const cases: [Uint8Array, string][] = [
      [jpegBytes(), "image/jpeg"],
      [pngBytes(), "image/png"],
      [webpBytes(), "image/webp"],
      [heicBytes(), "image/heic"],
      [heicBytes(), "image/heif"],
    ];
    for (const [bytes, mimeType] of cases) {
      const photo = await uploadPhoto(weddingId, owner, { bytes, mimeType });
      expect(photo.status, mimeType).toBe("active");
      expect(photo.mimeType).toBe(mimeType);
    }
  });

  it("refuses what is not a supported photo, a bad size, or an unknown key, before anything is stored", async () => {
    const { weddingId, owner } = await setup();
    const base = { fileName: "a.jpg", mimeType: "image/jpeg", sizeBytes: 1000 };
    for (const body of [
      { ...base, mimeType: "image/gif" },
      { ...base, mimeType: "video/mp4" },
      { ...base, mimeType: "image/svg+xml" },
      { ...base, mimeType: "text/html" },
      { ...base, sizeBytes: 0 },
      { ...base, sizeBytes: MAX_PHOTO_BYTES + 1 },
      { ...base, sizeBytes: 12.5 },
      { ...base, fileName: "" },
      { ...base, objectKey: "weddings/x" },
      { ...base, albumId: "not-an-id" },
    ]) {
      const result = await requestUpload(weddingId, owner, body);
      expect(result.status, JSON.stringify(body)).toBe(400);
    }
  });

  it("stores the file name safely, never as a path", async () => {
    const { weddingId, owner } = await setup();
    const photo = await uploadPhoto(weddingId, owner, { fileName: "../../etc/pass<wd>.jpg" });
    expect(photo.fileName).toBe("passwd.jpg");
    const ticket = await requestUpload(weddingId, owner, {
      fileName: "x.jpg",
      mimeType: "image/jpeg",
      sizeBytes: 100,
    });
    // The store address is built only from ids we made, never from the file name.
    expect(new URL(ticket.json.data.uploadUrl).pathname).toMatch(
      /^\/api\/v1\/storage\/local\/weddings\/[a-f0-9]{24}\/gallery\/[a-f0-9]{24}\/[A-Za-z0-9_-]{24}\.jpg$/,
    );
  });

  it("puts a photo in an album and gives it the album's default visibility", async () => {
    const { weddingId, owner } = await setup();
    const album = await makeAlbum(weddingId, owner, { defaultVisibility: "guests" });
    const inAlbum = await uploadPhoto(weddingId, owner, { albumId: album.id });
    expect(inAlbum).toMatchObject({ albumId: album.id, visibility: "guests" });
    expect((await uploadPhoto(weddingId, owner)).visibility).toBe("private");
    const stranger = await setupWedding();
    const foreign = await makeAlbum(stranger.weddingId, stranger.owner);
    const result = await requestUpload(weddingId, owner, {
      fileName: "a.jpg",
      mimeType: "image/jpeg",
      sizeBytes: 100,
      albumId: foreign.id,
    });
    expect(result.status).toBe(404);
  });

  describe("on confirm, the stored file must be the photo that was announced", () => {
    async function announce(weddingId: string, who: any, mimeType = "image/jpeg", size = 2048) {
      const ticket = await requestUpload(weddingId, who, {
        fileName: "a.jpg",
        mimeType,
        sizeBytes: size,
      });
      return ticket.json.data as { assetId: string; uploadUrl: string };
    }

    it("rejects something that is not a photo, and removes it", async () => {
      const { weddingId, owner } = await setup();
      const { assetId, uploadUrl } = await announce(weddingId, owner);
      expect(await putToStore(uploadUrl, notAPhoto(), { "content-type": "image/jpeg" })).toBe(200);
      expect(existsSync(fileOf(uploadUrl))).toBe(true);
      const result = await confirmUploadOf(weddingId, assetId, owner);
      expect(result.status).toBe(422);
      expect(result.json.error.message).toContain("isn't a JPEG, PNG, WebP or HEIC");
      expect(existsSync(fileOf(uploadUrl))).toBe(false);
      // The pending row is gone too.
      expect((await confirmUploadOf(weddingId, assetId, owner)).status).toBe(404);
    });

    it("rejects a photo of another type than announced", async () => {
      const { weddingId, owner } = await setup();
      const { assetId, uploadUrl } = await announce(weddingId, owner, "image/jpeg");
      await putToStore(uploadUrl, pngBytes(), { "content-type": "image/jpeg" });
      expect((await confirmUploadOf(weddingId, assetId, owner)).status).toBe(422);
      expect(existsSync(fileOf(uploadUrl))).toBe(false);
    });

    it("rejects a file larger than announced (a way to dodge the storage limit)", async () => {
      const { weddingId, owner } = await setup();
      const { assetId, uploadUrl } = await announce(weddingId, owner, "image/jpeg", 1000);
      await putToStore(uploadUrl, jpegBytes(5000));
      const result = await confirmUploadOf(weddingId, assetId, owner);
      expect(result.status).toBe(422);
      expect(result.json.error.message).toContain("larger than the photo that was announced");
    });

    it("keeps a smaller file and records its real size", async () => {
      const { weddingId, owner } = await setup();
      const { assetId, uploadUrl } = await announce(weddingId, owner, "image/jpeg", 5000);
      await putToStore(uploadUrl, jpegBytes(3000));
      const result = await confirmUploadOf(weddingId, assetId, owner);
      expect(result.status).toBe(200);
      expect(result.json.data.sizeBytes).toBe(3000);
    });

    it("asks to try again when nothing arrived, and lets the same announcement still work", async () => {
      const { weddingId, owner } = await setup();
      const { assetId, uploadUrl } = await announce(weddingId, owner);
      const early = await confirmUploadOf(weddingId, assetId, owner);
      expect(early.status).toBe(422);
      expect(early.json.error.message).toContain("didn't arrive");
      await putToStore(uploadUrl, jpegBytes());
      expect((await confirmUploadOf(weddingId, assetId, owner)).status).toBe(200);
    });

    it("is harmless to confirm twice", async () => {
      const { weddingId, owner } = await setup();
      const photo = await uploadPhoto(weddingId, owner);
      const again = await confirmUploadOf(weddingId, photo.id, owner);
      expect(again.status).toBe(200);
      expect(again.json.data.id).toBe(photo.id);
    });

    it("lets only the uploader or an owner or admin confirm", async () => {
      const { weddingId, owner, admin, member } = await setup();
      const other = await addMember(weddingId);
      const { assetId, uploadUrl } = await announce(weddingId, member);
      await putToStore(uploadUrl, jpegBytes());
      const denied = await confirmUploadOf(weddingId, assetId, other);
      expect(denied.status).toBe(403);
      expect((await confirmUploadOf(weddingId, assetId, admin)).status).toBe(200);
      expect(owner).toBeTruthy();
    });

    it("answers 404 for another wedding's upload and for unknown ids", async () => {
      const { weddingId, owner } = await setup();
      const { assetId } = await announce(weddingId, owner);
      const stranger = await setupWedding();
      expect((await confirmUploadOf(stranger.weddingId, assetId, stranger.owner)).status).toBe(404);
      expect((await confirmUploadOf(weddingId, "aaaaaaaaaaaaaaaaaaaaaaaa", owner)).status).toBe(
        404,
      );
    });

    it("rejects impossible dimensions", async () => {
      const { weddingId, owner } = await setup();
      const { assetId, uploadUrl } = await announce(weddingId, owner);
      await putToStore(uploadUrl, jpegBytes());
      for (const body of [
        { width: 0 },
        { width: -4 },
        { height: 99999 },
        { width: 1.5 },
        { depth: 3 },
      ]) {
        expect(
          (await confirmUploadOf(weddingId, assetId, owner, body)).status,
          JSON.stringify(body),
        ).toBe(400);
      }
    });
  });

  describe("the store's signed addresses", () => {
    it("refuse a tampered, wrong-purpose, expired or traversing address", async () => {
      const { weddingId, owner } = await setup();
      const ticket = (
        await requestUpload(weddingId, owner, {
          fileName: "a.jpg",
          mimeType: "image/jpeg",
          sizeBytes: 100,
        })
      ).json.data;
      const tampered = ticket.uploadUrl.replace(/sig=[^&]+/, "sig=AAAA");
      expect(await putToStore(tampered, jpegBytes())).toBe(403);
      const extended = ticket.uploadUrl.replace(
        /exp=\d+/,
        `exp=${Math.floor(Date.now() / 1000) + 99999}`,
      );
      expect(await putToStore(extended, jpegBytes())).toBe(403);
      const expired = ticket.uploadUrl.replace(
        /exp=\d+/,
        `exp=${Math.floor(Date.now() / 1000) - 5}`,
      );
      expect(await putToStore(expired, jpegBytes())).toBe(403);
      // A viewing address cannot be used to upload.
      const photo = await uploadPhoto(weddingId, owner);
      expect(await putToStore(photo.url, jpegBytes())).toBe(403);
      // An upload address cannot be used to read.
      expect((await getFromStore(ticket.uploadUrl)).status).toBe(403);
      // Too large.
      expect(await putToStore(ticket.uploadUrl, jpegBytes(MAX_PHOTO_BYTES + 10))).toBe(413);
      // And the real one still works.
      expect(await putToStore(ticket.uploadUrl, jpegBytes())).toBe(200);
    });

    it("never serve a key that is not one we made", async () => {
      const bad =
        "http://localhost:3000/api/v1/storage/local/..%2F..%2Fsecret.txt?op=get&exp=9999999999&sig=x";
      const result = await getFromStore(bad);
      expect([403, 404]).toContain(result.status);
    });
  });

  it("counts toward the wedding's storage, and stops at the allowance", async () => {
    const { weddingId, owner, member } = await setup();
    await uploadPhoto(weddingId, owner, { bytes: jpegBytes(3000) });
    const settings = await getGallery(weddingId, member);
    expect(settings.json.data.usage).toMatchObject({ usedBytes: 3000, photoCount: 1 });

    // Announcements hold their space, so 136 x 15 MB fits and the next one does not.
    const request = () =>
      requestUpload(weddingId, owner, {
        fileName: "big.jpg",
        mimeType: "image/jpeg",
        sizeBytes: MAX_PHOTO_BYTES,
      });
    for (let i = 0; i < 136; i += 1) expect((await request()).status).toBe(200);
    const full = await request();
    expect(full.status).toBe(422);
    expect(full.json.error.message).toContain("photo storage is full (2 GB)");
    expect(full.json.error.details).toEqual({ code: "STORAGE_FULL" });
  });

  it("frees space when a photo is deleted", async () => {
    const { weddingId, owner } = await setup();
    const photo = await uploadPhoto(weddingId, owner, { bytes: jpegBytes(5000) });
    expect((await getGallery(weddingId, owner)).json.data.usage.usedBytes).toBe(5000);
    await removeAsset(weddingId, photo.id, owner);
    expect((await getGallery(weddingId, owner)).json.data.usage).toMatchObject({
      usedBytes: 0,
      photoCount: 0,
    });
  });
});

describe("browsing photos", () => {
  it("lists newest first, pages by cursor and never repeats a photo", async () => {
    const { weddingId, owner, member } = await setup();
    const ids: string[] = [];
    for (let i = 0; i < 5; i += 1) ids.push((await uploadPhoto(weddingId, owner)).id);
    const seen: string[] = [];
    let cursor = "";
    for (let page = 0; page < 5; page += 1) {
      const result = await listAssets(weddingId, member, `?limit=2${cursor}`);
      expect(result.status).toBe(200);
      seen.push(...result.json.data.map((p: any) => p.id));
      if (!result.json.meta.hasMore) break;
      cursor = `&cursor=${result.json.meta.nextCursor}`;
    }
    expect(seen).toEqual([...ids].reverse());
  });

  it("filters by album, by 'no album' and by favourites", async () => {
    const { weddingId, owner } = await setup();
    const album = await makeAlbum(weddingId, owner);
    const inAlbum = await uploadPhoto(weddingId, owner, { albumId: album.id });
    const loose = await uploadPhoto(weddingId, owner);
    await patchAsset(weddingId, loose.id, owner, { version: loose.version, isFavorite: true });

    const idsOf = async (query: string) =>
      ((await listAssets(weddingId, owner, query)).json.data as any[]).map((p) => p.id);
    expect((await idsOf("")).sort()).toEqual([inAlbum.id, loose.id].sort());
    expect(await idsOf(`?albumId=${album.id}`)).toEqual([inAlbum.id]);
    expect(await idsOf("?albumId=root")).toEqual([loose.id]);
    expect(await idsOf("?favorite=true")).toEqual([loose.id]);
  });

  it("shows members only the active photos, and the approval queue only to owners and admins", async () => {
    const { weddingId, owner, admin, member } = await setup();
    await uploadPhoto(weddingId, owner);
    expect((await listAssets(weddingId, member, "?status=pending_review")).status).toBe(403);
    expect((await listAssets(weddingId, member, "?status=rejected")).status).toBe(403);
    expect((await listAssets(weddingId, admin, "?status=pending_review")).status).toBe(200);
    expect((await listAssets(weddingId, owner, "?status=pending_upload")).status).toBe(400);
  });

  it("rejects unknown filters and bad cursors", async () => {
    const { weddingId, owner } = await setup();
    for (const query of [
      "?size=big",
      "?limit=0",
      "?limit=101",
      "?cursor=nonsense",
      "?albumId=xyz",
      "?favorite=false",
    ]) {
      expect((await listAssets(weddingId, owner, query)).status, query).toBe(400);
    }
  });

  it("includes who uploaded each photo for the team", async () => {
    const { weddingId, member } = await setup();
    await uploadPhoto(weddingId, member);
    const [photo] = (await listAssets(weddingId, member)).json.data as any[];
    expect(photo.uploadedBy.kind).toBe("member");
    expect(photo.uploadedBy.name).toEqual(expect.any(String));
  });

  it("never shows another wedding's photos", async () => {
    const { weddingId, owner } = await setup();
    await uploadPhoto(weddingId, owner);
    const stranger = await setupWedding();
    expect((await listAssets(stranger.weddingId, stranger.owner)).json.data).toEqual([]);
    expect((await listAssets(weddingId, stranger.owner)).status).toBe(403);
  });
});

describe("editing and deleting photos", () => {
  it("lets any role caption, favourite, move and change who can see a photo", async () => {
    const { weddingId, owner, member } = await setup();
    const album = await makeAlbum(weddingId, owner);
    const photo = await uploadPhoto(weddingId, owner);
    const edited = await patchAsset(weddingId, photo.id, member, {
      version: photo.version,
      caption: "Mama applying haldi",
      visibility: "guests",
      albumId: album.id,
      isFavorite: true,
    });
    expect(edited.status).toBe(200);
    expect(edited.json.data).toMatchObject({
      caption: "Mama applying haldi",
      visibility: "guests",
      albumId: album.id,
      isFavorite: true,
    });
    const cleared = await patchAsset(weddingId, photo.id, owner, {
      version: edited.json.data.version,
      caption: null,
      albumId: null,
    });
    expect(cleared.json.data).toMatchObject({ caption: null, albumId: null });
  });

  it("rejects a stale version, bad values, unknown keys and a stranger's album", async () => {
    const { weddingId, owner } = await setup();
    const photo = await uploadPhoto(weddingId, owner);
    await patchAsset(weddingId, photo.id, owner, { version: photo.version, caption: "First" });
    expect(
      (await patchAsset(weddingId, photo.id, owner, { version: photo.version, caption: "Late" }))
        .status,
    ).toBe(409);
    for (const body of [
      { version: 1, caption: "x".repeat(301) },
      { version: 1, visibility: "everyone" },
      { version: 1, status: "active" },
      { version: 1, objectKey: "weddings/x" },
      { version: 1 },
    ]) {
      expect(
        (await patchAsset(weddingId, photo.id, owner, body)).status,
        JSON.stringify(body),
      ).toBe(400);
    }
    const stranger = await setupWedding();
    const foreign = await makeAlbum(stranger.weddingId, stranger.owner);
    expect(
      (await patchAsset(weddingId, photo.id, owner, { version: 1, albumId: foreign.id })).status,
    ).toBe(404);
  });

  it("lets a member delete only their own photos, and an owner or admin any, removing the file", async () => {
    const { weddingId, owner, admin, member } = await setup();
    const other = await addMember(weddingId);
    const mine = await uploadPhoto(weddingId, member);
    const denied = await removeAsset(weddingId, mine.id, other);
    expect(denied.status).toBe(403);
    expect(denied.json.error.code).toBe("INSUFFICIENT_ROLE");
    const seen = ((await listAssets(weddingId, other)).json.data as any[])[0];
    expect(seen.canDelete).toBe(false);

    expect((await removeAsset(weddingId, mine.id, member)).status).toBe(200);
    expect((await getFromStore(mine.url)).status).toBe(404); // the file is gone too
    const theirs = await uploadPhoto(weddingId, owner);
    expect((await removeAsset(weddingId, theirs.id, admin)).status).toBe(200);
    expect((await removeAsset(weddingId, theirs.id, admin)).status).toBe(404);
    expect((await listAssets(weddingId, owner)).json.data).toEqual([]);
  });

  it("is no longer the cover once deleted", async () => {
    const { weddingId, owner } = await setup();
    const photo = await uploadPhoto(weddingId, owner);
    await patchGallery(weddingId, owner, { version: 0, coverAssetId: photo.id });
    await removeAsset(weddingId, photo.id, owner);
    expect((await getGallery(weddingId, owner)).json.data.gallery).toMatchObject({
      coverAssetId: null,
      coverUrl: null,
    });
  });

  it("answers 404 for another wedding's photo", async () => {
    const { weddingId, owner } = await setup();
    const photo = await uploadPhoto(weddingId, owner);
    const stranger = await setupWedding();
    expect((await removeAsset(stranger.weddingId, photo.id, stranger.owner)).status).toBe(404);
    expect(
      (await patchAsset(stranger.weddingId, photo.id, stranger.owner, { version: 0, caption: "x" }))
        .status,
    ).toBe(404);
  });
});
