/* eslint-disable @typescript-eslint/no-explicit-any -- response bodies are asserted on */
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { EmailLog } from "@/models/emailLog.model";
import { setupTestDatabase } from "../../setup/database";
import { addMember, setupWedding } from "../../setup/wedding";
import {
  captureGuestEmails,
  createLink,
  emailLogs,
  invite,
  inviteBatch,
  makeEvent,
  makeGuest,
  record,
  retryLog,
  tokenOf,
} from "./helpers";
import { getGuest } from "../guests/helpers";

setupTestDatabase();

async function guestWithEvent(
  weddingId: string,
  who: Awaited<ReturnType<typeof setupWedding>>["owner"],
  body: Record<string, unknown> = {},
) {
  const event = await makeEvent(weddingId, who);
  const guest = await makeGuest(weddingId, who, { eventIds: [event], ...body });
  return { event, guest };
}

describe("emailing one guest", () => {
  it("sends the invitation with the couple's name, the guest's events and their personal link", async () => {
    const { weddingId, owner } = await setupWedding("Aarav & Diya's Wedding");
    const { sent } = captureGuestEmails();
    const { guest } = await guestWithEvent(weddingId, owner, { email: "rahul@example.com" });

    const result = await invite(weddingId, guest.id, owner, { channel: "email" });
    expect(result.status).toBe(200);
    expect(result.json.data).toMatchObject({ channel: "email", sent: 1, failed: 0, skipped: 0 });

    expect(sent).toHaveLength(1);
    const mail = sent[0]!;
    expect(mail.to).toBe("rahul@example.com");
    expect(mail.subject).toContain("Aarav & Diya's Wedding");
    expect(mail.text).toContain("Hi Rahul,");
    expect(mail.text).toContain("Haldi");
    const link = (await createLink(weddingId, guest.id, owner)).json.data.inviteUrl;
    expect(mail.text).toContain(link);
    expect(mail.html).toContain(link);
  });

  it("marks the guest invited by email and counts the send", async () => {
    const { weddingId, owner } = await setupWedding();
    captureGuestEmails();
    const { guest } = await guestWithEvent(weddingId, owner, { email: "rahul@example.com" });
    await invite(weddingId, guest.id, owner, { channel: "email" });
    const detail = (await getGuest(weddingId, guest.id, owner)).json.data;
    expect(detail.invitation).toMatchObject({
      status: "invited",
      lastChannel: "email",
      sendCount: 1,
    });
    expect(detail.invitation.lastSentAt).toBeTruthy();
  });

  it("records a delivery log row without the body or the link", async () => {
    const { weddingId, owner } = await setupWedding();
    captureGuestEmails();
    const { guest } = await guestWithEvent(weddingId, owner, { email: "rahul@example.com" });
    await invite(weddingId, guest.id, owner, { channel: "email" });
    const link = (await createLink(weddingId, guest.id, owner)).json.data.inviteUrl;

    const logs = await emailLogs(weddingId, owner);
    expect(logs.json.data).toHaveLength(1);
    expect(logs.json.data[0]).toMatchObject({
      type: "guest_invitation",
      status: "sent",
      recipientEmail: "rahul@example.com",
      guestId: guest.id,
      guestName: "Rahul Sharma",
      attempts: 1,
    });
    const raw = JSON.stringify(await EmailLog.find().lean());
    expect(raw).not.toContain(tokenOf(link));
    expect(raw).not.toContain("Haldi");
  });

  it("skips a guest with no email, and says why", async () => {
    const { weddingId, owner } = await setupWedding();
    const { sent } = captureGuestEmails();
    const { guest } = await guestWithEvent(weddingId, owner);
    const result = await invite(weddingId, guest.id, owner, { channel: "email" });
    expect(result.status).toBe(200);
    expect(result.json.data.skipped).toBe(1);
    expect(result.json.data.results[0]).toMatchObject({
      outcome: "skipped",
      reason: "No email address on file",
    });
    expect(sent).toHaveLength(0);
    const detail = (await getGuest(weddingId, guest.id, owner)).json.data;
    expect(detail.invitation.status).toBe("not_invited");
  });

  it("skips a guest who is not invited to any event (they would have nothing to answer)", async () => {
    const { weddingId, owner } = await setupWedding();
    captureGuestEmails();
    const guest = await makeGuest(weddingId, owner, { email: "a@example.com" });
    const result = await invite(weddingId, guest.id, owner, { channel: "email" });
    expect(result.json.data.results[0].reason).toMatch(/any event/);
  });

  it("a failed email changes nothing about the guest and is logged for retry", async () => {
    const { weddingId, owner } = await setupWedding();
    captureGuestEmails(["full@example.com"]);
    const { guest } = await guestWithEvent(weddingId, owner, { email: "full@example.com" });
    const result = await invite(weddingId, guest.id, owner, { channel: "email" });
    expect(result.status).toBe(200);
    expect(result.json.data).toMatchObject({ sent: 0, failed: 1 });
    expect(result.json.data.results[0]).toMatchObject({
      outcome: "failed",
      error: { code: "mailbox_full" },
    });
    expect(result.json.data.failedGuestIds).toEqual([guest.id]);
    const detail = (await getGuest(weddingId, guest.id, owner)).json.data;
    expect(detail.invitation.status).toBe("not_invited");
    const logs = (await emailLogs(weddingId, owner, "?status=failed")).json.data;
    expect(logs).toHaveLength(1);
    expect(logs[0].error.code).toBe("mailbox_full");
  });

  it("works for every role", async () => {
    const { weddingId, owner } = await setupWedding();
    captureGuestEmails();
    const { guest } = await guestWithEvent(weddingId, owner, { email: "rahul@example.com" });
    for (const who of [owner, await addMember(weddingId, "admin"), await addMember(weddingId)]) {
      expect((await invite(weddingId, guest.id, who, { channel: "email" })).status).toBe(200);
    }
  });
});

