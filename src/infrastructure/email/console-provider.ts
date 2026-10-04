import type { EmailMessage, EmailProvider } from "@/infrastructure/email/types";

/**
 * Development only: prints the email (including any links) to the server console instead of
 * sending it. Never used in production — links in emails are secrets (Architecture §37).
 */
export const consoleEmailProvider: EmailProvider = {
  name: "console",
  async send(message: EmailMessage) {
    console.log(
      [
        "",
        "──────── DEV EMAIL (not sent) ────────",
        `To:      ${message.to}`,
        `Subject: ${message.subject}`,
        "",
        message.text,
        "──────────────────────────────────────",
        "",
      ].join("\n"),
    );
    return { providerMessageId: null };
  },
};
