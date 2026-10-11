/* eslint-disable @typescript-eslint/no-explicit-any -- response bodies are asserted on */
import { beforeEach, describe, expect, it } from "vitest";
import { clearCollections, setupTestDatabase } from "../../setup/database";
import { addMember, setupWedding } from "../../setup/wedding";
import {
  addStream,
  createEvent,
  deleteWedding,
  describeWedding,
  liveTokenOf,
  listStreams,
  makeStream,
  patchStream,
  publicLive,
  removeEvent,
  removeStream,
  rotateStream,
  streamBody,
  VIMEO_URL,
  YOUTUBE_URL,
} from "./helpers";

setupTestDatabase();
// Every test starts from an empty database, so links and rate limits never leak between them.
beforeEach(clearCollections);

async function setup() {
  const wedding = await setupWedding("Aarav & Diya's Wedding");
  await describeWedding(wedding.weddingId, wedding.owner);
  const stream = await makeStream(wedding.weddingId, wedding.owner, {
    description: "Join us for the pheras.",
  });
  return { ...wedding, stream, token: liveTokenOf(stream.inviteUrl) };
}

describe("adding a stream", () => {
  it("creates it scheduled, with its own watch link", async () => {
    const { stream } = await setup();
    expect(stream).toMatchObject({
      title: "Wedding ceremony live",
      provider: "youtube",
      streamUrl: YOUTUBE_URL,
      status: "scheduled",
      eventId: null,
      eventName: null,
      startTime: "2027-02-14T07:30:00.000Z",
      timezone: "Asia/Kolkata",
      description: "Join us for the pheras.",
    });
    expect(stream.inviteUrl).toMatch(/^http:\/\/localhost:3000\/live\/[A-Za-z0-9_-]{43}$/);
  });

  it("links an event of this wedding, and shows its name", async () => {
    const { weddingId, owner } = await setup();
    const eventId = await createEvent(weddingId, owner, { name: "Reception" });
    const stream = await makeStream(weddingId, owner, { eventId, title: "Reception live" });
    expect(stream).toMatchObject({ eventId, eventName: "Reception" });
  });

  it("answers 404 for an event of another wedding, like a missing one", async () => {
    const { weddingId, owner } = await setup();
    const other = await setupWedding();
    const foreign = await createEvent(other.weddingId, other.owner, { name: "Theirs" });
    expect((await addStream(weddingId, owner, { eventId: foreign })).status).toBe(404);
    expect(
      (await addStream(weddingId, owner, { eventId: "aaaaaaaaaaaaaaaaaaaaaaaa" })).status,
    ).toBe(404);
  });

  it("is open to every role: whoever is at the venue can add a stream", async () => {
    const { weddingId } = await setup();
    const member = await addMember(weddingId);
    const created = await addStream(weddingId, member, { title: "Member's stream" });
    expect(created.status).toBe(201);
    expect((await listStreams(weddingId, member)).json.data).toHaveLength(2);
  });

  it("checks the link belongs to the chosen platform", async () => {
    const { weddingId, owner } = await setup();
    const wrong = await addStream(weddingId, owner, { provider: "youtube", streamUrl: VIMEO_URL });
    expect(wrong.status).toBe(400);
    expect(wrong.json.error.details[0]).toMatchObject({ path: "streamUrl" });
    expect(JSON.stringify(wrong.json)).toContain("YouTube link");

    const other = await addStream(weddingId, owner, { provider: "vimeo", streamUrl: YOUTUBE_URL });
    expect(other.status).toBe(400);
    expect(JSON.stringify(other.json)).toContain("Vimeo link");

    const ok = await addStream(weddingId, owner, { provider: "vimeo", streamUrl: VIMEO_URL });
    expect(ok.status).toBe(201);
    // "Other" accepts any https address.
    const generic = await addStream(weddingId, owner, {
      provider: "other",
      streamUrl: "https://stream.example.org/aarav-diya",
    });
    expect(generic.status).toBe(201);
  });

  it("rejects links that are not safe or not links", async () => {
    const { weddingId, owner } = await setup();
    for (const streamUrl of [
      "http://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "javascript:alert(1)",
      "not a link",
      "https://user:pass@www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ",
      "ftp://www.youtube.com/x",
    ]) {
      const result = await addStream(weddingId, owner, { streamUrl });
      expect(result.status, streamUrl).toBe(400);
    }
  });

  it("rejects bad titles, times, statuses and unknown keys", async () => {
    const { weddingId, owner } = await setup();
    for (const overrides of [
      { title: "   " },
      { title: "x".repeat(121) },
      { description: "x".repeat(1001) },
      { startTime: "tomorrow at one" },
      { startTime: undefined },
      { status: "paused" },
      { provider: "twitch" },
      { link: { tokenHash: "x" } },
      { weddingId: "000000000000000000000000" },
    ]) {
      const result = await addStream(weddingId, owner, overrides);
      expect(result.status, JSON.stringify(overrides)).toBe(400);
    }
  });

  it("keeps each wedding's streams to itself", async () => {
    const { weddingId } = await setup();
    const stranger = await setupWedding();
    const read = await listStreams(weddingId, stranger.owner);
    expect(read.status).toBe(403);
    expect(read.json.error.code).toBe("NOT_A_MEMBER");
    expect((await addStream(weddingId, stranger.owner)).status).toBe(403);
    expect((await listStreams(stranger.weddingId, stranger.owner)).json.data).toEqual([]);
  });

  it("lists soonest first and shows the same link every time", async () => {
    const { weddingId, owner, stream } = await setup();
    const earlier = await makeStream(weddingId, owner, {
      title: "Mehendi live",
      startTime: "2027-02-12T10:30:00Z",
    });
    const list = (await listStreams(weddingId, owner)).json.data as any[];
    expect(list.map((item) => item.title)).toEqual(["Mehendi live", "Wedding ceremony live"]);
    expect(list[1].inviteUrl).toBe(stream.inviteUrl);
    expect(list[0].inviteUrl).toBe(earlier.inviteUrl);
    const again = (await listStreams(weddingId, owner)).json.data as any[];
    expect(again[1].inviteUrl).toBe(stream.inviteUrl);
  });
});

