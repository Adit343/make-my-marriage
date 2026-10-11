import "server-only";
import { Types } from "mongoose";
import { aggregateScoped } from "@/infrastructure/database/aggregate";
import { connectDb } from "@/infrastructure/database/connection";
import type { EmailStatus, EmailType } from "@/lib/constants/enums";
import { EmailLog } from "@/models/emailLog.model";

type Id = Types.ObjectId | string;

/** The two kinds of email sent to guests; member invitations and password resets are not listed with them. */
export const GUEST_EMAIL_TYPES: EmailType[] = ["guest_invitation", "rsvp_reminder"];

export async function insertEmailLog(input: {
  weddingId?: Types.ObjectId | string | null;
  type: EmailType;
  invitationId?: Types.ObjectId | string | null;
  guestId?: Types.ObjectId | string | null;
  recipientEmail: string;
  status: EmailStatus;
  provider: string;
  providerMessageId?: string | null;
  sentAt?: Date | null;
  error?: { code: string; message: string } | null;
  batchId: string;
  idempotencyKey?: string | null;
  attempts?: number;
}) {
  await connectDb();
  const log = await EmailLog.create(input);
  return log.toObject();
}

/** Duplicate-send protection (DB Design §6.21): a send is identified by its idempotency key. */
export async function findEmailLogByKey(idempotencyKey: string) {
  await connectDb();
  return EmailLog.findOne({ idempotencyKey }).lean();
}

/** A retry updates the failed row in place (the key is unique), counting the extra attempt. */
export async function updateEmailLogResult(
  logId: Id,
  result: {
    status: EmailStatus;
    provider: string;
    providerMessageId?: string | null;
    sentAt?: Date | null;
    error?: { code: string; message: string } | null;
  },
) {
  await connectDb();
  return EmailLog.findOneAndUpdate(
    { _id: logId },
    {
      $set: {
        status: result.status,
        provider: result.provider,
        providerMessageId: result.providerMessageId ?? null,
        sentAt: result.sentAt ?? null,
        error: result.error ?? null,
      },
      $inc: { attempts: 1 },
    },
    { returnDocument: "after" },
  ).lean();
}

export async function findGuestEmailLog(weddingId: Id, logId: Id) {
  await connectDb();
  return EmailLog.findOne({ _id: logId, weddingId, type: { $in: GUEST_EMAIL_TYPES } }).lean();
}

export interface EmailLogFilters {
  status?: EmailStatus;
  type?: EmailType;
  batchId?: string;
}

export interface EmailLogCursor {
  at: string;
  id: string;
}

/** Newest first, `limit + 1` rows so the caller can tell whether there is another page. */
export async function listGuestEmailLogsPage(
  weddingId: Id,
  filters: EmailLogFilters,
  page: { limit: number; after?: EmailLogCursor },
) {
  await connectDb();
  const filter: Record<string, unknown> = {
    weddingId,
    type: filters.type ? filters.type : { $in: GUEST_EMAIL_TYPES },
  };
  if (filters.status) filter.status = filters.status;
  if (filters.batchId) filter.batchId = filters.batchId;
  const query = page.after
    ? {
        $and: [
          filter,
          {
            $or: [
              { createdAt: { $lt: new Date(page.after.at) } },
              {
                createdAt: new Date(page.after.at),
                _id: { $lt: new Types.ObjectId(page.after.id) },
              },
            ],
          },
        ],
      }
    : filter;
  return EmailLog.find(query)
    .sort({ createdAt: -1, _id: -1 })
    .limit(page.limit + 1)
    .lean();
}

export interface LatestFailure {
  guestId: string;
  logId: string;
  type: EmailType;
  recipientEmail: string;
  error: { code?: string | null; message?: string | null } | null;
  failedAt: Date;
}

/**
 * Guests whose most recent guest email failed: "needs attention". One aggregation over
 * {weddingId, createdAt}, newest log per guest first.
 */
export async function listLatestFailures(weddingId: Id): Promise<LatestFailure[]> {
  const rows = await aggregateScoped<{
    _id: Types.ObjectId;
    last: {
      _id: Types.ObjectId;
      type: EmailType;
      status: EmailStatus;
      recipientEmail: string;
      error?: { code?: string | null; message?: string | null } | null;
      createdAt: Date;
    };
  }>(EmailLog, weddingId, [
    { $match: { type: { $in: GUEST_EMAIL_TYPES }, guestId: { $ne: null } } },
    { $sort: { createdAt: -1, _id: -1 } },
    { $group: { _id: "$guestId", last: { $first: "$$ROOT" } } },
    { $match: { "last.status": "failed" } },
    { $sort: { "last.createdAt": -1 } },
    { $limit: 200 },
  ]);
  return rows.map((row) => ({
    guestId: row._id.toString(),
    logId: row.last._id.toString(),
    type: row.last.type,
    recipientEmail: row.last.recipientEmail,
    error: row.last.error ?? null,
    failedAt: row.last.createdAt,
  }));
}

export interface BatchSummary {
  batchId: string;
  at: Date;
  type: EmailType;
  total: number;
  sent: number;
  failed: number;
}

/** The most recent send batches, summarised from their per-recipient rows. */
export async function listRecentBatches(weddingId: Id, limit: number): Promise<BatchSummary[]> {
  const rows = await aggregateScoped<{
    _id: string;
    at: Date;
    type: EmailType;
    total: number;
    sent: number;
    failed: number;
  }>(EmailLog, weddingId, [
    { $match: { type: { $in: GUEST_EMAIL_TYPES } } },
    {
      $group: {
        _id: "$batchId",
        at: { $max: "$createdAt" },
        type: { $first: "$type" },
        total: { $sum: 1 },
        sent: { $sum: { $cond: [{ $eq: ["$status", "sent"] }, 1, 0] } },
        failed: { $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] } },
      },
    },
    { $sort: { at: -1 } },
    { $limit: limit },
  ]);
  return rows.map((row) => ({
    batchId: row._id,
    at: row.at,
    type: row.type,
    total: row.total,
    sent: row.sent,
    failed: row.failed,
  }));
}
