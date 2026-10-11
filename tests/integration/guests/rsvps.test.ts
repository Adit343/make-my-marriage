import { describe, expect, it } from "vitest";
import { DELETE as deleteEvent } from "@/app/api/v1/weddings/[weddingId]/events/[eventId]/route";
import { DELETE as deleteWedding } from "@/app/api/v1/weddings/[weddingId]/route";
import { call } from "../../setup/http";
import { setupTestDatabase } from "../../setup/database";
import { addMember, setupWedding } from "../../setup/wedding";
import {
  assign,
  getGuest,
  headcount,
  listGuestRsvps,
  listGuests,
  makeEvent,
  makeGuest,
  record,
  summary,
  unassign,
} from "./helpers";

setupTestDatabase();

describe("assigning a guest to an event", () => {
  it("invites the guest with a pending reply", async () => {
    const { weddingId, owner } = await setupWedding();
    const haldi = await makeEvent(weddingId, owner);
    const guest = await makeGuest(weddingId, owner);
    const result = await assign(weddingId, guest.id, owner, haldi);
    expect(result.status).toBe(201);
    expect(result.json.data).toEqual({
      eventId: haldi,
      status: "pending",
      attendingCount: 0,
      note: null,
      respondedAt: null,
      respondedVia: null,
    });
    const list = await listGuestRsvps(weddingId, guest.id, owner);
    expect(list.json.data).toHaveLength(1);
  });

  it("refuses inviting the same guest to the same event twice", async () => {
    const { weddingId, owner } = await setupWedding();
    const haldi = await makeEvent(weddingId, owner);
    const guest = await makeGuest(weddingId, owner);
    await assign(weddingId, guest.id, owner, haldi);
    const again = await assign(weddingId, guest.id, owner, haldi);
    expect(again.status).toBe(409);
    expect(again.json.error.code).toBe("CONFLICT");
  });

  it("answers 404 for an event or guest of another wedding", async () => {
    const a = await setupWedding();
    const b = await setupWedding("Other wedding");
    const foreignEvent = await makeEvent(b.weddingId, b.owner);
    const foreignGuest = await makeGuest(b.weddingId, b.owner);
    const guest = await makeGuest(a.weddingId, a.owner);
    const event = await makeEvent(a.weddingId, a.owner);
    expect((await assign(a.weddingId, guest.id, a.owner, foreignEvent)).status).toBe(404);
    expect((await assign(a.weddingId, foreignGuest.id, a.owner, event)).status).toBe(404);
    expect((await listGuestRsvps(a.weddingId, foreignGuest.id, a.owner)).status).toBe(404);
  });

  it("validates the event id", async () => {
    const { weddingId, owner } = await setupWedding();
    const guest = await makeGuest(weddingId, owner);
    expect((await assign(weddingId, guest.id, owner, "nope")).status).toBe(400);
  });

  it("can be undone, and redone with a fresh pending reply", async () => {
    const { weddingId, owner } = await setupWedding();
    const haldi = await makeEvent(weddingId, owner);
    const guest = await makeGuest(weddingId, owner, { eventIds: [haldi] });
    await record(weddingId, guest.id, haldi, owner, { status: "attending", attendingCount: 1 });

    const removed = await unassign(weddingId, guest.id, haldi, owner);
    expect(removed.status).toBe(200);
    expect((await listGuestRsvps(weddingId, guest.id, owner)).json.data).toEqual([]);
    expect((await unassign(weddingId, guest.id, haldi, owner)).status).toBe(404);

    const back = await assign(weddingId, guest.id, owner, haldi);
    expect(back.status).toBe(201);
    expect(back.json.data.status).toBe("pending");
  });

  it("lets every role assign and unassign", async () => {
    const { weddingId, owner } = await setupWedding();
    const member = await addMember(weddingId, "member");
    const haldi = await makeEvent(weddingId, owner);
    const guest = await makeGuest(weddingId, owner);
    expect((await assign(weddingId, guest.id, member, haldi)).status).toBe(201);
    expect((await unassign(weddingId, guest.id, haldi, member)).status).toBe(200);
  });
});