describe("WhatsApp and in-person invitations", () => {
  it("a single WhatsApp tap records the guest and returns a pre-filled wa.me link", async () => {
    const { weddingId, owner } = await setupWedding();
    const { sent } = captureGuestEmails();
    const { guest } = await guestWithEvent(weddingId, owner, { phone: "+919876543210" });
    const result = await invite(weddingId, guest.id, owner, { channel: "whatsapp" });
    expect(result.status).toBe(200);
    const item = result.json.data.results[0];
    expect(item.outcome).toBe("marked");
    expect(item.whatsappUrl).toMatch(/^https:\/\/wa\.me\/919876543210\?text=/);
    const text = decodeURIComponent(item.whatsappUrl.split("?text=")[1]);
    expect(text).toContain("Hi Rahul,");
    expect(text).toContain(item.inviteUrl);
    expect(sent).toHaveLength(0); // the app never sends WhatsApp itself

    const detail = (await getGuest(weddingId, guest.id, owner)).json.data;
    expect(detail.invitation).toMatchObject({ status: "invited", lastChannel: "whatsapp" });
  });

  it("a batch only PREPARES WhatsApp links: nobody is marked until the member taps", async () => {
    const { weddingId, owner } = await setupWedding();
    const event = await makeEvent(weddingId, owner);
    const a = await makeGuest(weddingId, owner, {
      name: "Ann",
      phone: "+919876500001",
      eventIds: [event],
    });
    const b = await makeGuest(weddingId, owner, { name: "Bob", eventIds: [event] });
    const result = await inviteBatch(weddingId, owner, {
      guestIds: [a.id, b.id],
      channel: "whatsapp",
    });
    expect(result.json.data).toMatchObject({ prepared: 1, skipped: 1, marked: 0 });
    const byName = Object.fromEntries(result.json.data.results.map((r: any) => [r.name, r]));
    expect(byName.Ann.whatsappUrl).toContain("wa.me/919876500001");
    expect(byName.Bob.reason).toBe("No phone number on file");
    expect((await getGuest(weddingId, a.id, owner)).json.data.invitation.status).toBe(
      "not_invited",
    );
  });

  it("'manual' only records that you told them", async () => {
    const { weddingId, owner } = await setupWedding();
    const { sent } = captureGuestEmails();
    const { guest } = await guestWithEvent(weddingId, owner);
    const result = await invite(weddingId, guest.id, owner, { channel: "manual" });
    expect(result.json.data).toMatchObject({ marked: 1, sent: 0 });
    expect(sent).toHaveLength(0);
    const detail = (await getGuest(weddingId, guest.id, owner)).json.data;
    expect(detail.invitation).toMatchObject({ status: "invited", lastChannel: "manual" });
  });
});