describe("editing a stream", () => {
  it("sets the status by hand, any role", async () => {
    const { weddingId, stream } = await setup();
    const member = await addMember(weddingId);
    const live = await patchStream(weddingId, stream.id, member, {
      version: stream.version,
      status: "live",
    });
    expect(live.status).toBe(200);
    expect(live.json.data.status).toBe("live");
    expect(live.json.data.version).toBe(stream.version + 1);
    // The guest link is unchanged by edits.
    expect(live.json.data.inviteUrl).toBe(stream.inviteUrl);
  });

  it("rejects a stale version with 409 VERSION_CONFLICT", async () => {
    const { weddingId, owner, stream } = await setup();
    await patchStream(weddingId, stream.id, owner, { version: stream.version, title: "First" });
    const stale = await patchStream(weddingId, stream.id, owner, {
      version: stream.version,
      title: "Second",
    });
    expect(stale.status).toBe(409);
    expect(stale.json.error.code).toBe("VERSION_CONFLICT");
  });

  it("keeps the platform and the link in step when either changes", async () => {
    const { weddingId, owner, stream } = await setup();
    const mismatch = await patchStream(weddingId, stream.id, owner, {
      version: stream.version,
      provider: "vimeo",
    });
    expect(mismatch.status).toBe(400); // the stored YouTube link is not a Vimeo link
    const both = await patchStream(weddingId, stream.id, owner, {
      version: stream.version,
      provider: "vimeo",
      streamUrl: VIMEO_URL,
    });
    expect(both.status).toBe(200);
    expect(both.json.data).toMatchObject({ provider: "vimeo", streamUrl: VIMEO_URL });
  });

  it("unlinks an event with null and clears the description", async () => {
    const { weddingId, owner } = await setup();
    const eventId = await createEvent(weddingId, owner, { name: "Sangeet" });
    const stream = await makeStream(weddingId, owner, { eventId, description: "Music night" });
    const result = await patchStream(weddingId, stream.id, owner, {
      version: stream.version,
      eventId: null,
      description: null,
    });
    expect(result.status).toBe(200);
    expect(result.json.data).toMatchObject({ eventId: null, eventName: null, description: null });
  });

  it("answers 404 for another wedding's stream", async () => {
    const { stream } = await setup();
    const stranger = await setupWedding();
    const result = await patchStream(stranger.weddingId, stream.id, stranger.owner, {
      version: stream.version,
      title: "Mine now",
    });
    expect(result.status).toBe(404);
    expect((await removeStream(stranger.weddingId, stream.id, stranger.owner)).status).toBe(404);
  });

  it("follows an event's timezone", async () => {
    const { weddingId, owner } = await setup();
    const eventId = await createEvent(weddingId, owner, {
      name: "Reception abroad",
      timezone: "America/New_York",
    });
    const stream = await makeStream(weddingId, owner, { eventId });
    expect(stream.timezone).toBe("America/New_York");
  });
});

