import "server-only";
import { z } from "zod";
import { withTransaction } from "@/infrastructure/database/transaction";
import { PAYMENTS_DUE_WINDOW_DAYS } from "@/lib/constants/finance";
import { addDays, todayIn } from "@/lib/dates";
import { AppError } from "@/lib/errors";
import { decodeCursor, paginateByCursor, type CursorMeta } from "@/lib/http/pagination";
import { costOf, remainingOf } from "@/lib/finance/money";
import { objectId } from "@/lib/validation/primitives";
import { findEvent, listEvents } from "@/modules/events/event.repository";
import {
  toExpenseDto,
  toPaymentDto,
  type CategorySpendDto,
  type DuePaymentDto,
  type EventSpendDto,
  type ExpenseDetailDto,
  type ExpenseDto,
  type ExpenseSummaryDto,
} from "@/modules/expenses/expense.dto";
import {
  findExpense,
  insertExpense,
  listAllExpenses,
  listExpenseCosts,
  listExpensesPage,
  softDeleteExpense,
  updateExpense as updateExpenseRow,
  type ExpenseChanges,
} from "@/modules/expenses/expense.repository";
import type {
  CreateExpenseInput,
  ListExpensesQuery,
  UpdateExpenseInput,
} from "@/modules/expenses/expense.schemas";
import {
  listPaymentsForExpense,
  listPendingPaymentsDueBy,
  paidTotalsByExpense,
  scheduledTotalsByExpense,
  softDeletePaymentsForExpense,
} from "@/modules/expenses/payment.repository";
import type { WeddingAuth } from "@/modules/members/guards";
import { can } from "@/modules/members/permissions";
import { findUserSummaries } from "@/modules/users/user.repository";
import { findVendor, listAllVendors } from "@/modules/vendors/vendor.repository";
import { findWedding } from "@/modules/weddings/wedding.repository";

// Expenses (API Design §9.1). Owner decision 2026-10-10: every member sees ALL expenses in one place
// and can record one; a member edits or deletes only the expenses they recorded, an admin or owner
// any. Routes check membership and expenses:edit; WHICH expense is being touched is only known
// here, so the own-or-any rule lives in this file. What has been paid is never stored: it is summed
// from the expense's payments (DB Design §9.4).

type ExpenseRow = NonNullable<Awaited<ReturnType<typeof findExpense>>>;

const cursorPosition = z.object({ id: objectId });

function canManage(auth: WeddingAuth, expense: { createdBy: { toString(): string } }): boolean {
  return (
    expense.createdBy.toString() === auth.userId || can(auth.membership.role, "expenses:manage-any")
  );
}

/** A cross-wedding id looks exactly like a missing one (DB Design §9.2 rule 1). */
async function assertEventInWedding(auth: WeddingAuth, eventId: string) {
  if (!(await findEvent(auth.weddingId, eventId))) {
    throw new AppError("NOT_FOUND", { message: "That event isn't part of this wedding." });
  }
}

async function assertVendorInWedding(auth: WeddingAuth, vendorId: string) {
  if (!(await findVendor(auth.weddingId, vendorId))) {
    throw new AppError("NOT_FOUND", { message: "That vendor isn't part of this wedding." });
  }
}

/**
 * Turns rows into DTOs with ONE query each for the paid totals, the event and vendor names and the
 * people who recorded them (no N+1; Architecture §46). `paidFor` is passed in when the caller
 * already has the totals.
 */
export async function toExpenseDtos(
  auth: WeddingAuth,
  rows: ExpenseRow[],
  options: { paidFor?: Map<string, number> } = {},
): Promise<ExpenseDto[]> {
  if (rows.length === 0) return [];
  const [paid, events, vendors, users] = await Promise.all([
    options.paidFor ??
      paidTotalsByExpense(
        auth.weddingId,
        rows.map((row) => row._id),
      ),
    listEvents(auth.weddingId),
    listAllVendors(auth.weddingId),
    findUserSummaries(rows.map((row) => row.createdBy)),
  ]);
  const eventName = new Map(events.map((event) => [event._id.toString(), event.name]));
  const vendorName = new Map(vendors.map((vendor) => [vendor._id.toString(), vendor.name]));
  const userName = new Map(users.map((user) => [user._id.toString(), user.name]));
  return rows.map((row) =>
    toExpenseDto(row, {
      paidAmountMinor: paid.get(row._id.toString()) ?? 0,
      eventName: row.eventId ? (eventName.get(row.eventId.toString()) ?? null) : null,
      vendorName: row.vendorId ? (vendorName.get(row.vendorId.toString()) ?? null) : null,
      createdByName: userName.get(row.createdBy.toString()) ?? null,
      canManage: canManage(auth, row),
    }),
  );
}

