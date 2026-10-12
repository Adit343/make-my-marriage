import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { Gallery } from "@/models/gallery.model";
import { GalleryAccessToken } from "@/models/galleryAccessToken.model";
import { GalleryAlbum } from "@/models/galleryAlbum.model";
import { GalleryAsset } from "@/models/galleryAsset.model";
import { setupTestDatabase } from "../../setup/database";

setupTestDatabase();

const createdBy = new Types.ObjectId();
const oid = () => new Types.ObjectId();

const asset = (overrides: Record<string, unknown> = {}) => {
  const _id = oid();
  const weddingId = oid();
  return {
    _id,
    weddingId,
    galleryId: oid(),
    uploadedBy: { kind: "member" as const, userId: createdBy },
    objectKey: `weddings/${weddingId}/gallery/${_id}/${"a".repeat(20)}${Math.floor(Math.random() * 1e4)}.jpg`,
    fileName: "IMG_1.jpg",
    mimeType: "image/jpeg",
    sizeBytes: 2048,
    ...overrides,
  };
};

describe("Gallery", () => {
  it("starts with guest uploads off and approval on, and holds one per wedding", async () => {
    const weddingId = oid();
    const gallery = await Gallery.create({ weddingId, title: "Photos", createdBy });
    expect(gallery).toMatchObject({
      allowGuestUploads: false,
      requireUploadApproval: true,
      coverAssetId: null,
      deletedAt: null,
    });
    await expect(Gallery.create({ weddingId, title: "Again", createdBy })).rejects.toMatchObject({
      code: 11000,
    });
    await Gallery.updateOne({ _id: gallery._id }, { $set: { deletedAt: new Date() } });
    await expect(Gallery.create({ weddingId, title: "Fresh", createdBy })).resolves.toBeTruthy();
  });

  it("limits its texts", async () => {
    await expect(
      Gallery.create({ weddingId: oid(), title: "x".repeat(121), createdBy }),
    ).rejects.toThrow();
    await expect(
      Gallery.create({ weddingId: oid(), title: "ok", description: "x".repeat(1001), createdBy }),
    ).rejects.toThrow();
  });
});

describe("GalleryAlbum", () => {
  it("starts private, unlinked and soft-deletable", async () => {
    const album = await GalleryAlbum.create({
      weddingId: oid(),
      galleryId: oid(),
      title: "Haldi",
      createdBy,
    });
    expect(album).toMatchObject({
      defaultVisibility: "private",
      eventId: null,
      coverAssetId: null,
      deletedAt: null,
    });
    await expect(
      GalleryAlbum.create({
        weddingId: oid(),
        galleryId: oid(),
        title: "x",
        defaultVisibility: "everyone" as never,
        createdBy,
      }),
    ).rejects.toThrow();
    await expect(
      GalleryAlbum.create({
        weddingId: oid(),
        galleryId: oid(),
        title: "x".repeat(101),
        createdBy,
      }),
    ).rejects.toThrow();
  });
});

