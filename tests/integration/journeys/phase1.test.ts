import { describe, expect, it } from "vitest";
import { POST as login } from "@/app/api/v1/auth/login/route";
import { POST as resetConfirm } from "@/app/api/v1/auth/password/reset-confirm/route";
import { POST as resetRequest } from "@/app/api/v1/auth/password/reset-request/route";
import { POST as signup } from "@/app/api/v1/auth/signup/route";
import { POST as accept } from "@/app/api/v1/invitations/accept/route";
import { GET as me } from "@/app/api/v1/users/me/route";
import { POST as invite } from "@/app/api/v1/weddings/[weddingId]/invitations/route";
import { GET as listMembers } from "@/app/api/v1/weddings/[weddingId]/members/route";
import { GET as getWedding, PATCH as patchWedding } from "@/app/api/v1/weddings/[weddingId]/route";
import { POST as createWedding } from "@/app/api/v1/weddings/route";
import { resolveSession } from "@/modules/auth/session.service";
import { getDashboard } from "@/modules/dashboard/dashboard.service";
import { captureEmails, freshIp } from "../../setup/auth";
import { setupTestDatabase } from "../../setup/database";
import { call, cookiePair } from "../../setup/http";

setupTestDatabase();

async function authOf(cookie: string) {
  const auth = await resolveSession(cookie.split("=")[1]);
  if (!auth) throw new Error("not signed in");
  return auth;
}

async function newAccount(name: string, email: string) {
  const result = await call(signup, {
    body: { email, password: "journey-password-1", name },
    ip: freshIp(),
  });
  expect(result.status).toBe(201);
  expect(result.json.data.hasWedding).toBe(false);
  return cookiePair(result.setCookies, "mmm_session")!;
}

// Phase 1 exit condition (PRD §36): "A couple can create a wedding, access its workspace, invite
// collaborators, and reach a functional dashboard shell."
describe("Phase 1 journey: couple → wedding → family and planner → dashboards", () => {
  it("works end to end, with each person seeing exactly what their role allows", async () => {
    const emails = captureEmails();

    // 1. A couple member signs up (no verification gate) and sets up the wedding.
    const priya = await newAccount("Priya Sharma", "priya@example.com");
    const created = await call(createWedding, {
      cookie: priya,
      body: {
        title: "Aarav & Diya's Wedding",
        partners: [{ name: "Aarav" }, { name: "Diya" }],
        weddingDate: "2027-02-14",
        relationship: "couple",
        location: { address: { city: "Udaipur", state: "Rajasthan" } },
      },
    });
    expect(created.status).toBe(201);
    const weddingId: string = created.json.data.wedding.id;

    // 2. Her dashboard is ready: the wedding, her owner role, a one-person team.
    const priyaDash = await getDashboard(await authOf(priya));
    expect(priyaDash.workspace).toMatchObject({
      weddingId,
      title: "Aarav & Diya's Wedding",
      city: "Udaipur",
      team: [expect.objectContaining({ role: "owner", isYou: true })],
    });
    expect(priyaDash.viewer.role).toBe("owner");

    // 3. She invites her mother (member) and the planner (admin). Each gets an email with a link.
    const meenaInvite = await call(invite, {
      cookie: priya,
      params: { weddingId },
      body: { email: "meena@example.com", role: "member", relationship: "parent" },
    });
    const kavitaInvite = await call(invite, {
      cookie: priya,
      params: { weddingId },
      body: { email: "kavita@example.com", role: "admin", relationship: "planner" },
    });
    expect([meenaInvite.status, kavitaInvite.status]).toEqual([201, 201]);
    expect(emails.map((message) => message.to).sort()).toEqual([
      "kavita@example.com",
      "meena@example.com",
    ]);

    // 4. They open the links, sign up (no verification gate) and accept.
    const meena = await newAccount("Meena Sharma", "meena@example.com");
    const kavita = await newAccount("Kavita Rao", "kavita@example.com");
    for (const [cookie, link] of [
      [meena, meenaInvite.json.data.inviteLink],
      [kavita, kavitaInvite.json.data.inviteLink],
    ] as const) {
      const joined = await call(accept, {
        cookie,
        body: { token: String(link).split("/join/")[1] },
      });
      expect(joined.status).toBe(200);
      expect(joined.json.data.wedding.id).toBe(weddingId);
    }

    // 5. Everyone reaches the same workspace; the team has three people with the right roles.
    for (const cookie of [priya, meena, kavita]) {
      const dash = await getDashboard(await authOf(cookie));
      expect(dash.workspace?.weddingId).toBe(weddingId);
      expect(dash.workspace?.team.map((m) => m.role).sort()).toEqual(["admin", "member", "owner"]);
    }
    const team = await call(listMembers, { method: "GET", cookie: meena, params: { weddingId } });
    expect(team.json.meta.totalCount).toBe(3);

    // 6. Permissions hold: the planner (admin) can edit the wedding, the mother (member) cannot.
    const edit = (cookie: string, title: string) =>
      call(patchWedding, {
        method: "PATCH",
        cookie,
        params: { weddingId },
        body: { version: 0, title },
      });
    const denied = await edit(meena, "Renamed by mum");
    expect(denied.status).toBe(403);
    const allowed = await edit(kavita, "Aarav & Diya — Udaipur");
    expect(allowed.status).toBe(200);

    // 7. Every member sees the planner's change; nobody can see another wedding.
    const seen = await call(getWedding, { method: "GET", cookie: meena, params: { weddingId } });
    expect(seen.json.data.wedding.title).toBe("Aarav & Diya — Udaipur");
    const outsider = await newAccount("Outsider", "outsider@example.com");
    const blocked = await call(getWedding, {
      method: "GET",
      cookie: outsider,
      params: { weddingId },
    });
    expect(blocked.status).toBe(403);
  });
});

describe("Phase 1 journey: forgotten password", () => {
  it("resets by email, ends old sessions, and the new password works", async () => {
    const emails = captureEmails();
    const oldCookie = await newAccount("Priya Sharma", "reset-me@example.com");

    await call(resetRequest, { body: { email: "reset-me@example.com" }, ip: freshIp() });
    expect(emails).toHaveLength(1);
    const token = /\/reset-password\/([A-Za-z0-9_-]+)/.exec(emails[0]!.text)![1]!;

    const confirmed = await call(resetConfirm, {
      body: { token, newPassword: "a-brand-new-password-2" },
      ip: freshIp(),
    });
    expect(confirmed.status).toBe(200);

    // The session from before the reset is dead; the old password no longer works; the link is single-use.
    expect((await call(me, { method: "GET", cookie: oldCookie })).status).toBe(401);
    const oldLogin = await call(login, {
      body: { email: "reset-me@example.com", password: "journey-password-1" },
      ip: freshIp(),
    });
    expect(oldLogin.status).toBe(401);
    const newLogin = await call(login, {
      body: { email: "reset-me@example.com", password: "a-brand-new-password-2" },
      ip: freshIp(),
    });
    expect(newLogin.status).toBe(200);
    const reused = await call(resetConfirm, {
      body: { token, newPassword: "yet-another-password-3" },
      ip: freshIp(),
    });
    expect(reused.status).toBe(403);
    expect(reused.json.error.code).toBe("INVALID_TOKEN");
  });
});
