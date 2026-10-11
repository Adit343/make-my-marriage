import { describe, expect, it } from "vitest";
import { setupTestDatabase } from "../../setup/database";
import { addMember, setupWedding } from "../../setup/wedding";
import {
  bulk,
  createGroup,
  createGuest,
  deleteGuest,
  getGuest,
  listGroups,
  listGuests,
  makeEvent,
  makeGuest,
  patchGuest,
} from "./helpers";

setupTestDatabase();

describe("POST /weddings/:weddingId/guests", () => {
  it("creates a guest with the documented defaults", async () => {
    const { weddingId, owner } = await setupWedding();
    const result = await createGuest(weddingId, owner, {
      name: "Rahul Sharma",
      side: "partnerOne",
    });
    expect(result.status).toBe(201);
    expect(result.json.data).toMatchObject({
      name: "Rahul Sharma",
      groupId: null,
      side: "partnerOne",
      email: null,
      phone: null,
      address: null,
      relationLabel: null,
      ageCategory: "adult",
      plusOnesAllowed: 0,
      dietaryPreference: null,
      notes: null,
      invitation: { status: "not_invited", lastChannel: null, lastSentAt: null, sendCount: 0 },
      responses: [],
      rsvpSummary: { invitedToCount: 0, respondedCount: 0 },
      createdBy: owner.user.id,
      version: 0,
    });
  });

  it("stores every field", async () => {
    const { weddingId, owner } = await setupWedding();
    const group = (
      await createGroup(weddingId, owner, { name: "College Friends", side: "partnerOne" })
    ).json.data;
    const result = await createGuest(weddingId, owner, {
      name: "  Rahul   Sharma ",
      side: "both",
      groupId: group.id,
      email: "Rahul@Example.com",
      phone: "+919876543210",
      address: { line1: "12 MG Road", city: "Surat", postalCode: "395007" },
      relationLabel: "College friend",
      ageCategory: "child",
      plusOnesAllowed: 2,
      dietaryPreference: "jain",
      notes: "Arriving on the 12th",
    });
    expect(result.status).toBe(201);
    expect(result.json.data).toMatchObject({
      name: "Rahul Sharma",
      groupId: group.id,
      side: "both",
      email: "rahul@example.com",
      phone: "+919876543210",
      address: { line1: "12 MG Road", city: "Surat", postalCode: "395007" },
      relationLabel: "College friend",
      ageCategory: "child",
      plusOnesAllowed: 2,
      dietaryPreference: "jain",
      notes: "Arriving on the 12th",
    });
  });

  it("invites the guest to the chosen events, each one pending", async () => {
    const { weddingId, owner } = await setupWedding();
    const haldi = await makeEvent(weddingId, owner, "Haldi");
    const sangeet = await makeEvent(weddingId, owner, "Sangeet");
    await makeEvent(weddingId, owner, "Reception");
    const result = await createGuest(weddingId, owner, {
      name: "Rahul",
      side: "partnerOne",
      eventIds: [haldi, sangeet],
    });
    expect(result.status).toBe(201);
    expect(result.json.data.responses).toHaveLength(2);
    expect(result.json.data.responses.map((r: { eventId: string }) => r.eventId).sort()).toEqual(
      [haldi, sangeet].sort(),
    );
    expect(result.json.data.responses[0]).toMatchObject({
      status: "pending",
      attendingCount: 0,
      respondedAt: null,
    });
    expect(result.json.data.rsvpSummary).toEqual({ invitedToCount: 2, respondedCount: 0 });
  });

  it("lets every role add guests", async () => {
    const { weddingId } = await setupWedding();
    for (const role of ["admin", "member"] as const) {
      const who = await addMember(weddingId, role);
      expect((await createGuest(weddingId, who, { name: role, side: "both" })).status).toBe(201);
    }
  });

  it("rejects bad input with 400", async () => {
    const { weddingId, owner } = await setupWedding();
    const bad: Record<string, unknown>[] = [
      { side: "both" },
      { name: "", side: "both" },
      { name: "x" },
      { name: "x", side: "left" },
      { name: "x", side: "both", phone: "98765 43210" },
      { name: "x", side: "both", phone: "+0123" },
      { name: "x", side: "both", email: "not-an-email" },
      { name: "x", side: "both", plusOnesAllowed: 11 },
      { name: "x", side: "both", plusOnesAllowed: -1 },
      { name: "x", side: "both", plusOnesAllowed: 1.5 },
      { name: "x", side: "both", ageCategory: "teen" },
      { name: "x", side: "both", dietaryPreference: "keto" },
      { name: "x", side: "both", address: { postalCode: "123" } },
      { name: "x", side: "both", notes: "n".repeat(1001) },
      { name: "x".repeat(121), side: "both" },
      { name: "x", side: "both", deletedAt: null },
      { name: "x", side: "both", createdBy: "someone" },
      { name: "x", side: "both", eventIds: ["not-an-id"] },
    ];
    for (const body of bad) {
      const result = await createGuest(weddingId, owner, body);
      expect(result.status, JSON.stringify(body)).toBe(400);
    }
  });

  it("rejects a repeated event id", async () => {
    const { weddingId, owner } = await setupWedding();
    const event = await makeEvent(weddingId, owner);
    const result = await createGuest(weddingId, owner, {
      name: "x",
      side: "both",
      eventIds: [event, event],
    });
    expect(result.status).toBe(400);
  });

  it("answers 404 for a group or event of another wedding, and saves nothing", async () => {
    const a = await setupWedding();
    const b = await setupWedding("Other wedding");
    const foreignGroup = (
      await createGroup(b.weddingId, b.owner, { name: "Foreign", side: "both" })
    ).json.data;
    const foreignEvent = await makeEvent(b.weddingId, b.owner);

    const withGroup = await createGuest(a.weddingId, a.owner, {
      name: "x",
      side: "both",
      groupId: foreignGroup.id,
    });
    expect(withGroup.status).toBe(404);
    const withEvent = await createGuest(a.weddingId, a.owner, {
      name: "x",
      side: "both",
      eventIds: [foreignEvent],
    });
    expect(withEvent.status).toBe(404);
    expect((await listGuests(a.weddingId, a.owner)).json.data).toEqual([]);
  });

  it("denies non-members and signed-out callers", async () => {
    const a = await setupWedding();
    const b = await setupWedding("Other wedding");
    expect((await createGuest(a.weddingId, b.owner, { name: "x", side: "both" })).status).toBe(403);
    expect(
      (await createGuest(a.weddingId, { cookie: "" } as never, { name: "x", side: "both" })).status,
    ).toBe(401);
  });
});