export async function listExpenses(
  auth: WeddingAuth,
  query: ListExpensesQuery,
): Promise<{ items: ExpenseDto[]; meta: CursorMeta }> {
  const { limit, cursor, ...filters } = query;
  const afterId = cursor ? decodeCursor(cursor, cursorPosition).id : undefined;
  const rows = await listExpensesPage(auth.weddingId, filters, { limit, afterId });
  const page = paginateByCursor(rows, limit, (row) => ({ id: row._id.toString() }));
  return { items: await toExpenseDtos(auth, page.items), meta: page.meta };
}

/** Every expense, for the Expenses screen, which filters and totals them itself. */
export async function listEveryExpense(auth: WeddingAuth): Promise<ExpenseDto[]> {
  const [rows, paid] = await Promise.all([
    listAllExpenses(auth.weddingId),
    paidTotalsByExpense(auth.weddingId),
  ]);
  return toExpenseDtos(auth, rows, { paidFor: paid });
}

/** The vendors a form may pick: names only, so every role can record an expense against one. */
export async function listVendorChoices(
  auth: WeddingAuth,
): Promise<{ id: string; name: string }[]> {
  const vendors = await listAllVendors(auth.weddingId);
  return vendors.map((vendor) => ({ id: vendor._id.toString(), name: vendor.name }));
}

export async function getExpenseDetail(
  auth: WeddingAuth,
  expenseId: string,
): Promise<ExpenseDetailDto> {
  const row = await findExpense(auth.weddingId, expenseId);
  if (!row) throw new AppError("NOT_FOUND");

  const [[expense], payments, scheduled, wedding, vendor] = await Promise.all([
    toExpenseDtos(auth, [row]),
    listPaymentsForExpense(auth.weddingId, row._id),
    scheduledTotalsByExpense(auth.weddingId, [row._id]),
    findWedding(auth.weddingId),
    row.vendorId ? findVendor(auth.weddingId, row.vendorId) : Promise.resolve(null),
  ]);
  const today = todayIn(wedding?.timezone ?? "Asia/Kolkata");
  const scheduledAmountMinor = scheduled.get(row._id.toString()) ?? 0;
  const cost = costOf(row);
  const canSeeVendor = can(auth.membership.role, "vendors:manage");

  return {
    expense: expense!,
    payments: payments.map((payment) => toPaymentDto(payment, today)),
    exceedsAgreedAmount: cost > 0 && scheduledAmountMinor > cost,
    scheduledAmountMinor,
    vendor: vendor
      ? {
          id: vendor._id.toString(),
          name: vendor.name,
          status: vendor.status,
          // Contact details are for owners and admins; a member sees only the name.
          phone: canSeeVendor ? (vendor.contact?.phone ?? null) : null,
        }
      : null,
  };
}

export async function createExpense(
  auth: WeddingAuth,
  input: CreateExpenseInput,
): Promise<ExpenseDto> {
  if (input.eventId) await assertEventInWedding(auth, input.eventId);
  if (input.vendorId) await assertVendorInWedding(auth, input.vendorId);

  const row = await insertExpense(auth.weddingId, { ...input, createdBy: auth.userId });
  const [dto] = await toExpenseDtos(auth, [row], { paidFor: new Map() });
  return dto!;
}

export async function updateExpense(
  auth: WeddingAuth,
  expenseId: string,
  input: UpdateExpenseInput,
): Promise<ExpenseDto> {
  const existing = await findExpense(auth.weddingId, expenseId);
  if (!existing) throw new AppError("NOT_FOUND");
  if (!canManage(auth, existing)) throw new AppError("INSUFFICIENT_ROLE");

  const { version, ...changes } = input as UpdateExpenseInput & ExpenseChanges;
  if (changes.eventId) await assertEventInWedding(auth, changes.eventId);
  if (changes.vendorId) await assertVendorInWedding(auth, changes.vendorId);

  const result = await updateExpenseRow(auth.weddingId, expenseId, version, changes);
  if (result === "conflict") throw new AppError("VERSION_CONFLICT");
  if (result === "not_found") throw new AppError("NOT_FOUND");
  const [dto] = await toExpenseDtos(auth, [result]);
  return dto!;
}

/**
 * Soft delete (DB Design §6.12). The expense's payments go with it in the same transaction, and
 * the response says how many, so the screen can say "3 payment records were also removed".
 */
export async function deleteExpense(auth: WeddingAuth, expenseId: string) {
  const existing = await findExpense(auth.weddingId, expenseId);
  if (!existing) throw new AppError("NOT_FOUND");
  if (!canManage(auth, existing)) throw new AppError("INSUFFICIENT_ROLE");

  const at = new Date();
  const paymentsRemoved = await withTransaction(async (session) => {
    if (!(await softDeleteExpense(auth.weddingId, expenseId, { by: auth.userId, at }, session))) {
      throw new AppError("NOT_FOUND");
    }
    return softDeletePaymentsForExpense(
      auth.weddingId,
      expenseId,
      { by: auth.userId, at },
      session,
    );
  });
  return { id: expenseId, deletedAt: at.toISOString(), paymentsRemoved };
}

