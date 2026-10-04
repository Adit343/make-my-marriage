import "server-only";
import { consoleEmailProvider } from "@/infrastructure/email/console-provider";
import {
  createResendProvider,
  RESEND_ONBOARDING_SENDER,
} from "@/infrastructure/email/resend-provider";
import { EmailProviderError, type EmailProvider } from "@/infrastructure/email/types";
import { getEnv } from "@/lib/env";

export type { EmailMessage, EmailProvider } from "@/infrastructure/email/types";
export { EmailProviderError } from "@/infrastructure/email/types";

/** Refuses every send: production without RESEND_API_KEY must not fall back to the console. */
const unconfiguredProvider: EmailProvider = {
  name: "unconfigured",
  async send() {
    throw new EmailProviderError("not_configured", "RESEND_API_KEY is not set");
  },
};

let override: EmailProvider | undefined;

export function getEmailProvider(): EmailProvider {
  if (override) return override;
  const env = getEnv();
  if (env.RESEND_API_KEY) {
    return createResendProvider(env.RESEND_API_KEY, env.EMAIL_FROM ?? RESEND_ONBOARDING_SENDER);
  }
  return env.NODE_ENV === "production" ? unconfiguredProvider : consoleEmailProvider;
}

/** Tests capture outgoing mail instead of printing or sending it. */
export function setEmailProviderForTests(provider: EmailProvider | undefined) {
  override = provider;
}