describe("recording a reply by hand", () => {
  async function setup(plusOnes = 1) {
    const wedding = await setupWedding();
    const haldi = await makeEvent(wedding.weddingId, wedding.owner);
    const guest = await makeGuest(wedding.weddingId, wedding.owner, {
      plusOnesAllowed: plusOnes,
      eventIds: [haldi],
    });
    return { ...wedding, haldi, guest };
  }

  it("marks attending with a headcount, who recorded it and when", async () => {
    const { weddingId, owner, haldi, guest } = await setup();
    const result = await record(weddingId, guest.id, haldi, owner, {
      status: "attending",
      attendingCount: 2,
      note: "Coming with his wife",
    });
    expect(result.status).toBe(200);
    expect(result.json.data).toMatchObject({
      eventId: haldi,
      status: "attending",
      attendingCount: 2,
      note: "Coming with his wife",
      respondedVia: "member",
    });
    expect(Date.parse(result.json.data.respondedAt)).not.toBeNaN();
  });

  it("counts just the guest when attending is recorded without a number", async () => {
    const { weddingId, owner, haldi, guest } = await setup();
    const result = await record(weddingId, guest.id, haldi, owner, { status: "attending" });
    expect(result.json.data.attendingCount).toBe(1);
  });

  it("counts nobody for declined, and nobody for pending", async () => {
    const { weddingId, owner, haldi, guest } = await setup();
    await record(weddingId, guest.id, haldi, owner, { status: "attending", attendingCount: 2 });
    const declined = await record(weddingId, guest.id, haldi, owner, {
      status: "declined",
      attendingCount: 2,
    });
    expect(declined.json.data).toMatchObject({ status: "declined", attendingCount: 0 });
    expect(declined.json.data.respondedAt).not.toBeNull();

    const reset = await record(weddingId, guest.id, haldi, owner, { status: "pending" });
    expect(reset.json.data).toMatchObject({
      status: "pending",
      attendingCount: 0,
      respondedAt: null,
      respondedVia: null,
    });
  });

  it("accepts maybe with a headcount", async () => {
    const { weddingId, owner, haldi, guest } = await setup();
    const result = await record(weddingId, guest.id, haldi, owner, {
      status: "maybe",
      attendingCount: 2,
    });
    expect(result.json.data).toMatchObject({ status: "maybe", attendingCount: 2 });
  });

  it("keeps the earlier note when none is sent, and clears it with null", async () => {
    const { weddingId, owner, haldi, guest } = await setup();
    await record(weddingId, guest.id, haldi, owner, { status: "declined", note: "Travelling" });
    const kept = await record(weddingId, guest.id, haldi, owner, { status: "declined" });
    expect(kept.json.data.note).toBe("Travelling");
    const cleared = await record(weddingId, guest.id, haldi, owner, {
      status: "declined",
      note: null,
    });
    expect(cleared.json.data.note).toBeNull();
  });

  it("refuses more people than the guest plus their allowed plus-ones (422)", async () => {
    const { weddingId, owner, haldi, guest } = await setup(1);
    const tooMany = await record(weddingId, guest.id, haldi, owner, {
      status: "attending",
      attendingCount: 3,
    });
    expect(tooMany.status).toBe(422);
    expect(tooMany.json.error.code).toBe("BUSINESS_RULE_VIOLATION");
    const zero = await record(weddingId, guest.id, haldi, owner, {
      status: "attending",
      attendingCount: 0,
    });
    expect(zero.status).toBe(422);
  });

  it("explains a guest with no plus-ones can only be counted once", async () => {
    const { weddingId, owner, haldi, guest } = await setup(0);
    const result = await record(weddingId, guest.id, haldi, owner, {
      status: "attending",
      attendingCount: 2,
    });
    expect(result.status).toBe(422);
    expect(result.json.error.message).toMatch(/can't bring anyone/);
    expect(
      (await record(weddingId, guest.id, haldi, owner, { status: "attending", attendingCount: 1 }))
        .status,
    ).toBe(200);
  });

  it("answers 400 for malformed input", async () => {
    const { weddingId, owner, haldi, guest } = await setup();
    for (const body of [
      {},
      { status: "yes" },
      { status: "attending", attendingCount: -1 },
      { status: "attending", attendingCount: 12 },
      { status: "attending", attendingCount: 1.5 },
      { status: "declined", respondedVia: "guest_link" },
      { status: "declined", note: "n".repeat(501) },
    ]) {
      expect(
        (await record(weddingId, guest.id, haldi, owner, body)).status,
        JSON.stringify(body),
      ).toBe(400);
    }
  });

  it("answers 404 when the guest is not invited to that event", async () => {
    const { weddingId, owner, guest } = await setup();
    const other = await makeEvent(weddingId, owner, "Sangeet");
    expect((await record(weddingId, guest.id, other, owner, { status: "declined" })).status).toBe(
      404,
    );
  });

  it("answers 404 across weddings and lets every role record", async () => {
    const a = await setup();
    const b = await setupWedding("Other wedding");
    expect(
      (await record(b.weddingId, a.guest.id, a.haldi, b.owner, { status: "declined" })).status,
    ).toBe(404);
    const member = await addMember(a.weddingId, "member");
    expect(
      (await record(a.weddingId, a.guest.id, a.haldi, member, { status: "declined" })).status,
    ).toBe(200);
  });

  it("shows up in the guest list and the guest's detail", async () => {
    const { weddingId, owner, haldi, guest } = await setup();
    await record(weddingId, guest.id, haldi, owner, { status: "attending", attendingCount: 2 });
    const list = await listGuests(weddingId, owner);
    expect(list.json.data[0].rsvps).toEqual([
      { eventId: haldi, status: "attending", attendingCount: 2 },
    ]);
    expect(list.json.data[0].rsvpSummary).toEqual({ invitedToCount: 1, respondedCount: 1 });
    const detail = await getGuest(weddingId, guest.id, owner);
    expect(detail.json.data.responses[0]).toMatchObject({ status: "attending", attendingCount: 2 });
  });
});

describe("numbers for the guest screen", () => {
  async function seed() {
    const wedding = await setupWedding();
    const { weddingId, owner } = wedding;
    const haldi = await makeEvent(weddingId, owner, "Haldi");
    const reception = await makeEvent(weddingId, owner, "Reception");
    const a = await makeGuest(weddingId, owner, {
      name: "A",
      plusOnesAllowed: 2,
      eventIds: [haldi, reception],
    });
    const b = await makeGuest(weddingId, owner, {
      name: "B",
      plusOnesAllowed: 1,
      eventIds: [haldi],
    });
    const c = await makeGuest(weddingId, owner, { name: "C", eventIds: [haldi, reception] });
    await makeGuest(weddingId, owner, { name: "D" });
    await record(weddingId, a.id, haldi, owner, { status: "attending", attendingCount: 3 });
    await record(weddingId, b.id, haldi, owner, { status: "attending", attendingCount: 2 });
    await record(weddingId, c.id, haldi, owner, { status: "declined" });
    await record(weddingId, a.id, reception, owner, { status: "maybe", attendingCount: 1 });
    return { ...wedding, haldi, reception };
  }

  it("summarises the whole wedding", async () => {
    const { weddingId, owner } = await seed();
    const result = await summary(weddingId, owner);
    expect(result.status).toBe(200);
    expect(result.json.data).toEqual({
      totalGuests: 4,
      // Haldi is the busiest event: 3 + 2 people attending.
      expectedHeadcount: 5,
      unsentInvitations: 4,
      // Only C has a pending reply (reception).
      awaitingResponse: 1,
    });
  });

  it("summarises one event", async () => {
    const { weddingId, owner, haldi, reception } = await seed();
    expect((await summary(weddingId, owner, `?eventId=${haldi}`)).json.data).toMatchObject({
      totalGuests: 4,
      expectedHeadcount: 5,
      awaitingResponse: 0,
    });
    expect((await summary(weddingId, owner, `?eventId=${reception}`)).json.data).toMatchObject({
      expectedHeadcount: 0,
      awaitingResponse: 1,
    });
  });

  it("is all zeros for an empty wedding", async () => {
    const { weddingId, owner } = await setupWedding();
    expect((await summary(weddingId, owner)).json.data).toEqual({
      totalGuests: 0,
      expectedHeadcount: 0,
      unsentInvitations: 0,
      awaitingResponse: 0,
    });
  });

  it("reports replies and headcount per event", async () => {
    const { weddingId, owner, haldi, reception } = await seed();
    const result = await headcount(weddingId, owner, `?eventId=${haldi}`);
    expect(result.status).toBe(200);
    expect(result.json.data).toEqual({
      eventId: haldi,
      byStatus: { pending: 0, attending: 2, declined: 1, maybe: 0 },
      totalAttendingCount: 5,
    });
    expect((await headcount(weddingId, owner, `?eventId=${reception}`)).json.data).toMatchObject({
      byStatus: { pending: 1, attending: 0, declined: 0, maybe: 1 },
      totalAttendingCount: 0,
    });
  });

  it("requires an event, and 404s for another wedding's event", async () => {
    const a = await seed();
    const b = await setupWedding("Other wedding");
    const foreign = await makeEvent(b.weddingId, b.owner);
    expect((await headcount(a.weddingId, a.owner)).status).toBe(400);
    expect((await headcount(a.weddingId, a.owner, `?eventId=${foreign}`)).status).toBe(404);
    expect((await summary(a.weddingId, a.owner, `?eventId=${foreign}`)).status).toBe(404);
    expect((await headcount(a.weddingId, b.owner, `?eventId=${a.haldi}`)).status).toBe(403);
  });

  it("leaves another wedding's numbers out", async () => {
    const a = await seed();
    const b = await setupWedding("Other wedding");
    const event = await makeEvent(b.weddingId, b.owner);
    const guest = await makeGuest(b.weddingId, b.owner, { eventIds: [event] });
    await record(b.weddingId, guest.id, event, b.owner, { status: "attending" });
    expect((await summary(a.weddingId, a.owner)).json.data.totalGuests).toBe(4);
    expect((await summary(b.weddingId, b.owner)).json.data).toMatchObject({
      totalGuests: 1,
      expectedHeadcount: 1,
    });
  });
});

describe("deleting an event", () => {
  it("takes its replies with it, in the same transaction, and says how many", async () => {
    const { weddingId, owner } = await setupWedding();
    const haldi = await makeEvent(weddingId, owner, "Haldi");
    const reception = await makeEvent(weddingId, owner, "Reception");
    const one = await makeGuest(weddingId, owner, { name: "One", eventIds: [haldi, reception] });
    await makeGuest(weddingId, owner, { name: "Two", eventIds: [haldi] });

    const result = await call(deleteEvent, {
      method: "DELETE",
      cookie: owner.cookie,
      params: { weddingId, eventId: haldi },
    });
    expect(result.status).toBe(200);
    expect(result.json.data).toMatchObject({ id: haldi, rsvpsRemoved: 2, tasksUnlinked: 0 });

    const detail = await getGuest(weddingId, one.id, owner);
    expect(detail.json.data.responses.map((r: { eventId: string }) => r.eventId)).toEqual([
      reception,
    ]);
    expect((await summary(weddingId, owner)).json.data.totalGuests).toBe(2);
    expect((await summary(weddingId, owner, `?eventId=${haldi}`)).status).toBe(404);
  });
});

describe("a deleted wedding", () => {
  it("closes every guest route, and leaves nothing readable behind", async () => {
    const { weddingId, owner, title } = await setupWedding();
    const guest = await makeGuest(weddingId, owner);
    const removed = await call(deleteWedding, {
      method: "DELETE",
      cookie: owner.cookie,
      params: { weddingId },
      body: { confirm: title },
    });
    expect(removed.status).toBe(200);
    expect((await listGuests(weddingId, owner)).status).toBe(403);
    expect((await getGuest(weddingId, guest.id, owner)).status).toBe(403);
    expect((await summary(weddingId, owner)).status).toBe(403);
  });
});
