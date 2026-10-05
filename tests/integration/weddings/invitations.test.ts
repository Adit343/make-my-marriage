import { afterEach, describe, expect, it } from "vitest";
import { POST as accept } from "@/app/api/v1/invitations/accept/route";
import { GET as preview } from "@/app/api/v1/public/invitations/[token]/route";
import { DELETE as revoke } from "@/app/api/v1/weddings/[weddingId]/invitations/[invitationId]/route";
import { POST as resend } from "@/app/api/v1/weddings/[weddingId]/invitations/[invitationId]/resend/route";
import {
  GET as listInvitations,
  POST as invite,
} from "@/app/api/v1/weddings/[weddingId]/invitations/route";
import { DELETE as deleteWedding } from "@/app/api/v1/weddings/[weddingId]/route";
import { POST as createWedding } from "@/app/api/v1/weddings/route";
import { EmailProviderError, setEmailProviderForTests } from "@/infrastructure/email";
import { EmailLog } from "@/models/emailLog.model";
import { WeddingInvitation } from "@/models/weddingInvitation.model";
import { WeddingMember } from "@/models/weddingMember.model";
import { captureEmails, signUpUser } from "../../setup/auth";
import { setupTestDatabase } from "../../setup/database";
import { call } from "../../setup/http";
import { addMember, setupWedding } from "../../setup/wedding";

setupTestDatabase();

afterEach(() => setEmailProviderForTests(undefined));

const tokenOf = (inviteLink: string) => inviteLink.split("/join/")[1]!;

async function sendInvite(cookie: string, weddingId: string, body: Record<string, unknown> = {}) {
  return call(invite, {
    cookie,
    params: { weddingId },
    body: { email: `guest${Math.random()}@example.com`, role: "member", ...body },
  });
}

async function previewOf(token: string) {
  return call(preview, { method: "GET", params: { token } });
}

