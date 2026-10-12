/* eslint-disable @typescript-eslint/no-explicit-any -- response bodies are asserted on */
import { beforeEach, describe, expect, it } from "vitest";
import { clearCollections, setupTestDatabase } from "../../setup/database";
import { addMember, setupWedding } from "../../setup/wedding";
import {
  createEvent,
  deleteWedding,
  describeWedding,
  getWebsite,
  makeWebsite,
  patchEvent,
  patchWebsite,
  publicSite,
  publish,
  removeEvent,
  setUpWebsite,
  slugCheck,
  unpublish,
} from "./helpers";

setupTestDatabase();
// Every test starts from an empty database, so addresses and rate limits never leak between them.
beforeEach(clearCollections);

const sectionsOf = (site: Record<string, any>) => site.sections as any[];

/** A wedding with its couple filled in, a public event, and a draft site that shows it. */
async function setup() {
  const wedding = await setupWedding("Aarav & Diya's Wedding");
  await describeWedding(wedding.weddingId, wedding.owner);
  const eventId = await createEvent(wedding.weddingId, wedding.owner, {
    name: "Haldi Ceremony",
    isPublic: true,
    dressCode: "Yellow festive",
    description: "Family only, at home.",
    timezone: "Asia/Kolkata",
    location: { label: "Family Residence", address: { line1: "14 Bungalow Road", city: "Surat" } },
    schedule: [
      { time: "10:30", title: "Haldi begins", isPublic: true },
      { time: "09:00", title: "Makeup (private)", isPublic: false },
    ],
  });
  const site = await makeWebsite(wedding.weddingId, wedding.owner);
  return { ...wedding, eventId, site };
}

describe("setting the website up", () => {
  it("reading before it exists answers null and writes nothing", async () => {
    const { weddingId, owner } = await setupWedding();
    const first = await getWebsite(weddingId, owner);
    expect(first.status).toBe(200);
    expect(first.json.data).toBeNull();
    // A GET never creates the site (API Design §2.9): it is still not there.
    expect((await getWebsite(weddingId, owner)).json.data).toBeNull();
  });

  it("creates a private draft from the couple, with the five standard sections", async () => {
    const { site, eventId } = await setup();
    expect(site).toMatchObject({
      status: "draft",
      publishedAt: null,
      title: "Aarav & Diya",
      slug: "aarav-diya",
      display: { showVenueAddresses: false, showCountdown: true },
      theme: { templateKey: "modern_minimal", accentColor: "#1F4D3D" },
    });
    expect(sectionsOf(site).map((s) => [s.type, s.isVisible])).toEqual([
      ["story", true],
      ["schedule", true],
      ["travel", false],
      ["faq", true],
      ["contact", true],
    ]);
    // Events already marked public start out shown.
    expect(site.publicEventIds).toEqual([eventId]);
    expect(site.seo.title).toContain("Aarav & Diya");
    expect(site.seo.description).toContain("Surat");
  });

  it("refuses a second site for the same wedding", async () => {
    const { weddingId, owner } = await setup();
    const again = await setUpWebsite(weddingId, owner);
    expect(again.status).toBe(409);
    expect(again.json.error.code).toBe("CONFLICT");
  });

  it("gives two weddings with the same names different addresses", async () => {
    const one = await setupWedding();
    const two = await setupWedding();
    await describeWedding(one.weddingId, one.owner);
    await describeWedding(two.weddingId, two.owner);
    const first = await makeWebsite(one.weddingId, one.owner);
    const second = await makeWebsite(two.weddingId, two.owner);
    expect(new Set([first.slug, second.slug]).size).toBe(2);
    expect(second.slug).toMatch(/^aarav-diya(-\d+)?$/);
  });

  it("lets owners and admins set up and edit, and every member read", async () => {
    const { weddingId, owner } = await setupWedding();
    const admin = await addMember(weddingId, "admin");
    const member = await addMember(weddingId);

    expect((await setUpWebsite(weddingId, member)).status).toBe(403);
    expect((await setUpWebsite(weddingId, member)).json.error.code).toBe("INSUFFICIENT_ROLE");
    const created = await setUpWebsite(weddingId, admin);
    expect(created.status).toBe(201);

    const read = await getWebsite(weddingId, member);
    expect(read.status).toBe(200);
    expect(read.json.data.slug).toBe(created.json.data.slug);

    const edit = await patchWebsite(weddingId, member, {
      version: created.json.data.version,
      title: "Hacked",
    });
    expect(edit.status).toBe(403);
    expect(
      (await patchWebsite(weddingId, owner, { version: created.json.data.version, title: "Ok" }))
        .status,
    ).toBe(200);
  });

  it("is invisible to another wedding's members and to the signed out", async () => {
    const { weddingId } = await setup();
    const stranger = await setupWedding();
    const read = await getWebsite(weddingId, stranger.owner);
    expect(read.status).toBe(403);
    expect(read.json.error.code).toBe("NOT_A_MEMBER");
    expect((await patchWebsite(weddingId, stranger.owner, { version: 0, title: "x" })).status).toBe(
      403,
    );
    const anonymous = await getWebsite(weddingId, { cookie: "" } as never);
    expect(anonymous.status).toBe(401);
  });
});

