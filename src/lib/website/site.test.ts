import { describe, expect, it } from "vitest";
import {
  buildSiteView,
  initialsOf,
  navLabel,
  paragraphs,
  parseFaq,
  type SiteContext,
  type SiteDraft,
  type SiteEventSource,
} from "@/lib/website/site";

const NOW = new Date("2027-01-01T00:00:00Z");

const context: SiteContext = {
  coupleNames: "Aarav & Diya",
  initials: "A & D",
  dateLabel: "14 February 2027",
  city: "Surat",
  weddingDayStart: "2027-02-13T18:30:00.000Z",
};

const event = (id: string, startsAt: string, overrides: Partial<SiteEventSource> = {}) =>
  ({
    id,
    name: `Event ${id}`,
    startsAt,
    dateLabel: "13 Feb 2027",
    timeLabel: "10:00 AM IST",
    venueName: "Riverfront Pavilion",
    venueAddress: "Riverfront Pavilion, 14 Bungalow Road, Surat",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=x",
    dressCode: null,
    description: null,
    timings: [],
    ...overrides,
  }) satisfies SiteEventSource;

const draft = (overrides: Partial<SiteDraft> = {}): SiteDraft => ({
  slug: "aarav-diya",
  title: "Aarav & Diya",
  tagline: "",
  welcomeMessage: "",
  heroAssetId: null,
  sections: [],
  publicEventIds: [],
  display: { showVenueAddresses: false, showCountdown: true },
  theme: { templateKey: "modern_minimal", accentColor: "#1F4D3D" },
  seo: { title: "", description: "" },
  ...overrides,
});

const section = (
  type: SiteDraft["sections"][number]["type"],
  body = "text",
  extra: Partial<SiteDraft["sections"][number]> = {},
) => ({ id: `s-${type}`, type, title: type, body, isVisible: true, ...extra });