describe("POST /weddings/:weddingId/invitations", () => {
  it("creates the invitation, emails the link and logs the send", async () => {
    const sent = captureEmails();
    const { weddingId, owner } = await setupWedding("Aarav & Diya");
    const result = await sendInvite(owner.cookie, weddingId, {
      email: "Meena@Example.com",
      role: "member",
      relationship: "parent",
      message: "Would love your help planning!",
    });

    expect(result.status).toBe(201);
    const { invitation, inviteLink, emailStatus } = result.json.data;
    expect(emailStatus).toBe("sent");
    expect(invitation).toMatchObject({
      email: "Meena@Example.com",
      role: "member",
      relationship: "parent",
      status: "pending",
    });
    expect(inviteLink).toMatch(/\/join\/[A-Za-z0-9_-]{40,}$/);

    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe("Meena@Example.com");
    expect(sent[0]!.html).toContain(inviteLink);
    expect(sent[0]!.text).toContain(inviteLink);
    expect(sent[0]!.html).toContain("Aarav &amp; Diya");
    expect(sent[0]!.html).toContain("Would love your help planning!");

    const log = await EmailLog.findOne({ invitationId: invitation.id }).lean();
    expect(log).toMatchObject({
      type: "member_invitation",
      status: "sent",
      weddingId: expect.anything(),
    });
  });

  it("stores only a hash of the token, and never returns it in listings", async () => {
    captureEmails();
    const { weddingId, owner } = await setupWedding();
    const result = await sendInvite(owner.cookie, weddingId);
    const token = tokenOf(result.json.data.inviteLink);

    const row = await WeddingInvitation.findOne({ _id: result.json.data.invitation.id })
      .select("+tokenHash")
      .lean();
    expect(row?.tokenHash).toHaveLength(64);
    expect(JSON.stringify(row)).not.toContain(token);

    const list = await call(listInvitations, {
      method: "GET",
      cookie: owner.cookie,
      params: { weddingId },
    });
    expect(JSON.stringify(list.json)).not.toContain(token);
    expect(JSON.stringify(list.json)).not.toContain("tokenHash");
  });

  it("keeps the invitation when the email fails, and says so", async () => {
    setEmailProviderForTests({
      name: "broken",
      async send() {
        throw new EmailProviderError("provider_down", "Provider unavailable");
      },
    });
    const { weddingId, owner } = await setupWedding();
    const result = await sendInvite(owner.cookie, weddingId);

    expect(result.status).toBe(201);
    expect(result.json.data.emailStatus).toBe("failed");
    expect(result.json.data.inviteLink).toContain("/join/");
    expect(await WeddingInvitation.countDocuments({ weddingId })).toBe(1);
    expect(await EmailLog.countDocuments({ status: "failed", type: "member_invitation" })).toBe(1);
  });

  it("is for admins and owners, not plain members", async () => {
    captureEmails();
    const { weddingId } = await setupWedding();
    const member = await addMember(weddingId, "member");
    const admin = await addMember(weddingId, "admin");

    const denied = await sendInvite(member.cookie, weddingId);
    expect(denied.status).toBe(403);
    expect(denied.json.error.code).toBe("INSUFFICIENT_ROLE");
    const listDenied = await call(listInvitations, {
      method: "GET",
      cookie: member.cookie,
      params: { weddingId },
    });
    expect(listDenied.status).toBe(403);

    expect((await sendInvite(admin.cookie, weddingId)).status).toBe(201);
  });

  it("can never invite someone as owner, and validates input", async () => {
    captureEmails();
    const { weddingId, owner } = await setupWedding();
    const bad: Record<string, unknown>[] = [
      { role: "owner" },
      { email: "not-an-email" },
      { message: "x".repeat(501) },
      { relationship: "boss" },
      { extra: true },
    ];
    for (const body of bad) {
      const result = await sendInvite(owner.cookie, weddingId, body);
      expect(result.status, JSON.stringify(body)).toBe(400);
    }
  });

  it("rejects a second pending invitation to the same email (any spelling)", async () => {
    captureEmails();
    const { weddingId, owner } = await setupWedding();
    await sendInvite(owner.cookie, weddingId, { email: "meena@example.com" });
    const again = await sendInvite(owner.cookie, weddingId, { email: "  MEENA@example.com " });
    expect(again.status).toBe(409);
    expect(again.json.error.code).toBe("CONFLICT");
  });

  it("replaces a stale (expired) pending invitation instead of being blocked by it", async () => {
    captureEmails();
    const { weddingId, owner } = await setupWedding();
    const first = await sendInvite(owner.cookie, weddingId, { email: "meena@example.com" });
    await WeddingInvitation.updateOne(
      { _id: first.json.data.invitation.id },
      { $set: { expiresAt: new Date(Date.now() - 1000) } },
    );

    const second = await sendInvite(owner.cookie, weddingId, { email: "meena@example.com" });
    expect(second.status).toBe(201);
    const stale = await WeddingInvitation.findOne({ _id: first.json.data.invitation.id }).lean();
    expect(stale?.status).toBe("revoked");
  });

  it("won't invite someone who is already on the team", async () => {
    captureEmails();
    const { weddingId, owner } = await setupWedding();
    const member = await addMember(weddingId, "member");
    const result = await sendInvite(owner.cookie, weddingId, { email: member.user.email });
    expect(result.status).toBe(409);
  });
});