describe("editing the website", () => {
  it("saves any subset and bumps the version", async () => {
    const { weddingId, owner, site } = await setup();
    const result = await patchWebsite(weddingId, owner, {
      version: site.version,
      tagline: "Two families, one celebration",
      welcomeMessage: "We can't wait to see you.",
      theme: { templateKey: "editorial", accentColor: "#5A3D4E" },
      display: { showVenueAddresses: true, showCountdown: false },
      seo: { title: "Aarav & Diya", description: "Join us in Surat." },
    });
    expect(result.status).toBe(200);
    expect(result.json.data).toMatchObject({
      tagline: "Two families, one celebration",
      theme: { templateKey: "editorial", accentColor: "#5A3D4E" },
      display: { showVenueAddresses: true, showCountdown: false },
      version: site.version + 1,
    });
  });

  it("rejects a stale version with 409 VERSION_CONFLICT", async () => {
    const { weddingId, owner, site } = await setup();
    await patchWebsite(weddingId, owner, { version: site.version, title: "First" });
    const stale = await patchWebsite(weddingId, owner, { version: site.version, title: "Second" });
    expect(stale.status).toBe(409);
    expect(stale.json.error.code).toBe("VERSION_CONFLICT");
    expect((await getWebsite(weddingId, owner)).json.data.title).toBe("First");
  });

  it("rejects bad input: unknown keys, an empty title, a bad colour, a long tagline", async () => {
    const { weddingId, owner, site } = await setup();
    const v = site.version;
    for (const body of [
      { version: v, status: "published" },
      { version: v, weddingId: "000000000000000000000000" },
      { version: v, title: "   " },
      { version: v, theme: { templateKey: "editorial", accentColor: "green" } },
      { version: v, theme: { templateKey: "neon", accentColor: "#1F4D3D" } },
      { version: v, tagline: "x".repeat(201) },
      { version: v, seo: { title: "x".repeat(61), description: "ok" } },
      { version: v },
    ]) {
      const result = await patchWebsite(weddingId, owner, body);
      expect(result.status, JSON.stringify(body)).toBe(400);
      expect(result.json.error.code).toBe("VALIDATION_ERROR");
    }
  });

  describe("the address", () => {
    it("can be changed, and the old one stops resolving", async () => {
      const { weddingId, owner, site } = await setup();
      await publish(weddingId, owner);
      expect((await publicSite(site.slug)).status).toBe(200);
      const moved = await patchWebsite(weddingId, owner, {
        version: site.version + 1,
        slug: "aarav-and-diya",
      });
      expect(moved.status).toBe(200);
      expect((await publicSite("aarav-and-diya")).status).toBe(200);
      expect((await publicSite(site.slug)).status).toBe(404);
    });

    it("refuses one another wedding uses (409 SLUG_TAKEN), without revealing whose", async () => {
      const first = await setup();
      const second = await setupWedding();
      const draft = await makeWebsite(second.weddingId, second.owner);
      const result = await patchWebsite(second.weddingId, second.owner, {
        version: draft.version,
        slug: first.site.slug,
      });
      expect(result.status).toBe(409);
      expect(result.json.error.code).toBe("SLUG_TAKEN");
      expect(JSON.stringify(result.json)).not.toContain(first.weddingId);
    });

    it("refuses reserved words (422) and badly shaped ones (400)", async () => {
      const { weddingId, owner, site } = await setup();
      for (const slug of ["admin", "dashboard", "api", "login"]) {
        const result = await patchWebsite(weddingId, owner, { version: site.version, slug });
        expect(result.status, slug).toBe(422);
        expect(result.json.error.code).toBe("BUSINESS_RULE_VIOLATION");
      }
      for (const slug of ["ab", "Has Space", "-lead", "trail-", "double--hyphen", "x".repeat(41)]) {
        const result = await patchWebsite(weddingId, owner, { version: site.version, slug });
        expect(result.status, slug).toBe(400);
      }
    });

    it("is lower-cased on the way in", async () => {
      const { weddingId, owner, site } = await setup();
      const result = await patchWebsite(weddingId, owner, {
        version: site.version,
        slug: "Aarav-Diya-2027",
      });
      expect(result.status).toBe(200);
      expect(result.json.data.slug).toBe("aarav-diya-2027");
    });

    it("reports availability for the editor's badge", async () => {
      const first = await setup();
      const other = await setupWedding();
      await makeWebsite(other.weddingId, other.owner);
      const check = async (slug: string) =>
        (await slugCheck(other.weddingId, other.owner, slug)).json.data.availability;
      expect(await check(first.site.slug)).toBe("taken");
      expect(await check("admin")).toBe("reserved");
      expect(await check("no")).toBe("invalid");
      expect(await check("brand-new-address")).toBe("available");
      const own = (await getWebsite(other.weddingId, other.owner)).json.data.slug;
      expect(await check(own)).toBe("yours");
      // The checker is for editors only.
      const member = await addMember(other.weddingId);
      expect((await slugCheck(other.weddingId, member, "whatever")).status).toBe(403);
    });
  });

  describe("sections", () => {
    it("replaces the whole list in order, keeping ids of sections that already exist", async () => {
      const { weddingId, owner, site } = await setup();
      const [story, schedule, travel, faq, contact] = sectionsOf(site);
      const result = await patchWebsite(weddingId, owner, {
        version: site.version,
        sections: [
          {
            id: contact.id,
            type: "contact",
            title: "Reach us",
            body: "Call Ananya",
            isVisible: true,
          },
          {
            id: story.id,
            type: "story",
            title: "Our story",
            body: "We met over chai.",
            isVisible: true,
          },
          { type: "custom", title: "Gifts", body: "Your blessings are enough.", isVisible: true },
          { id: schedule.id, type: "schedule", title: "Schedule", body: "", isVisible: true },
          { id: faq.id, type: "faq", title: "FAQ", body: "Kids?\nYes.", isVisible: false },
        ],
      });
      expect(result.status).toBe(200);
      const saved = sectionsOf(result.json.data);
      expect(saved.map((s) => s.title)).toEqual([
        "Reach us",
        "Our story",
        "Gifts",
        "Schedule",
        "FAQ",
      ]);
      expect(saved[0].id).toBe(contact.id);
      expect(saved[1].id).toBe(story.id);
      expect(saved[2].id).not.toBe(travel.id);
      expect(saved.map((s) => s.id)).not.toContain(travel.id); // dropped
      expect(saved[4].isVisible).toBe(false);
    });

    it("refuses the same standard section twice, a schedule with text, and too many sections", async () => {
      const { weddingId, owner, site } = await setup();
      const dup = await patchWebsite(weddingId, owner, {
        version: site.version,
        sections: [
          { type: "story", title: "One", body: "a", isVisible: true },
          { type: "story", title: "Two", body: "b", isVisible: true },
        ],
      });
      expect(dup.status).toBe(400);

      const textual = await patchWebsite(weddingId, owner, {
        version: site.version,
        sections: [{ type: "schedule", title: "Schedule", body: "free text", isVisible: true }],
      });
      expect(textual.status).toBe(400);

      const many = await patchWebsite(weddingId, owner, {
        version: site.version,
        sections: Array.from({ length: 21 }, (_, index) => ({
          type: "custom",
          title: `Extra ${index}`,
          body: "x",
          isVisible: true,
        })),
      });
      expect(many.status).toBe(400);

      const twenty = await patchWebsite(weddingId, owner, {
        version: site.version,
        sections: Array.from({ length: 20 }, (_, index) => ({
          type: "custom",
          title: `Extra ${index}`,
          body: "x",
          isVisible: true,
        })),
      });
      expect(twenty.status).toBe(200);
    });

    it("ignores an id that is not one of its own sections (it gets a new id)", async () => {
      const { weddingId, owner, site } = await setup();
      const foreign = "ffffffffffffffffffffffff";
      const result = await patchWebsite(weddingId, owner, {
        version: site.version,
        sections: [{ id: foreign, type: "custom", title: "Mine", body: "text", isVisible: true }],
      });
      expect(result.status).toBe(200);
      expect(sectionsOf(result.json.data)[0].id).not.toBe(foreign);
    });
  });

  describe("events shown on the site", () => {
    it("lists only events of this wedding that are marked public", async () => {
      const { weddingId, owner, site, eventId } = await setup();
      const privateEvent = await createEvent(weddingId, owner, {
        name: "Family dinner",
        isPublic: false,
      });
      const publicEvent = await createEvent(weddingId, owner, { name: "Sangeet", isPublic: true });

      const notPublic = await patchWebsite(weddingId, owner, {
        version: site.version,
        publicEventIds: [eventId, privateEvent],
      });
      expect(notPublic.status).toBe(422);
      expect(notPublic.json.error.code).toBe("BUSINESS_RULE_VIOLATION");
      expect(notPublic.json.error.message).toContain("Family dinner");

      const ok = await patchWebsite(weddingId, owner, {
        version: site.version,
        publicEventIds: [publicEvent],
      });
      expect(ok.status).toBe(200);
      expect(ok.json.data.publicEventIds).toEqual([publicEvent]);
    });

    it("answers 404 for an event of another wedding, like a missing one", async () => {
      const { weddingId, owner, site } = await setup();
      const other = await setupWedding();
      const foreignEvent = await createEvent(other.weddingId, other.owner, { isPublic: true });
      const result = await patchWebsite(weddingId, owner, {
        version: site.version,
        publicEventIds: [foreignEvent],
      });
      expect(result.status).toBe(404);
      const missing = await patchWebsite(weddingId, owner, {
        version: site.version,
        publicEventIds: ["aaaaaaaaaaaaaaaaaaaaaaaa"],
      });
      expect(missing.status).toBe(404);
    });

    it("refuses the same event twice", async () => {
      const { weddingId, owner, site, eventId } = await setup();
      const result = await patchWebsite(weddingId, owner, {
        version: site.version,
        publicEventIds: [eventId, eventId],
      });
      expect(result.status).toBe(400);
    });

    it("drops an event from the list when it is deleted", async () => {
      const { weddingId, owner, eventId } = await setup();
      expect((await getWebsite(weddingId, owner)).json.data.publicEventIds).toEqual([eventId]);
      const removed = await removeEvent(weddingId, eventId, owner);
      expect(removed.status).toBe(200);
      expect((await getWebsite(weddingId, owner)).json.data.publicEventIds).toEqual([]);
    });
  });
});

