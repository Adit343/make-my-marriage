/* eslint-disable @typescript-eslint/no-explicit-any -- response bodies are asserted on */
import { describe, expect, it } from "vitest";
import { setupTestDatabase } from "../../setup/database";
import { addMember, setupWedding } from "../../setup/wedding";
import {
  captureGuestEmails,
  emailLogs,
  invite,
  inviteBatch,
  makeEvent,
  makeGuest,
  overview,
  record,
  replies,
} from "./helpers";
import { createGroup } from "../guests/helpers";

setupTestDatabase();

describe("the invitations overview", () => {
  it("is all zeros for a wedding with no guests", async () => {
    const { weddingId, owner } = await setupWedding();
    const result = await overview(weddingId, owner);
    expect(result.status).toBe(200);
    expect(result.json.data).toEqual({
      totals: { guests: 0, invited: 0, notInvited: 0, noContact: 0 },
      responseCount: 0,
      noContactGuests: [],
      channels: { email: 0, whatsapp: 0, manual: 0 },
      failures: [],
      batches: [],
    });
  });

  it("counts coverage by channel, and the guests nobody can reach", async () => {
    const { weddingId, owner } = await setupWedding();
    captureGuestEmails();
    const event = await makeEvent(weddingId, owner);
    const mailed = await makeGuest(weddingId, owner, {
      name: "A",
      email: "a@example.com",
      eventIds: [event],
    });
    const whatsapped = await makeGuest(weddingId, owner, {
      name: "B",
      phone: "+919876500002",
      eventIds: [event],
    });
    const told = await makeGuest(weddingId, owner, { name: "C", eventIds: [event] });
    await makeGuest(weddingId, owner, { name: "D", eventIds: [event] }); // no contact, never invited
    await invite(weddingId, mailed.id, owner, { channel: "email" });
    await invite(weddingId, whatsapped.id, owner, { channel: "whatsapp" });
    await invite(weddingId, told.id, owner, { channel: "manual" });

    const data = (await overview(weddingId, owner)).json.data;
    expect(data.totals).toEqual({ guests: 4, invited: 3, notInvited: 1, noContact: 2 });
    expect(data.channels).toEqual({ email: 1, whatsapp: 1, manual: 1 });
  });

  it("lists emails that failed as needing attention, and clears them once the guest is reached", async () => {
    const { weddingId, owner } = await setupWedding();
    const { failing } = captureGuestEmails(["bad@example.com"]);
    const event = await makeEvent(weddingId, owner);
    const guest = await makeGuest(weddingId, owner, {
      name: "Ananya",
      email: "bad@example.com",
      eventIds: [event],
    });
    await invite(weddingId, guest.id, owner, { channel: "email" });

    let data = (await overview(weddingId, owner)).json.data;
    expect(data.failures).toHaveLength(1);
    expect(data.failures[0]).toMatchObject({
      guestId: guest.id,
      name: "Ananya",
      email: "bad@example.com",
      kind: "invitation",
      error: { code: "mailbox_full" },
    });
    expect(data.totals.invited).toBe(0);

    // Reached another way afterwards: no longer needs attention.
    await invite(weddingId, guest.id, owner, { channel: "manual" });
    data = (await overview(weddingId, owner)).json.data;
    expect(data.failures).toEqual([]);

    // And a fresh failure followed by a successful retry also clears.
    failing.clear();
    const other = await makeGuest(weddingId, owner, {
      name: "Kunal",
      email: "k@example.com",
      eventIds: [event],
    });
    failing.add("k@example.com");
    await invite(weddingId, other.id, owner, { channel: "email" });
    expect((await overview(weddingId, owner)).json.data.failures).toHaveLength(1);
    failing.clear();
    await invite(weddingId, other.id, owner, { channel: "email" });
    expect((await overview(weddingId, owner)).json.data.failures).toEqual([]);
  });

  it("summarises recent email batches", async () => {
    const { weddingId, owner } = await setupWedding();
    captureGuestEmails(["f@example.com"]);
    const event = await makeEvent(weddingId, owner);
    const ok1 = await makeGuest(weddingId, owner, {
      name: "One",
      email: "1@example.com",
      eventIds: [event],
    });
    const ok2 = await makeGuest(weddingId, owner, {
      name: "Two",
      email: "2@example.com",
      eventIds: [event],
    });
    const bad = await makeGuest(weddingId, owner, {
      name: "Bad",
      email: "f@example.com",
      eventIds: [event],
    });
    const sent = await inviteBatch(weddingId, owner, {
      guestIds: [ok1.id, ok2.id, bad.id],
      channel: "email",
    });
    const batches = (await overview(weddingId, owner)).json.data.batches;
    expect(batches).toHaveLength(1);
    expect(batches[0]).toMatchObject({
      batchId: sent.json.data.batchId,
      kind: "invitation",
      total: 3,
      sent: 2,
      failed: 1,
    });
  });

  it("is isolated per wedding and open to every role", async () => {
    const a = await setupWedding();
    const b = await setupWedding("Other wedding");
    await makeGuest(b.weddingId, b.owner);
    expect((await overview(a.weddingId, a.owner)).json.data.totals.guests).toBe(0);
    expect((await overview(a.weddingId, b.owner)).status).toBe(403);
    expect((await overview(a.weddingId, await addMember(a.weddingId))).status).toBe(200);
  });
});