const round1 = (value: number) => Math.round(value * 10) / 10;

/**
 * The budget overview (Stitch "Expenses & Budget Overview"): totals, spend by category and by event,
 * and the payments coming due. Everything is derived from the expenses and payments (DB Design
 * §9.4). The wedding's overall budget is shown to owners and admins only.
 */
export async function getExpenseSummary(auth: WeddingAuth): Promise<ExpenseSummaryDto> {
  const wedding = await findWedding(auth.weddingId);
  const timezone = wedding?.timezone ?? "Asia/Kolkata";
  const today = todayIn(timezone);
  const until = addDays(today, PAYMENTS_DUE_WINDOW_DAYS);

  const [expenses, paid, events, duePayments] = await Promise.all([
    listExpenseCosts(auth.weddingId),
    paidTotalsByExpense(auth.weddingId),
    listEvents(auth.weddingId),
    listPendingPaymentsDueBy(auth.weddingId, until),
  ]);

  let totalCost = 0;
  let totalPaid = 0;
  let stillToPay = 0;
  const byCategory = new Map<string, CategorySpendDto>();
  const costByEvent = new Map<string | null, number>();
  const expenseById = new Map(expenses.map((expense) => [expense._id.toString(), expense]));

  for (const expense of expenses) {
    const cost = costOf(expense);
    const paidAmount = paid.get(expense._id.toString()) ?? 0;
    totalCost += cost;
    totalPaid += paidAmount;
    stillToPay += remainingOf(cost, paidAmount);

    const category = byCategory.get(expense.category) ?? {
      category: expense.category,
      count: 0,
      costMinor: 0,
      paidMinor: 0,
    };
    category.count += 1;
    category.costMinor += cost;
    category.paidMinor += paidAmount;
    byCategory.set(expense.category, category);

    const eventKey = expense.eventId ? expense.eventId.toString() : null;
    costByEvent.set(eventKey, (costByEvent.get(eventKey) ?? 0) + cost);
  }

  // Events in timeline order, then the expenses not tied to one.
  const byEvent: EventSpendDto[] = [];
  const share = (cost: number) => (totalCost > 0 ? round1((cost / totalCost) * 100) : 0);
  for (const event of events) {
    const cost = costByEvent.get(event._id.toString());
    if (cost === undefined) continue;
    byEvent.push({
      eventId: event._id.toString(),
      name: event.name,
      costMinor: cost,
      sharePercent: share(cost),
    });
  }
  const unlinked = costByEvent.get(null);
  if (unlinked !== undefined) {
    byEvent.push({
      eventId: null,
      name: "Unlinked items",
      costMinor: unlinked,
      sharePercent: share(unlinked),
    });
  }

  // Payments for expenses that no longer exist were soft-deleted with them; skip any stragglers.
  const vendors = await listAllVendors(auth.weddingId);
  const vendorName = new Map(vendors.map((vendor) => [vendor._id.toString(), vendor.name]));
  const items: DuePaymentDto[] = [];
  let overdueCount = 0;
  let overdueTotal = 0;
  let dueTotal = 0;
  for (const payment of duePayments) {
    const expense = expenseById.get(payment.expenseId.toString());
    if (!expense || !payment.dueDate) continue;
    const isOverdue = payment.dueDate < today;
    dueTotal += payment.amountMinor;
    if (isOverdue) {
      overdueCount += 1;
      overdueTotal += payment.amountMinor;
    }
    items.push({
      id: payment._id.toString(),
      expenseId: payment.expenseId.toString(),
      expenseTitle: expense.title,
      vendorName: expense.vendorId ? (vendorName.get(expense.vendorId.toString()) ?? null) : null,
      amountMinor: payment.amountMinor,
      dueDate: payment.dueDate,
      isOverdue,
    });
  }

  const canSeeBudget = can(auth.membership.role, "wedding:update");
  const budget = canSeeBudget ? (wedding?.budgetTotalMinor ?? null) : null;

  return {
    currency: wedding?.currency ?? "INR",
    budgetTotalMinor: budget,
    committedPercent: budget && budget > 0 ? round1((totalCost / budget) * 100) : null,
    expenseCount: expenses.length,
    totalCostMinor: totalCost,
    totalPaidMinor: totalPaid,
    stillToPayMinor: stillToPay,
    byCategory: [...byCategory.values()].sort((a, b) => b.costMinor - a.costMinor),
    byEvent,
    dueSoon: {
      count: items.length,
      totalMinor: dueTotal,
      windowDays: PAYMENTS_DUE_WINDOW_DAYS,
      items,
    },
    overdue: { count: overdueCount, totalMinor: overdueTotal },
  };
}