describe("RSVP reminders", () => {
  it("only go to guests who were invited and still owe an answer", async () => {
    const { weddingId, owner } = await setupWedding();
    const { sent } = captureGuestEmails();
    const event = await makeEvent(weddingId, owner);
    const waiting = await makeGuest(weddingId, owner, {
      name: "Waiting",
      email: "w@example.com",
      eventIds: [event],
    });
    const replied = await makeGuest(weddingId, owner, {
      name: "Replied",
      email: "r@example.com",
      eventIds: [event],
    });
    const never = await makeGuest(weddingId, owner, {
      name: "Never",
      email: "n@example.com",
      eventIds: [event],
    });
    await invite(weddingId, waiting.id, owner, { channel: "email" });
    await invite(weddingId, replied.id, owner, { channel: "email" });
    await record(weddingId, replied.id, event, owner, { status: "attending", attendingCount: 1 });
    sent.length = 0;

    const result = await inviteBatch(weddingId, owner, {
      guestIds: [waiting.id, replied.id, never.id],
      channel: "email",
      kind: "reminder",
    });
    expect(result.json.data).toMatchObject({ kind: "reminder", sent: 1, skipped: 2 });
    const reasons = Object.fromEntries(
      result.json.data.results.map((r: any) => [r.name, r.reason]),
    );
    expect(reasons.Replied).toBe("Has already replied to every event");
    expect(reasons.Never).toBe("Hasn't been invited yet");
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe("w@example.com");
    expect(sent[0]!.subject).toMatch(/reminder/i);
    const logs = (await emailLogs(weddingId, owner, "?type=rsvp_reminder")).json.data;
    expect(logs).toHaveLength(1);
  });
});

describe("sending to many guests", () => {
  async function seed(count: number, who: Awaited<ReturnType<typeof setupWedding>>) {
    const event = await makeEvent(who.weddingId, who.owner);
    const guests = [];
    for (let index = 0; index < count; index += 1) {
      guests.push(
        await makeGuest(who.weddingId, who.owner, {
          name: `Guest ${String(index).padStart(2, "0")}`,
          email: `guest${index}@example.com`,
          eventIds: [event],
        }),
      );
    }
    return guests;
  }

  it("reports who was sent, who failed and who was skipped, and the rest still go out", async () => {
    const wedding = await setupWedding();
    const { sent } = captureGuestEmails(["guest3@example.com", "guest7@example.com"]);
    const guests = await seed(12, wedding);
    const result = await inviteBatch(wedding.weddingId, wedding.owner, {
      guestIds: guests.map((guest) => guest.id),
      channel: "email",
    });
    expect(result.status).toBe(200);
    expect(result.json.data).toMatchObject({ total: 12, sent: 10, failed: 2, skipped: 0 });
    expect(result.json.data.failedGuestIds).toHaveLength(2);
    expect(sent).toHaveLength(10);
    const invited = (await emailLogs(wedding.weddingId, wedding.owner, "?status=sent")).json.data;
    expect(invited).toHaveLength(10);
  });

  it("retrying with the same batchId emails only the failures, never the delivered", async () => {
    const wedding = await setupWedding();
    const { sent, failing } = captureGuestEmails(["guest1@example.com"]);
    const guests = await seed(4, wedding);
    const body = {
      guestIds: guests.map((guest) => guest.id),
      channel: "email",
      batchId: randomUUID(),
    };
    const first = await inviteBatch(wedding.weddingId, wedding.owner, body);
    expect(first.json.data).toMatchObject({ sent: 3, failed: 1 });
    expect(sent).toHaveLength(3);

    failing.clear(); // the mailbox was emptied
    const second = await inviteBatch(wedding.weddingId, wedding.owner, body);
    expect(second.json.data).toMatchObject({ sent: 4, failed: 0 });
    expect(sent).toHaveLength(4); // exactly ONE more email: the three delivered were not re-sent

    const logs = (await emailLogs(wedding.weddingId, wedding.owner)).json.data;
    expect(logs).toHaveLength(4);
    expect(logs.every((log: any) => log.status === "sent")).toBe(true);
    expect(logs.find((log: any) => log.recipientEmail === "guest1@example.com").attempts).toBe(2);
    // The delivered guests were counted once, not twice.
    const detail = (await getGuest(wedding.weddingId, guests[0]!.id, wedding.owner)).json.data;
    expect(detail.invitation.sendCount).toBe(1);
  });

  it("retries one failed email from the delivery log, in place", async () => {
    const wedding = await setupWedding();
    const { sent, failing } = captureGuestEmails(["guest0@example.com"]);
    const [guest] = await seed(1, wedding);
    await invite(wedding.weddingId, guest!.id, wedding.owner, { channel: "email" });
    const failed = (await emailLogs(wedding.weddingId, wedding.owner, "?status=failed")).json.data;
    expect(failed).toHaveLength(1);

    failing.clear();
    const retried = await retryLog(wedding.weddingId, failed[0].id, wedding.owner);
    expect(retried.status).toBe(200);
    expect(retried.json.data).toMatchObject({ sent: 1, failed: 0 });
    expect(sent).toHaveLength(1);

    const logs = (await emailLogs(wedding.weddingId, wedding.owner)).json.data;
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ status: "sent", attempts: 2 });

    // It has been delivered now: retrying again is refused, not sent twice.
    const again = await retryLog(wedding.weddingId, failed[0].id, wedding.owner);
    expect(again.status).toBe(422);
    expect(sent).toHaveLength(1);
  });

  it("refuses more than 50 guests, none, repeats, and bad ids", async () => {
    const { weddingId, owner } = await setupWedding();
    const ids = Array.from({ length: 51 }, (_, index) => index.toString(16).padStart(24, "0"));
    expect((await inviteBatch(weddingId, owner, { guestIds: ids, channel: "email" })).status).toBe(
      400,
    );
    expect((await inviteBatch(weddingId, owner, { guestIds: [], channel: "email" })).status).toBe(
      400,
    );
    const guest = await makeGuest(weddingId, owner);
    expect(
      (await inviteBatch(weddingId, owner, { guestIds: [guest.id, guest.id], channel: "email" }))
        .status,
    ).toBe(400);
    expect(
      (await inviteBatch(weddingId, owner, { guestIds: ["nope"], channel: "email" })).status,
    ).toBe(400);
    expect(
      (await inviteBatch(weddingId, owner, { guestIds: [guest.id], channel: "sms" })).status,
    ).toBe(400);
    expect(
      (await inviteBatch(weddingId, owner, { guestIds: [guest.id], channel: "email", extra: 1 }))
        .status,
    ).toBe(400);
  });

  it("fails the whole request, sending nothing, if one guest is not in this wedding", async () => {
    const a = await setupWedding();
    const b = await setupWedding("Other wedding");
    const { sent } = captureGuestEmails();
    const mine = (await seed(1, a))[0]!;
    const eventB = await makeEvent(b.weddingId, b.owner);
    const foreign = await makeGuest(b.weddingId, b.owner, {
      email: "x@example.com",
      eventIds: [eventB],
    });
    const result = await inviteBatch(a.weddingId, a.owner, {
      guestIds: [mine.id, foreign.id],
      channel: "email",
    });
    expect(result.status).toBe(404);
    expect(sent).toHaveLength(0);
    const single = await invite(a.weddingId, foreign.id, a.owner, { channel: "email" });
    expect(single.status).toBe(404);
  });

  it("is limited per wedding so it cannot be used to spam", async () => {
    const { weddingId, owner } = await setupWedding();
    captureGuestEmails();
    const guest = await makeGuest(weddingId, owner);
    let limited = 0;
    for (let index = 0; index < 62; index += 1) {
      const result = await invite(weddingId, guest.id, owner, { channel: "manual" });
      if (result.status === 429) limited += 1;
    }
    expect(limited).toBeGreaterThan(0);
  });
});

