import {
  EmailProviderError,
  type EmailMessage,
  type EmailProvider,
} from "@/infrastructure/email/types";

// Resend's REST API called directly with fetch: one endpoint, no SDK dependency needed.
// https://resend.com/docs/api-reference/emails/send-email
const RESEND_SEND_URL = "https://api.resend.com/emails";

/**
 * Without a verified sending domain, Resend only accepts its shared onboarding sender and only
 * delivers to the account owner's own address — fine for testing, not for real invitees.
 */
export const RESEND_ONBOARDING_SENDER = "Make My Marriage <onboarding@resend.dev>";

export function createResendProvider(apiKey: string, from: string): EmailProvider {
  return {
    name: "resend",
    async send(message: EmailMessage) {
      let response: Response;
      try {
        response = await fetch(RESEND_SEND_URL, {
          method: "POST",
          headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
          body: JSON.stringify({
            from,
            to: [message.to],
            subject: message.subject,
            html: message.html,
            text: message.text,
          }),
          signal: AbortSignal.timeout(10_000),
        });
      } catch {
        throw new EmailProviderError("network_error", "Could not reach the email provider");
      }

      const body = (await response.json().catch(() => null)) as {
        id?: string;
        name?: string;
        message?: string;
      } | null;

      if (!response.ok) {
        throw new EmailProviderError(
          body?.name ?? `http_${response.status}`,
          body?.message ?? `Email provider responded with HTTP ${response.status}`,
        );
      }
      return { providerMessageId: body?.id ?? null };
    },
  };
}