describe("publishing", () => {
  it("is a draft nobody can open until it is published, and again after unpublishing", async () => {
    const { weddingId, owner, site } = await setup();
    expect((await publicSite(site.slug)).status).toBe(404);

    const live = await publish(weddingId, owner);
    expect(live.status).toBe(200);
    expect(live.json.data.status).toBe("published");
    expect(live.json.data.publishedAt).toEqual(expect.any(String));
    expect((await publicSite(site.slug)).status).toBe(200);

    const down = await unpublish(weddingId, owner);
    expect(down.json.data).toMatchObject({ status: "draft", publishedAt: null });
    expect((await publicSite(site.slug)).status).toBe(404);
    // The content and address are kept.
    expect((await getWebsite(weddingId, owner)).json.data.slug).toBe(site.slug);
  });

  it("is for owners and admins", async () => {
    const { weddingId } = await setup();
    const member = await addMember(weddingId);
    expect((await publish(weddingId, member)).status).toBe(403);
    expect((await unpublish(weddingId, member)).status).toBe(403);
    const admin = await addMember(weddingId, "admin");
    expect((await publish(weddingId, admin)).status).toBe(200);
  });

  it("answers 404 before the site is set up", async () => {
    const { weddingId, owner } = await setupWedding();
    expect((await publish(weddingId, owner)).status).toBe(404);
  });

  it("goes dark when the wedding is deleted", async () => {
    const { weddingId, owner, site, title } = await setup();
    await publish(weddingId, owner);
    expect((await publicSite(site.slug)).status).toBe(200);
    expect((await deleteWedding(weddingId, owner, title)).status).toBe(200);
    expect((await publicSite(site.slug)).status).toBe(404);
  });
});

