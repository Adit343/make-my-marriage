import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { LiveStream } from "@/models/liveStream.model";
import { WeddingWebsite } from "@/models/weddingWebsite.model";
import { setupTestDatabase } from "../../setup/database";

setupTestDatabase();

const createdBy = new Types.ObjectId();

const site = (overrides: Record<string, unknown> = {}) => ({
  weddingId: new Types.ObjectId(),
  slug: `slug-${new Types.ObjectId().toString().slice(-8)}`,
  title: "Aarav & Diya",
  createdBy,
  ...overrides,
});

const stream = (overrides: Record<string, unknown> = {}) => ({
  weddingId: new Types.ObjectId(),
  provider: "youtube" as const,
  streamUrl: "https://youtu.be/dQw4w9WgXcQ",
  title: "Ceremony",
  startTime: new Date("2027-02-14T07:30:00Z"),
  createdBy,
  ...overrides,
});

const link = (hash: string) => ({
  tokenHash: hash,
  tokenEnc: "enc",
  createdAt: new Date(),
  expiresAt: null,
  revokedAt: null,
});

describe("WeddingWebsite", () => {
  it("starts as a private draft with safe defaults", async () => {
    const created = await WeddingWebsite.create(site());
    expect(created).toMatchObject({
      status: "draft",
      publishedAt: null,
      deletedAt: null,
      display: { showVenueAddresses: false, showCountdown: true },
      theme: { templateKey: "modern_minimal", accentColor: "#1F4D3D" },
    });
    expect(created.sections).toHaveLength(0);
    expect(created.publicEventIds).toHaveLength(0);
  });

  it("holds exactly one site per wedding", async () => {
    const weddingId = new Types.ObjectId();
    await WeddingWebsite.create(site({ weddingId }));
    await expect(WeddingWebsite.create(site({ weddingId }))).rejects.toMatchObject({ code: 11000 });
  });

  it("holds each address once among live sites, and frees it when the site is deleted", async () => {
    const first = await WeddingWebsite.create(site({ slug: "shared-address" }));
    await expect(WeddingWebsite.create(site({ slug: "shared-address" }))).rejects.toMatchObject({
      code: 11000,
    });
    await WeddingWebsite.updateOne({ _id: first._id }, { $set: { deletedAt: new Date() } });
    await expect(WeddingWebsite.create(site({ slug: "shared-address" }))).resolves.toBeTruthy();
  });

  it("frees the wedding for a new site once the old one is deleted", async () => {
    const weddingId = new Types.ObjectId();
    const first = await WeddingWebsite.create(site({ weddingId }));
    await WeddingWebsite.updateOne({ _id: first._id }, { $set: { deletedAt: new Date() } });
    await expect(WeddingWebsite.create(site({ weddingId }))).resolves.toBeTruthy();
  });

  it.each(["ab", "Has Space", "-lead", "trail-", "double--hyphen", "x".repeat(41), "UPPER"])(
    "rejects the address %j",
    async (slug) => {
      // "UPPER" is lower-cased by the schema, so it is valid; every other value is not.
      const attempt = WeddingWebsite.create(site({ slug }));
      if (slug === "UPPER") await expect(attempt).resolves.toMatchObject({ slug: "upper" });
      else await expect(attempt).rejects.toThrow(/slug/i);
    },
  );

  it("limits sections to 20 and events to 20, and rejects a bad accent colour or template", async () => {
    const section = (i: number) => ({ type: "custom", title: `S${i}`, body: "x", sortOrder: i });
    await expect(
      WeddingWebsite.create(site({ sections: Array.from({ length: 21 }, (_, i) => section(i)) })),
    ).rejects.toThrow(/at most 20 sections/);
    await expect(
      WeddingWebsite.create(
        site({ publicEventIds: Array.from({ length: 21 }, () => new Types.ObjectId()) }),
      ),
    ).rejects.toThrow(/at most 20 events/);
    await expect(
      WeddingWebsite.create(
        site({ theme: { templateKey: "modern_minimal", accentColor: "green" } }),
      ),
    ).rejects.toThrow();
    await expect(
      WeddingWebsite.create(site({ theme: { templateKey: "neon", accentColor: "#112233" } })),
    ).rejects.toThrow();
    await expect(
      WeddingWebsite.create(site({ sections: Array.from({ length: 20 }, (_, i) => section(i)) })),
    ).resolves.toBeTruthy();
  });

  it("limits the length of each public text", async () => {
    await expect(WeddingWebsite.create(site({ title: "x".repeat(121) }))).rejects.toThrow();
    await expect(WeddingWebsite.create(site({ tagline: "x".repeat(201) }))).rejects.toThrow();
    await expect(
      WeddingWebsite.create(site({ welcomeMessage: "x".repeat(1001) })),
    ).rejects.toThrow();
    await expect(
      WeddingWebsite.create(
        site({ sections: [{ type: "custom", title: "t", body: "x".repeat(3001) }] }),
      ),
    ).rejects.toThrow();
    await expect(
      WeddingWebsite.create(site({ seo: { title: "x".repeat(61), description: "ok" } })),
    ).rejects.toThrow();
  });

  it("rejects a stale save (optimistic concurrency)", async () => {
    const created = await WeddingWebsite.create(site());
    const one = await WeddingWebsite.findById(created._id);
    const two = await WeddingWebsite.findById(created._id);
    one!.title = "First";
    await one!.save();
    two!.title = "Second";
    await expect(two!.save()).rejects.toThrow(/No matching document|version/i);
  });
});

