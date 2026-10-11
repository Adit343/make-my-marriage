/* eslint-disable @typescript-eslint/no-explicit-any -- response bodies are asserted on */
import { describe, expect, it } from "vitest";
import { DELETE as deleteEventRoute } from "@/app/api/v1/weddings/[weddingId]/events/[eventId]/route";
import { DELETE as deleteWeddingRoute } from "@/app/api/v1/weddings/[weddingId]/route";
import { call } from "../../setup/http";
import { setupTestDatabase } from "../../setup/database";
import { setupWedding } from "../../setup/wedding";
import {
  createLink,
  makeEvent,
  makeGuest,
  publicRsvp,
  replies,
  submitRsvp,
  tokenOf,
} from "./helpers";
import { createGuest, deleteGuest, getGuest, headcount, listGuests } from "../guests/helpers";

setupTestDatabase();

async function setup(guestBody: Record<string, unknown> = {}) {
  const wedding = await setupWedding("Aarav & Diya's Wedding");
  const { weddingId, owner } = wedding;
  const haldi = await makeEvent(weddingId, owner, "Haldi");
  const sangeet = await makeEvent(weddingId, owner, "Sangeet");
  const guest = await makeGuest(weddingId, owner, {
    plusOnesAllowed: 1,
    notes: "PRIVATE: allergic to nuts",
    eventIds: [haldi, sangeet],
    ...guestBody,
  });
  const token = tokenOf((await createLink(weddingId, guest.id, owner)).json.data.inviteUrl);
  return { ...wedding, haldi, sangeet, guest, token };
}

describe("opening a personal link", () => {
  it("shows the guest their own name, events and open questions, and nothing else", async () => {
    const { token, haldi } = await setup();
    const result = await publicRsvp(token);
    expect(result.status).toBe(200);
    const data = result.json.data;
    expect(data.weddingTitle).toBe("Aarav & Diya's Wedding");
    expect(data.guest).toEqual({
      name: "Rahul Sharma",
      plusOnesAllowed: 1,
      dietaryPreference: null,
    });
    expect(data.events.map((event: any) => event.name).sort()).toEqual(["Haldi", "Sangeet"]);
    expect(data.events.find((event: any) => event.eventId === haldi)).toMatchObject({
      status: "pending",
      attendingCount: 0,
      respondedAt: null,
    });
    expect(data.hasResponded).toBe(false);
  });

  it("never leaks private data, other guests, ids or secrets", async () => {
    const { token, weddingId, owner, guest } = await setup({ email: "rahul@example.com" });
    await makeGuest(weddingId, owner, { name: "Someone Else", notes: "other guest secret" });
    const body = JSON.stringify((await publicRsvp(token)).json);
    for (const forbidden of [
      "PRIVATE",
      "allergic",
      "Someone Else",
      "other guest secret",
      "weddingId",
      weddingId,
      "tokenHash",
      "tokenEnc",
      "nameNormalized",
      "createdBy",
      "deletedAt",
      "rahul@example.com",
      "side",
      "groupId",
      "sortOrder",
    ]) {
      expect(body, forbidden).not.toContain(forbidden);
    }
    expect(body).not.toContain(`"id":"${guest.id}"`);
  });

  it("answers the same 403 for unknown, malformed and empty links", async () => {
    await setup();
    for (const token of ["nope", "a".repeat(43), "x".repeat(150), "%20"]) {
      const result = await publicRsvp(token);
      expect(result.status, token).toBe(403);
      expect(result.json.error.code).toBe("INVALID_TOKEN");
      expect(JSON.stringify(result.json)).not.toMatch(/stack|mongo/i);
    }
  });

  it("needs no session or cookie", async () => {
    const { token } = await setup();
    expect((await publicRsvp(token)).status).toBe(200);
  });

  it("stops working when the guest is deleted", async () => {
    const { token, weddingId, owner, guest } = await setup();
    await deleteGuest(weddingId, guest.id, owner);
    expect((await publicRsvp(token)).status).toBe(403);
    expect((await submitRsvp(token, { responses: [] })).status).toBe(400);
  });

  it("stops working when the wedding is deleted", async () => {
    const { token, weddingId, owner, title } = await setup();
    const removed = await call(deleteWeddingRoute, {
      method: "DELETE",
      cookie: owner.cookie,
      params: { weddingId },
      body: { confirm: title },
    });
    expect(removed.status).toBe(200);
    expect((await publicRsvp(token)).status).toBe(403);
  });

  it("drops an event that was deleted from the guest's page", async () => {
    const { token, weddingId, owner, haldi } = await setup();
    await call(deleteEventRoute, {
      method: "DELETE",
      cookie: owner.cookie,
      params: { weddingId, eventId: haldi },
    });
    const data = (await publicRsvp(token)).json.data;
    expect(data.events.map((event: any) => event.name)).toEqual(["Sangeet"]);
  });

  it("is rate limited per IP", async () => {
    const { token } = await setup();
    let limited = 0;
    for (let index = 0; index < 65; index += 1) {
      if ((await publicRsvp(token, "192.0.2.77")).status === 429) limited += 1;
    }
    expect(limited).toBeGreaterThan(0);
  });
});