describe("the watch link", () => {
  it("opens the watch page without an account", async () => {
    const { token } = await setup();
    const result = await publicLive(token);
    expect(result.status).toBe(200);
    expect(result.json.data).toMatchObject({
      coupleNames: "Aarav & Diya",
      title: "Wedding ceremony live",
      description: "Join us for the pheras.",
      status: "scheduled",
      provider: "youtube",
      providerLabel: "YouTube",
      dateLabel: "Sunday, 14 February 2027",
      timeLabel: "1:00 PM IST",
      zoneLabel: "IST (UTC+5:30)",
    });
  });

  it("gives out the video only while the stream is live", async () => {
    const { weddingId, owner, stream, token } = await setup();
    const before = (await publicLive(token)).json.data;
    expect(before.watchUrl).toBeNull();
    expect(before.embedUrl).toBeNull();

    await patchStream(weddingId, stream.id, owner, { version: stream.version, status: "live" });
    const live = (await publicLive(token)).json.data;
    expect(live.status).toBe("live");
    expect(live.watchUrl).toBe(YOUTUBE_URL);
    expect(live.embedUrl).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0");

    await patchStream(weddingId, stream.id, owner, {
      version: stream.version + 1,
      status: "ended",
    });
    const ended = (await publicLive(token)).json.data;
    expect(ended).toMatchObject({ status: "ended", watchUrl: null, embedUrl: null });
    await patchStream(weddingId, stream.id, owner, {
      version: stream.version + 2,
      status: "cancelled",
    });
    expect((await publicLive(token)).json.data).toMatchObject({
      status: "cancelled",
      watchUrl: null,
    });
  });

  it("embeds Vimeo, and gives only a link for 'other' platforms", async () => {
    const { weddingId, owner } = await setup();
    const vimeo = await makeStream(weddingId, owner, {
      provider: "vimeo",
      streamUrl: VIMEO_URL,
      status: "live",
    });
    const vimeoView = (await publicLive(liveTokenOf(vimeo.inviteUrl))).json.data;
    expect(vimeoView.embedUrl).toBe("https://player.vimeo.com/video/76979871");

    const generic = await makeStream(weddingId, owner, {
      provider: "other",
      streamUrl: "https://stream.example.org/live/aarav-diya",
      status: "live",
    });
    const genericView = (await publicLive(liveTokenOf(generic.inviteUrl))).json.data;
    expect(genericView.embedUrl).toBeNull();
    expect(genericView.watchUrl).toBe("https://stream.example.org/live/aarav-diya");

    // A YouTube link that is not a single video (a channel's live page) is linked, not embedded.
    const channel = await makeStream(weddingId, owner, {
      streamUrl: "https://www.youtube.com/@aaravdiya/live",
      status: "live",
    });
    const channelView = (await publicLive(liveTokenOf(channel.inviteUrl))).json.data;
    expect(channelView.embedUrl).toBeNull();
    expect(channelView.watchUrl).toBe("https://www.youtube.com/@aaravdiya/live");
  });

  it("returns a hand-built whitelist: no ids, private data or secrets", async () => {
    const { weddingId, owner, token } = await setup();
    const body = JSON.stringify((await publicLive(token)).json);
    expect(Object.keys((await publicLive(token)).json.data).sort()).toEqual(
      [
        "coupleNames",
        "title",
        "description",
        "startTime",
        "dateLabel",
        "timeLabel",
        "zoneLabel",
        "status",
        "provider",
        "providerLabel",
        "watchUrl",
        "embedUrl",
      ].sort(),
    );
    for (const forbidden of [
      weddingId,
      owner.user.id,
      owner.user.email,
      "tokenHash",
      "tokenEnc",
      "createdBy",
      "weddingId",
      "eventId",
      "deletedAt",
      "_id",
    ]) {
      expect(body, forbidden).not.toContain(forbidden);
    }
  });

  it("stops working at once when it is replaced, and the new one works", async () => {
    const { weddingId, owner, stream, token } = await setup();
    const rotated = await rotateStream(weddingId, stream.id, owner);
    expect(rotated.status).toBe(200);
    expect(rotated.json.data.inviteUrl).not.toBe(stream.inviteUrl);
    const old = await publicLive(token);
    expect(old.status).toBe(403);
    expect(old.json.error.code).toBe("INVALID_TOKEN");
    expect((await publicLive(liveTokenOf(rotated.json.data.inviteUrl))).status).toBe(200);
    // The team keeps seeing the current link.
    const listed = (await listStreams(weddingId, owner)).json.data[0];
    expect(listed.inviteUrl).toBe(rotated.json.data.inviteUrl);
  });

  it("stops working when the stream is deleted, and the list no longer shows it", async () => {
    const { weddingId, owner, stream, token } = await setup();
    expect((await removeStream(weddingId, stream.id, owner)).status).toBe(200);
    expect((await publicLive(token)).status).toBe(403);
    expect((await listStreams(weddingId, owner)).json.data).toEqual([]);
    expect((await removeStream(weddingId, stream.id, owner)).status).toBe(404);
  });

  it("stops working when the wedding is deleted", async () => {
    const { weddingId, owner, title, token } = await setup();
    expect((await publicLive(token)).status).toBe(200);
    expect((await deleteWedding(weddingId, owner, title)).status).toBe(200);
    expect((await publicLive(token)).status).toBe(403);
  });

  it("answers the same 403 for unknown, altered and guessed links", async () => {
    const { token } = await setup();
    const answers = await Promise.all(
      [
        "x",
        `${token}x`,
        token.slice(0, -1),
        token.toUpperCase(),
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        "507f1f77bcf86cd799439011",
      ].map((candidate) => publicLive(candidate)),
    );
    for (const answer of answers) {
      expect(answer.status).toBe(403);
      expect(answer.json.error.code).toBe("INVALID_TOKEN");
    }
    expect(new Set(answers.map((a) => JSON.stringify(a.json))).size).toBe(1);
  });

  it("is rate limited per visitor", async () => {
    const { token } = await setup();
    const ip = "203.0.113.90";
    let last = 0;
    for (let i = 0; i < 155; i += 1) last = (await publicLive(token, ip)).status;
    expect(last).toBe(429);
    expect((await publicLive(token, "203.0.113.91")).status).toBe(200);
  });

  it("keeps a stream when its event is deleted, unlinked and still watchable", async () => {
    const { weddingId, owner } = await setup();
    const eventId = await createEvent(weddingId, owner, { name: "Reception" });
    const stream = await makeStream(weddingId, owner, { eventId });
    const removed = await removeEvent(weddingId, eventId, owner);
    expect(removed.status).toBe(200);
    expect(removed.json.data.streamsUnlinked).toBe(1);
    const listed = (await listStreams(weddingId, owner)).json.data as any[];
    const found = listed.find((item) => item.id === stream.id);
    expect(found).toMatchObject({ eventId: null, eventName: null });
    expect((await publicLive(liveTokenOf(stream.inviteUrl))).status).toBe(200);
  });
});

describe("request validation", () => {
  it("defaults the status to scheduled and accepts a status on creation", async () => {
    const { weddingId, owner } = await setup();
    const scheduled = await addStream(weddingId, owner, streamBody({ title: "A" }));
    expect(scheduled.json.data.status).toBe("scheduled");
    const live = await addStream(weddingId, owner, streamBody({ title: "B", status: "live" }));
    expect(live.json.data.status).toBe("live");
  });
});