describe("LiveStream", () => {
  it("starts scheduled and visible only to its wedding", async () => {
    const created = await LiveStream.create(stream());
    expect(created).toMatchObject({ status: "scheduled", eventId: null, deletedAt: null });
  });

  it("accepts only https links and known platforms and statuses", async () => {
    await expect(LiveStream.create(stream({ streamUrl: "http://youtu.be/x" }))).rejects.toThrow();
    await expect(LiveStream.create(stream({ streamUrl: "javascript:alert(1)" }))).rejects.toThrow();
    await expect(LiveStream.create(stream({ provider: "twitch" }))).rejects.toThrow();
    await expect(LiveStream.create(stream({ status: "paused" }))).rejects.toThrow();
    await expect(LiveStream.create(stream({ title: "" }))).rejects.toThrow();
    await expect(LiveStream.create(stream({ title: "x".repeat(121) }))).rejects.toThrow();
    await expect(LiveStream.create(stream({ description: "x".repeat(1001) }))).rejects.toThrow();
    await expect(LiveStream.create(stream({ startTime: undefined }))).rejects.toThrow();
  });

  it("holds each watch link once, and keeps the secrets out of normal reads", async () => {
    await LiveStream.create(stream({ link: link("hash-one") }));
    await expect(LiveStream.create(stream({ link: link("hash-one") }))).rejects.toMatchObject({
      code: 11000,
    });
    // Streams without a link do not collide with each other.
    await LiveStream.create(stream());
    await LiveStream.create(stream());

    const found = await LiveStream.findOne({ "link.tokenHash": "hash-one" }).lean();
    expect(found).toBeTruthy();
    expect(found!.link).not.toHaveProperty("tokenHash");
    expect(found!.link).not.toHaveProperty("tokenEnc");
    const withSecret = await LiveStream.findOne({ "link.tokenHash": "hash-one" })
      .select("+link.tokenEnc")
      .lean();
    expect(withSecret!.link!.tokenEnc).toBe("enc");
  });

  it("hides deleted streams from ordinary queries", async () => {
    const weddingId = new Types.ObjectId();
    const keep = await LiveStream.create(stream({ weddingId }));
    const gone = await LiveStream.create(stream({ weddingId, link: link("gone-hash") }));
    await LiveStream.updateOne({ _id: gone._id }, { $set: { deletedAt: new Date() } });
    const found = await LiveStream.find({ weddingId }).lean();
    expect(found.map((row) => row._id.toString())).toEqual([keep._id.toString()]);
    expect(await LiveStream.findOne({ "link.tokenHash": "gone-hash" })).toBeNull();
  });
});
