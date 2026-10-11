import { describe, expect, it } from "vitest";
import { setupTestDatabase } from "../../setup/database";
import { addMember, setupWedding } from "../../setup/wedding";
import {
  captureGuestEmails,
  emailLogs,
  invite,
  makeEvent,
  makeGuest,
  overview,
  retryLog,
} from "./helpers";

setupTestDatabase();

// The Stitch delivery log says "Visible to owners and admins only", matching API Design §13.
describe("who may read the delivery log", () => {
  it("lets owners and admins read and retry, and keeps members out (403 INSUFFICIENT_ROLE)", async () => {
    const { weddingId, owner } = await setupWedding();
    const admin = await addMember(weddingId, "admin");
    const member = await addMember(weddingId, "member");
    captureGuestEmails(["bad@example.com"]);
    const event = await makeEvent(weddingId, owner);
    const guest = await makeGuest(weddingId, owner, {
      email: "bad@example.com",
      eventIds: [event],
    });
    await invite(weddingId, guest.id, member, { channel: "email" });

    expect((await emailLogs(weddingId, owner)).status).toBe(200);
    expect((await emailLogs(weddingId, admin)).status).toBe(200);
    const denied = await emailLogs(weddingId, member);
    expect(denied.status).toBe(403);
    expect(denied.json.error.code).toBe("INSUFFICIENT_ROLE");

    const failed = (await emailLogs(weddingId, owner, "?status=failed")).json.data[0];
    const deniedRetry = await retryLog(weddingId, failed.id, member);
    expect(deniedRetry.status).toBe(403);
    expect((await retryLog(weddingId, failed.id, admin)).status).toBe(200);
  });

  it("members still see what needs attention in the overview and can resend by guest", async () => {
    const { weddingId, owner } = await setupWedding();
    const member = await addMember(weddingId, "member");
    captureGuestEmails(["bad@example.com"]);
    const event = await makeEvent(weddingId, owner);
    const guest = await makeGuest(weddingId, owner, {
      email: "bad@example.com",
      eventIds: [event],
    });
    await invite(weddingId, guest.id, member, { channel: "email" });
    const data = (await overview(weddingId, member)).json.data;
    expect(data.failures).toHaveLength(1);
    expect(data.failures[0].guestId).toBe(guest.id);
  });
});
