import "server-only";
import { randomUUID } from "node:crypto";
import type { Types } from "mongoose";
import { EmailProviderError, getEmailProvider, type EmailMessage } from "@/infrastructure/email";
import type { EmailType } from "@/lib/constants/enums";
import { logger } from "@/lib/logger";
import { insertEmailLog } from "@/modules/notifications/email-log.repository";

export interface SendEmailInput extends EmailMessage {
  type: EmailType;
  weddingId?: Types.ObjectId | string | null;
  invitationId?: Types.ObjectId | string | null;
  batchId?: string;
}

/**
 * Sends one email and records the outcome in emailLogs (DB Design §6.21). Never throws for a
 * delivery failure: the caller's own write (invitation, reset token) stays valid and the failure
 * is visible in the log for retry (Architecture §49). Only the status is logged — never the body.
 */
export interface SendResult {
  status: "sent" | "failed";
  /** Why it failed (sanitized: provider code and message, never a secret). */
  error?: { code: string; message: string };
}

export async function sendEmail(input: SendEmailInput): Promise<SendResult> {
  const provider = getEmailProvider();
  const base = {
    weddingId: input.weddingId ?? null,
    type: input.type,
    invitationId: input.invitationId ?? null,
    recipientEmail: input.to,
    provider: provider.name,
    batchId: input.batchId ?? randomUUID(),
  };

  try {
    const { providerMessageId } = await provider.send(input);
    await insertEmailLog({ ...base, status: "sent", providerMessageId, sentAt: new Date() });
    return { status: "sent" };
  } catch (error) {
    const failure =
      error instanceof EmailProviderError
        ? { code: error.code, message: error.message }
        : { code: "unexpected_error", message: "Email could not be sent" };
    const log = await insertEmailLog({ ...base, status: "failed", error: failure });
    logger.warn("email.send_failed", {
      emailLogId: log._id.toString(),
      type: input.type,
      provider: provider.name,
      errorCode: failure.code,
    });
    return { status: "failed", error: failure };
  }
}
