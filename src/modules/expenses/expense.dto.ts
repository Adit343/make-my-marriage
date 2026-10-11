import type { Types } from "mongoose";
import type { ExpenseCategory, PaymentMethod, PaymentStatus } from "@/lib/constants/enums";
import { costOf, remainingOf } from "@/lib/finance/money";

// Member-facing expense and payment shapes (API Design §9.1, §9.3). Amounts are whole paise; the
// paid and remaining figures are DERIVED from the payments, never stored (DB Design §9.4).
// `canManage` tells the UI whether THIS viewer may edit or delete the expense, so the screen never
// re-implements the permission rule.

export interface ExpenseDto {
  id: string;
  title: string;
  category: ExpenseCategory;
  /** "YYYY-MM-DD" or null. */
  expenseDate: string | null;
  eventId: string | null;
  eventName: string | null;
  vendorId: string | null;
  vendorName: string | null;
  estimatedAmountMinor: number | null;
  agreedAmountMinor: number | null;
  /** The agreed amount, else the estimate, else 0: what the budget counts. */
  costMinor: number;
  paidAmountMinor: number;
  remainingAmountMinor: number;
  notes: string | null;
  createdBy: string;
  createdByName: string | null;
  canManage: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentDto {
  id: string;
  expenseId: string;
  amountMinor: number;
  status: PaymentStatus;
  /** "YYYY-MM-DD" or null. */
  dueDate: string | null;
  paidAt: string | null;
  method: PaymentMethod | null;
  reference: string | null;
  notes: string | null;
  /** Pending and past its due day (in the wedding's timezone). */
  isOverdue: boolean;
  version: number;
  createdAt: string;
}

interface ExpenseLike {
  _id: Types.ObjectId;
  title: string;
  category: ExpenseCategory;
  expenseDate?: string | null;
  eventId?: Types.ObjectId | null;
  vendorId?: Types.ObjectId | null;
  estimatedAmountMinor?: number | null;
  agreedAmountMinor?: number | null;
  notes?: string | null;
  createdBy: Types.ObjectId;
  __v?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export function toExpenseDto(
  expense: ExpenseLike,
  context: {
    paidAmountMinor: number;
    eventName: string | null;
    vendorName: string | null;
    createdByName: string | null;
    canManage: boolean;
  },
): ExpenseDto {
  const cost = costOf(expense);
  return {
    id: expense._id.toString(),
    title: expense.title,
    category: expense.category,
    expenseDate: expense.expenseDate ?? null,
    eventId: expense.eventId ? expense.eventId.toString() : null,
    eventName: context.eventName,
    vendorId: expense.vendorId ? expense.vendorId.toString() : null,
    vendorName: context.vendorName,
    estimatedAmountMinor: expense.estimatedAmountMinor ?? null,
    agreedAmountMinor: expense.agreedAmountMinor ?? null,
    costMinor: cost,
    paidAmountMinor: context.paidAmountMinor,
    remainingAmountMinor: remainingOf(cost, context.paidAmountMinor),
    notes: expense.notes ?? null,
    createdBy: expense.createdBy.toString(),
    createdByName: context.createdByName,
    canManage: context.canManage,
    version: expense.__v ?? 0,
    createdAt: (expense.createdAt ?? new Date(0)).toISOString(),
    updatedAt: (expense.updatedAt ?? new Date(0)).toISOString(),
  };
}

interface PaymentLike {
  _id: Types.ObjectId;
  expenseId: Types.ObjectId;
  amountMinor: number;
  status: PaymentStatus;
  dueDate?: string | null;
  paidAt?: Date | null;
  method?: PaymentMethod | null;
  reference?: string | null;
  notes?: string | null;
  __v?: number;
  createdAt?: Date;
}

export function toPaymentDto(payment: PaymentLike, today: string): PaymentDto {
  const dueDate = payment.dueDate ?? null;
  return {
    id: payment._id.toString(),
    expenseId: payment.expenseId.toString(),
    amountMinor: payment.amountMinor,
    status: payment.status,
    dueDate,
    paidAt: payment.paidAt ? payment.paidAt.toISOString() : null,
    method: payment.method ?? null,
    reference: payment.reference ?? null,
    notes: payment.notes ?? null,
    isOverdue: payment.status === "pending" && dueDate !== null && dueDate < today,
    version: payment.__v ?? 0,
    createdAt: (payment.createdAt ?? new Date(0)).toISOString(),
  };
}

/** One expense with its payments, and the vendor it is paid to (name only unless the viewer manages vendors). */
export interface ExpenseDetailDto {
  expense: ExpenseDto;
  payments: PaymentDto[];
  /** True when paid plus still-to-pay payments are more than the expense's cost (a warning, not an error). */
  exceedsAgreedAmount: boolean;
  scheduledAmountMinor: number;
  /** Only owners and admins see vendor contact details. */
  vendor: {
    id: string;
    name: string;
    status: string;
    phone: string | null;
  } | null;
}

export interface CategorySpendDto {
  category: ExpenseCategory;
  count: number;
  costMinor: number;
  paidMinor: number;
}

export interface EventSpendDto {
  /** null = expenses not linked to an event. */
  eventId: string | null;
  name: string;
  costMinor: number;
  /** Share of the total cost, tenths of a percent resolution (one decimal). */
  sharePercent: number;
}

export interface DuePaymentDto {
  id: string;
  expenseId: string;
  expenseTitle: string;
  vendorName: string | null;
  amountMinor: number;
  dueDate: string;
  isOverdue: boolean;
}

/** The Expenses overview: where the budget stands (API Design §9.1, Stitch "Expenses & Budget Overview"). */
export interface ExpenseSummaryDto {
  currency: string;
  /** Only owners and admins see the wedding's overall budget; null for everyone else. */
  budgetTotalMinor: number | null;
  /** Share of the budget the costs commit, 0 to 100+; null without a budget or for members. */
  committedPercent: number | null;
  expenseCount: number;
  totalCostMinor: number;
  totalPaidMinor: number;
  /** What is still to pay across every expense (an overpaid expense counts as 0, not negative). */
  stillToPayMinor: number;
  byCategory: CategorySpendDto[];
  byEvent: EventSpendDto[];
  /** Pending payments due within the window, overdue ones first. */
  dueSoon: { count: number; totalMinor: number; windowDays: number; items: DuePaymentDto[] };
  overdue: { count: number; totalMinor: number };
}
