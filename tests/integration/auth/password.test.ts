import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { POST as changePassword } from "@/app/api/v1/auth/password/change/route";
import { POST as resetConfirm } from "@/app/api/v1/auth/password/reset-confirm/route";
import { POST as resetRequest } from "@/app/api/v1/auth/password/reset-request/route";
import { GET as me } from "@/app/api/v1/users/me/route";
import { setEmailProviderForTests, EmailProviderError } from "@/infrastructure/email";
import { hashToken } from "@/lib/crypto/tokens";
import { EmailLog } from "@/models/emailLog.model";
import { PasswordResetToken } from "@/models/passwordResetToken.model";
import { captureEmails, freshIp, logInUser, PASSWORD, signUpUser } from "../../setup/auth";
import { clearCollections, setupTestDatabase } from "../../setup/database";
import { call } from "../../setup/http";

setupTestDatabase();
beforeEach(clearCollections);
afterAll(() => setEmailProviderForTests(undefined));

const NEW_PASSWORD = "an-even-better-passphrase";
const getMe = (cookie: string) => call(me, { method: "GET", cookie });

function linkToken(text: string): string {
  const match = text.match(/\/reset-password\/([A-Za-z0-9_-]+)/);
  if (!match) throw new Error("no reset link in email");
  return match[1]!;
}

describe("POST /api/v1/auth/password/change", () => {
  it("needs the current password", async () => {
    const { cookie } = await signUpUser();
    const result = await call(changePassword, {
      cookie,
      body: { currentPassword: "wrong-password", newPassword: NEW_PASSWORD },
    });
    expect(result.status).toBe(401);
  });

  it("changes the password and signs out every other device", async () => {
    const { email, cookie: laptop } = await signUpUser();
    const phone = (await logInUser(email)).setCookies[0]!.split(";")[0]!;

    const result = await call(changePassword, {
      cookie: laptop,
      body: { currentPassword: PASSWORD, newPassword: NEW_PASSWORD },
    });
    expect(result.status).toBe(200);

    expect((await getMe(laptop)).status).toBe(200);
    expect((await getMe(phone)).status).toBe(401);
    expect((await logInUser(email, PASSWORD)).status).toBe(401);
    expect((await logInUser(email, NEW_PASSWORD)).status).toBe(200);
  });
});

describe("password reset", () => {
  let emails: ReturnType<typeof captureEmails>;
  beforeEach(() => {
    emails = captureEmails();
  });

  it("answers 200 for unknown emails without sending anything", async () => {
    const result = await call(resetRequest, { body: { email: "ghost@example.com" } });
    expect(result.status).toBe(200);
    expect(emails).toHaveLength(0);
  });

  it("emails a single-use link, stores only its hash, and logs the send", async () => {
    const { email } = await signUpUser();
    expect((await call(resetRequest, { body: { email } })).status).toBe(200);

    expect(emails).toHaveLength(1);
    expect(emails[0]!.to).toBe(email);
    const token = linkToken(emails[0]!.text);
    expect(emails[0]!.html).toContain(`/reset-password/${token}`);

    const stored = await PasswordResetToken.findOne({}).select("+tokenHash").lean();
    expect(stored?.tokenHash).toBe(hashToken(token));

    const log = await EmailLog.findOne({}).lean();
    expect(log).toMatchObject({
      type: "password_reset",
      status: "sent",
      weddingId: null,
      recipientEmail: email,
    });
    expect(JSON.stringify(log)).not.toContain(token);
  });

  it("sets the new password once, signs out everywhere, and refuses reuse", async () => {
    const { email, cookie } = await signUpUser();
    await call(resetRequest, { body: { email } });
    const token = linkToken(emails[0]!.text);

    const confirm = () =>
      call(resetConfirm, { body: { token, newPassword: NEW_PASSWORD }, ip: freshIp() });

    expect((await confirm()).status).toBe(200);
    expect((await getMe(cookie)).status).toBe(401);
    expect((await logInUser(email, NEW_PASSWORD)).status).toBe(200);

    const reused = await confirm();
    expect(reused.status).toBe(403);
    expect(reused.json.error.code).toBe("INVALID_TOKEN");
  });

  it("only the newest link works", async () => {
    const { email } = await signUpUser();
    await call(resetRequest, { body: { email } });
    await call(resetRequest, { body: { email } });
    const [older, newer] = emails.map((message) => linkToken(message.text));

    const body = (token: string) => ({ token, newPassword: NEW_PASSWORD });
    expect((await call(resetConfirm, { body: body(older!), ip: freshIp() })).status).toBe(403);
    expect((await call(resetConfirm, { body: body(newer!), ip: freshIp() })).status).toBe(200);
  });

  it("refuses expired links", async () => {
    const { email } = await signUpUser();
    await call(resetRequest, { body: { email } });
    await PasswordResetToken.updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });

    const result = await call(resetConfirm, {
      body: { token: linkToken(emails[0]!.text), newPassword: NEW_PASSWORD },
      ip: freshIp(),
    });
    expect(result.status).toBe(403);
  });

  it("still answers 200 when the email provider fails, and logs the failure", async () => {
    setEmailProviderForTests({
      name: "broken",
      async send() {
        throw new EmailProviderError("http_500", "Provider is down");
      },
    });
    const { email } = await signUpUser();

    expect((await call(resetRequest, { body: { email } })).status).toBe(200);
    expect(await EmailLog.findOne({}).lean()).toMatchObject({
      status: "failed",
      provider: "broken",
      error: { code: "http_500", message: "Provider is down" },
    });
  });
});