describe("what the public sees", () => {
  async function published(
    patchOrFn:
      Record<string, unknown> | ((site: Record<string, any>) => Record<string, unknown>) = {},
  ) {
    const ctx = await setup();
    const patch = typeof patchOrFn === "function" ? patchOrFn(ctx.site) : patchOrFn;
    if (Object.keys(patch).length > 0) {
      const edited = await patchWebsite(ctx.weddingId, ctx.owner, {
        version: ctx.site.version,
        ...patch,
      });
      if (edited.status !== 200) throw new Error(JSON.stringify(edited.json));
    }
    await publish(ctx.weddingId, ctx.owner);
    const view = (await publicSite(ctx.site.slug)).json.data;
    return { ...ctx, view };
  }

  it("builds the page from the couple, the public events and the visible written sections", async () => {
    const { view } = await published((site) => ({
      tagline: "Together",
      welcomeMessage: "Welcome!",
      sections: [
        {
          id: sectionsOf(site)[0].id,
          type: "story",
          title: "Our story",
          body: "We met.\n\nThen we married.",
          isVisible: true,
        },
        {
          id: sectionsOf(site)[1].id,
          type: "schedule",
          title: "Schedule",
          body: "",
          isVisible: true,
        },
        {
          id: sectionsOf(site)[2].id,
          type: "travel",
          title: "Travel & stay",
          body: "Fly to STV.",
          isVisible: false,
        },
        {
          id: sectionsOf(site)[3].id,
          type: "faq",
          title: "FAQ",
          body: "Kids?\nYes.",
          isVisible: true,
        },
        {
          id: sectionsOf(site)[4].id,
          type: "contact",
          title: "Contact",
          body: "",
          isVisible: true,
        },
      ],
    }));
    expect(view).toMatchObject({
      title: "Aarav & Diya",
      coupleNames: "Aarav & Diya",
      initials: "A & D",
      tagline: "Together",
      welcomeMessage: "Welcome!",
      dateLabel: "14 February 2027",
      city: "Surat",
    });
    // Hidden (travel) and empty (contact) sections are left out; the schedule comes from events.
    expect(view.sections.map((s: any) => s.type)).toEqual(["story", "schedule", "faq"]);
    expect(view.events).toHaveLength(1);
    expect(view.events[0]).toMatchObject({
      name: "Haldi Ceremony",
      dressCode: "Yellow festive",
      description: "Family only, at home.",
      dateLabel: "13 Feb 2027",
    });
    expect(view.events[0].timeLabel).toMatch(/^10:00 AM IST$/);
    // Only the public lines of the event's run-of-show appear.
    expect(view.events[0].timings).toEqual([{ time: "10:30 AM", title: "Haldi begins" }]);
  });

  it("shows venue names only until the couple allow addresses", async () => {
    const hidden = await published();
    expect(hidden.view.events[0].venue).toBe("Family Residence");
    expect(hidden.view.events[0].mapsUrl).toBeNull();
    expect(JSON.stringify(hidden.view)).not.toContain("Bungalow");

    const shown = await published({ display: { showVenueAddresses: true, showCountdown: true } });
    expect(shown.view.events[0].venue).toContain("14 Bungalow Road");
    expect(shown.view.events[0].mapsUrl).toContain("google.com/maps");
  });

  it("leaves out events that are not chosen, or that stopped being public", async () => {
    const { weddingId, owner, eventId, view } = await published();
    expect(view.events.map((e: any) => e.name)).toEqual(["Haldi Ceremony"]);
    const event = await createEvent(weddingId, owner, { name: "Reception", isPublic: true });
    // Public on the event but not chosen for the site: not shown.
    expect(((await publicSite(view.slug)).json.data.events as any[]).map((e) => e.name)).toEqual([
      "Haldi Ceremony",
    ]);
    // Taking public off the event hides it from the site at once, even though it is still chosen.
    const current = await patchEvent(weddingId, eventId, owner, { version: 0, isPublic: false });
    expect(current.status).toBe(200);
    expect((await publicSite(view.slug)).json.data.events).toEqual([]);
    expect(event).toBeTruthy();
  });

  it("drops the schedule section when no events are shown", async () => {
    const { view } = await published({ publicEventIds: [] });
    expect(view.events).toEqual([]);
    expect(view.sections.map((s: any) => s.type)).not.toContain("schedule");
  });

  it("counts down to the first upcoming public event, or not at all when switched off", async () => {
    const on = await published();
    expect(on.view.countdownTarget).toBe("2027-02-13T04:30:00.000Z");
    const off = await published({ display: { showVenueAddresses: false, showCountdown: false } });
    expect(off.view.countdownTarget).toBeNull();
  });

  it("returns a hand-built whitelist and never an internal field, id or private note", async () => {
    const { view, weddingId, owner } = await published();
    const privateEvent = await createEvent(weddingId, owner, {
      name: "Secret planning",
      isPublic: false,
      description: "PRIVATE budget talk",
    });
    const body = JSON.stringify((await publicSite(view.slug)).json);
    expect(Object.keys(view).sort()).toEqual(
      [
        "slug",
        "title",
        "coupleNames",
        "initials",
        "tagline",
        "welcomeMessage",
        "heroImageUrl",
        "dateLabel",
        "city",
        "countdownTarget",
        "sections",
        "events",
        "theme",
        "seo",
      ].sort(),
    );
    for (const forbidden of [
      weddingId,
      privateEvent,
      owner.user.id,
      owner.user.email,
      "createdBy",
      "weddingId",
      "deletedAt",
      "version",
      "__v",
      "_id",
      "PRIVATE",
      "Secret planning",
      "Makeup (private)",
    ]) {
      expect(body, forbidden).not.toContain(forbidden);
    }
  });

  it("answers the same 404 for a draft, a reserved word, and an address nobody uses", async () => {
    const { site } = await setup();
    const results = await Promise.all(
      [site.slug, "admin", "nobody-uses-this", "x"].map((s) => publicSite(s)),
    );
    for (const result of results) {
      expect(result.status).toBe(404);
      expect(result.json).toEqual({
        success: false,
        error: { code: "NOT_FOUND", message: expect.any(String) },
      });
    }
    expect(new Set(results.map((r) => JSON.stringify(r.json))).size).toBe(1);
  });

  it("is rate limited per visitor", async () => {
    const { site } = await setup();
    const ip = "203.0.113.77";
    let last = 0;
    for (let i = 0; i < 125; i += 1) last = (await publicSite(site.slug, ip)).status;
    expect(last).toBe(429);
    // A different visitor is unaffected.
    expect((await publicSite(site.slug, "203.0.113.78")).status).toBe(404);
  });
});