describe("GET /weddings/:weddingId/guests", () => {
  async function seed() {
    const wedding = await setupWedding();
    const { weddingId, owner } = wedding;
    const college = (await createGroup(weddingId, owner, { name: "College", side: "partnerOne" }))
      .json.data.id as string;
    const family = (await createGroup(weddingId, owner, { name: "Family", side: "both" })).json.data
      .id as string;
    const haldi = await makeEvent(weddingId, owner, "Haldi");
    const reception = await makeEvent(weddingId, owner, "Reception");
    const guests = {
      aarav: await makeGuest(weddingId, owner, {
        name: "Aarav Trivedi",
        groupId: college,
        side: "partnerOne",
        dietaryPreference: "vegetarian",
        eventIds: [haldi, reception],
      }),
      ananya: await makeGuest(weddingId, owner, {
        name: "Ananya Joshi",
        groupId: family,
        side: "partnerTwo",
        dietaryPreference: "jain",
        eventIds: [haldi],
      }),
      bhavin: await makeGuest(weddingId, owner, {
        name: "Bhavin Patel",
        groupId: college,
        side: "partnerOne",
      }),
      deepa: await makeGuest(weddingId, owner, { name: "Deepa Mehta", side: "both" }),
    };
    return { ...wedding, college, family, haldi, reception, guests };
  }

  const names = (result: { json: { data: { name: string }[] } }) =>
    result.json.data.map((guest) => guest.name);

  it("lists A to Z with each guest's replies, and no private fields", async () => {
    const { weddingId, owner, guests, haldi } = await seed();
    const result = await listGuests(weddingId, owner);
    expect(result.status).toBe(200);
    expect(names(result)).toEqual(["Aarav Trivedi", "Ananya Joshi", "Bhavin Patel", "Deepa Mehta"]);
    const aarav = result.json.data[0];
    expect(aarav.id).toBe(guests.aarav.id);
    expect(aarav.rsvps).toHaveLength(2);
    expect(aarav.rsvps.find((r: { eventId: string }) => r.eventId === haldi)).toEqual({
      eventId: haldi,
      status: "pending",
      attendingCount: 0,
    });
    expect(aarav.rsvpSummary).toEqual({ invitedToCount: 2, respondedCount: 0 });
    for (const guest of result.json.data) {
      expect(guest).not.toHaveProperty("notes");
      expect(guest).not.toHaveProperty("address");
      expect(guest).not.toHaveProperty("nameNormalized");
      expect(guest).not.toHaveProperty("deletedAt");
    }
    expect(result.json.meta).toEqual({ nextCursor: null, hasMore: false });
  });

  it("pages with an opaque cursor and never repeats or skips a guest", async () => {
    const { weddingId, owner } = await seed();
    const first = await listGuests(weddingId, owner, "?limit=3");
    expect(names(first)).toEqual(["Aarav Trivedi", "Ananya Joshi", "Bhavin Patel"]);
    expect(first.json.meta.hasMore).toBe(true);
    const second = await listGuests(
      weddingId,
      owner,
      `?limit=3&cursor=${first.json.meta.nextCursor}`,
    );
    expect(names(second)).toEqual(["Deepa Mehta"]);
    expect(second.json.meta).toEqual({ nextCursor: null, hasMore: false });
  });

  it("keeps same-named guests in a stable order across pages", async () => {
    const { weddingId, owner } = await setupWedding();
    for (let i = 0; i < 5; i++) await makeGuest(weddingId, owner, { name: "Sam Shah" });
    const seen: string[] = [];
    let cursor = "";
    for (let page = 0; page < 5; page++) {
      const result = await listGuests(weddingId, owner, `?limit=2${cursor}`);
      seen.push(...result.json.data.map((guest: { id: string }) => guest.id));
      if (!result.json.meta.hasMore) break;
      cursor = `&cursor=${result.json.meta.nextCursor}`;
    }
    expect(seen).toHaveLength(5);
    expect(new Set(seen).size).toBe(5);
  });

  it("rejects a tampered cursor and an oversized page", async () => {
    const { weddingId, owner } = await seed();
    expect((await listGuests(weddingId, owner, "?cursor=garbage")).status).toBe(400);
    expect((await listGuests(weddingId, owner, "?limit=101")).status).toBe(400);
    expect((await listGuests(weddingId, owner, "?limit=0")).status).toBe(400);
  });

  it("searches by the start of the name, ignoring case, never by 'contains'", async () => {
    const { weddingId, owner } = await seed();
    expect(names(await listGuests(weddingId, owner, "?search=AN"))).toEqual(["Ananya Joshi"]);
    expect(names(await listGuests(weddingId, owner, "?search=a"))).toEqual([
      "Aarav Trivedi",
      "Ananya Joshi",
    ]);
    expect(names(await listGuests(weddingId, owner, "?search=trivedi"))).toEqual([]);
    expect(names(await listGuests(weddingId, owner, "?search=aarav%20t"))).toEqual([
      "Aarav Trivedi",
    ]);
  });

  it("treats regex characters in the search as plain text", async () => {
    const { weddingId, owner } = await seed();
    expect(names(await listGuests(weddingId, owner, "?search=.*"))).toEqual([]);
    expect(names(await listGuests(weddingId, owner, "?search=(a"))).toEqual([]);
  });

  it("searches while paging", async () => {
    const { weddingId, owner } = await seed();
    const first = await listGuests(weddingId, owner, "?search=a&limit=1");
    expect(names(first)).toEqual(["Aarav Trivedi"]);
    const second = await listGuests(
      weddingId,
      owner,
      `?search=a&limit=1&cursor=${first.json.meta.nextCursor}`,
    );
    expect(names(second)).toEqual(["Ananya Joshi"]);
    expect(second.json.meta.hasMore).toBe(false);
  });

  it("filters by group, ungrouped, side, invitation status and dietary preference", async () => {
    const { weddingId, owner, college } = await seed();
    expect(names(await listGuests(weddingId, owner, `?groupId=${college}`))).toEqual([
      "Aarav Trivedi",
      "Bhavin Patel",
    ]);
    expect(names(await listGuests(weddingId, owner, "?groupId=none"))).toEqual(["Deepa Mehta"]);
    expect(names(await listGuests(weddingId, owner, "?side=partnerTwo"))).toEqual(["Ananya Joshi"]);
    expect(names(await listGuests(weddingId, owner, "?inviteStatus=invited"))).toEqual([]);
    expect(
      (await listGuests(weddingId, owner, "?inviteStatus=not_invited")).json.data,
    ).toHaveLength(4);
    expect(names(await listGuests(weddingId, owner, "?dietaryPreference=jain"))).toEqual([
      "Ananya Joshi",
    ]);
  });

  it("combines filters", async () => {
    const { weddingId, owner, college } = await seed();
    expect(
      names(await listGuests(weddingId, owner, `?groupId=${college}&dietaryPreference=vegetarian`)),
    ).toEqual(["Aarav Trivedi"]);
    expect(
      names(await listGuests(weddingId, owner, `?groupId=${college}&side=partnerTwo`)),
    ).toEqual([]);
  });

  it("filters by event: guests invited to it", async () => {
    const { weddingId, owner, haldi, reception } = await seed();
    expect(names(await listGuests(weddingId, owner, `?eventId=${haldi}`))).toEqual([
      "Aarav Trivedi",
      "Ananya Joshi",
    ]);
    expect(names(await listGuests(weddingId, owner, `?eventId=${reception}`))).toEqual([
      "Aarav Trivedi",
    ]);
  });

  it("filters by reply status, for one event or any", async () => {
    const { weddingId, owner, haldi, reception, guests } = await seed();
    const { record } = await import("./helpers");
    await record(weddingId, guests.aarav.id, haldi, owner, {
      status: "attending",
      attendingCount: 1,
    });
    await record(weddingId, guests.ananya.id, haldi, owner, { status: "declined" });

    expect(names(await listGuests(weddingId, owner, "?rsvpStatus=attending"))).toEqual([
      "Aarav Trivedi",
    ]);
    expect(names(await listGuests(weddingId, owner, "?rsvpStatus=declined"))).toEqual([
      "Ananya Joshi",
    ]);
    // Aarav still has a pending reply for the reception.
    expect(names(await listGuests(weddingId, owner, "?rsvpStatus=pending"))).toEqual([
      "Aarav Trivedi",
    ]);
    expect(
      names(await listGuests(weddingId, owner, `?eventId=${haldi}&rsvpStatus=pending`)),
    ).toEqual([]);
    expect(
      names(await listGuests(weddingId, owner, `?eventId=${reception}&rsvpStatus=pending`)),
    ).toEqual(["Aarav Trivedi"]);
    expect(names(await listGuests(weddingId, owner, "?rsvpStatus=maybe"))).toEqual([]);
  });

  it("rejects unknown filters and values", async () => {
    const { weddingId, owner } = await seed();
    for (const query of [
      "?nameNormalized=x",
      "?deletedAt=null",
      "?side=left",
      "?rsvpStatus=yes",
      "?groupId=nope",
      "?eventId=nope",
    ]) {
      expect((await listGuests(weddingId, owner, query)).status, query).toBe(400);
    }
  });

  it("answers 404 for another wedding's group or event in a filter", async () => {
    const a = await seed();
    const b = await setupWedding("Other wedding");
    const foreignGroup = (await createGroup(b.weddingId, b.owner, { name: "F", side: "both" })).json
      .data.id;
    const foreignEvent = await makeEvent(b.weddingId, b.owner);
    expect((await listGuests(a.weddingId, a.owner, `?groupId=${foreignGroup}`)).status).toBe(404);
    expect((await listGuests(a.weddingId, a.owner, `?eventId=${foreignEvent}`)).status).toBe(404);
  });

  it("never shows another wedding's guests", async () => {
    const a = await seed();
    const b = await setupWedding("Other wedding");
    await makeGuest(b.weddingId, b.owner, { name: "Aaron Outsider" });
    expect(names(await listGuests(a.weddingId, a.owner, "?search=aa"))).toEqual(["Aarav Trivedi"]);
    expect(names(await listGuests(b.weddingId, b.owner))).toEqual(["Aaron Outsider"]);
    expect((await listGuests(a.weddingId, b.owner)).status).toBe(403);
  });

  it("hides deleted guests", async () => {
    const { weddingId, owner, guests } = await seed();
    await deleteGuest(weddingId, guests.bhavin.id, owner);
    expect(names(await listGuests(weddingId, owner))).toEqual([
      "Aarav Trivedi",
      "Ananya Joshi",
      "Deepa Mehta",
    ]);
  });

  it("lets every role read the list", async () => {
    const { weddingId } = await seed();
    const member = await addMember(weddingId, "member");
    expect((await listGuests(weddingId, member)).status).toBe(200);
  });
});

