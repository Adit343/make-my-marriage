import { existsSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { DELETE as deleteWedding } from "@/app/api/v1/weddings/[weddingId]/route";
import { DELETE as deleteAccount } from "@/app/api/v1/users/me/route";
import { WEDDING_PURGE_GRACE_DAYS } from "@/lib/constants/retention";
import { anonymizeDeletedUsers, purgeWeddings } from "@/modules/maintenance/maintenance.service";
import { Event } from "@/models/event.model";
import { GalleryAsset } from "@/models/galleryAsset.model";
import { Session } from "@/models/session.model";
import { User } from "@/models/user.model";
import { Wedding } from "@/models/wedding.model";
import { WeddingMember } from "@/models/weddingMember.model";
import { clearCollections, setupTestDatabase } from "../../setup/database";
import { signUpUser } from "../../setup/auth";
import { call } from "../../setup/http";
import { addMember, setupWedding } from "../../setup/wedding";
import { uploadPhoto, withTempPhotoStore } from "../gallery/helpers";
import { createEvent } from "../invitations/helpers-events";

setupTestDatabase();
const storeDir = withTempPhotoStore();
beforeEach(clearCollections);

const DAY = 24 * 60 * 60 * 1000;
const afterGrace = () => new Date(Date.now() + (WEDDING_PURGE_GRACE_DAYS + 1) * DAY);

async function weddingWithPhoto() {
  const { weddingId, owner, title } = await setupWedding("Priya & Rohan");
  await addMember(weddingId, "member");
  await createEvent(weddingId, owner, { name: "Haldi" });
  const photo = await uploadPhoto(weddingId, owner);
  return { weddingId, owner, title, photoId: photo.id as string };
}

async function remove(weddingId: string, owner: { cookie: string }, title: string) {
  const result = await call(deleteWedding, {
    method: "DELETE",
    cookie: owner.cookie,
    params: { weddingId },
    body: { confirm: title },
  });
  expect(result.status).toBe(200);
}

function filesInStore(): number {
  const root = path.join(storeDir(), "weddings");
  return existsSync(root) ? 1 : 0;
}

describe("purgeWeddings", () => {
  it("leaves a wedding alone while it is inside its grace period", async () => {
    const { weddingId, owner, title } = await weddingWithPhoto();
    await remove(weddingId, owner, title);
    const results = await purgeWeddings({ apply: true });
    expect(results).toEqual([]);
    expect(await Wedding.countDocuments({ _id: weddingId }).setOptions({ withDeleted: true })).toBe(
      1,
    );
  });

  it("never touches a live wedding, however old", async () => {
    const { weddingId } = await weddingWithPhoto();
    const results = await purgeWeddings({ apply: true, now: afterGrace() });
    expect(results).toEqual([]);
    expect(await Wedding.countDocuments({ _id: weddingId })).toBe(1);
  });

  it("a dry run reports what it would delete and deletes nothing", async () => {
    const { weddingId, owner, title } = await weddingWithPhoto();
    await remove(weddingId, owner, title);
    const results = await purgeWeddings({ apply: false, now: afterGrace() });
    expect(results).toHaveLength(1);
    expect(results[0]!.rows).toMatchObject({
      galleryAssets: 1,
      events: 1,
      weddingMembers: 2,
    });
    expect(await GalleryAsset.countDocuments({ weddingId }).setOptions({ withDeleted: true })).toBe(
      1,
    );
  });

  it("deletes the files, every row and the wedding, and only that wedding", async () => {
    const mine = await weddingWithPhoto();
    const other = await weddingWithPhoto();
    await remove(mine.weddingId, mine.owner, mine.title);

    const results = await purgeWeddings({ apply: true, now: afterGrace() });
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ weddingId: mine.weddingId, filesRemoved: 1 });
    expect(results[0]!.error).toBeUndefined();

    const q = { weddingId: mine.weddingId };
    expect(
      await Wedding.countDocuments({ _id: mine.weddingId }).setOptions({ withDeleted: true }),
    ).toBe(0);
    expect(await GalleryAsset.countDocuments(q).setOptions({ withDeleted: true })).toBe(0);
    expect(await Event.countDocuments(q).setOptions({ withDeleted: true })).toBe(0);
    expect(await WeddingMember.countDocuments(q).setOptions({ withDeleted: true })).toBe(0);

    // The other wedding, its photo and its people are untouched.
    expect(await Wedding.countDocuments({ _id: other.weddingId })).toBe(1);
    expect(await GalleryAsset.countDocuments({ weddingId: other.weddingId })).toBe(1);
    expect(await WeddingMember.countDocuments({ weddingId: other.weddingId })).toBe(2);
    expect(filesInStore()).toBe(1);

    // Running it again finds nothing: it is safe to repeat.
    expect(await purgeWeddings({ apply: true, now: afterGrace() })).toEqual([]);
  });

  it("keeps the rows and reports the wedding when a file cannot be removed", async () => {
    const { weddingId, owner, title } = await weddingWithPhoto();
    await remove(weddingId, owner, title);
    const { setStorageForTests } = await import("@/infrastructure/storage");
    setStorageForTests({
      name: "local",
      createUploadUrl: async () => "",
      createDownloadUrl: async () => "",
      head: async () => null,
      readStart: async () => null,
      remove: async () => {
        throw new Error("store unavailable");
      },
    });
    try {
      const results = await purgeWeddings({ apply: true, now: afterGrace() });
      expect(results[0]!.error).toBe("store unavailable");
      expect(
        await Wedding.countDocuments({ _id: weddingId }).setOptions({ withDeleted: true }),
      ).toBe(1);
      expect(
        await GalleryAsset.countDocuments({ weddingId }).setOptions({ withDeleted: true }),
      ).toBe(1);
    } finally {
      setStorageForTests(null);
    }
    // Once the store works again, the same run finishes the job.
    const retry = await purgeWeddings({ apply: true, now: afterGrace() });
    expect(retry[0]!.error).toBeUndefined();
    expect(await Wedding.countDocuments({ _id: weddingId }).setOptions({ withDeleted: true })).toBe(
      0,
    );
  });
});

