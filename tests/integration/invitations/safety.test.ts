import { describe, expect, it } from "vitest";
import { POST as restoreWedding } from "@/app/api/v1/weddings/[weddingId]/restore/route";
import { DELETE as deleteWedding } from "@/app/api/v1/weddings/[weddingId]/route";
import { redactPath } from "@/lib/http/route";
import { call } from "../../setup/http";
import { setupTestDatabase } from "../../setup/database";
import { addMember, setupWedding } from "../../setup/wedding";
import {
  captureGuestEmails,
  createLink,
  emailLogs,
  getLink,
  invite,
  inviteBatch,
  makeEvent,
  makeGuest,
  overview,
  publicRsvp,
  replies,
  rotateLink,
  submitRsvp,
  tokenOf,
} from "./helpers";
import { createEvent } from "./helpers-events";

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
  "idempotencyKey",
  "providerMessageId",
];

describe("member invitation responses never leak internal fields or tokens", () => {
  it("is clean for every route and every role", async () => {
    const { weddingId, owner } = await setupWedding();
    const admin = await addMember(weddingId, "admin");
    const member = await addMember(weddingId, "member");
    captureGuestEmails(["bad@example.com"]);
    const event = await makeEvent(weddingId, owner);
    const good = await makeGuest(weddingId, owner, {
      email: "good@example.com",
      phone: "+919876543210",
      eventIds: [event],
    });
    const bad = await makeGuest(weddingId, owner, {
      name: "Bad Mailbox",
      email: "bad@example.com",
      eventIds: [event],
    });
    const token = tokenOf((await createLink(weddingId, good.id, owner)).json.data.inviteUrl);

    for (const who of [owner, admin, member]) {
      const bodies = [
        await invite(weddingId, good.id, who, { channel: "email" }),
        await invite(weddingId, bad.id, who, { channel: "email" }),
        await invite(weddingId, good.id, who, { channel: "whatsapp" }),
        await inviteBatch(weddingId, who, { guestIds: [good.id, bad.id], channel: "manual" }),
        await overview(weddingId, who),
        await replies(weddingId, who, event),
      ].map((result) => JSON.stringify(result.json));
      if (who !== member) bodies.push(JSON.stringify((await emailLogs(weddingId, who)).json));

      for (const body of bodies) {
        for (const forbidden of FORBIDDEN) expect(body, forbidden).not.toContain(forbidden);
      }
      // Only the link routes and WhatsApp/prepared results may carry a guest's link; the overview,
      // the tracker list and the delivery log never do.
      for (const body of [bodies[4]!, bodies[5]!, ...(who !== member ? [bodies[6]!] : [])]) {
        expect(body).not.toContain(token);
        expect(body).not.toContain("/i/");
      }
    }
  });
});

describe("a wedding's guest links follow the wedding", () => {
  it("stops working when the wedding is deleted and comes back when it is restored", async () => {
    const { weddingId, owner, title } = await setupWedding();
    const event = await makeEvent(weddingId, owner);
    const guest = await makeGuest(weddingId, owner, { eventIds: [event] });
    const token = tokenOf((await createLink(weddingId, guest.id, owner)).json.data.inviteUrl);
    expect((await publicRsvp(token)).status).toBe(200);

    await call(deleteWedding, {
      method: "DELETE",
      cookie: owner.cookie,
      params: { weddingId },
      body: { confirm: title },
    });
    expect((await publicRsvp(token)).status).toBe(403);
    expect(
      (await submitRsvp(token, { responses: [{ eventId: event, status: "attending" }] })).status,
    ).toBe(403);

    const restored = await call(restoreWedding, {
      cookie: owner.cookie,
      params: { weddingId },
    });
    expect(restored.status).toBe(200);
    // The same link that was sent before works again: nothing was rotated or lost.
    expect((await publicRsvp(token)).status).toBe(200);
    expect((await getLink(weddingId, guest.id, owner)).json.data.inviteUrl).toContain(token);
  });
});

