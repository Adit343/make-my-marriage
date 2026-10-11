// Money helpers shared by the server (totals) and the browser (forms and display). Amounts are
// whole minor units (paise), never floats (DB Design §3.5); the API never converts, so these two
// directions are the only place rupees and paise meet.

/** What an expense counts for in the budget: the agreed amount, else the estimate, else nothing. */
export function costOf(expense: {
  agreedAmountMinor?: number | null;
  estimatedAmountMinor?: number | null;
}): number {
  return expense.agreedAmountMinor ?? expense.estimatedAmountMinor ?? 0;
}

/** What is still to pay. Never negative: paying more than the cost leaves nothing to pay. */
export function remainingOf(cost: number, paid: number): number {
  return Math.max(0, cost - paid);
}

/** Paid share of the cost, 0 to 100 (whole percent); 0 when there is no cost. */
export function paidPercent(cost: number, paid: number): number {
  if (cost <= 0) return 0;
  return Math.min(100, Math.round((paid / cost) * 100));
}

/** A pending payment whose due day is before today (both "YYYY-MM-DD"). */
export function isPaymentOverdue(
  payment: { status: string; dueDate: string | null },
  today: string,
): boolean {
  return payment.status === "pending" && payment.dueDate !== null && payment.dueDate < today;
}

/**
 * "₹1,65,000" for rupees (Indian digit grouping), with paise only when there are some
 * ("₹499.50"). Other currencies use their own symbol and the same grouping.
 */
export function formatMoney(minor: number, currency = "INR"): string {
  const major = minor / 100;
  const hasMinor = minor % 100 !== 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: hasMinor ? 2 : 0,
    maximumFractionDigits: hasMinor ? 2 : 0,
  }).format(major);
}

/** The currency symbol on its own ("₹"), for the amount fields. */
export function currencySymbol(currency = "INR"): string {
  return (
    new Intl.NumberFormat("en-IN", { style: "currency", currency })
      .formatToParts(0)
      .find((part) => part.type === "currency")?.value ?? currency
  );
}

/**
 * What a person typed ("1,65,000", "499.50") to whole minor units, or null when it is not a usable
 * amount: letters, a negative number or more than two decimals. Commas and spaces are ignored.
 */
export function parseAmountToMinor(typed: string): number | null {
  const compact = typed.replace(/[,\s₹]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(compact)) return null;
  const [whole = "0", fraction = ""] = compact.split(".");
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(minor) ? minor : null;
}

/** What goes in an amount box when editing: "165000" or "499.50", no symbol, no grouping. */
export function minorToInput(minor: number | null | undefined): string {
  if (minor === null || minor === undefined) return "";
  const whole = Math.floor(minor / 100);
  const fraction = minor % 100;
  return fraction === 0 ? String(whole) : `${whole}.${String(fraction).padStart(2, "0")}`;
}
