/* eslint-disable @typescript-eslint/no-explicit-any -- response bodies are asserted on */
import { beforeEach, describe, expect, it } from "vitest";
import { resolveSession } from "@/modules/auth/session.service";
import { getWebsitePage } from "@/modules/dashboard/workspace-pages.service";
import { clearCollections, setupTestDatabase } from "../../setup/database";
import { addMember, setupWedding } from "../../setup/wedding";
import {
  describeWedding,
  getWebsite,
  makeWebsite,
  patchWebsite,
  publicSite,
  publish,
} from "../experience/helpers";
import {
  getFromStore,
  guestUploadPhoto,
  listAssets,
  makeToken,
  patchAsset,
  patchGallery,
  getGallery,
  removeAsset,
  uploadPhoto,
  withTempPhotoStore,
} from "./helpers";

// Phase 6 step 6.4: the website's cover photo. Only a PUBLIC gallery photo may be the cover (a
// private photo must never reach the public site), and the rule is checked again every time the
// page is drawn, so a photo made private later simply stops being shown.

setupTestDatabase();
withTempPhotoStore();
beforeEach(clearCollections);

async function setup() {
  const wedding = await setupWedding("Aarav & Diya's Wedding");
  await describeWedding(wedding.weddingId, wedding.owner);
  const site = await makeWebsite(wedding.weddingId, wedding.owner);
  return { ...wedding, site };
}

async function photo(
  weddingId: string,
  who: any,
  visibility: "private" | "guests" | "public" = "public",
) {
  const uploaded = await uploadPhoto(weddingId, who);
  if (visibility === "private") return uploaded;
  const changed = await patchAsset(weddingId, uploaded.id, who, {
    version: uploaded.version,
    visibility,
  });
  if (changed.status !== 200) throw new Error(JSON.stringify(changed.json));
  return changed.json.data as Record<string, any>;
}

const setCover = (weddingId: string, who: any, version: number, heroAssetId: string | null) =>
  patchWebsite(weddingId, who, { version, heroAssetId });

describe("listing photos by who can see them", () => {
  it("returns only Public photos when asked, for the cover picker", async () => {
    const { weddingId, owner } = await setup();
    await photo(weddingId, owner, "private");
    await photo(weddingId, owner, "guests");
    const publicOne = await photo(weddingId, owner, "public");

    const result = await listAssets(weddingId, owner, "?visibility=public");
    expect(result.status).toBe(200);
    expect((result.json.data as any[]).map((item) => item.id)).toEqual([publicOne.id]);
  });

  it("rejects a visibility it does not know", async () => {
    const { weddingId, owner } = await setup();
    expect((await listAssets(weddingId, owner, "?visibility=everyone")).status).toBe(400);
  });
});

describe("choosing the cover", () => {
  it("accepts a Public photo and says so in the saved site", async () => {
    const { weddingId, owner, site } = await setup();
    const cover = await photo(weddingId, owner);
    const saved = await setCover(weddingId, owner, site.version, cover.id);
    expect(saved.status).toBe(200);
    expect(saved.json.data.heroAssetId).toBe(cover.id);
  });

  it("refuses a photo that is not Public (422), so a private photo can't be put on the site", async () => {
    const { weddingId, owner, site } = await setup();
    for (const visibility of ["private", "guests"] as const) {
      const hidden = await photo(weddingId, owner, visibility);
      const result = await setCover(weddingId, owner, site.version, hidden.id);
      expect(result.status).toBe(422);
      expect(result.json.error.code).toBe("BUSINESS_RULE_VIOLATION");
      expect(result.json.error.message).toMatch(/Public/);
    }
    const unchanged = (await getWebsiteData(weddingId, owner)).heroAssetId;
    expect(unchanged).toBeNull();
  });

  it("answers 404 for another wedding's photo, a missing one and a guest photo awaiting approval", async () => {
    const { weddingId, owner, site } = await setup();
    const other = await setupWedding("Another Wedding");
    const theirs = await photo(other.weddingId, other.owner);
    expect((await setCover(weddingId, owner, site.version, theirs.id)).status).toBe(404);
    expect((await setCover(weddingId, owner, site.version, "a".repeat(24))).status).toBe(404);

    // A guest's photo that still waits for approval is not usable, even though it exists.
    const current = (await getGallery(weddingId, owner)).json.data.gallery;
    await patchGallery(weddingId, owner, {
      version: current.version,
      allowGuestUploads: true,
      requireUploadApproval: true,
    });
    const link = await makeToken(weddingId, owner, {
      permissions: { canView: true, canUpload: true, canDownload: false },
    });
    const { ticket } = await guestUploadPhoto(link.token);
    expect((await setCover(weddingId, owner, site.version, ticket.assetId)).status).toBe(404);
  });

  it("can be removed again with null", async () => {
    const { weddingId, owner, site } = await setup();
    const cover = await photo(weddingId, owner);
    const set = await setCover(weddingId, owner, site.version, cover.id);
    const cleared = await setCover(weddingId, owner, set.json.data.version, null);
    expect(cleared.status).toBe(200);
    expect(cleared.json.data.heroAssetId).toBeNull();
  });

  it("is for owners and admins, like the rest of the website", async () => {
    const { weddingId, owner, site } = await setup();
    const member = await addMember(weddingId);
    const cover = await photo(weddingId, owner);
    expect((await setCover(weddingId, member, site.version, cover.id)).status).toBe(403);
  });

  it("rejects an id that isn't an id", async () => {
    const { weddingId, owner, site } = await setup();
    expect((await setCover(weddingId, owner, site.version, "nope")).status).toBe(400);
  });
});

