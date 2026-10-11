import "server-only";
import { Error as MongooseError, Types, type ClientSession } from "mongoose";
import { aggregateScoped } from "@/infrastructure/database/aggregate";
import { connectDb } from "@/infrastructure/database/connection";
import type { PaymentMethod, PaymentStatus } from "@/lib/constants/enums";
import { VendorPayment } from "@/models/vendorPayment.model";

type Id = Types.ObjectId | string;

// Payments recorded against expenses (DB Design §6.14). Every function takes weddingId first.

export interface NewPayment {
  expenseId: Id;
  amountMinor: number;
  status: PaymentStatus;
  dueDate?: string | null;
  paidAt?: Date | null;
  method?: PaymentMethod | null;
  reference?: string;
  notes?: string;
  createdBy: Id;
}

export interface PaymentChanges {
  amountMinor?: number;
  status?: PaymentStatus;
  dueDate?: string | null;
  paidAt?: Date | null;
  method?: PaymentMethod | null;
  reference?: string | null;
  notes?: string | null;
}

export async function insertPayment(weddingId: Id, input: NewPayment) {
  await connectDb();
  const payment = await VendorPayment.create({ ...input, weddingId });
  return payment.toObject();
}

export async function findPayment(weddingId: Id, paymentId: Id) {
  await connectDb();
  return VendorPayment.findOne({ _id: paymentId, weddingId }).lean();
}

/** One expense's payments: the ones with a due date by date, then the paid ones by when they were paid. */
export async function listPaymentsForExpense(weddingId: Id, expenseId: Id) {
  await connectDb();
  return VendorPayment.find({ weddingId, expenseId }).sort({ _id: 1 }).lean();
}

/**
 * What has actually been paid, per expense (status paid only), in ONE aggregation for the whole
 * wedding or a page of expenses (DB Design §9.4: totals are derived, never stored).
 */
export async function paidTotalsByExpense(
  weddingId: Id,
  expenseIds?: Id[],
): Promise<Map<string, number>> {
  const rows = await aggregateScoped<{ _id: Types.ObjectId; total: number }>(
    VendorPayment,
    weddingId,
    [
      {
        $match: {
          status: "paid",
          ...(expenseIds
            ? { expenseId: { $in: expenseIds.map((id) => new Types.ObjectId(id)) } }
            : {}),
        },
      },
      { $group: { _id: "$expenseId", total: { $sum: "$amountMinor" } } },
    ],
  );
  return new Map(rows.map((row) => [row._id.toString(), row.total]));
}

/** Paid plus still-to-pay (not cancelled) per expense: what the team has committed to paying. */
export async function scheduledTotalsByExpense(
  weddingId: Id,
  expenseIds: Id[],
): Promise<Map<string, number>> {
  const rows = await aggregateScoped<{ _id: Types.ObjectId; total: number }>(
    VendorPayment,
    weddingId,
    [
      {
        $match: {
          status: { $in: ["paid", "pending"] },
          expenseId: { $in: expenseIds.map((id) => new Types.ObjectId(id)) },
        },
      },
      { $group: { _id: "$expenseId", total: { $sum: "$amountMinor" } } },
    ],
  );
  return new Map(rows.map((row) => [row._id.toString(), row.total]));
}

/** Payments still to be made with a due date up to (and including) `until`, soonest first. */
export async function listPendingPaymentsDueBy(weddingId: Id, until: string, limit = 500) {
  await connectDb();
  return VendorPayment.find({
    weddingId,
    status: "pending",
    dueDate: { $type: "string", $lte: until },
  })
    .sort({ dueDate: 1, _id: 1 })
    .limit(limit)
    .lean();
}

/** Optimistic concurrency: the write only lands if the payment is still at `version`. */
export async function updatePayment(
  weddingId: Id,
  paymentId: Id,
  version: number,
  changes: PaymentChanges,
): Promise<"conflict" | "not_found" | NonNullable<Awaited<ReturnType<typeof findPayment>>>> {
  await connectDb();
  const payment = await VendorPayment.findOne({ _id: paymentId, weddingId });
  if (!payment) return "not_found";
  if (payment.__v !== version) return "conflict";

  payment.set(changes);
  try {
    await payment.save();
  } catch (error) {
    if (error instanceof MongooseError.VersionError) return "conflict";
    throw error;
  }
  return payment.toObject();
}

/** False if the payment does not exist in this wedding or is already deleted. */
export async function softDeletePayment(
  weddingId: Id,
  paymentId: Id,
  deletion: { by: Id; at: Date },
): Promise<boolean> {
  await connectDb();
  const result = await VendorPayment.updateOne(
    { _id: paymentId, weddingId },
    { $set: { deletedAt: deletion.at, deletedBy: deletion.by } },
  );
  return result.modifiedCount === 1;
}

/** An expense's payments go with it (same transaction). Returns how many were removed. */
export async function softDeletePaymentsForExpense(
  weddingId: Id,
  expenseId: Id,
  deletion: { by: Id; at: Date },
  session: ClientSession,
): Promise<number> {
  await connectDb();
  const result = await VendorPayment.updateMany(
    { weddingId, expenseId },
    { $set: { deletedAt: deletion.at, deletedBy: deletion.by } },
    { session },
  );
  return result.modifiedCount;
}

/** The payments of several expenses at once (a vendor's payment milestones), without N queries. */
export async function listPaymentsForExpenses(weddingId: Id, expenseIds: Id[]) {
  if (expenseIds.length === 0) return [];
  await connectDb();
  return VendorPayment.find({ weddingId, expenseId: { $in: expenseIds } })
    .sort({ _id: 1 })
    .lean();
}
