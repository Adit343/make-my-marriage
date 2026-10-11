import "server-only";
import { Error as MongooseError, Types, type ClientSession } from "mongoose";
import { connectDb } from "@/infrastructure/database/connection";
import type { ExpenseCategory } from "@/lib/constants/enums";
import { EXPENSE_READ_CAP } from "@/lib/constants/finance";
import { Expense } from "@/models/expense.model";

type Id = Types.ObjectId | string;

// Every function takes weddingId (DB Design §9.2): there is no way to read or change an expense
// without naming the wedding it must belong to. Soft-deleted expenses are hidden by the plugin.

export interface NewExpense {
  title: string;
  category: ExpenseCategory;
  expenseDate?: string | null;
  eventId?: Id | null;
  vendorId?: Id | null;
  estimatedAmountMinor?: number | null;
  agreedAmountMinor?: number | null;
  notes?: string;
  createdBy: Id;
}

export interface ExpenseChanges {
  title?: string;
  category?: ExpenseCategory;
  expenseDate?: string | null;
  eventId?: Id | null;
  vendorId?: Id | null;
  estimatedAmountMinor?: number | null;
  agreedAmountMinor?: number | null;
  notes?: string | null;
}

export interface ExpenseFilters {
  category?: ExpenseCategory;
  eventId?: string;
  vendorId?: string;
  /** Inclusive "YYYY-MM-DD" bounds on the expense date. */
  from?: string;
  to?: string;
}

export async function insertExpense(weddingId: Id, input: NewExpense) {
  await connectDb();
  const expense = await Expense.create({ ...input, weddingId });
  return expense.toObject();
}

export async function findExpense(weddingId: Id, expenseId: Id) {
  await connectDb();
  return Expense.findOne({ _id: expenseId, weddingId }).lean();
}

function filterFor(weddingId: Id, filters: ExpenseFilters): Record<string, unknown> {
  const filter: Record<string, unknown> = { weddingId };
  if (filters.category) filter.category = filters.category;
  if (filters.eventId) filter.eventId = filters.eventId;
  if (filters.vendorId) filter.vendorId = filters.vendorId;
  if (filters.from || filters.to) {
    filter.expenseDate = {
      ...(filters.from ? { $gte: filters.from } : {}),
      ...(filters.to ? { $lte: filters.to } : {}),
    };
  }
  return filter;
}

/** Newest first, `limit + 1` rows so the caller can tell whether there is another page. */
export async function listExpensesPage(
  weddingId: Id,
  filters: ExpenseFilters,
  page: { limit: number; afterId?: string },
) {
  await connectDb();
  const filter = filterFor(weddingId, filters);
  if (page.afterId) filter._id = { $lt: new Types.ObjectId(page.afterId) };
  return Expense.find(filter)
    .sort({ _id: -1 })
    .limit(page.limit + 1)
    .lean();
}

/**
 * Every expense of the wedding for the Expenses screen, which filters and totals them itself. A
 * wedding has dozens to a few hundred expenses, so one capped read is simpler than paging; the cap
 * is a safety stop, not a feature (same reasoning as the Tasks screen).
 */
export async function listAllExpenses(weddingId: Id, limit = EXPENSE_READ_CAP) {
  await connectDb();
  return Expense.find({ weddingId }).sort({ _id: -1 }).limit(limit).lean();
}

/** Just the money-related fields of every expense: totals and per-vendor numbers need no more. */
export async function listExpenseCosts(weddingId: Id, limit = EXPENSE_READ_CAP) {
  await connectDb();
  return Expense.find({ weddingId })
    .select("category eventId vendorId estimatedAmountMinor agreedAmountMinor title")
    .limit(limit)
    .lean();
}

export async function countExpenses(weddingId: Id): Promise<number> {
  await connectDb();
  return Expense.countDocuments({ weddingId });
}

/** Optimistic concurrency (decision C5): the write only lands if the expense is still at `version`. */
export async function updateExpense(
  weddingId: Id,
  expenseId: Id,
  version: number,
  changes: ExpenseChanges,
): Promise<"conflict" | "not_found" | NonNullable<Awaited<ReturnType<typeof findExpense>>>> {
  await connectDb();
  const expense = await Expense.findOne({ _id: expenseId, weddingId });
  if (!expense) return "not_found";
  if (expense.__v !== version) return "conflict";

  expense.set(changes);
  try {
    await expense.save();
  } catch (error) {
    if (error instanceof MongooseError.VersionError) return "conflict";
    throw error;
  }
  return expense.toObject();
}

/** False if the expense does not exist in this wedding or is already deleted. */
export async function softDeleteExpense(
  weddingId: Id,
  expenseId: Id,
  deletion: { by: Id; at: Date },
  session?: ClientSession,
): Promise<boolean> {
  await connectDb();
  const result = await Expense.updateOne(
    { _id: expenseId, weddingId },
    { $set: { deletedAt: deletion.at, deletedBy: deletion.by } },
    { session },
  );
  return result.modifiedCount === 1;
}

/**
 * Deleting an event does not delete its expenses: they become wedding-level (DB Design §6.7 rule 1).
 * Returns how many were affected, for the delete response.
 */
export async function unlinkExpensesFromEvent(
  weddingId: Id,
  eventId: Id,
  session: ClientSession,
): Promise<number> {
  await connectDb();
  const result = await Expense.updateMany(
    { weddingId, eventId },
    { $set: { eventId: null } },
    { session },
  );
  return result.modifiedCount;
}

/** Deleting a vendor keeps its expenses (the money was still spent): they just lose the vendor. */
export async function unlinkExpensesFromVendor(
  weddingId: Id,
  vendorId: Id,
  session: ClientSession,
): Promise<number> {
  await connectDb();
  const result = await Expense.updateMany(
    { weddingId, vendorId },
    { $set: { vendorId: null } },
    { session },
  );
  return result.modifiedCount;
}