describe("listing, revoking and resending", () => {
  it("lists with a computed 'expired' state and filters by status", async () => {
    captureEmails();
    const { weddingId, owner } = await setupWedding();
    const fresh = await sendInvite(owner.cookie, weddingId);
    const old = await sendInvite(owner.cookie, weddingId);
    await WeddingInvitation.updateOne(
      { _id: old.json.data.invitation.id },
      { $set: { expiresAt: new Date(Date.now() - 1000) } },
    );

    const all = await call(listInvitations, {
      method: "GET",
      cookie: owner.cookie,
      params: { weddingId },
    });
    const byId = Object.fromEntries(
      all.json.data.map((row: { id: string; status: string }) => [row.id, row.status]),
    );
    expect(byId[fresh.json.data.invitation.id]).toBe("pending");
    expect(byId[old.json.data.invitation.id]).toBe("expired");
    expect(all.json.meta.totalCount).toBe(2);

    const revoked = await call(listInvitations, {
      method: "GET",
      path: "/api/test?status=revoked",
      cookie: owner.cookie,
      params: { weddingId },
    });
    expect(revoked.json.data).toHaveLength(0);
  });

  it("revoking kills the link; a revoked invitation can't be revoked or resent again", async () => {
    captureEmails();
    const { weddingId, owner } = await setupWedding();
    const created = await sendInvite(owner.cookie, weddingId);
    const invitationId = created.json.data.invitation.id;
    const token = tokenOf(created.json.data.inviteLink);

    const result = await call(revoke, {
      method: "DELETE",
      cookie: owner.cookie,
      params: { weddingId, invitationId },
    });
    expect(result.status).toBe(200);
    expect(result.json.data.status).toBe("revoked");
    expect((await previewOf(token)).json.data).toEqual({ valid: false });

    const again = await call(revoke, {
      method: "DELETE",
      cookie: owner.cookie,
      params: { weddingId, invitationId },
    });
    expect(again.status).toBe(409);
    const resent = await call(resend, {
      cookie: owner.cookie,
      params: { weddingId, invitationId },
    });
    expect(resent.status).toBe(409);

    // The row is kept for a while (then purged by TTL), and the email can be invited afresh.
    expect(await WeddingInvitation.countDocuments({ _id: invitationId })).toBe(1);
    const row = await WeddingInvitation.findOne({ _id: invitationId }).lean();
    expect(row!.purgeAt.getTime()).toBeGreaterThan(Date.now() + 29 * 24 * 60 * 60 * 1000);
  });

  it("resend issues a new link, extends expiry and invalidates the old link", async () => {
    const sent = captureEmails();
    const { weddingId, owner } = await setupWedding();
    const created = await sendInvite(owner.cookie, weddingId);
    const invitationId = created.json.data.invitation.id;
    const oldToken = tokenOf(created.json.data.inviteLink);

    const result = await call(resend, {
      cookie: owner.cookie,
      params: { weddingId, invitationId },
    });
    expect(result.status).toBe(200);
    const newToken = tokenOf(result.json.data.inviteLink);
    expect(newToken).not.toBe(oldToken);
    expect(sent).toHaveLength(2);
    expect(sent[1]!.text).toContain(newToken);

    expect((await previewOf(oldToken)).json.data).toEqual({ valid: false });
    expect((await previewOf(newToken)).json.data.valid).toBe(true);
  });

  it("answers 404 for another wedding's invitation", async () => {
    captureEmails();
    const a = await setupWedding("Wedding A");
    const b = await setupWedding("Wedding B");
    const theirs = await sendInvite(b.owner.cookie, b.weddingId);
    const invitationId = theirs.json.data.invitation.id;

    for (const handler of [revoke, resend]) {
      const result = await call(handler, {
        method: handler === revoke ? "DELETE" : "POST",
        cookie: a.owner.cookie,
        params: { weddingId: a.weddingId, invitationId },
      });
      expect(result.status).toBe(404);
    }
    const row = await WeddingInvitation.findOne({ _id: invitationId }).lean();
    expect(row?.status).toBe("pending");
  });
});

