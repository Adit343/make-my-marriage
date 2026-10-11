import { describe, expect, it } from "vitest";
import {
  applyLedgerFilters,
  hasLedgerFilters,
  ledgerTotals,
  NO_LEDGER_FILTERS,
  type LedgerRow,
} from "@/lib/finance/ledger";

function row(overrides: Partial<LedgerRow> & { id: string }): LedgerRow {
  return {
    category: "venue",
    expenseDate: null,
    eventId: null,
    vendorId: null,
    estimatedAmountMinor: null,
    agreedAmountMinor: null,
    costMinor: 0,
    paidAmountMinor: 0,
    remainingAmountMinor: 0,
    ...overrides,
  };
}

const rows = [
  row({ id: "a", category: "venue", eventId: "e1", vendorId: "v1", expenseDate: "2027-01-05" }),
  row({ id: "b", category: "catering", eventId: "e2", vendorId: null, expenseDate: "2027-02-10" }),
  row({ id: "c", category: "venue", eventId: null, vendorId: "v1", expenseDate: null }),
];

const ids = (list: LedgerRow[]) => list.map((item) => item.id);

describe("applyLedgerFilters", () => {
  it("keeps everything with no filters", () => {
    expect(ids(applyLedgerFilters(rows, NO_LEDGER_FILTERS))).toEqual(["a", "b", "c"]);
    expect(hasLedgerFilters(NO_LEDGER_FILTERS)).toBe(false);
  });

  it("filters by category, event and vendor, and by 'none'", () => {
    expect(ids(applyLedgerFilters(rows, { ...NO_LEDGER_FILTERS, category: "venue" }))).toEqual([
      "a",
      "c",
    ]);
    expect(ids(applyLedgerFilters(rows, { ...NO_LEDGER_FILTERS, event: "e2" }))).toEqual(["b"]);
    expect(ids(applyLedgerFilters(rows, { ...NO_LEDGER_FILTERS, event: "none" }))).toEqual(["c"]);
    expect(ids(applyLedgerFilters(rows, { ...NO_LEDGER_FILTERS, vendor: "v1" }))).toEqual([
      "a",
      "c",
    ]);
    expect(ids(applyLedgerFilters(rows, { ...NO_LEDGER_FILTERS, vendor: "none" }))).toEqual(["b"]);
  });

  it("combines filters (all must match)", () => {
    const filters = { ...NO_LEDGER_FILTERS, category: "venue" as const, vendor: "v1", event: "e1" };
    expect(ids(applyLedgerFilters(rows, filters))).toEqual(["a"]);
    expect(hasLedgerFilters(filters)).toBe(true);
  });

  it("applies date bounds inclusively and leaves out undated expenses", () => {
    expect(ids(applyLedgerFilters(rows, { ...NO_LEDGER_FILTERS, from: "2027-01-05" }))).toEqual([
      "a",
      "b",
    ]);
    expect(ids(applyLedgerFilters(rows, { ...NO_LEDGER_FILTERS, to: "2027-01-05" }))).toEqual([
      "a",
    ]);
    expect(
      ids(applyLedgerFilters(rows, { ...NO_LEDGER_FILTERS, from: "2027-01-06", to: "2027-02-09" })),
    ).toEqual([]);
  });
});

describe("ledgerTotals", () => {
  it("adds estimates, agreed amounts, paid and remaining", () => {
    const totals = ledgerTotals([
      row({
        id: "1",
        estimatedAmountMinor: 18000000,
        agreedAmountMinor: 16500000,
        costMinor: 16500000,
        paidAmountMinor: 5000000,
        remainingAmountMinor: 11500000,
      }),
      row({
        id: "2",
        estimatedAmountMinor: 2500000,
        agreedAmountMinor: null,
        costMinor: 2500000,
        remainingAmountMinor: 2500000,
      }),
    ]);
    expect(totals).toEqual({
      estimatedMinor: 20500000,
      agreedMinor: 16500000,
      paidMinor: 5000000,
      remainingMinor: 14000000,
    });
  });

  it("is zero for nothing", () => {
    expect(ledgerTotals([])).toEqual({
      estimatedMinor: 0,
      agreedMinor: 0,
      paidMinor: 0,
      remainingMinor: 0,
    });
  });
});
