import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as signup } from "@/app/api/v1/auth/signup/route";
import { POST as resetRequest } from "@/app/api/v1/auth/password/reset-request/route";
import { GET as listSessions } from "@/app/api/v1/auth/sessions/route";
import { GET as publicInvitation } from "@/app/api/v1/public/invitations/[token]/route";
import { GET as me } from "@/app/api/v1/users/me/route";
import { DELETE as revokeInvitation } from "@/app/api/v1/weddings/[weddingId]/invitations/[invitationId]/route";
import { POST as linkInvitation } from "@/app/api/v1/weddings/[weddingId]/invitations/[invitationId]/link/route";
import { POST as resendInvitation } from "@/app/api/v1/weddings/[weddingId]/invitations/[invitationId]/resend/route";
import {
  GET as listInvitations,
  POST as createInvitation,
} from "@/app/api/v1/weddings/[weddingId]/invitations/route";
import { GET as listMembers } from "@/app/api/v1/weddings/[weddingId]/members/route";
import { GET as getWedding } from "@/app/api/v1/weddings/[weddingId]/route";
import { resetEnvCacheForTests } from "@/lib/env";
import { captureEmails, freshIp, signUpUser } from "../../setup/auth";
import { setupTestDatabase } from "../../setup/database";
import { call } from "../../setup/http";
import { addMember, setupWedding } from "../../setup/wedding";

setupTestDatabase();

afterEach(() => {
  // Only undo what these tests change; the test database's own env stubs must stay in place.
  vi.stubEnv("NODE_ENV", "test");
  resetEnvCacheForTests();
});

describe("API responses are never cacheable", () => {
  it("sends Cache-Control: no-store on success, validation and auth failures alike", async () => {
    const { cookie } = await signUpUser();
    const ok = await call(me, { method: "GET", cookie });
    const unauthorized = await call(me, { method: "GET" });
    const invalid = await call(publicInvitation, { method: "GET", params: { token: "x" } });
    for (const response of [ok, unauthorized, invalid]) {
      expect(response.headers.get("cache-control")).toBe("no-store");
    }
    expect([ok.status, unauthorized.status, invalid.status]).toEqual([200, 401, 400]);
  });
});

describe("session cookie", () => {
  it("is HttpOnly, SameSite=Lax and site-wide", async () => {
    const result = await call(signup, {
      body: { email: `c${Date.now()}@example.com`, password: "correct-horse-battery", name: "C" },
      ip: freshIp(),
    });
    const cookie = result.setCookies.find((c) => c.startsWith("mmm_session="))!;
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
    expect(cookie).not.toContain("Secure"); // plain http in dev/test
  });

  it("is also Secure in production, and holds an opaque value that is not the stored hash", async () => {
    vi.stubEnv("NODE_ENV", "production");
    resetEnvCacheForTests();
    const result = await call(signup, {
      body: { email: `p${Date.now()}@example.com`, password: "correct-horse-battery", name: "P" },
      ip: freshIp(),
    });
    const cookie = result.setCookies.find((c) => c.startsWith("mmm_session="))!;
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("HttpOnly");
    const value = decodeURIComponent(cookie.split(";")[0]!.split("=")[1]!);
    expect(value).toMatch(/^[A-Za-z0-9_-]{43}$/); // 32 random bytes, base64url
  });
});

describe("no secret ever appears in a response body", () => {
  // Anything that would be a credential, hash or internal-only field if it leaked.
  const FORBIDDEN = [
    "tokenHash",
    "passwordAuth",
    "scrypt",
    '"salt"',
    '"hash"',
    "tokenEnc",
    "deletedBy",
    "deletionReason",
    "purgeAt",
    "purgeAfter",
    "emailNormalized",
    "nameNormalized",
  ];

  it("holds for every read endpoint, for owners, admins and members", async () => {
    captureEmails();
    const { weddingId, owner } = await setupWedding();
    const admin = await addMember(weddingId, "admin");
    const member = await addMember(weddingId, "member");
    const created = await call(createInvitation, {
      cookie: owner.cookie,
      params: { weddingId },
      body: { email: "scan@example.com", role: "member" },
    });
    const token = created.json.data.inviteLink.split("/join/")[1] as string;

    const responses = [await call(publicInvitation, { method: "GET", params: { token } })];
    for (const person of [owner, admin, member]) {
      responses.push(
        await call(me, { method: "GET", cookie: person.cookie }),
        await call(listSessions, { method: "GET", cookie: person.cookie }),
        await call(getWedding, { method: "GET", cookie: person.cookie, params: { weddingId } }),
        await call(listMembers, { method: "GET", cookie: person.cookie, params: { weddingId } }),
      );
    }
    responses.push(
      await call(listInvitations, { method: "GET", cookie: owner.cookie, params: { weddingId } }),
      created,
    );

    for (const response of responses) {
      expect(response.status).toBeLessThan(400);
      const body = JSON.stringify(response.json);
      for (const word of FORBIDDEN) expect(body, word).not.toContain(word);
    }
    // The one place a raw invitation token may appear is the response that creates its link.
    const others = responses.filter((response) => response !== created);
    for (const response of others) {
      expect(JSON.stringify(response.json)).not.toContain(token);
    }
  });
});

describe("another wedding's invitations are out of reach", () => {
  it("denies every invitation route to members of a different wedding", async () => {
    captureEmails();
    const a = await setupWedding("Wedding A");
    const b = await setupWedding("Wedding B");
    const created = await call(createInvitation, {
      cookie: b.owner.cookie,
      params: { weddingId: b.weddingId },
      body: { email: "b-only@example.com", role: "member" },
    });
    const invitationId = created.json.data.invitation.id as string;
    const params = { weddingId: b.weddingId, invitationId };
    const cookie = a.owner.cookie;

    const attempts = await Promise.all([
      call(listInvitations, { method: "GET", cookie, params }),
      call(createInvitation, {
        cookie,
        params,
        body: { email: "x@example.com", role: "admin" },
      }),
      call(revokeInvitation, { method: "DELETE", cookie, params }),
      call(resendInvitation, { cookie, params }),
      call(linkInvitation, { cookie, params }),
    ]);
    for (const result of attempts) {
      expect(result.status).toBe(403);
      expect(result.json.error.code).toBe("NOT_A_MEMBER");
    }

    // Nothing leaked into, or changed in, wedding B.
    const list = await call(listInvitations, {
      method: "GET",
      cookie: b.owner.cookie,
      params: { weddingId: b.weddingId },
    });
    expect(list.json.data).toHaveLength(1);
    expect(list.json.data[0].status).toBe("pending");
  });
});

describe("password reset does not reveal which emails have accounts", () => {
  it("answers identically for a registered and an unregistered address", async () => {
    const sent = captureEmails();
    const { email } = await signUpUser();
    const known = await call(resetRequest, { body: { email }, ip: freshIp() });
    const unknown = await call(resetRequest, {
      body: { email: "nobody-here@example.com" },
      ip: freshIp(),
    });

    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(known.json).toEqual(unknown.json);
    // ...yet only the real account got an email.
    expect(sent.map((message) => message.to)).toEqual([email]);
  });
});