async function getWebsiteData(weddingId: string, who: any) {
  return (await getWebsite(weddingId, who)).json.data as Record<string, any>;
}

describe("the public site", () => {
  async function published() {
    const ctx = await setup();
    const cover = await photo(ctx.weddingId, ctx.owner);
    const saved = await setCover(ctx.weddingId, ctx.owner, ctx.site.version, cover.id);
    expect((await publish(ctx.weddingId, ctx.owner)).status).toBe(200);
    return { ...ctx, cover, version: saved.json.data.version as number };
  }

  it("shows the cover through a signed address that really serves the photo", async () => {
    const { site, cover } = await published();
    const result = await publicSite(site.slug);
    expect(result.status).toBe(200);
    const url = result.json.data.heroImageUrl as string;
    expect(url).toMatch(/^https?:\/\//);
    const served = await getFromStore(url);
    expect(served.status).toBe(200);
    expect(served.bytes.length).toBeGreaterThan(0);
    // The address is the only trace. Its path holds the storage key (ids are never secrets, and the
    // address is signed and short-lived), so look at everything else.
    const text = JSON.stringify({ ...result.json.data, heroImageUrl: null });
    expect(text).not.toContain(cover.id);
    expect(text).not.toContain(cover.fileName);
    expect(text).not.toContain("heroAssetId");
  });

  it("has no cover until one is chosen", async () => {
    const { site, weddingId, owner } = await setup();
    await publish(weddingId, owner);
    expect((await publicSite(site.slug)).json.data.heroImageUrl).toBeNull();
  });

  it("drops the cover the moment its photo stops being Public", async () => {
    const { site, weddingId, owner, cover } = await published();
    const fresh = (await listAssets(weddingId, owner, "?visibility=public")).json.data[0];
    expect(fresh.id).toBe(cover.id);
    await patchAsset(weddingId, cover.id, owner, { version: fresh.version, visibility: "private" });
    expect((await publicSite(site.slug)).json.data.heroImageUrl).toBeNull();
  });

  it("drops the cover when its photo is deleted", async () => {
    const { site, weddingId, owner, cover } = await published();
    expect((await removeAsset(weddingId, cover.id, owner)).status).toBe(200);
    expect((await publicSite(site.slug)).json.data.heroImageUrl).toBeNull();
  });

  it("tells the editor the cover is gone, rather than showing a broken picture", async () => {
    const { weddingId, owner, cover } = await published();
    const auth = await resolveSession(owner.cookie.split("=")[1]);
    const before = await getWebsitePage(auth!);
    expect(before && !before.forbidden && before.data.hero?.assetId).toBe(cover.id);

    await removeAsset(weddingId, cover.id, owner);
    const after = await getWebsitePage(auth!);
    expect(after && !after.forbidden && after.data.hero).toBeNull();
    // The saved site still remembers which photo it meant (the editor words it as unavailable).
    expect(after && !after.forbidden && after.data.website?.heroAssetId).toBe(cover.id);
  });
});