describe("answering", () => {
  it("records the guest's answers per event, who answered, and shows them back", async () => {
    const { token, haldi, sangeet, weddingId, owner, guest } = await setup();
    const result = await submitRsvp(token, {
      responses: [
        { eventId: haldi, status: "attending", attendingCount: 2, note: "So excited!" },
        { eventId: sangeet, status: "declined" },
      ],
      dietaryPreference: "vegetarian",
    });
    expect(result.status).toBe(200);
    const data = result.json.data;
    expect(data.hasResponded).toBe(true);
    expect(data.guest.dietaryPreference).toBe("vegetarian");
    const byId = Object.fromEntries(data.events.map((event: any) => [event.eventId, event]));
    expect(byId[haldi]).toMatchObject({
      status: "attending",
      attendingCount: 2,
      note: "So excited!",
    });
    expect(byId[haldi].respondedAt).toBeTruthy();
    expect(byId[sangeet]).toMatchObject({ status: "declined", attendingCount: 0 });

    // The team sees it, marked as coming from the guest's link.
    const detail = (await getGuest(weddingId, guest.id, owner)).json.data;
    const haldiReply = detail.responses.find((reply: any) => reply.eventId === haldi);
    expect(haldiReply).toMatchObject({
      status: "attending",
      attendingCount: 2,
      respondedVia: "guest_link",
    });
    expect(detail.dietaryPreference).toBe("vegetarian");
    const counts = (await headcount(weddingId, owner, `?eventId=${haldi}`)).json.data;
    expect(counts.totalAttendingCount).toBe(2);
    expect(counts.byStatus.attending).toBe(1);
  });

  it("lets a guest change their mind and answer again", async () => {
    const { token, haldi } = await setup();
    await submitRsvp(token, {
      responses: [{ eventId: haldi, status: "attending", attendingCount: 2 }],
    });
    const again = await submitRsvp(token, { responses: [{ eventId: haldi, status: "maybe" }] });
    const event = again.json.data.events.find((row: any) => row.eventId === haldi);
    expect(event).toMatchObject({ status: "maybe", attendingCount: 1 });
    const declined = await submitRsvp(token, {
      responses: [{ eventId: haldi, status: "declined" }],
    });
    expect(declined.json.data.events.find((row: any) => row.eventId === haldi)).toMatchObject({
      status: "declined",
      attendingCount: 0,
    });
  });

  it("keeps an earlier note when the new answer sends none, and clears it with null", async () => {
    const { token, haldi } = await setup();
    await submitRsvp(token, {
      responses: [{ eventId: haldi, status: "attending", note: "Hello" }],
    });
    const kept = await submitRsvp(token, { responses: [{ eventId: haldi, status: "attending" }] });
    expect(kept.json.data.events.find((row: any) => row.eventId === haldi).note).toBe("Hello");
    const cleared = await submitRsvp(token, {
      responses: [{ eventId: haldi, status: "attending", note: null }],
    });
    expect(cleared.json.data.events.find((row: any) => row.eventId === haldi).note).toBeNull();
  });

  it("refuses more people than the guest plus their allowed plus-ones (422)", async () => {
    const { token, haldi } = await setup({ plusOnesAllowed: 1 });
    const tooMany = await submitRsvp(token, {
      responses: [{ eventId: haldi, status: "attending", attendingCount: 3 }],
    });
    expect(tooMany.status).toBe(422);
    expect(tooMany.json.error.code).toBe("BUSINESS_RULE_VIOLATION");
    const zero = await submitRsvp(token, {
      responses: [{ eventId: haldi, status: "attending", attendingCount: 0 }],
    });
    expect(zero.status).toBe(422);
    // Nothing was saved by the refused attempts.
    expect((await publicRsvp(token)).json.data.hasResponded).toBe(false);
  });

  it("says the invitation is for one person when no plus-ones are allowed", async () => {
    const { token, haldi } = await setup({ plusOnesAllowed: 0 });
    const result = await submitRsvp(token, {
      responses: [{ eventId: haldi, status: "attending", attendingCount: 2 }],
    });
    expect(result.status).toBe(422);
    expect(result.json.error.message).toMatch(/one person/);
  });

  it("is all-or-nothing: one bad answer saves none of them", async () => {
    const { token, haldi, sangeet } = await setup({ plusOnesAllowed: 0 });
    const result = await submitRsvp(token, {
      responses: [
        { eventId: haldi, status: "attending", attendingCount: 1 },
        { eventId: sangeet, status: "attending", attendingCount: 5 },
      ],
    });
    expect(result.status).toBe(422);
    expect((await publicRsvp(token)).json.data.hasResponded).toBe(false);
  });

  it("cannot answer an event the guest is not invited to, or another wedding's (404)", async () => {
    const { token, weddingId, owner } = await setup();
    const uninvited = await makeEvent(weddingId, owner, "Reception");
    const other = await setupWedding("Other");
    const foreign = await makeEvent(other.weddingId, other.owner);
    for (const eventId of [uninvited, foreign]) {
      const result = await submitRsvp(token, { responses: [{ eventId, status: "attending" }] });
      expect(result.status).toBe(404);
    }
  });

  it("only accepts what a guest may write", async () => {
    const { token, haldi, guest } = await setup();
    const responses = [{ eventId: haldi, status: "attending", attendingCount: 1 }];
    const attempts: unknown[] = [
      { responses, plusOnesAllowed: 10 },
      { responses, notes: "hack" },
      { responses, name: "Renamed" },
      { responses, email: "evil@example.com" },
      { responses: [{ eventId: haldi, status: "pending" }] },
      { responses: [{ eventId: haldi, status: "attending", respondedVia: "member" }] },
      { responses: [{ eventId: haldi, status: "attending", attendingCount: -1 }] },
      { responses: [{ eventId: haldi, status: "attending", note: "x".repeat(501) }] },
      {
        responses: [
          { eventId: haldi, status: "attending" },
          { eventId: haldi, status: "maybe" },
        ],
      },
      { responses: [] },
      { dietaryPreference: "vegan" },
      { responses, dietaryPreference: "carnivore" },
      "not an object",
    ];
    for (const body of attempts) {
      expect((await submitRsvp(token, body)).status, JSON.stringify(body)).toBe(400);
    }
    // And none of those changed the guest.
    expect(guest.plusOnesAllowed).toBe(1);
  });

  it("leaves the guest's own record alone: plus-ones, name and notes cannot change", async () => {
    const { token, haldi, weddingId, owner, guest } = await setup();
    await submitRsvp(token, {
      responses: [{ eventId: haldi, status: "attending", attendingCount: 2 }],
      dietaryPreference: "jain",
    });
    const detail = (await getGuest(weddingId, guest.id, owner)).json.data;
    expect(detail).toMatchObject({
      name: "Rahul Sharma",
      plusOnesAllowed: 1,
      notes: "PRIVATE: allergic to nuts",
      dietaryPreference: "jain",
    });
    // The team's edit version is unchanged, so a guest answering never causes an edit conflict.
    expect(detail.version).toBe(guest.version);
  });

  it("shows up in the guest list reply column and the tracker", async () => {
    const { token, haldi, weddingId, owner } = await setup();
    await submitRsvp(token, {
      responses: [{ eventId: haldi, status: "attending", attendingCount: 2 }],
    });
    const list = (await listGuests(weddingId, owner, `?eventId=${haldi}&rsvpStatus=attending`)).json
      .data;
    expect(list).toHaveLength(1);
    const tracker = (await replies(weddingId, owner, haldi)).json.data;
    expect(tracker.totalAttendingCount).toBe(2);
    expect(tracker.byStatus.attending).toBe(1);
    expect(tracker.rows[0]).toMatchObject({
      name: "Rahul Sharma",
      status: "attending",
      attendingCount: 2,
      respondedVia: "guest_link",
    });
  });

  it("a revoked (rotated) link can no longer answer", async () => {
    const { token, haldi, weddingId, owner, guest } = await setup();
    const { rotateLink } = await import("./helpers");
    await rotateLink(weddingId, guest.id, owner);
    const result = await submitRsvp(token, {
      responses: [{ eventId: haldi, status: "attending" }],
    });
    expect(result.status).toBe(403);
  });

  it("two guests answering at once do not interfere", async () => {
    const wedding = await setupWedding();
    const event = await makeEvent(wedding.weddingId, wedding.owner);
    const tokens: string[] = [];
    for (let index = 0; index < 5; index += 1) {
      const g = (
        await createGuest(wedding.weddingId, wedding.owner, {
          name: `Guest ${index}`,
          side: "both",
          eventIds: [event],
        })
      ).json.data;
      tokens.push(
        tokenOf((await createLink(wedding.weddingId, g.id, wedding.owner)).json.data.inviteUrl),
      );
    }
    const results = await Promise.all(
      tokens.map((token) =>
        submitRsvp(token, {
          responses: [{ eventId: event, status: "attending", attendingCount: 1 }],
        }),
      ),
    );
    expect(results.every((result) => result.status === 200)).toBe(true);
    const counts = (await headcount(wedding.weddingId, wedding.owner, `?eventId=${event}`)).json
      .data;
    expect(counts.byStatus.attending).toBe(5);
    expect(counts.totalAttendingCount).toBe(5);
  });
});