describe("one wedding can never reach another's guests through links", () => {
  it("a guest link of wedding B cannot answer for, or even name, wedding A's events", async () => {
    const a = await setupWedding("Wedding A");
    const b = await setupWedding("Wedding B");
    const eventA = await makeEvent(a.weddingId, a.owner);
    const eventB = await makeEvent(b.weddingId, b.owner);
    const guestB = await makeGuest(b.weddingId, b.owner, { eventIds: [eventB] });
    const tokenB = tokenOf((await createLink(b.weddingId, guestB.id, b.owner)).json.data.inviteUrl);

    const view = (await publicRsvp(tokenB)).json.data;
    expect(view.weddingTitle).toBe("Wedding B");
    expect(JSON.stringify(view)).not.toContain(eventA);
    const attempt = await submitRsvp(tokenB, {
      responses: [{ eventId: eventA, status: "attending" }],
    });
    expect(attempt.status).toBe(404);
  });

  it("guessing or altering a token finds nothing", async () => {
    const a = await setupWedding();
    const event = await makeEvent(a.weddingId, a.owner);
    const guest = await makeGuest(a.weddingId, a.owner, { eventIds: [event] });
    const token = tokenOf((await createLink(a.weddingId, guest.id, a.owner)).json.data.inviteUrl);
    const flipped = token.slice(0, -1) + (token.endsWith("A") ? "B" : "A");
    for (const attempt of [
      flipped,
      token.toLowerCase() === token ? token.toUpperCase() : token.toLowerCase(),
      token + "x",
      token.slice(1),
      guest.id,
    ]) {
      expect((await publicRsvp(attempt)).status, attempt).toBe(403);
    }
  });

  it("an old (rotated) link is dead everywhere, a new one is alive", async () => {
    const a = await setupWedding();
    const event = await makeEvent(a.weddingId, a.owner);
    const guest = await makeGuest(a.weddingId, a.owner, { eventIds: [event] });
    const oldToken = tokenOf(
      (await createLink(a.weddingId, guest.id, a.owner)).json.data.inviteUrl,
    );
    const newToken = tokenOf(
      (await rotateLink(a.weddingId, guest.id, a.owner)).json.data.inviteUrl,
    );
    expect((await publicRsvp(oldToken)).status).toBe(403);
    expect((await publicRsvp(newToken)).status).toBe(200);
  });
});

describe("emails made from guest and event text are escaped", () => {
  it("never puts raw markup from a name, an event or a venue into the HTML body", async () => {
    const { weddingId, owner } = await setupWedding("Aarav & <Diya>'s Wedding");
    const { sent } = captureGuestEmails();
    const event = await createEvent(weddingId, owner, {
      name: "Haldi <img src=x onerror=alert(1)>",
      location: { label: "Hall <script>alert(2)</script>" },
    });
    const guest = await makeGuest(weddingId, owner, {
      name: '<b>Rahul</b> "Sharma"',
      email: "rahul@example.com",
      eventIds: [event],
    });
    await invite(weddingId, guest.id, owner, { channel: "email" });
    expect(sent).toHaveLength(1);
    const html = sent[0]!.html;
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>Rahul</b>");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).toContain("&lt;Diya&gt;");
  });
});

describe("tokens stay out of logs", () => {
  it("redacts a guest link's token from the request path", () => {
    const token = "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG";
    const logged = redactPath(`/api/v1/public/rsvp/${token}`);
    expect(logged).not.toContain(token);
    expect(logged).toContain("[redacted]");
  });
});

describe("the public answer endpoint is rate limited", () => {
  it("answers 429 after too many tries from one address", async () => {
    const { weddingId, owner } = await setupWedding();
    const event = await makeEvent(weddingId, owner);
    const guest = await makeGuest(weddingId, owner, { eventIds: [event] });
    const token = tokenOf((await createLink(weddingId, guest.id, owner)).json.data.inviteUrl);
    let limited = 0;
    for (let index = 0; index < 33; index += 1) {
      const result = await submitRsvp(
        token,
        { responses: [{ eventId: event, status: "maybe" }] },
        "192.0.2.99",
      );
      if (result.status === 429) limited += 1;
    }
    expect(limited).toBeGreaterThan(0);
  });
});