describe("anonymizeDeletedUsers", () => {
  async function deletedAccount() {
    const { cookie, email, user } = await signUpUser();
    const result = await call(deleteAccount, { method: "DELETE", cookie });
    expect(result.status).toBe(200);
    return { email, id: user.id as string };
  }

  it("waits out the grace period", async () => {
    await deletedAccount();
    const result = await anonymizeDeletedUsers({ apply: true });
    expect(result).toEqual({ userIds: [], anonymized: 0 });
  });

  it("a dry run lists accounts without changing them", async () => {
    const { id, email } = await deletedAccount();
    const result = await anonymizeDeletedUsers({ apply: false, now: afterGrace() });
    expect(result.userIds).toEqual([id]);
    const stored = await User.findOne({ _id: id }).setOptions({ withDeleted: true }).lean();
    expect(stored?.emailNormalized).toBe(email);
  });

  it("strips personal data, keeps the row, frees the email and is safe to repeat", async () => {
    const { id, email } = await deletedAccount();
    const live = await signUpUser();

    const result = await anonymizeDeletedUsers({ apply: true, now: afterGrace() });
    expect(result).toEqual({ userIds: [id], anonymized: 1 });

    const stored = await User.findOne({ _id: id })
      .setOptions({ withDeleted: true })
      .select("+passwordAuth")
      .lean();
    expect(stored).toMatchObject({
      email: `deleted+${id}@invalid`,
      emailNormalized: `deleted+${id}@invalid`,
      name: "Deleted user",
      passwordAuth: null,
      authProviders: [],
      status: "pending_deletion",
    });
    expect(JSON.stringify(stored)).not.toContain(email);
    expect(await Session.countDocuments({ userId: id })).toBe(0);

    // The old address can be registered again; a live account was never touched.
    expect((await signUpUser(email)).user.email).toBe(email);
    expect(await User.countDocuments({ _id: live.user.id, status: "active" })).toBe(1);

    expect(await anonymizeDeletedUsers({ apply: true, now: afterGrace() })).toEqual({
      userIds: [],
      anonymized: 0,
    });
  });
});
