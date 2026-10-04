import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { DELETE as deleteSession } from "@/app/api/v1/auth/sessions/[sessionId]/route";
import { GET as listSessions } from "@/app/api/v1/auth/sessions/route";
import { GET as me } from "@/app/api/v1/users/me/route";
import { POST as createWedding } from "@/app/api/v1/weddings/route";
import { WeddingMember } from "@/models/weddingMember.model";
import { logInUser, signUpUser } from "../../setup/auth";
import { setupTestDatabase } from "../../setup/database";
import { call, cookiePair } from "../../setup/http";

setupTestDatabase();

const getMe = (cookie: string) => call(me, { method: "GET", cookie });

describe("session management", () => {
  it("lists only the caller's sessions and marks the current one", async () => {
    const { email, cookie } = await signUpUser();
    await logInUser(email);
    await signUpUser(); // someone else's session must not appear

    const result = await call(listSessions, { method: "GET", cookie });
    expect(result.status).toBe(200);
    expect(result.json.data).toHaveLength(2);
    expect(result.json.data.filter((s: { isCurrent: boolean }) => s.isCurrent)).toHaveLength(1);
    expect(JSON.stringify(result.json)).not.toContain("tokenHash");
  });

  it("revokes another device's session, but never someone else's", async () => {
    const { email, cookie } = await signUpUser();
    const phone = cookiePair((await logInUser(email)).setCookies, "mmm_session")!;
    const sessions = (await call(listSessions, { method: "GET", cookie })).json.data;
    const phoneSession = sessions.find((s: { isCurrent: boolean }) => !s.isCurrent);

    const stranger = await signUpUser();
    const strangerAttempt = await call(deleteSession, {
      method: "DELETE",
      cookie: stranger.cookie,
      params: { sessionId: phoneSession.id },
    });
    expect(strangerAttempt.status).toBe(404);
    expect((await getMe(phone)).status).toBe(200);

    const revoked = await call(deleteSession, {
      method: "DELETE",
      cookie,
      params: { sessionId: phoneSession.id },
    });
    expect(revoked.status).toBe(200);
    expect((await getMe(phone)).status).toBe(401);
    expect((await getMe(cookie)).status).toBe(200);
  });

  it("clears the cookie when the current session is revoked", async () => {
    const { cookie } = await signUpUser();
    const [current] = (await call(listSessions, { method: "GET", cookie })).json.data;
    const result = await call(deleteSession, {
      method: "DELETE",
      cookie,
      params: { sessionId: current.id },
    });
    expect(result.setCookies.join()).toContain("Max-Age=0");
  });

  it("rejects malformed session ids", async () => {
    const { cookie } = await signUpUser();
    const result = await call(deleteSession, {
      method: "DELETE",
      cookie,
      params: { sessionId: "not-an-id" },
    });
    expect(result.status).toBe(400);
  });
});

describe("POST /api/v1/weddings", () => {
  it("creates the wedding and the caller's owner membership together", async () => {
    const { cookie, user } = await signUpUser();
    const result = await call(createWedding, {
      cookie,
      body: { title: "Ananya & Vikram", relationship: "couple" },
    });

    expect(result.status).toBe(201);
    expect(result.json.data.wedding).toMatchObject({
      title: "Ananya & Vikram",
      timezone: "Asia/Kolkata",
      currency: "INR",
      status: "planning",
      version: 0,
    });
    expect(result.json.data.membership.role).toBe("owner");

    const membership = await WeddingMember.findOne({ userId: new Types.ObjectId(user.id) }).lean();
    expect(membership).toMatchObject({ role: "owner", relationship: "couple" });
    expect(membership?.weddingId.toString()).toBe(result.json.data.wedding.id);
  });

  it("allows one wedding per user — including two requests racing each other", async () => {
    const { cookie, user } = await signUpUser();
    const attempt = (title: string) => call(createWedding, { cookie, body: { title } });

    const results = await Promise.all([attempt("First"), attempt("Second")]);
    const statuses = results.map((result) => result.status).sort();
    expect(statuses).toEqual([201, 409]);
    expect(results.find((r) => r.status === 409)!.json.error.code).toBe("ALREADY_IN_WEDDING");

    const later = await attempt("Third");
    expect(later.status).toBe(409);
    expect(await WeddingMember.countDocuments({ userId: new Types.ObjectId(user.id) })).toBe(1);
  });

  it("requires a session and valid input", async () => {
    expect((await call(createWedding, { body: { title: "Nope" } })).status).toBe(401);

    const { cookie } = await signUpUser();
    const invalid = await call(createWedding, {
      cookie,
      body: { title: "Bad date", weddingDate: "14-02-2027" },
    });
    expect(invalid.status).toBe(400);
  });
});
