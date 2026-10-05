import { afterEach, describe, expect, it } from "vitest";
import { POST as accept } from "@/app/api/v1/invitations/accept/route";
import { GET as preview } from "@/app/api/v1/public/invitations/[token]/route";
import { POST as newLink } from "@/app/api/v1/weddings/[weddingId]/invitations/[invitationId]/link/route";
import { DELETE as revoke } from "@/app/api/v1/weddings/[weddingId]/invitations/[invitationId]/route";
import { POST as invite } from "@/app/api/v1/weddings/[weddingId]/invitations/route";
import { setEmailProviderForTests } from "@/infrastructure/email";
import { EmailLog } from "@/models/emailLog.model";
import { WeddingInvitation } from "@/models/weddingInvitation.model";
import { captureEmails, signUpUser } from "../../setup/auth";
import { setupTestDatabase } from "../../setup/database";
import { call } from "../../setup/http";
import { addMember, setupWedding } from "../../setup/wedding";

setupTestDatabase();

afterEach(() => setEmailProviderForTests(undefined));

const tokenOf = (inviteLink: string) => inviteLink.split("/join/")[1]!;

async function createInvitation(cookie: string, weddingId: string) {
  const result = await call(invite, {
    cookie,
    params: { weddingId },
    body: { email: `guest${Math.random()}@example.com`, role: "member" },
  });
  return {
    invitationId: result.json.data.invitation.id as string,
    token: tokenOf(result.json.data.inviteLink),
  };
}

// "Copy invite link" on the Team screen: a fresh link, no email.
describe("POST /weddings/:weddingId/invitations/:invitationId/link", () => {
  it("returns a working fresh link, kills the old one and sends no email", async () => {
    const sent = captureEmails();
    const { weddingId, owner } = await setupWedding();
    const { invitationId, token: oldToken } = await createInvitation(owner.cookie, weddingId);
    expect(sent).toHaveLength(1);

    const result = await call(newLink, {
      cookie: owner.cookie,
      params: { weddingId, invitationId },
    });
    expect(result.status).toBe(200);
    const fresh = tokenOf(result.json.data.inviteLink);
    expect(fresh).not.toBe(oldToken);

    expect(sent).toHaveLength(1);
    expect(await EmailLog.countDocuments({ invitationId })).toBe(1);
    const old = await call(preview, { method: "GET", params: { token: oldToken } });
    expect(old.json.data).toEqual({ valid: false });
    const live = await call(preview, { method: "GET", params: { token: fresh } });
    expect(live.json.data.valid).toBe(true);

    const invitee = await signUpUser();
    const joined = await call(accept, { cookie: invitee.cookie, body: { token: fresh } });
    expect(joined.status).toBe(200);
  });

  it("extends the expiry", async () => {
    captureEmails();
    const { weddingId, owner } = await setupWedding();
    const { invitationId } = await createInvitation(owner.cookie, weddingId);
    await WeddingInvitation.updateOne(
      { _id: invitationId },
      { $set: { expiresAt: new Date(Date.now() + 60_000) } },
    );

    await call(newLink, { cookie: owner.cookie, params: { weddingId, invitationId } });
    const row = await WeddingInvitation.findOne({ _id: invitationId }).lean();
    expect(row!.expiresAt.getTime()).toBeGreaterThan(Date.now() + 6 * 24 * 60 * 60 * 1000);
  });

  it("is admin+ only, and only for pending invitations of this wedding", async () => {
    captureEmails();
    const a = await setupWedding("Wedding A");
    const b = await setupWedding("Wedding B");
    const member = await addMember(a.weddingId, "member");
    const { invitationId } = await createInvitation(a.owner.cookie, a.weddingId);

    const asMember = await call(newLink, {
      cookie: member.cookie,
      params: { weddingId: a.weddingId, invitationId },
    });
    expect(asMember.status).toBe(403);
    expect(asMember.json.error.code).toBe("INSUFFICIENT_ROLE");

    const crossWedding = await call(newLink, {
      cookie: b.owner.cookie,
      params: { weddingId: b.weddingId, invitationId },
    });
    expect(crossWedding.status).toBe(404);

    await call(revoke, {
      method: "DELETE",
      cookie: a.owner.cookie,
      params: { weddingId: a.weddingId, invitationId },
    });
    const revoked = await call(newLink, {
      cookie: a.owner.cookie,
      params: { weddingId: a.weddingId, invitationId },
    });
    expect(revoked.status).toBe(409);
  });
});
