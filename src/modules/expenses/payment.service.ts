import "server-only";
import { todayIn } from "@/lib/dates";
import { AppError } from "@/lib/errors";
import { costOf } from "@/lib/finance/money";
import { toPaymentDto, type PaymentDto } from "@/modules/expenses/expense.dto";
import { findExpense } from "@/modules/expenses/expense.repository";
import type { CreatePaymentInput, UpdatePaymentInput } from "@/modules/expenses/expense.schemas";
import {
  findPayment,
  insertPayment,
  listPaymentsForExpense,
  scheduledTotalsByExpense,
  softDeletePayment,
  updatePayment as updatePaymentRow,
  type PaymentChanges,
} from "@/modules/expenses/payment.repository";
import type { WeddingAuth } from "@/modules/members/guards";
import { findWedding } from "@/modules/weddings/wedding.repository";

// Payments recorded against an expense (API Design §9.3). Owners and admins record them (permission
// payments:record); every member can read them. The app NEVER moves money: this only writes down
// what someone has paid or still owes. Paying more than the agreed amount is allowed (real weddings
// have unplanned extras) and answered with a warning instead of an error (DB Design §6.12).

export interface PaymentResult {
  payment: PaymentDto;
  /** Paid plus still-to-pay (not cancelled) payments are now more than the expense's cost. */
  exceedsAgreedAmount: boolean;
  scheduledAmountMinor: number;
}

async function today(auth: WeddingAuth): Promise<string> {
  const wedding = await findWedding(auth.weddingId);
  return todayIn(wedding?.timezone ?? "Asia/Kolkata");
}

async function resultFor(
  auth: WeddingAuth,
  row: NonNullable<Awaited<ReturnType<typeof findPayment>>>,
): Promise<PaymentResult> {
  const [expense, scheduled, todayIso] = await Promise.all([
    findExpense(auth.weddingId, row.expenseId),
    scheduledTotalsByExpense(auth.weddingId, [row.expenseId]),
    today(auth),
  ]);
  const scheduledAmountMinor = scheduled.get(row.expenseId.toString()) ?? 0;
  const cost = expense ? costOf(expense) : 0;
  return {
    payment: toPaymentDto(row, todayIso),
    exceedsAgreedAmount: cost > 0 && scheduledAmountMinor > cost,
    scheduledAmountMinor,
  };
}

/** An expense's payments (every member can read them; only owners and admins record them). */
export async function listPayments(auth: WeddingAuth, expenseId: string): Promise<PaymentDto[]> {
  const expense = await findExpense(auth.weddingId, expenseId);
  if (!expense) throw new AppError("NOT_FOUND");
  const [rows, todayIso] = await Promise.all([
    listPaymentsForExpense(auth.weddingId, expense._id),
    today(auth),
  ]);
  return rows.map((row) => toPaymentDto(row, todayIso));
}

export async function createPayment(
  auth: WeddingAuth,
  expenseId: string,
  input: CreatePaymentInput,
): Promise<PaymentResult> {
  // A cross-wedding or deleted expense looks exactly like a missing one.
  const expense = await findExpense(auth.weddingId, expenseId);
  if (!expense) throw new AppError("NOT_FOUND");

  const status = input.status ?? "pending";
  const row = await insertPayment(auth.weddingId, {
    expenseId: expense._id,
    amountMinor: input.amountMinor,
    status,
    dueDate: input.dueDate ?? null,
    // A paid payment records when; the client may say, otherwise it is now.
    paidAt: status === "paid" ? (input.paidAt ? new Date(input.paidAt) : new Date()) : null,
    method: input.method ?? null,
    reference: input.reference,
    notes: input.notes,
    createdBy: auth.userId,
  });
  return resultFor(auth, row);
}

export async function updatePayment(
  auth: WeddingAuth,
  paymentId: string,
  input: UpdatePaymentInput,
): Promise<PaymentResult> {
  const existing = await findPayment(auth.weddingId, paymentId);
  if (!existing) throw new AppError("NOT_FOUND");

  const { version, paidAt, ...rest } = input;
  const status = rest.status ?? existing.status;
  if (status !== "paid" && paidAt) {
    throw new AppError("BUSINESS_RULE_VIOLATION", {
      message: "Only a paid payment has a paid date.",
    });
  }

  const changes: PaymentChanges = { ...rest };
  if (status === "paid") {
    // Becoming paid records when (now, unless the client says); staying paid keeps the date
    // unless a new one is given.
    if (paidAt) changes.paidAt = new Date(paidAt);
    else if (!existing.paidAt) changes.paidAt = new Date();
  } else {
    changes.paidAt = null;
  }

  const result = await updatePaymentRow(auth.weddingId, paymentId, version, changes);
  if (result === "conflict") throw new AppError("VERSION_CONFLICT");
  if (result === "not_found") throw new AppError("NOT_FOUND");
  return resultFor(auth, result);
}

export async function deletePayment(auth: WeddingAuth, paymentId: string) {
  const at = new Date();
  if (!(await softDeletePayment(auth.weddingId, paymentId, { by: auth.userId, at }))) {
    throw new AppError("NOT_FOUND");
  }
  return { id: paymentId, deletedAt: at.toISOString() };
}
