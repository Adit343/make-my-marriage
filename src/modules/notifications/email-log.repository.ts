import "server-only";
import type { Types } from "mongoose";
import { connectDb } from "@/infrastructure/database/connection";
import type { EmailStatus, EmailType } from "@/lib/constants/enums";
import { EmailLog } from "@/models/emailLog.model";

export async function insertEmailLog(input: {
  weddingId?: Types.ObjectId | string | null;
  type: EmailType;
  invitationId?: Types.ObjectId | string | null;
  recipientEmail: string;
  status: EmailStatus;
  provider: string;
  providerMessageId?: string | null;
  sentAt?: Date | null;
  error?: { code: string; message: string } | null;
  batchId: string;
  idempotencyKey?: string | null;
}) {
  await connectDb();
  const log = await EmailLog.create(input);
  return log.toObject();
}