describe("GET /public/invitations/:token", () => {
  it("shows just enough for a landing page, with no session", async () => {
    captureEmails();
    const { weddingId, owner } = await setupWedding("Aarav & Diya");
    const created = await sendInvite(owner.cookie, weddingId, { role: "admin" });
    const result = await previewOf(tokenOf(created.json.data.inviteLink));

    expect(result.status).toBe(200);
    expect(result.json.data).toEqual({
      valid: true,
      weddingTitle: "Aarav & Diya",
      inviterName: owner.user.name,
      role: "admin",
      expiresAt: expect.any(String),
    });
  });

  it("gives the same quiet answer for unknown, expired and deleted-wedding links", async () => {
    captureEmails();
    const { weddingId, owner, title } = await setupWedding("Priya & Rohan");
    const expired = await sendInvite(owner.cookie, weddingId);
    await WeddingInvitation.updateOne(
      { _id: expired.json.data.invitation.id },
      { $set: { expiresAt: new Date(Date.now() - 1000) } },
    );
    const live = await sendInvite(owner.cookie, weddingId);

    const unknown = await previewOf("a".repeat(43));
    expect(unknown.json.data).toEqual({ valid: false });
    expect((await previewOf(tokenOf(expired.json.data.inviteLink))).json.data).toEqual({
      valid: false,
    });

    await call(deleteWedding, {
      method: "DELETE",
      cookie: owner.cookie,
      params: { weddingId },
      body: { confirm: title },
    });
    expect((await previewOf(tokenOf(live.json.data.inviteLink))).json.data).toEqual({
      valid: false,
    });
  });

  it("rejects a malformed token", async () => {
    const result = await previewOf("short");
    expect(result.status).toBe(400);
  });
});

