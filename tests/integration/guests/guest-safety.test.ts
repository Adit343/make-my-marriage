import { describe, expect, it } from "vitest";
import { setupTestDatabase } from "../../setup/database";
import { addMember, setupWedding } from "../../setup/wedding";
import {
  assign,
  bulk,
  createGroup,
  createGuest,
  getGuest,
  headcount,
  listGroups,
  listGuestRsvps,
  listGuests,
  makeEvent,
  makeGuest,
  patchGuest,
  record,
  summary,
} from "./helpers";

setupTestDatabase();

// Internal-only fields and secrets that must never reach a response body, whoever asks.
const FORBIDDEN = [
  "tokenHash",
  "tokenEnc",
  "passwordAuth",
  "deletedBy",
  "deletedAt",
  "deletionReason",
  "nameNormalized",
  "respondedByUserId",
  "weddingId",
  "purgeAt",
];

describe("guest responses never leak internal fields", () => {
  it("is clean for every guest route and every role", async () => {
    const { weddingId, owner } = await setupWedding();
    const admin = await addMember(weddingId, "admin");
    const member = await addMember(weddingId, "member");
    const haldi = await makeEvent(weddingId, owner);
    const group = (await createGroup(weddingId, owner, { name: "Family", side: "both" })).json.data;
    const guest = await makeGuest(weddingId, owner, {
      groupId: group.id,
      email: "a@b.co",
      phone: "+919876543210",
      notes: "private note",
      address: { city: "Surat" },
      eventIds: [haldi],
    });

    const responses = [
      await createGuest(weddingId, member, { name: "Made by member", side: "both" }),
      await record(weddingId, guest.id, haldi, admin, { status: "attending", attendingCount: 1 }),
      await patchGuest(weddingId, guest.id, owner, { version: guest.version, plusOnesAllowed: 1 }),
    ];
    for (const person of [owner, admin, member]) {
      responses.push(
        await listGuests(weddingId, person),
        await getGuest(weddingId, guest.id, person),
        await listGroups(weddingId, person),
        await listGuestRsvps(weddingId, guest.id, person),
        await summary(weddingId, person),
        await headcount(weddingId, person, `?eventId=${haldi}`),
      );
    }

    for (const response of responses) {
      expect(response.status).toBeLessThan(400);
      const body = JSON.stringify(response.json);
      for (const word of FORBIDDEN) expect(body, word).not.toContain(word);
    }
  });

  it("keeps private notes and the postal address out of the list, and in the detail", async () => {
    const { weddingId, owner } = await setupWedding();
    const guest = await makeGuest(weddingId, owner, {
      notes: "private note",
      address: { line1: "12 MG Road" },
    });
    expect(JSON.stringify((await listGuests(weddingId, owner)).json)).not.toMatch(
      /private note|12 MG Road/,
    );
    expect(JSON.stringify((await getGuest(weddingId, guest.id, owner)).json)).toMatch(
      /private note.*12 MG Road|12 MG Road.*private note/,
    );
  });
});

describe("one wedding can never touch another's guests", () => {
  it("fails every cross-wedding attempt, by guessed id, without revealing the guest exists", async () => {
    const a = await setupWedding();
    const b = await setupWedding("Other wedding");
    const guest = await makeGuest(a.weddingId, a.owner, { name: "Secret Guest" });
    const event = await makeEvent(a.weddingId, a.owner);

    // B's owner, in B's own wedding, guessing A's guest id.
    expect((await getGuest(b.weddingId, guest.id, b.owner)).status).toBe(404);
    expect(
      (await patchGuest(b.weddingId, guest.id, b.owner, { version: 0, name: "Hijacked" })).status,
    ).toBe(404);
    expect((await assign(b.weddingId, guest.id, b.owner, event)).status).toBe(404);
    expect((await listGuestRsvps(b.weddingId, guest.id, b.owner)).status).toBe(404);
    expect(
      (await bulk(b.weddingId, b.owner, { action: "delete", guestIds: [guest.id] })).status,
    ).toBe(404);
    // B's owner, naming A's wedding: not a member.
    for (const result of [
      await getGuest(a.weddingId, guest.id, b.owner),
      await listGuests(a.weddingId, b.owner),
      await listGroups(a.weddingId, b.owner),
      await summary(a.weddingId, b.owner),
    ]) {
      expect(result.status).toBe(403);
      expect(JSON.stringify(result.json)).not.toContain("Secret Guest");
    }
    // And A's guest is untouched.
    expect((await getGuest(a.weddingId, guest.id, a.owner)).json.data.name).toBe("Secret Guest");
  });
});
