import { beforeEach, describe, expect, it } from "vitest";
import { resolveSession } from "@/modules/auth/session.service";
import { getGalleryPage } from "@/modules/dashboard/workspace-pages.service";
import { clearCollections, setupTestDatabase } from "../../setup/database";
import { addMember, setupWedding } from "../../setup/wedding";
import { describeWedding } from "../experience/helpers";
import { makeAlbum, makeToken, uploadPhoto, withTempPhotoStore } from "../gallery/helpers";

setupTestDatabase();
withTempPhotoStore();
beforeEach(clearCollections);

async function authFor(cookie: string) {
  const auth = await resolveSession(cookie.split("=")[1]);
  if (!auth) throw new Error("no session");
  return auth;
}

describe("getGalleryPage", () => {
  it("gives an owner the albums, usage, links and the couple's details", async () => {
    const { weddingId, owner } = await setupWedding("Aarav & Diya's Wedding");
    await describeWedding(weddingId, owner);
    const album = await makeAlbum(weddingId, owner, { title: "Haldi" });
    await uploadPhoto(weddingId, owner, { albumId: album.id });
    await makeToken(weddingId, owner, { label: "Reception QR" });

    const page = await getGalleryPage(await authFor(owner.cookie));
    expect(page).toMatchObject({
      weddingId,
      canManage: true,
      coupleNames: "Aarav & Diya",
      timezone: "Asia/Kolkata",
    });
    expect(page?.dateLabel).toBe("14 February 2027");
    expect(page?.albums.map((item) => [item.title, item.photoCount])).toEqual([["Haldi", 1]]);
    expect(page?.settings.usage.photoCount).toBe(1);
    expect(page?.settings.storage).toEqual({ configured: true, kind: "local" });
    expect(page?.links.map((link) => link.label)).toEqual(["Reception QR"]);
    // A link can be shown again (the same QR code), so its address is in the page data for admins.
    expect(page?.links[0]?.shareUrl).toMatch(/\/gallery\//);
  });

  it("gives a member the gallery but neither the shared links nor the approval powers", async () => {
    const { weddingId, owner } = await setupWedding();
    await makeToken(weddingId, owner, { label: "Family group" });
    const member = await addMember(weddingId);

    const page = await getGalleryPage(await authFor(member.cookie));
    expect(page?.canManage).toBe(false);
    expect(page?.links).toEqual([]);
    expect(JSON.stringify(page)).not.toContain("/gallery/");
  });

  it("answers null for someone with no wedding", async () => {
    const { signUpUser } = await import("../../setup/auth");
    const user = await signUpUser();
    expect(await getGalleryPage(await authFor(user.cookie))).toBeNull();
  });
});
