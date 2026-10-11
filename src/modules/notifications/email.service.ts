import "server-only";
import { randomUUID } from "node:crypto";
import type { Types } from "mongoose";
import { EmailProviderError, getEmailProvider, type EmailMessage } from "@/infrastructure/email";
import type { EmailType } from "@/lib/constants/enums";
import { isDuplicateKeyError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import {
  findEmailLogByKey,
  insertEmailLog,
  updateEmailLogResult,
} from "@/modules/notifications/email-log.repository";

export interface SendEmailInput extends EmailMessage {
  type: EmailType;
  weddingId?: Types.ObjectId | string | null;
  invitationId?: Types.ObjectId | string | null;
  guestId?: Types.ObjectId | string | null;
  batchId?: string;
  /**
   * Makes a send safe to repeat (DB Design §6.21): if a send with this key already succeeded, the
   * email is NOT sent again; if it failed, it is sent again and the same log row is updated.
   */
  idempotencyKey?: string | null;
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
  /** True when an earlier send with the same idempotency key had already succeeded. */
  duplicate?: boolean;
}

export async function sendEmail(input: SendEmailInput): Promise<SendResult> {
  const provider = getEmailProvider();
  const key = input.idempotencyKey ?? null;

  const earlier = key ? await findEmailLogByKey(key) : null;
  if (earlier?.status === "sent") return { status: "sent", duplicate: true };

  const base = {
    weddingId: input.weddingId ?? null,
    type: input.type,
    invitationId: input.invitationId ?? null,
    guestId: input.guestId ?? null,
    recipientEmail: input.to,
    provider: provider.name,
    batchId: input.batchId ?? randomUUID(),
    idempotencyKey: key,
  };

  const record = async (
    outcome:
      | { status: "sent"; providerMessageId: string | null }
      | { status: "failed"; error: { code: string; message: string } },
  ) => {
    const row =
      outcome.status === "sent"
        ? {
            status: "sent" as const,
            providerMessageId: outcome.providerMessageId,
            sentAt: new Date(),
          }
        : { status: "failed" as const, error: outcome.error };
    if (earlier) {
      // A retry of a failed send: same row, one more attempt.
      return updateEmailLogResult(earlier._id, { ...row, provider: provider.name });
    }
    try {
      return await insertEmailLog({ ...base, ...row });
    } catch (error) {
      // Two identical sends raced; the other one already wrote the row.
      if (key && isDuplicateKeyError(error, "idempotencyKey")) return findEmailLogByKey(key);
      throw error;
    }
  };

  try {
    const { providerMessageId } = await provider.send(input);
    await record({ status: "sent", providerMessageId });
    return { status: "sent" };
  } catch (error) {
    const failure =
      error instanceof EmailProviderError
        ? { code: error.code, message: error.message }
        : { code: "unexpected_error", message: "Email could not be sent" };
    const log = await record({ status: "failed", error: failure });
    logger.warn("email.send_failed", {
      emailLogId: log?._id.toString(),
      type: input.type,
      provider: provider.name,
      errorCode: failure.code,
    });
    return { status: "failed", error: failure };
  }
}
