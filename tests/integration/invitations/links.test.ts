import mongoose from "mongoose";
import { describe, expect, it } from "vitest";
import { Guest } from "@/models/guest.model";
import { setupTestDatabase } from "../../setup/database";
import { addMember, setupWedding } from "../../setup/wedding";
import {
  createLink,
  getLink,
  makeEvent,
  makeGuest,
  publicRsvp,
  rotateLink,
  tokenOf,
} from "./helpers";

setupTestDatabase();

describe("a guest's personal link", () => {
  it("does not exist until someone asks for it, and a GET never creates it", async () => {
    const { weddingId, owner } = await setupWedding();
    const guest = await makeGuest(weddingId, owner);
    const before = await getLink(weddingId, guest.id, owner);
    expect(before.status).toBe(200);
    expect(before.json.data).toBeNull();
    expect((await getLink(weddingId, guest.id, owner)).json.data).toBeNull();
  });

  it("is created on request and is then the SAME link every time", async () => {
    const { weddingId, owner } = await setupWedding();
    const guest = await makeGuest(weddingId, owner);
    const first = await createLink(weddingId, guest.id, owner);
    expect(first.status).toBe(200);
    expect(first.json.data.inviteUrl).toMatch(/^http:\/\/localhost:3000\/i\/[A-Za-z0-9_-]{40,}$/);

    const second = await createLink(weddingId, guest.id, owner);
    expect(second.json.data.inviteUrl).toBe(first.json.data.inviteUrl);
    const read = await getLink(weddingId, guest.id, owner);
    expect(read.json.data.inviteUrl).toBe(first.json.data.inviteUrl);
  });

  it("never stores the token in the clear", async () => {
    const { weddingId, owner } = await setupWedding();
    const guest = await makeGuest(weddingId, owner);
    const { inviteUrl } = (await createLink(weddingId, guest.id, owner)).json.data;
    const token = tokenOf(inviteUrl);

    const stored = await mongoose.connection
      .db!.collection("guests")
      .findOne({ _id: new mongoose.Types.ObjectId(guest.id) });
    const text = JSON.stringify(stored);
    expect(text).not.toContain(token);
    expect(stored!.link.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(stored!.link.tokenEnc).toMatch(/^v1\./);
  });

  it("is never part of the guest list or detail responses", async () => {
    const { weddingId, owner } = await setupWedding();
    const guest = await makeGuest(weddingId, owner);
    const { inviteUrl } = (await createLink(weddingId, guest.id, owner)).json.data;
    const token = tokenOf(inviteUrl);
    const { getGuest, listGuests } = await import("../guests/helpers");
    const detail = JSON.stringify((await getGuest(weddingId, guest.id, owner)).json);
    const list = JSON.stringify((await listGuests(weddingId, owner)).json);
    for (const body of [detail, list]) {
      expect(body).not.toContain(token);
      expect(body).not.toContain("tokenHash");
      expect(body).not.toContain("tokenEnc");
    }
  });

  it("works for every role", async () => {
    const { weddingId, owner } = await setupWedding();
    const guest = await makeGuest(weddingId, owner);
    for (const who of [owner, await addMember(weddingId, "admin"), await addMember(weddingId)]) {
      expect((await createLink(weddingId, guest.id, who)).status).toBe(200);
    }
  });

  it("rotating gives a new link and kills the old one at once", async () => {
    const { weddingId, owner } = await setupWedding();
    const haldi = await makeEvent(weddingId, owner);
    const guest = await makeGuest(weddingId, owner, { eventIds: [haldi] });
    const oldUrl = (await createLink(weddingId, guest.id, owner)).json.data.inviteUrl;
    expect((await publicRsvp(tokenOf(oldUrl))).status).toBe(200);

    const rotated = await rotateLink(weddingId, guest.id, owner);
    expect(rotated.status).toBe(200);
    const newUrl = rotated.json.data.inviteUrl;
    expect(newUrl).not.toBe(oldUrl);

    const oldTry = await publicRsvp(tokenOf(oldUrl));
    expect(oldTry.status).toBe(403);
    expect(oldTry.json.error.code).toBe("INVALID_TOKEN");
    expect((await publicRsvp(tokenOf(newUrl))).status).toBe(200);
    // Asking again returns the rotated link, not another new one.
    expect((await createLink(weddingId, guest.id, owner)).json.data.inviteUrl).toBe(newUrl);
  });

  it("two simultaneous requests end up with the same link", async () => {
    const { weddingId, owner } = await setupWedding();
    const guest = await makeGuest(weddingId, owner);
    const results = await Promise.all(
      Array.from({ length: 6 }, () => createLink(weddingId, guest.id, owner)),
    );
    const urls = new Set(results.map((result) => result.json.data.inviteUrl));
    expect(results.every((result) => result.status === 200)).toBe(true);
    expect(urls.size).toBe(1);
  });

  it("replaces a stored link that can no longer be decrypted instead of failing", async () => {
    const { weddingId, owner } = await setupWedding();
    const guest = await makeGuest(weddingId, owner);
    const first = (await createLink(weddingId, guest.id, owner)).json.data.inviteUrl;
    await Guest.updateOne({ _id: guest.id }, { $set: { "link.tokenEnc": "v1.bad.bad.bad" } });
    const second = (await createLink(weddingId, guest.id, owner)).json.data.inviteUrl;
    expect(second).not.toBe(first);
    expect((await getLink(weddingId, guest.id, owner)).json.data.inviteUrl).toBe(second);
  });

  it("answers 404 for a guest of another wedding", async () => {
    const a = await setupWedding();
    const b = await setupWedding("Other wedding");
    const foreign = await makeGuest(b.weddingId, b.owner);
    expect((await createLink(a.weddingId, foreign.id, a.owner)).status).toBe(404);
    expect((await getLink(a.weddingId, foreign.id, a.owner)).status).toBe(404);
    expect((await rotateLink(a.weddingId, foreign.id, a.owner)).status).toBe(404);
  });

  it("keeps a person outside the wedding out (403)", async () => {
    const a = await setupWedding();
    const b = await setupWedding("Other wedding");
    const guest = await makeGuest(a.weddingId, a.owner);
    expect((await createLink(a.weddingId, guest.id, b.owner)).status).toBe(403);
  });
});
