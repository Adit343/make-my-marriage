import type { ExpenseCategory } from "@/lib/constants/enums";

// The All expenses tab filters and totals the wedding's expenses in the browser (the screen reads
// them in one capped server call, like the Tasks screen). Pure functions, so they are unit-tested.

export interface LedgerRow {
  id: string;
  category: ExpenseCategory;
  /** "YYYY-MM-DD" or null. */
  expenseDate: string | null;
  eventId: string | null;
  vendorId: string | null;
  estimatedAmountMinor: number | null;
  agreedAmountMinor: number | null;
  costMinor: number;
  paidAmountMinor: number;
  remainingAmountMinor: number;
}

export interface LedgerFilters {
  category: ExpenseCategory | "all";
  /** An event id, "none" for expenses with no event, or "all". */
  event: string;
  /** A vendor id, "none" for expenses with no vendor, or "all". */
  vendor: string;
  /** Inclusive "YYYY-MM-DD" bounds; "" means open. */
  from: string;
  to: string;
}

export const NO_LEDGER_FILTERS: LedgerFilters = {
  category: "all",
  event: "all",
  vendor: "all",
  from: "",
  to: "",
};

export function hasLedgerFilters(filters: LedgerFilters): boolean {
  return (
    filters.category !== "all" ||
    filters.event !== "all" ||
    filters.vendor !== "all" ||
    filters.from !== "" ||
    filters.to !== ""
  );
}

/**
 * Rows matching every filter. With a date range, an expense that has no date is left out: it can't
 * be said to fall inside the range.
 */
export function applyLedgerFilters<T extends LedgerRow>(rows: T[], filters: LedgerFilters): T[] {
  return rows.filter((row) => {
    if (filters.category !== "all" && row.category !== filters.category) return false;
    if (
      filters.event === "none"
        ? row.eventId !== null
        : filters.event !== "all" && row.eventId !== filters.event
    ) {
      return false;
    }
    if (
      filters.vendor === "none"
        ? row.vendorId !== null
        : filters.vendor !== "all" && row.vendorId !== filters.vendor
    ) {
      return false;
    }
    if (filters.from || filters.to) {
      if (!row.expenseDate) return false;
      if (filters.from && row.expenseDate < filters.from) return false;
      if (filters.to && row.expenseDate > filters.to) return false;
    }
    return true;
  });
}

export interface LedgerTotals {
  estimatedMinor: number;
  agreedMinor: number;
  paidMinor: number;
  remainingMinor: number;
}

/**
 * The "Cumulative Ledger Balance" under the table: estimates, agreed amounts, what is paid and what
 * remains, over the rows given. An expense with no agreed amount adds nothing to Agreed (it is
 * still counted in Remaining through its estimate, as the budget does).
 */
export function ledgerTotals(rows: LedgerRow[]): LedgerTotals {
  const totals: LedgerTotals = {
    estimatedMinor: 0,
    agreedMinor: 0,
    paidMinor: 0,
    remainingMinor: 0,
  };
  for (const row of rows) {
    totals.estimatedMinor += row.estimatedAmountMinor ?? 0;
    totals.agreedMinor += row.agreedAmountMinor ?? 0;
    totals.paidMinor += row.paidAmountMinor;
    totals.remainingMinor += row.remainingAmountMinor;
  }
  return totals;
}