describe("GET /weddings/:weddingId/guests/:guestId", () => {
  it("returns the private shape with notes, address and each event's reply", async () => {
    const { weddingId, owner } = await setupWedding();
    const haldi = await makeEvent(weddingId, owner, "Haldi");
    const guest = await makeGuest(weddingId, owner, {
      notes: "Arriving on the 12th",
      address: { city: "Surat" },
      eventIds: [haldi],
    });
    const result = await getGuest(weddingId, guest.id, owner);
    expect(result.status).toBe(200);
    expect(result.json.data).toMatchObject({
      notes: "Arriving on the 12th",
      address: { city: "Surat" },
    });
    expect(result.json.data.responses[0]).toMatchObject({
      eventId: haldi,
      eventName: "Haldi",
      eventType: "haldi",
      status: "pending",
      timezone: "Asia/Kolkata",
    });
    expect(JSON.stringify(result.json)).not.toMatch(/tokenHash|tokenEnc|nameNormalized|deletedAt/);
  });

  it("lists replies in the order of the events", async () => {
    const { weddingId, owner } = await setupWedding();
    const { call } = await import("../../setup/http");
    const { POST } = await import("@/app/api/v1/weddings/[weddingId]/events/route");
    const make = async (name: string, startsAt: string) =>
      (
        await call(POST, {
          cookie: owner.cookie,
          params: { weddingId },
          body: { name, type: "other", startsAt },
        })
      ).json.data.id as string;
    const late = await make("Reception", "2027-02-15T14:00:00Z");
    const early = await make("Mehendi", "2027-02-12T04:00:00Z");
    const guest = await makeGuest(weddingId, owner, { eventIds: [late, early] });
    const result = await getGuest(weddingId, guest.id, owner);
    expect(result.json.data.responses.map((r: { eventName: string }) => r.eventName)).toEqual([
      "Mehendi",
      "Reception",
    ]);
  });

  it("answers 404 for a missing, deleted or other wedding's guest", async () => {
    const a = await setupWedding();
    const b = await setupWedding("Other wedding");
    const guest = await makeGuest(a.weddingId, a.owner);
    expect((await getGuest(a.weddingId, "0123456789abcdef01234567", a.owner)).status).toBe(404);
    expect((await getGuest(b.weddingId, guest.id, b.owner)).status).toBe(404);
    expect((await getGuest(a.weddingId, guest.id, b.owner)).status).toBe(403);
    await deleteGuest(a.weddingId, guest.id, a.owner);
    expect((await getGuest(a.weddingId, guest.id, a.owner)).status).toBe(404);
  });
});

