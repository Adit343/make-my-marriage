import { beforeEach, describe, expect, it } from "vitest";
import { POST as login } from "@/app/api/v1/auth/login/route";
import { POST as logout } from "@/app/api/v1/auth/logout/route";
import { POST as signup } from "@/app/api/v1/auth/signup/route";
import { GET as me } from "@/app/api/v1/users/me/route";
import { hashToken } from "@/lib/crypto/tokens";
import { Session } from "@/models/session.model";
import { User } from "@/models/user.model";
import { freshIp, logInUser, PASSWORD, signUpUser } from "../../setup/auth";
import { clearCollections, setupTestDatabase } from "../../setup/database";
import { call, cookiePair, cookieValue } from "../../setup/http";

setupTestDatabase();
beforeEach(clearCollections);

const getMe = (cookie?: string) => call(me, { method: "GET", cookie });

describe("POST /api/v1/auth/signup", () => {
  it("creates the account, signs in with a secure cookie, and stores only the token's hash", async () => {
    const result = await call(signup, {
      body: { email: "Priya@Example.com", password: PASSWORD, name: "Priya Sharma" },
      ip: freshIp(),
    });

    expect(result.status).toBe(201);
    expect(result.json.data).toMatchObject({
      user: {
        email: "Priya@Example.com",
        name: "Priya Sharma",
        hasPassword: true,
        authProviders: [],
      },
      hasWedding: false,
    });
    expect(result.json.data.user).not.toHaveProperty("passwordAuth");

    const setCookie = result.setCookies.find((cookie) => cookie.startsWith("mmm_session="))!;
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).toContain(`Max-Age=${30 * 24 * 60 * 60}`);

    const token = cookieValue(result.setCookies, "mmm_session")!;
    const stored = await Session.findOne({}).select("+tokenHash").lean();
    expect(stored?.tokenHash).toBe(hashToken(token));
    expect(JSON.stringify(stored)).not.toContain(token);

    const user = await User.findOne({ emailNormalized: "priya@example.com" })
      .select("+passwordAuth")
      .lean();
    expect(user?.passwordAuth?.algorithm).toBe("scrypt");
    expect(JSON.stringify(user)).not.toContain(PASSWORD);
  });

  it("rejects a second account for the same email in any case", async () => {
    await signUpUser("meena@example.com");
    const result = await call(signup, {
      body: { email: "MEENA@example.com", password: PASSWORD, name: "Imposter" },
      ip: freshIp(),
    });
    expect(result.status).toBe(409);
    expect(result.json.error.code).toBe("EMAIL_TAKEN");
  });

  it("enforces the 10-character password minimum", async () => {
    const result = await call(signup, {
      body: { email: "short@example.com", password: "123456789", name: "Short" },
      ip: freshIp(),
    });
    expect(result.status).toBe(400);
    expect(result.json.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("POST /api/v1/auth/login", () => {
  it("signs in; 'remember me' controls whether the cookie outlives the browser", async () => {
    const { email } = await signUpUser();

    const remembered = await logInUser(email, PASSWORD, true);
    expect(remembered.status).toBe(200);
    expect(remembered.json.data.hasWedding).toBe(false);
    expect(remembered.setCookies.join()).toContain("Max-Age=");

    const browserOnly = await logInUser(email, PASSWORD, false);
    expect(browserOnly.status).toBe(200);
    expect(browserOnly.setCookies.find((c) => c.startsWith("mmm_session="))).not.toContain(
      "Max-Age",
    );
  });

  it("gives the same answer for a wrong password and an unknown email", async () => {
    const { email } = await signUpUser();
    const wrongPassword = await logInUser(email, "not-the-password");
    const unknownEmail = await logInUser("nobody@example.com", PASSWORD);

    for (const result of [wrongPassword, unknownEmail]) {
      expect(result.status).toBe(401);
      expect(result.json.error).toEqual({
        code: "AUTHENTICATION_REQUIRED",
        message: "Invalid email or password",
      });
      expect(result.setCookies).toHaveLength(0);
    }
  });

  it("refuses disabled accounts, including their existing sessions", async () => {
    const { email, cookie } = await signUpUser();
    await User.updateOne(
      { emailNormalized: email.toLowerCase() },
      { $set: { status: "disabled" } },
    );

    expect((await logInUser(email)).status).toBe(401);
    expect((await getMe(cookie)).status).toBe(401);
  });

  it("rate-limits repeated attempts for one email from one IP", async () => {
    const { email } = await signUpUser();
    const attempt = () =>
      call(login, { body: { email, password: "wrong-password" }, ip: "192.0.2.77" });

    for (let i = 0; i < 10; i += 1) expect((await attempt()).status).toBe(401);
    const blocked = await attempt();
    expect(blocked.status).toBe(429);
    expect(blocked.json.error.code).toBe("RATE_LIMITED");
    expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThan(0);
  });
});

describe("sessions", () => {
  it("GET /users/me needs a valid session", async () => {
    const { cookie, email } = await signUpUser();

    const ok = await getMe(cookie);
    expect(ok.status).toBe(200);
    expect(ok.json.data).toMatchObject({ email, hasPassword: true });

    expect((await getMe()).status).toBe(401);
    expect((await getMe("mmm_session=not-a-real-token")).status).toBe(401);
  });

  it("stops accepting a session once it expires", async () => {
    const { cookie } = await signUpUser();
    await Session.updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await getMe(cookie)).status).toBe(401);
  });

  it("logout revokes the session and clears the cookie; it is safe to call when signed out", async () => {
    const { cookie } = await signUpUser();

    const result = await call(logout, { cookie });
    expect(result.status).toBe(200);
    expect(cookiePair(result.setCookies, "mmm_session")).toBe("mmm_session=");
    expect(result.setCookies.join()).toContain("Max-Age=0");
    expect((await getMe(cookie)).status).toBe(401);

    expect((await call(logout)).status).toBe(200);
  });
});