describe("the delivery log", () => {
  it("pages newest first with a cursor and filters by status and type", async () => {
    const { weddingId, owner } = await setupWedding();
    captureGuestEmails(["bad@example.com"]);
    const event = await makeEvent(weddingId, owner);
    const ids: string[] = [];
    for (let index = 0; index < 5; index += 1) {
      const guest = await makeGuest(weddingId, owner, {
        name: `G${index}`,
        email: index === 2 ? "bad@example.com" : `g${index}@example.com`,
        eventIds: [event],
      });
      ids.push(guest.id);
      await invite(weddingId, guest.id, owner, { channel: "email" });
    }
    const first = await emailLogs(weddingId, owner, "?limit=2");
    expect(first.json.data).toHaveLength(2);
    expect(first.json.meta.hasMore).toBe(true);
    expect(first.json.data[0].recipientEmail).toBe("g4@example.com"); // newest first

    const second = await emailLogs(
      weddingId,
      owner,
      `?limit=2&cursor=${first.json.meta.nextCursor}`,
    );
    const third = await emailLogs(
      weddingId,
      owner,
      `?limit=2&cursor=${second.json.meta.nextCursor}`,
    );
    const all = [...first.json.data, ...second.json.data, ...third.json.data];
    expect(new Set(all.map((row: any) => row.id)).size).toBe(5);
    expect(third.json.meta.hasMore).toBe(false);

    expect((await emailLogs(weddingId, owner, "?status=failed")).json.data).toHaveLength(1);
    expect((await emailLogs(weddingId, owner, "?type=rsvp_reminder")).json.data).toHaveLength(0);
  });

  it("rejects unknown filters and a bad cursor", async () => {
    const { weddingId, owner } = await setupWedding();
    expect((await emailLogs(weddingId, owner, "?foo=1")).status).toBe(400);
    expect((await emailLogs(weddingId, owner, "?status=lost")).status).toBe(400);
    expect((await emailLogs(weddingId, owner, "?cursor=garbage")).status).toBe(400);
  });

  it("never lists member invitations or password resets", async () => {
    const { weddingId, owner } = await setupWedding();
    const { sent } = captureGuestEmails();
    const { POST: invitePerson } =
      await import("@/app/api/v1/weddings/[weddingId]/invitations/route");
    const { call } = await import("../../setup/http");
    await call(invitePerson, {
      cookie: owner.cookie,
      params: { weddingId },
      body: { email: "mom@example.com", role: "member", relationship: "parent" },
    });
    expect(sent.length).toBeGreaterThan(0);
    expect((await emailLogs(weddingId, owner)).json.data).toEqual([]);
  });
});

describe("the RSVP tracker list", () => {
  it("gives every guest of the event with their reply, group and headcount", async () => {
    const { weddingId, owner } = await setupWedding();
    const haldi = await makeEvent(weddingId, owner, "Haldi");
    const sangeet = await makeEvent(weddingId, owner, "Sangeet");
    const group = (
      await createGroup(weddingId, owner, { name: "Sharma Family", side: "partnerOne" })
    ).json.data;
    const rahul = await makeGuest(weddingId, owner, {
      name: "Rahul",
      groupId: group.id,
      plusOnesAllowed: 2,
      eventIds: [haldi, sangeet],
    });
    const meera = await makeGuest(weddingId, owner, { name: "Meera", eventIds: [haldi] });
    await makeGuest(weddingId, owner, { name: "Sangeet only", eventIds: [sangeet] });
    await record(weddingId, rahul.id, haldi, owner, {
      status: "attending",
      attendingCount: 3,
      note: "Phone call",
    });
    await record(weddingId, meera.id, haldi, owner, { status: "declined" });

    const data = (await replies(weddingId, owner, haldi)).json.data;
    expect(data.byStatus).toEqual({ pending: 0, attending: 1, declined: 1, maybe: 0 });
    expect(data.totalAttendingCount).toBe(3);
    expect(data.rows.map((row: any) => row.name)).toEqual(["Meera", "Rahul"]);
    expect(data.rows[1]).toMatchObject({
      guestId: rahul.id,
      groupName: "Sharma Family",
      plusOnesAllowed: 2,
      status: "attending",
      attendingCount: 3,
      note: "Phone call",
      respondedVia: "member",
      invitationStatus: "not_invited",
    });
  });

  it("answers 404 for an event of another wedding and validates the query", async () => {
    const a = await setupWedding();
    const b = await setupWedding("Other");
    const foreign = await makeEvent(b.weddingId, b.owner);
    expect((await replies(a.weddingId, a.owner, foreign)).status).toBe(404);
    expect((await replies(a.weddingId, a.owner, "nope")).status).toBe(400);
  });

  it("does not list guests that were deleted", async () => {
    const { weddingId, owner } = await setupWedding();
    const event = await makeEvent(weddingId, owner);
    const guest = await makeGuest(weddingId, owner, { eventIds: [event] });
    const { deleteGuest } = await import("../guests/helpers");
    await deleteGuest(weddingId, guest.id, owner);
    expect((await replies(weddingId, owner, event)).json.data.rows).toEqual([]);
  });
});
