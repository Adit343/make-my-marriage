import { setEmailProviderForTests, type EmailMessage } from "@/infrastructure/email";
import { POST as login } from "@/app/api/v1/auth/login/route";
import { POST as signup } from "@/app/api/v1/auth/signup/route";
import { call, cookiePair } from "./http";

export const PASSWORD = "correct-horse-battery";

let ipCounter = 0;
/** A fresh client IP per call keeps the per-IP signup limit out of unrelated tests. */
export function freshIp() {
  ipCounter += 1;
  return `203.0.113.${ipCounter % 250}`;
}

/** Signs up a user and returns their session cookie ("mmm_session=…"). */
export async function signUpUser(email = `user${Date.now()}${Math.random()}@example.com`) {
  const result = await call(signup, {
    body: { email, password: PASSWORD, name: "Priya Sharma" },
    ip: freshIp(),
  });
  if (result.status !== 201) throw new Error(`signup failed: ${JSON.stringify(result.json)}`);
  return {
    email,
    cookie: cookiePair(result.setCookies, "mmm_session")!,
    user: result.json.data.user,
  };
}

export async function logInUser(email: string, password = PASSWORD, rememberMe = false) {
  return call(login, { body: { email, password, rememberMe }, ip: freshIp() });
}

/** Captures outgoing email instead of printing or sending it. */
export function captureEmails() {
  const sent: EmailMessage[] = [];
  setEmailProviderForTests({
    name: "test",
    async send(message) {
      sent.push(message);
      return { providerMessageId: `test-${sent.length}` };
    },
  });
  return sent;
}
