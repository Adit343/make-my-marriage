import { beforeEach, describe, expect, it } from "vitest";
import { resolveSession } from "@/modules/auth/session.service";
import {
  getLiveStreamsPage,
  getWebsitePage,
  getWebsitePreviewPage,
} from "@/modules/dashboard/workspace-pages.service";
import { clearCollections, setupTestDatabase } from "../../setup/database";
import { addMember, setupWedding } from "../../setup/wedding";
import {
  createEvent,
  describeWedding,
  makeStream,
  makeWebsite,
  patchWebsite,
  publish,
} from "../experience/helpers";

setupTestDatabase();
beforeEach(clearCollections);

async function authFor(cookie: string) {
  const auth = await resolveSession(cookie.split("=")[1]);
  if (!auth) throw new Error("no session");
  return auth;
}

describe("getWebsitePage", () => {
  it("is empty before the site is set up, with the couple and events ready for the editor", async () => {
    const { weddingId, owner } = await setupWedding();
    await describeWedding(weddingId, owner);
    await createEvent(weddingId, owner, { name: "Haldi", isPublic: true });
    await createEvent(weddingId, owner, { name: "Family dinner", isPublic: false });

    const page = (await getWebsitePage(await authFor(owner.cookie)))!;
    expect(page.forbidden).toBe(false);
    if (page.forbidden) return;
    expect(page.data.website).toBeNull();
    expect(page.data.context).toMatchObject({ coupleNames: "Aarav & Diya", initials: "A & D" });
    expect(page.data.events.map((e) => [e.name, e.isPublic])).toEqual([
      ["Haldi", true],
      ["Family dinner", false],
    ]);
    // Only public events are formatted for the preview.
    expect(page.data.pool.map((e) => e.name)).toEqual(["Haldi"]);
    expect(page.data.addressPrefix).toBe("localhost:3000/w/");
    expect(page.data.origin).toBe("http://localhost:3000");
  });

  it("carries the saved site once it exists", async () => {
    const { weddingId, owner } = await setupWedding();
    await describeWedding(weddingId, owner);
    const site = await makeWebsite(weddingId, owner);
    const page = (await getWebsitePage(await authFor(owner.cookie)))!;
    if (page.forbidden) throw new Error("unexpected");
    expect(page.data.website).toMatchObject({ id: site.id, slug: site.slug, status: "draft" });
  });

  it("tells a member the page is for owners and admins, and lets an admin in", async () => {
    const { weddingId } = await setupWedding();
    const member = await addMember(weddingId);
    const admin = await addMember(weddingId, "admin");
    expect((await getWebsitePage(await authFor(member.cookie)))!.forbidden).toBe(true);
    expect((await getWebsitePage(await authFor(admin.cookie)))!.forbidden).toBe(false);
  });

  it("is null for someone with no wedding", async () => {
    const { signUpUser } = await import("../../setup/auth");
    const { cookie } = await signUpUser();
    expect(await getWebsitePage(await authFor(cookie))).toBeNull();
  });
});

describe("getWebsitePreviewPage", () => {
  it("shows the saved draft as guests would see it, before it is published", async () => {
    const { weddingId, owner } = await setupWedding();
    await describeWedding(weddingId, owner);
    await createEvent(weddingId, owner, { name: "Haldi", isPublic: true });
    const site = await makeWebsite(weddingId, owner);
    await patchWebsite(weddingId, owner, { version: site.version, tagline: "Together" });

    const page = await getWebsitePreviewPage(await authFor(owner.cookie));
    if (typeof page === "string" || page === null) throw new Error(`unexpected: ${page}`);
    expect(page.view).toMatchObject({ title: "Aarav & Diya", tagline: "Together" });
    expect(page.view.events.map((e) => e.name)).toEqual(["Haldi"]);
  });

  it("says 'none' with no site, and 'forbidden' for a member", async () => {
    const { weddingId, owner } = await setupWedding();
    expect(await getWebsitePreviewPage(await authFor(owner.cookie))).toBe("none");
    const member = await addMember(weddingId);
    expect(await getWebsitePreviewPage(await authFor(member.cookie))).toBe("forbidden");
  });
});

describe("getLiveStreamsPage", () => {
  it("gives every role the streams with their links, and the events to link them to", async () => {
    const { weddingId, owner } = await setupWedding();
    const eventId = await createEvent(weddingId, owner, { name: "Reception" });
    await createEvent(weddingId, owner, { name: "Haldi", startsAt: "2027-02-13T04:30:00Z" });
    const stream = await makeStream(weddingId, owner, { eventId });
    const member = await addMember(weddingId);

    for (const who of [owner, member]) {
      const page = (await getLiveStreamsPage(await authFor(who.cookie)))!;
      expect(page.timezone).toBe("Asia/Kolkata");
      expect(page.streams).toHaveLength(1);
      expect(page.streams[0]).toMatchObject({
        id: stream.id,
        eventName: "Reception",
        inviteUrl: stream.inviteUrl,
      });
      expect(page.events.map((e) => e.name).sort()).toEqual(["Haldi", "Reception"]);
    }
  });

  it("is null for someone with no wedding, and never shows another wedding's streams", async () => {
    const { signUpUser } = await import("../../setup/auth");
    const { cookie } = await signUpUser();
    expect(await getLiveStreamsPage(await authFor(cookie))).toBeNull();

    const one = await setupWedding();
    await makeStream(one.weddingId, one.owner);
    const two = await setupWedding();
    const page = (await getLiveStreamsPage(await authFor(two.owner.cookie)))!;
    expect(page.streams).toEqual([]);
  });
});

describe("published sites feed the preview the same as the public page", () => {
  it("builds identical views for the preview and the public address", async () => {
    const { weddingId, owner } = await setupWedding();
    await describeWedding(weddingId, owner);
    await createEvent(weddingId, owner, { name: "Haldi", isPublic: true });
    const site = await makeWebsite(weddingId, owner);
    await publish(weddingId, owner);

    const { getPublicWebsite } = await import("@/modules/website/website.service");
    const preview = await getWebsitePreviewPage(await authFor(owner.cookie));
    if (typeof preview === "string" || preview === null) throw new Error("unexpected");
    expect(await getPublicWebsite(site.slug)).toEqual(preview.view);
  });
});