describe("POST /invitations/accept", () => {
  it("adds the person to the wedding with the invited role and label", async () => {
    captureEmails();
    const { weddingId, owner } = await setupWedding("Aarav & Diya");
    const created = await sendInvite(owner.cookie, weddingId, {
      role: "admin",
      relationship: "planner",
    });
    const invitee = await signUpUser();

    const result = await call(accept, {
      cookie: invitee.cookie,
      body: { token: tokenOf(created.json.data.inviteLink) },
    });
    expect(result.status).toBe(200);
    expect(result.json.data.wedding).toEqual({ id: weddingId, title: "Aarav & Diya" });
    expect(result.json.data.membership.role).toBe("admin");

    const row = await WeddingMember.findOne({ userId: invitee.user.id }).lean();
    expect(row).toMatchObject({ role: "admin", relationship: "planner", status: "active" });
    expect(row?.weddingId.toString()).toBe(weddingId);
    expect(row?.invitedBy?.toString()).toBe(owner.user.id);

    const stored = await WeddingInvitation.findOne({ _id: created.json.data.invitation.id }).lean();
    expect(stored).toMatchObject({ status: "accepted" });
    expect(stored?.acceptedBy?.toString()).toBe(invitee.user.id);
  });

  it("works with a different email than the one invited (the token authorizes the join)", async () => {
    captureEmails();
    const { weddingId, owner } = await setupWedding();
    const created = await sendInvite(owner.cookie, weddingId, { email: "invited@example.com" });
    const someoneElse = await signUpUser("other@example.com");
    const result = await call(accept, {
      cookie: someoneElse.cookie,
      body: { token: tokenOf(created.json.data.inviteLink) },
    });
    expect(result.status).toBe(200);
  });

  it("is single use", async () => {
    captureEmails();
    const { weddingId, owner } = await setupWedding();
    const created = await sendInvite(owner.cookie, weddingId);
    const token = tokenOf(created.json.data.inviteLink);
    const first = await signUpUser();
    const second = await signUpUser();

    expect((await call(accept, { cookie: first.cookie, body: { token } })).status).toBe(200);
    const reused = await call(accept, { cookie: second.cookie, body: { token } });
    expect(reused.status).toBe(403);
    expect(reused.json.error.code).toBe("INVALID_TOKEN");
    expect(await WeddingMember.countDocuments({ userId: second.user.id })).toBe(0);
  });

  it("lets only one of two simultaneous accepts through", async () => {
    captureEmails();
    const { weddingId, owner } = await setupWedding();
    const created = await sendInvite(owner.cookie, weddingId);
    const token = tokenOf(created.json.data.inviteLink);
    const a = await signUpUser();
    const b = await signUpUser();

    const results = await Promise.all([
      call(accept, { cookie: a.cookie, body: { token } }),
      call(accept, { cookie: b.cookie, body: { token } }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 403]);
    expect(await WeddingMember.countDocuments({ weddingId, role: "member" })).toBe(1);
  });

  it("rejects expired, revoked and unknown links the same way", async () => {
    captureEmails();
    const { weddingId, owner } = await setupWedding();
    const expired = await sendInvite(owner.cookie, weddingId);
    await WeddingInvitation.updateOne(
      { _id: expired.json.data.invitation.id },
      { $set: { expiresAt: new Date(Date.now() - 1000) } },
    );
    const revoked = await sendInvite(owner.cookie, weddingId);
    await call(revoke, {
      method: "DELETE",
      cookie: owner.cookie,
      params: { weddingId, invitationId: revoked.json.data.invitation.id },
    });
    const invitee = await signUpUser();

    for (const token of [
      tokenOf(expired.json.data.inviteLink),
      tokenOf(revoked.json.data.inviteLink),
      "z".repeat(43),
    ]) {
      const result = await call(accept, { cookie: invitee.cookie, body: { token } });
      expect(result.status).toBe(403);
      expect(result.json.error.code).toBe("INVALID_TOKEN");
    }
    expect(await WeddingMember.countDocuments({ userId: invitee.user.id })).toBe(0);
  });

  it("refuses someone who already has a wedding, and does not burn the invitation", async () => {
    captureEmails();
    const { weddingId, owner } = await setupWedding();
    const created = await sendInvite(owner.cookie, weddingId);
    const token = tokenOf(created.json.data.inviteLink);

    const busy = await signUpUser();
    const theirs = await call(createWedding, {
      cookie: busy.cookie,
      body: { title: "My own wedding", relationship: "couple" },
    });
    expect(theirs.status).toBe(201);

    const result = await call(accept, { cookie: busy.cookie, body: { token } });
    expect(result.status).toBe(409);
    expect(result.json.error.code).toBe("ALREADY_IN_WEDDING");

    const stored = await WeddingInvitation.findOne({ _id: created.json.data.invitation.id }).lean();
    expect(stored?.status).toBe("pending");
    // ...so someone else can still use it.
    const free = await signUpUser();
    expect((await call(accept, { cookie: free.cookie, body: { token } })).status).toBe(200);
  });

  it("refuses an invitation to a wedding that has since been deleted", async () => {
    captureEmails();
    const { weddingId, owner, title } = await setupWedding();
    const created = await sendInvite(owner.cookie, weddingId);
    await call(deleteWedding, {
      method: "DELETE",
      cookie: owner.cookie,
      params: { weddingId },
      body: { confirm: title },
    });
    const invitee = await signUpUser();
    const result = await call(accept, {
      cookie: invitee.cookie,
      body: { token: tokenOf(created.json.data.inviteLink) },
    });
    expect(result.status).toBe(403);
    expect(await WeddingMember.countDocuments({ userId: invitee.user.id })).toBe(0);
    const stored = await WeddingInvitation.findOne({ _id: created.json.data.invitation.id }).lean();
    expect(stored?.status).toBe("pending");
  });

  it("requires a session", async () => {
    const result = await call(accept, { body: { token: "a".repeat(43) } });
    expect(result.status).toBe(401);
  });

  it("gives the new member the access their role grants, and nothing more", async () => {
    captureEmails();
    const { weddingId, owner } = await setupWedding();
    const created = await sendInvite(owner.cookie, weddingId, { role: "member" });
    const invitee = await signUpUser();
    await call(accept, {
      cookie: invitee.cookie,
      body: { token: tokenOf(created.json.data.inviteLink) },
    });

    const list = await call(listInvitations, {
      method: "GET",
      cookie: invitee.cookie,
      params: { weddingId },
    });
    expect(list.status).toBe(403);
    expect(list.json.error.code).toBe("INSUFFICIENT_ROLE");
  });
});
