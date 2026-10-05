import { describe, expect, it } from "vitest";
import { POST as invite } from "@/app/api/v1/weddings/[weddingId]/invitations/route";
import { resolveSession } from "@/modules/auth/session.service";
import { getSettingsPage, getTeamPage } from "@/modules/dashboard/workspace-pages.service";
import { captureEmails, logInUser, signUpUser } from "../../setup/auth";
import { setupTestDatabase } from "../../setup/database";
import { call } from "../../setup/http";
import { addMember, setupWedding } from "../../setup/wedding";

setupTestDatabase();

/** What a Server Component has: the AuthContext resolved from the session cookie. */
async function authFor(cookie: string) {
  const auth = await resolveSession(cookie.split("=")[1]);
  if (!auth) throw new Error("no session");
  return auth;
}

describe("getTeamPage", () => {
  it("gives owners and admins the members and the pending invitations", async () => {
    captureEmails();
    const { weddingId, owner } = await setupWedding("Aarav & Diya");
    await addMember(weddingId, "member");
    await call(invite, {
      cookie: owner.cookie,
      params: { weddingId },
      body: { email: "meena@example.com", role: "member" },
    });

    const page = await getTeamPage(await authFor(owner.cookie));
    expect(page?.viewer).toEqual({ memberId: owner.memberId, role: "owner" });
    expect(page?.members.map((m) => m.role)).toEqual(["owner", "member"]);
    expect(page?.invitations.map((i) => i.email)).toEqual(["meena@example.com"]);
    expect(page?.weddingTitle).toBe("Aarav & Diya");
  });

  it("never gives a plain member the list of invited email addresses", async () => {
    captureEmails();
    const { weddingId, owner } = await setupWedding();
    const member = await addMember(weddingId, "member");
    await call(invite, {
      cookie: owner.cookie,
      params: { weddingId },
      body: { email: "secret-invitee@example.com", role: "member" },
    });

    const page = await getTeamPage(await authFor(member.cookie));
    expect(page?.invitations).toEqual([]);
    expect(JSON.stringify(page)).not.toContain("secret-invitee@example.com");
  });

  it("is null for someone with no wedding", async () => {
    const { cookie } = await signUpUser();
    expect(await getTeamPage(await authFor(cookie))).toBeNull();
    expect(await getSettingsPage(await authFor(cookie))).toBeNull();
  });
});

describe("getSettingsPage", () => {
  it("tells the page who may edit and how many people are on the team", async () => {
    const { weddingId, owner } = await setupWedding();
    const admin = await addMember(weddingId, "admin");
    const member = await addMember(weddingId, "member");

    const asOwner = await getSettingsPage(await authFor(owner.cookie));
    expect(asOwner).toMatchObject({ canEditWedding: true, activeMemberCount: 3 });
    expect(asOwner?.wedding.version).toBe(0);
    expect(asOwner?.user).toMatchObject({
      name: owner.user.name,
      email: owner.user.email,
      hasPassword: true,
    });
    expect((await getSettingsPage(await authFor(admin.cookie)))?.canEditWedding).toBe(true);
    expect((await getSettingsPage(await authFor(member.cookie)))?.canEditWedding).toBe(false);
  });
});

describe("page extras for the Stitch screens", () => {
  it("labels pending invitations with how long they have left", async () => {
    captureEmails();
    const { weddingId, owner } = await setupWedding();
    await call(invite, {
      cookie: owner.cookie,
      params: { weddingId },
      body: { email: "soon@example.com", role: "member" },
    });
    const page = await getTeamPage(await authFor(owner.cookie));
    expect(page?.invitations[0]?.expiresLabel).toBe("Expires in 7 days");
  });

  it("lists the caller's sessions, current first, with a readable device name", async () => {
    const { owner } = await setupWedding();
    await logInUser(owner.user.email);
    const page = await getSettingsPage(await authFor(owner.cookie));
    expect(page?.sessions).toHaveLength(2);
    expect(page?.sessions[0]).toMatchObject({ isCurrent: true, activity: "Active now" });
    expect(page?.sessions[1]?.isCurrent).toBe(false);
    expect(page?.user.passwordChangedLabel).toBe("Last changed today");
    expect(page?.user.hasGoogle).toBe(false);
  });
});