describe("PATCH /weddings/:weddingId/guests/:guestId", () => {
  it("changes some fields and bumps the version", async () => {
    const { weddingId, owner } = await setupWedding();
    const guest = await makeGuest(weddingId, owner, {
      name: "Rahul Sharma",
      phone: "+919876543210",
    });
    const result = await patchGuest(weddingId, guest.id, owner, {
      version: guest.version,
      name: "Rahul S. Sharma",
      email: "rahul@example.com",
      plusOnesAllowed: 1,
    });
    expect(result.status).toBe(200);
    expect(result.json.data).toMatchObject({
      name: "Rahul S. Sharma",
      email: "rahul@example.com",
      plusOnesAllowed: 1,
      phone: "+919876543210",
      version: guest.version + 1,
    });
  });

  it("keeps the search key in step with a rename", async () => {
    const { weddingId, owner } = await setupWedding();
    const guest = await makeGuest(weddingId, owner, { name: "Rahul Sharma" });
    await patchGuest(weddingId, guest.id, owner, { version: guest.version, name: "Vikram Shah" });
    expect((await listGuests(weddingId, owner, "?search=rah")).json.data).toEqual([]);
    expect((await listGuests(weddingId, owner, "?search=vik")).json.data).toHaveLength(1);
  });

  it("clears optional fields with null", async () => {
    const { weddingId, owner } = await setupWedding();
    const group = (await createGroup(weddingId, owner, { name: "G", side: "both" })).json.data;
    const guest = await makeGuest(weddingId, owner, {
      groupId: group.id,
      email: "a@b.co",
      phone: "+919876543210",
      notes: "x",
      relationLabel: "Friend",
      dietaryPreference: "vegan",
      address: { city: "Surat" },
    });
    const result = await patchGuest(weddingId, guest.id, owner, {
      version: guest.version,
      groupId: null,
      email: null,
      phone: null,
      notes: null,
      relationLabel: null,
      dietaryPreference: null,
      address: null,
    });
    expect(result.status).toBe(200);
    expect(result.json.data).toMatchObject({
      groupId: null,
      email: null,
      phone: null,
      notes: null,
      relationLabel: null,
      dietaryPreference: null,
      address: null,
    });
  });

  it("rejects a stale version with VERSION_CONFLICT", async () => {
    const { weddingId, owner } = await setupWedding();
    const guest = await makeGuest(weddingId, owner);
    const first = await patchGuest(weddingId, guest.id, owner, {
      version: guest.version,
      name: "First edit",
    });
    expect(first.status).toBe(200);
    const stale = await patchGuest(weddingId, guest.id, owner, {
      version: guest.version,
      name: "Stale edit",
    });
    expect(stale.status).toBe(409);
    expect(stale.json.error.code).toBe("VERSION_CONFLICT");
    expect((await getGuest(weddingId, guest.id, owner)).json.data.name).toBe("First edit");
  });

  it("applies exactly one of two simultaneous edits", async () => {
    const { weddingId, owner } = await setupWedding();
    const guest = await makeGuest(weddingId, owner);
    const results = await Promise.all([
      patchGuest(weddingId, guest.id, owner, { version: guest.version, name: "One" }),
      patchGuest(weddingId, guest.id, owner, { version: guest.version, name: "Two" }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  });

  it("lets any role edit any guest", async () => {
    const { weddingId, owner } = await setupWedding();
    const member = await addMember(weddingId, "member");
    const guest = await makeGuest(weddingId, owner);
    const result = await patchGuest(weddingId, guest.id, member, {
      version: guest.version,
      name: "Edited by a member",
    });
    expect(result.status).toBe(200);
  });

  it("needs the version and at least one change, and rejects unknown fields", async () => {
    const { weddingId, owner } = await setupWedding();
    const guest = await makeGuest(weddingId, owner);
    expect((await patchGuest(weddingId, guest.id, owner, { name: "x" })).status).toBe(400);
    expect((await patchGuest(weddingId, guest.id, owner, { version: 0 })).status).toBe(400);
    expect(
      (
        await patchGuest(weddingId, guest.id, owner, {
          version: 0,
          invitation: { status: "invited" },
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await patchGuest(weddingId, guest.id, owner, {
          version: 0,
          weddingId: "0123456789abcdef01234567",
        })
      ).status,
    ).toBe(400);
  });

  it("answers 404 for a group of another wedding", async () => {
    const a = await setupWedding();
    const b = await setupWedding("Other wedding");
    const foreign = (await createGroup(b.weddingId, b.owner, { name: "F", side: "both" })).json
      .data;
    const guest = await makeGuest(a.weddingId, a.owner);
    const result = await patchGuest(a.weddingId, guest.id, a.owner, {
      version: guest.version,
      groupId: foreign.id,
    });
    expect(result.status).toBe(404);
  });

  it("answers 404 for another wedding's guest", async () => {
    const a = await setupWedding();
    const b = await setupWedding("Other wedding");
    const guest = await makeGuest(a.weddingId, a.owner);
    const result = await patchGuest(b.weddingId, guest.id, b.owner, {
      version: guest.version,
      name: "Hijacked",
    });
    expect(result.status).toBe(404);
    expect((await getGuest(a.weddingId, guest.id, a.owner)).json.data.name).toBe("Rahul Sharma");
  });

  describe("eventIds (the guest's whole set of events)", () => {
    it("adds new events as pending and removes the ones left out", async () => {
      const { weddingId, owner } = await setupWedding();
      const haldi = await makeEvent(weddingId, owner, "Haldi");
      const sangeet = await makeEvent(weddingId, owner, "Sangeet");
      const reception = await makeEvent(weddingId, owner, "Reception");
      const guest = await makeGuest(weddingId, owner, { eventIds: [haldi, sangeet] });
      const result = await patchGuest(weddingId, guest.id, owner, {
        version: guest.version,
        eventIds: [sangeet, reception],
      });
      expect(result.status).toBe(200);
      expect(result.json.data.responses.map((r: { eventId: string }) => r.eventId).sort()).toEqual(
        [sangeet, reception].sort(),
      );
    });

    it("keeps a recorded reply for an event that stays", async () => {
      const { weddingId, owner } = await setupWedding();
      const haldi = await makeEvent(weddingId, owner, "Haldi");
      const sangeet = await makeEvent(weddingId, owner, "Sangeet");
      const guest = await makeGuest(weddingId, owner, { eventIds: [haldi], plusOnesAllowed: 1 });
      const { record } = await import("./helpers");
      await record(weddingId, guest.id, haldi, owner, { status: "attending", attendingCount: 2 });
      const result = await patchGuest(weddingId, guest.id, owner, {
        version: guest.version,
        eventIds: [haldi, sangeet],
      });
      const byEvent = Object.fromEntries(
        result.json.data.responses.map((r: { eventId: string }) => [r.eventId, r]),
      );
      expect(byEvent[haldi]).toMatchObject({ status: "attending", attendingCount: 2 });
      expect(byEvent[sangeet]).toMatchObject({ status: "pending" });
    });

    it("can take a guest off every event, and put them back", async () => {
      const { weddingId, owner } = await setupWedding();
      const haldi = await makeEvent(weddingId, owner, "Haldi");
      const guest = await makeGuest(weddingId, owner, { eventIds: [haldi] });
      const off = await patchGuest(weddingId, guest.id, owner, {
        version: guest.version,
        eventIds: [],
      });
      expect(off.json.data.responses).toEqual([]);
      const back = await patchGuest(weddingId, guest.id, owner, {
        version: off.json.data.version,
        eventIds: [haldi],
      });
      expect(back.status).toBe(200);
      expect(back.json.data.responses).toHaveLength(1);
    });

    it("answers 404 for an event of another wedding and changes nothing", async () => {
      const a = await setupWedding();
      const b = await setupWedding("Other wedding");
      const foreign = await makeEvent(b.weddingId, b.owner);
      const haldi = await makeEvent(a.weddingId, a.owner, "Haldi");
      const guest = await makeGuest(a.weddingId, a.owner, { eventIds: [haldi] });
      const result = await patchGuest(a.weddingId, guest.id, a.owner, {
        version: guest.version,
        name: "Changed",
        eventIds: [foreign],
      });
      expect(result.status).toBe(404);
      const after = (await getGuest(a.weddingId, guest.id, a.owner)).json.data;
      expect(after.name).toBe("Rahul Sharma");
      expect(after.responses).toHaveLength(1);
    });

    it("rolls back the guest's own changes when a stale version stops the edit", async () => {
      const { weddingId, owner } = await setupWedding();
      const haldi = await makeEvent(weddingId, owner, "Haldi");
      const guest = await makeGuest(weddingId, owner);
      await patchGuest(weddingId, guest.id, owner, { version: guest.version, name: "First" });
      const stale = await patchGuest(weddingId, guest.id, owner, {
        version: guest.version,
        eventIds: [haldi],
      });
      expect(stale.status).toBe(409);
      expect((await getGuest(weddingId, guest.id, owner)).json.data.responses).toEqual([]);
    });
  });

  describe("plus-ones", () => {
    it("refuses lowering plus-ones below a reply already recorded", async () => {
      const { weddingId, owner } = await setupWedding();
      const haldi = await makeEvent(weddingId, owner);
      const guest = await makeGuest(weddingId, owner, { plusOnesAllowed: 2, eventIds: [haldi] });
      const { record } = await import("./helpers");
      await record(weddingId, guest.id, haldi, owner, { status: "attending", attendingCount: 3 });
      const result = await patchGuest(weddingId, guest.id, owner, {
        version: guest.version,
        plusOnesAllowed: 1,
      });
      expect(result.status).toBe(422);
      expect(result.json.error.code).toBe("BUSINESS_RULE_VIOLATION");
      const fine = await patchGuest(weddingId, guest.id, owner, {
        version: guest.version,
        plusOnesAllowed: 2,
      });
      expect(fine.status).toBe(200);
    });

    it("allows lowering them when the over-count event is being removed in the same edit", async () => {
      const { weddingId, owner } = await setupWedding();
      const haldi = await makeEvent(weddingId, owner);
      const guest = await makeGuest(weddingId, owner, { plusOnesAllowed: 2, eventIds: [haldi] });
      const { record } = await import("./helpers");
      await record(weddingId, guest.id, haldi, owner, { status: "attending", attendingCount: 3 });
      const result = await patchGuest(weddingId, guest.id, owner, {
        version: guest.version,
        plusOnesAllowed: 0,
        eventIds: [],
      });
      expect(result.status).toBe(200);
    });
  });
});

describe("DELETE /weddings/:weddingId/guests/:guestId", () => {
  it("soft-deletes the guest and their replies together", async () => {
    const { weddingId, owner } = await setupWedding();
    const haldi = await makeEvent(weddingId, owner, "Haldi");
    const reception = await makeEvent(weddingId, owner, "Reception");
    const guest = await makeGuest(weddingId, owner, { eventIds: [haldi, reception] });
    const result = await deleteGuest(weddingId, guest.id, owner);
    expect(result.status).toBe(200);
    expect(result.json.data).toMatchObject({ id: guest.id, rsvpsRemoved: 2 });
    expect(result.json.data.deletedAt).toEqual(expect.any(String));
    expect((await getGuest(weddingId, guest.id, owner)).status).toBe(404);
    expect((await listGuests(weddingId, owner)).json.data).toEqual([]);
    const { headcount } = await import("./helpers");
    const count = await headcount(weddingId, owner, `?eventId=${haldi}`);
    expect(count.json.data.byStatus).toEqual({ pending: 0, attending: 0, declined: 0, maybe: 0 });
  });

  it("answers 404 the second time", async () => {
    const { weddingId, owner } = await setupWedding();
    const guest = await makeGuest(weddingId, owner);
    await deleteGuest(weddingId, guest.id, owner);
    expect((await deleteGuest(weddingId, guest.id, owner)).status).toBe(404);
  });

  it("answers 404 for another wedding's guest and leaves it alone", async () => {
    const a = await setupWedding();
    const b = await setupWedding("Other wedding");
    const guest = await makeGuest(a.weddingId, a.owner);
    expect((await deleteGuest(b.weddingId, guest.id, b.owner)).status).toBe(404);
    expect((await getGuest(a.weddingId, guest.id, a.owner)).status).toBe(200);
  });

  it("lets any role delete any guest", async () => {
    const { weddingId, owner } = await setupWedding();
    const member = await addMember(weddingId, "member");
    const guest = await makeGuest(weddingId, owner);
    expect((await deleteGuest(weddingId, guest.id, member)).status).toBe(200);
  });
});

describe("POST /weddings/:weddingId/guests/bulk", () => {
  it("deletes several guests and their replies at once", async () => {
    const { weddingId, owner } = await setupWedding();
    const haldi = await makeEvent(weddingId, owner);
    const one = await makeGuest(weddingId, owner, { name: "One", eventIds: [haldi] });
    const two = await makeGuest(weddingId, owner, { name: "Two", eventIds: [haldi] });
    await makeGuest(weddingId, owner, { name: "Three", eventIds: [haldi] });
    const result = await bulk(weddingId, owner, { action: "delete", guestIds: [one.id, two.id] });
    expect(result.status).toBe(200);
    expect(result.json.data).toMatchObject({
      action: "delete",
      requested: 2,
      affected: 2,
      rsvpsRemoved: 2,
    });
    expect(
      (await listGuests(weddingId, owner)).json.data.map((g: { name: string }) => g.name),
    ).toEqual(["Three"]);
  });

  it("moves several guests to a group, or out of any group", async () => {
    const { weddingId, owner } = await setupWedding();
    const group = (await createGroup(weddingId, owner, { name: "Team", side: "both" })).json.data;
    const one = await makeGuest(weddingId, owner, { name: "One" });
    const two = await makeGuest(weddingId, owner, { name: "Two", groupId: group.id });
    const moved = await bulk(weddingId, owner, {
      action: "set-group",
      guestIds: [one.id, two.id],
      groupId: group.id,
    });
    expect(moved.status).toBe(200);
    expect(moved.json.data).toMatchObject({ requested: 2, affected: 2 });
    expect((await listGroups(weddingId, owner)).json.data[0].guestCount).toBe(2);

    const cleared = await bulk(weddingId, owner, {
      action: "set-group",
      guestIds: [one.id, two.id],
      groupId: null,
    });
    expect(cleared.json.data.affected).toBe(2);
    expect((await listGroups(weddingId, owner)).json.data[0].guestCount).toBe(0);
  });

  it("fails as a whole when any guest is gone or foreign, changing nothing", async () => {
    const a = await setupWedding();
    const b = await setupWedding("Other wedding");
    const mine = await makeGuest(a.weddingId, a.owner, { name: "Mine" });
    const gone = await makeGuest(a.weddingId, a.owner, { name: "Gone" });
    const foreign = await makeGuest(b.weddingId, b.owner, { name: "Foreign" });
    await deleteGuest(a.weddingId, gone.id, a.owner);

    for (const other of [gone.id, foreign.id, "0123456789abcdef01234567"]) {
      const result = await bulk(a.weddingId, a.owner, {
        action: "delete",
        guestIds: [mine.id, other],
      });
      expect(result.status, other).toBe(404);
    }
    expect((await listGuests(a.weddingId, a.owner)).json.data).toHaveLength(1);
    expect((await getGuest(b.weddingId, foreign.id, b.owner)).status).toBe(200);
  });

  it("answers 404 for a group of another wedding", async () => {
    const a = await setupWedding();
    const b = await setupWedding("Other wedding");
    const foreign = (await createGroup(b.weddingId, b.owner, { name: "F", side: "both" })).json
      .data;
    const guest = await makeGuest(a.weddingId, a.owner);
    const result = await bulk(a.weddingId, a.owner, {
      action: "set-group",
      guestIds: [guest.id],
      groupId: foreign.id,
    });
    expect(result.status).toBe(404);
  });

  it("validates the body", async () => {
    const { weddingId, owner } = await setupWedding();
    const guest = await makeGuest(weddingId, owner);
    const bad: Record<string, unknown>[] = [
      { action: "delete", guestIds: [] },
      { action: "delete", guestIds: [guest.id, guest.id] },
      { action: "delete", guestIds: ["x"] },
      { action: "set-group", guestIds: [guest.id] },
      { action: "explode", guestIds: [guest.id] },
      { action: "delete", guestIds: [guest.id], groupId: null },
      { guestIds: [guest.id] },
      {
        action: "delete",
        guestIds: Array.from({ length: 201 }, (_, i) => i.toString(16).padStart(24, "0")),
      },
    ];
    for (const body of bad) {
      expect((await bulk(weddingId, owner, body)).status, JSON.stringify(body)).toBe(400);
    }
  });

  it("denies non-members", async () => {
    const a = await setupWedding();
    const b = await setupWedding("Other wedding");
    const guest = await makeGuest(a.weddingId, a.owner);
    const result = await bulk(a.weddingId, b.owner, { action: "delete", guestIds: [guest.id] });
    expect(result.status).toBe(403);
  });
});