describe("buildSiteView", () => {
  it("shows only chosen events, soonest first", () => {
    const pool = [
      event("late", "2027-02-15T14:00:00Z"),
      event("early", "2027-02-13T04:30:00Z"),
      event("unchosen", "2027-02-14T04:30:00Z"),
    ];
    const view = buildSiteView(draft({ publicEventIds: ["late", "early"] }), pool, context, NOW);
    expect(view.events.map((e) => e.name)).toEqual(["Event early", "Event late"]);
  });

  it("ignores an id that is not in the pool of public events", () => {
    const view = buildSiteView(draft({ publicEventIds: ["ghost"] }), [], context, NOW);
    expect(view.events).toEqual([]);
  });

  it("shows the venue name only, and no map, until addresses are allowed", () => {
    const pool = [event("a", "2027-02-13T04:30:00Z")];
    const hidden = buildSiteView(draft({ publicEventIds: ["a"] }), pool, context, NOW);
    expect(hidden.events[0]).toMatchObject({ venue: "Riverfront Pavilion", mapsUrl: null });
    expect(JSON.stringify(hidden)).not.toContain("Bungalow");

    const shown = buildSiteView(
      draft({ publicEventIds: ["a"], display: { showVenueAddresses: true, showCountdown: true } }),
      pool,
      context,
      NOW,
    );
    expect(shown.events[0]!.venue).toContain("14 Bungalow Road");
    expect(shown.events[0]!.mapsUrl).toContain("google.com/maps");
  });

  it("falls back to the venue name when an address was asked for but there is none", () => {
    const pool = [event("a", "2027-02-13T04:30:00Z", { venueAddress: null })];
    const view = buildSiteView(
      draft({ publicEventIds: ["a"], display: { showVenueAddresses: true, showCountdown: true } }),
      pool,
      context,
      NOW,
    );
    expect(view.events[0]!.venue).toBe("Riverfront Pavilion");
  });

  describe("sections", () => {
    it("keeps the written order and drops hidden and empty sections", () => {
      const view = buildSiteView(
        draft({
          sections: [
            section("faq", "Kids?\nYes."),
            section("story", "We met."),
            section("travel", "Fly to STV.", { isVisible: false }),
            section("contact", "   "),
            section("custom", "More", { title: "Gifts" }),
          ],
        }),
        [],
        context,
        NOW,
      );
      expect(view.sections.map((s) => [s.type, s.title])).toEqual([
        ["faq", "faq"],
        ["story", "story"],
        ["custom", "Gifts"],
      ]);
    });

    it("builds the schedule from the events, with no text of its own, and drops it without events", () => {
      const schedule = section("schedule", "ignored text");
      const none = buildSiteView(draft({ sections: [schedule] }), [], context, NOW);
      expect(none.sections).toEqual([]);

      const some = buildSiteView(
        draft({ sections: [schedule], publicEventIds: ["a"] }),
        [event("a", "2027-02-13T04:30:00Z")],
        context,
        NOW,
      );
      expect(some.sections).toEqual([
        { key: "s-schedule", type: "schedule", title: "schedule", body: "" },
      ]);
    });

    it("uses the standard title when a section's title is blank", () => {
      const view = buildSiteView(
        draft({ sections: [section("faq", "Q?\nA.", { title: "  " })] }),
        [],
        context,
        NOW,
      );
      expect(view.sections[0]!.title).toBe("FAQ");
    });
  });

  describe("countdown", () => {
    const pool = [
      event("past", "2026-12-01T04:30:00Z"),
      event("next", "2027-02-13T04:30:00Z"),
      event("later", "2027-02-15T04:30:00Z"),
    ];

    it("runs to the next upcoming public event", () => {
      const view = buildSiteView(
        draft({ publicEventIds: ["past", "next", "later"] }),
        pool,
        context,
        NOW,
      );
      expect(view.countdownTarget).toBe("2027-02-13T04:30:00Z");
    });

    it("falls back to the start of the wedding day when no event is shown", () => {
      const view = buildSiteView(draft(), pool, context, NOW);
      expect(view.countdownTarget).toBe("2027-02-13T18:30:00.000Z");
    });

    it("is off when switched off, when everything has passed, and when there is nothing to count to", () => {
      expect(
        buildSiteView(
          draft({
            publicEventIds: ["next"],
            display: { showVenueAddresses: false, showCountdown: false },
          }),
          pool,
          context,
          NOW,
        ).countdownTarget,
      ).toBeNull();
      expect(
        buildSiteView(
          draft({ publicEventIds: ["next"] }),
          pool,
          context,
          new Date("2028-01-01T00:00:00Z"),
        ).countdownTarget,
      ).toBeNull();
      expect(
        buildSiteView(draft(), [], { ...context, weddingDayStart: null }, NOW).countdownTarget,
      ).toBeNull();
    });
  });

  it("returns exactly the whitelisted fields", () => {
    const view = buildSiteView(
      draft({ tagline: " Together ", welcomeMessage: " Hi " }),
      [],
      context,
      NOW,
    );
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
    expect(view.tagline).toBe("Together");
    expect(view.welcomeMessage).toBe("Hi");
    expect(buildSiteView(draft(), [], context, NOW).tagline).toBeNull();
  });

  it("carries the cover photo address, and never the photo id", () => {
    const url = "https://photos.example/cover.jpg?sig=abc";
    const view = buildSiteView(draft({ heroAssetId: "a".repeat(24) }), [], context, NOW, url);
    expect(view.heroImageUrl).toBe(url);
    expect(JSON.stringify(view)).not.toContain("a".repeat(24));
    expect(buildSiteView(draft(), [], context, NOW).heroImageUrl).toBeNull();
  });
});

describe("text helpers", () => {
  it("splits paragraphs on blank lines", () => {
    expect(paragraphs("One.\n\nTwo\nlines.\n   \n\nThree.")).toEqual([
      "One.",
      "Two\nlines.",
      "Three.",
    ]);
    expect(paragraphs("  \n\n ")).toEqual([]);
  });

  it("reads a FAQ as question lines with answers beneath", () => {
    expect(
      parseFaq("Kids?\nYes, all welcome.\n\nParking?\nValet at every venue.\nFree.\n\nUnanswered?"),
    ).toEqual([
      { question: "Kids?", answer: "Yes, all welcome." },
      { question: "Parking?", answer: "Valet at every venue.\nFree." },
      { question: "Unanswered?", answer: "" },
    ]);
    expect(parseFaq("")).toEqual([]);
  });

  it("makes initials from the couple's names", () => {
    expect(initialsOf(["Aarav", "Diya"], "x")).toBe("A & D");
    expect(initialsOf(["  priya "], "x")).toBe("P");
    expect(initialsOf([], "Our Wedding")).toBe("O");
    expect(initialsOf(["123"], "")).toBe("♥");
  });

  it("shortens long custom section names for the navigation", () => {
    const nav = (title: string) => navLabel({ key: "k", type: "custom", title, body: "x" });
    expect(nav("Gifts")).toBe("Gifts");
    expect(nav("A very long custom title")).toBe("A very long c…");
    expect(navLabel({ key: "k", type: "travel", title: "Getting there", body: "x" })).toBe(
      "Travel",
    );
  });
});