describe("GalleryAsset", () => {
  it("starts as a private, unfavourited upload still to be confirmed", async () => {
    const created = await GalleryAsset.create(asset());
    expect(created).toMatchObject({
      status: "pending_upload",
      visibility: "private",
      mediaType: "image",
      isFavorite: false,
      albumId: null,
      width: null,
      deletedAt: null,
    });
  });

  it("accepts only photos of the allowed types and sizes, with a server-made key", async () => {
    await expect(GalleryAsset.create(asset({ mimeType: "image/gif" }))).rejects.toThrow();
    await expect(GalleryAsset.create(asset({ mimeType: "video/mp4" }))).rejects.toThrow();
    await expect(GalleryAsset.create(asset({ sizeBytes: 0 }))).rejects.toThrow();
    await expect(GalleryAsset.create(asset({ sizeBytes: 15 * 1024 * 1024 + 1 }))).rejects.toThrow();
    await expect(GalleryAsset.create(asset({ sizeBytes: 10.5 }))).rejects.toThrow();
    await expect(GalleryAsset.create(asset({ objectKey: "../../etc/passwd" }))).rejects.toThrow();
    await expect(
      GalleryAsset.create(asset({ objectKey: "weddings/x/gallery/y/z.jpg" })),
    ).rejects.toThrow();
    await expect(GalleryAsset.create(asset({ visibility: "world" }))).rejects.toThrow();
    await expect(GalleryAsset.create(asset({ status: "approved" }))).rejects.toThrow();
    await expect(GalleryAsset.create(asset({ width: 0 }))).rejects.toThrow();
    await expect(GalleryAsset.create(asset({ caption: "x".repeat(301) }))).rejects.toThrow();
    await expect(
      GalleryAsset.create(asset({ uploadedBy: { kind: "stranger" } })),
    ).rejects.toThrow();
  });

  it("holds each stored file once", async () => {
    const one = asset();
    await GalleryAsset.create(one);
    await expect(
      GalleryAsset.create({ ...asset(), objectKey: one.objectKey }),
    ).rejects.toMatchObject({ code: 11000 });
  });

  it("expires unconfirmed uploads after a day, and never touches confirmed photos", async () => {
    const indexes = await GalleryAsset.collection.indexes();
    const ttl = indexes.find((index) => index.expireAfterSeconds !== undefined);
    expect(ttl).toMatchObject({
      key: { createdAt: 1 },
      expireAfterSeconds: 86400,
      partialFilterExpression: { status: "pending_upload" },
    });
  });

  it("hides deleted photos from ordinary queries", async () => {
    const live = await GalleryAsset.create(asset());
    const gone = await GalleryAsset.create({
      ...asset({ weddingId: live.weddingId }),
      status: "active",
    });
    await GalleryAsset.updateOne({ _id: gone._id }, { $set: { deletedAt: new Date() } });
    const found = await GalleryAsset.find({ weddingId: live.weddingId }).lean();
    expect(found.map((row) => row._id.toString())).toEqual([live._id.toString()]);
  });

  it("rejects a stale save (optimistic concurrency)", async () => {
    const created = await GalleryAsset.create(asset());
    const one = await GalleryAsset.findById(created._id);
    const two = await GalleryAsset.findById(created._id);
    one!.caption = "First";
    await one!.save();
    two!.caption = "Second";
    await expect(two!.save()).rejects.toThrow(/No matching document|version/i);
  });
});

describe("GalleryAccessToken", () => {
  const token = (hash: string, overrides: Record<string, unknown> = {}) => ({
    weddingId: oid(),
    galleryId: oid(),
    tokenHash: hash,
    tokenEnc: "enc",
    permissions: { canView: true, canUpload: false, canDownload: true },
    createdBy,
    ...overrides,
  });

  it("holds each link once and keeps its secrets out of normal reads", async () => {
    await GalleryAccessToken.create(token("hash-a"));
    await expect(GalleryAccessToken.create(token("hash-a"))).rejects.toMatchObject({ code: 11000 });
    const found = await GalleryAccessToken.findOne({ weddingId: { $exists: true } }).lean();
    expect(found).not.toHaveProperty("tokenHash");
    expect(found).not.toHaveProperty("tokenEnc");
    const withEnc = await GalleryAccessToken.findOne({}).select("+tokenEnc").lean();
    expect(withEnc!.tokenEnc).toBe("enc");
  });

  it("requires every permission to be decided, and limits the label", async () => {
    await expect(
      GalleryAccessToken.create(token("hash-b", { permissions: undefined })),
    ).rejects.toThrow();
    await expect(
      GalleryAccessToken.create(token("hash-c", { label: "x".repeat(81) })),
    ).rejects.toThrow();
  });

  it("is removed by the database 30 days after it is revoked or expires, not before", async () => {
    const indexes = await GalleryAccessToken.collection.indexes();
    const ttl = indexes.find((index) => index.expireAfterSeconds !== undefined);
    expect(ttl).toMatchObject({
      key: { purgeAt: 1 },
      expireAfterSeconds: 0,
      partialFilterExpression: { purgeAt: { $type: "date" } },
    });
    const row = await GalleryAccessToken.create(token("hash-d"));
    expect(row.purgeAt).toBeNull(); // an active, non-expiring link is never removed
  });
});