describe("keeping outsiders out", () => {
  it("a member of another wedding gets 403 on every send route", async () => {
    const a = await setupWedding();
    const b = await setupWedding("Other wedding");
    const guest = await makeGuest(a.weddingId, a.owner);
    expect((await invite(a.weddingId, guest.id, b.owner, { channel: "manual" })).status).toBe(403);
    expect(
      (await inviteBatch(a.weddingId, b.owner, { guestIds: [guest.id], channel: "manual" })).status,
    ).toBe(403);
    expect((await emailLogs(a.weddingId, b.owner)).status).toBe(403);
  });

  it("requires a session", async () => {
    const a = await setupWedding();
    const guest = await makeGuest(a.weddingId, a.owner);
    const anonymous = { cookie: "", user: a.owner.user, memberId: "" };
    expect((await invite(a.weddingId, guest.id, anonymous, { channel: "manual" })).status).toBe(
      401,
    );
  });

  it("the delivery log lists only this wedding's guest emails", async () => {
    const a = await setupWedding();
    const b = await setupWedding("Other wedding");
    captureGuestEmails();
    const eventA = await makeEvent(a.weddingId, a.owner);
    const ga = await makeGuest(a.weddingId, a.owner, {
      email: "a@example.com",
      eventIds: [eventA],
    });
    const eventB = await makeEvent(b.weddingId, b.owner);
    const gb = await makeGuest(b.weddingId, b.owner, {
      email: "b@example.com",
      eventIds: [eventB],
    });
    await invite(a.weddingId, ga.id, a.owner, { channel: "email" });
    await invite(b.weddingId, gb.id, b.owner, { channel: "email" });
    const logs = (await emailLogs(a.weddingId, a.owner)).json.data;
    expect(logs).toHaveLength(1);
    expect(logs[0].recipientEmail).toBe("a@example.com");
    const foreignLog = (await emailLogs(b.weddingId, b.owner)).json.data[0];
    expect((await retryLog(a.weddingId, foreignLog.id, a.owner)).status).toBe(404);
  });
});
