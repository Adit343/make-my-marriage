import { describe, expect, it } from "vitest";
import { GET as me } from "@/app/api/v1/users/me/route";
import { DELETE as endOthers, GET as listSessions } from "@/app/api/v1/auth/sessions/route";
import { logInUser, signUpUser } from "../../setup/auth";
import { setupTestDatabase } from "../../setup/database";
import { call, cookiePair } from "../../setup/http";

setupTestDatabase();

// "Sign out all other sessions" on the Settings screen.
describe("DELETE /auth/sessions", () => {
  it("ends every other session of the caller and keeps the current one", async () => {
    const { cookie, email } = await signUpUser();
    const phone = await logInUser(email);
    const tablet = await logInUser(email);
    const phoneCookie = cookiePair(phone.setCookies, "mmm_session")!;
    const tabletCookie = cookiePair(tablet.setCookies, "mmm_session")!;

    const result = await call(endOthers, { method: "DELETE", cookie });
    expect(result.status).toBe(200);

    expect((await call(me, { method: "GET", cookie })).status).toBe(200);
    expect((await call(me, { method: "GET", cookie: phoneCookie })).status).toBe(401);
    expect((await call(me, { method: "GET", cookie: tabletCookie })).status).toBe(401);

    const sessions = await call(listSessions, { method: "GET", cookie });
    expect(sessions.json.data).toHaveLength(1);
    expect(sessions.json.data[0].isCurrent).toBe(true);
  });

  it("never touches another user's sessions", async () => {
    const mine = await signUpUser();
    const theirs = await signUpUser();
    await call(endOthers, { method: "DELETE", cookie: mine.cookie });
    expect((await call(me, { method: "GET", cookie: theirs.cookie })).status).toBe(200);
  });

  it("requires a session", async () => {
    expect((await call(endOthers, { method: "DELETE" })).status).toBe(401);
  });
});

describe("GET /users/me", () => {
  it("says when the password was last set, and null for Google-only accounts", async () => {
    const { cookie } = await signUpUser();
    const result = await call(me, { method: "GET", cookie });
    expect(result.json.data.passwordChangedAt).toEqual(expect.any(String));
    expect(new Date(result.json.data.passwordChangedAt).getTime()).toBeLessThanOrEqual(Date.now());
  });
});
