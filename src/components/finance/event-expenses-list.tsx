import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { EXPENSE_CATEGORY_LABEL } from "@/lib/finance/labels";
import { formatMoney } from "@/lib/finance/money";
import type { ExpenseDto } from "@/modules/expenses/expense.dto";

/**
 * The body of the event page's "Linked expenses" card: what was recorded against this event, what
 * each costs and has been paid, and a way into the full ledger already filtered to the event.
 * Every member sees every expense (owner decision 2026-10-10), so this needs no role check.
 */
export function EventExpensesList({
  eventId,
  expenses,
  currency,
}: {
  eventId: string;
  expenses: ExpenseDto[];
  currency: string;
}) {
  const total = expenses.reduce((sum, expense) => sum + expense.costMinor, 0);
  return (
    <div className="mt-4 space-y-4">
      <ul className="divide-y divide-[#2A2622]/[0.06]">
        {expenses.map((expense) => (
          <li key={expense.id}>
            <Link
              href={`/dashboard/expenses/${expense.id}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg py-3 transition-colors hover:bg-surface-container-low"
            >
              <div className="min-w-0">
                <p className="truncate font-title text-body-sm font-semibold text-on-surface">
                  {expense.title}
                </p>
                <p className="font-body-sm text-[12px] text-on-surface-variant">
                  {EXPENSE_CATEGORY_LABEL[expense.category]}
                  {expense.vendorName ? ` • ${expense.vendorName}` : ""}
                </p>
              </div>
              <div className="text-right font-body-sm text-body-sm">
                <p className="font-title font-semibold text-on-surface">
                  {formatMoney(expense.costMinor, currency)}
                </p>
                <p className="text-[12px] text-on-surface-variant">
                  Paid {formatMoney(expense.paidAmountMinor, currency)}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#2A2622]/[0.06] pt-4 font-body-sm text-body-sm">
        <span className="text-on-surface-variant">
          Total{" "}
          <span className="font-title font-semibold text-on-surface">
            {formatMoney(total, currency)}
          </span>
        </span>
        <Link
          href={`/dashboard/expenses?event=${eventId}`}
          className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
        >
          View in Expenses
          <Icon name="arrow_forward" className="text-[14px]" />
        </Link>
      </div>
    </div>
  );
}
