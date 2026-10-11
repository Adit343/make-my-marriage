"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { EventMenuItem } from "@/components/events/event-menu";
import { ExpenseDrawer, type ExpenseDrawerMode } from "@/components/finance/expense-drawer";
import { deleteExpense } from "@/components/finance/finance-api";
import { PaymentDrawer, type PaymentDrawerMode } from "@/components/finance/payment-drawer";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/client/api-client";
import { formatMoney } from "@/lib/finance/money";
import type { ExpenseDto } from "@/modules/expenses/expense.dto";

/**
 * Everything you can do to an expense from the ledger or its own page: the add/edit slide-over,
 * recording a payment, and deleting. Render `overlays` once. The menu only offers what THIS viewer
 * may do: a member can edit and delete only what they recorded (`canManage`), and only owners and
 * admins record payments. The server enforces the same rules.
 */
export function useExpenseActions({
  weddingId,
  currency,
  timezone,
  events,
  vendors,
  canRecordPayments,
  afterDelete,
}: {
  weddingId: string;
  currency: string;
  timezone: string;
  events: { id: string; name: string }[];
  vendors: { id: string; name: string }[];
  canRecordPayments: boolean;
  /** Where to go after a delete (the detail page returns to the ledger); default: refresh in place. */
  afterDelete?: () => void;
}): {
  openDrawer: (mode: ExpenseDrawerMode) => void;
  openPayment: (expense: ExpenseDto) => void;
  menuItems: (expense: ExpenseDto) => EventMenuItem[];
  overlays: ReactNode;
} {
  const router = useRouter();
  const toast = useToast();
  const [drawer, setDrawer] = useState<ExpenseDrawerMode | null>(null);
  const [payment, setPayment] = useState<{ expense: ExpenseDto; mode: PaymentDrawerMode } | null>(
    null,
  );
  const [pendingDelete, setPendingDelete] = useState<ExpenseDto | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      const result = await deleteExpense(weddingId, pendingDelete.id);
      toast({
        type: "success",
        title: "Expense deleted",
        message:
          result.paymentsRemoved > 0
            ? `${pendingDelete.title} and its ${result.paymentsRemoved} payment ${result.paymentsRemoved === 1 ? "record" : "records"}`
            : pendingDelete.title,
      });
      setPendingDelete(null);
      setDeleting(false);
      if (afterDelete) afterDelete();
      else router.refresh();
    } catch (error) {
      setDeleting(false);
      setPendingDelete(null);
      toast({ type: "error", title: "Couldn't delete the expense", message: errorMessage(error) });
    }
  }

  const openPayment = (expense: ExpenseDto) =>
    setPayment({ expense, mode: { kind: "create", remainingMinor: expense.remainingAmountMinor } });

  function menuItems(expense: ExpenseDto): EventMenuItem[] {
    return [
      {
        icon: "visibility",
        label: "View details",
        onSelect: () => router.push(`/dashboard/expenses/${expense.id}`),
      },
      ...(expense.canManage
        ? [
            {
              icon: "edit" as const,
              label: "Edit expense",
              onSelect: () => setDrawer({ kind: "edit", expense }),
            },
          ]
        : []),
      ...(canRecordPayments
        ? [
            {
              icon: "add_circle" as const,
              label: "Add payment",
              onSelect: () => openPayment(expense),
            },
          ]
        : []),
      ...(expense.canManage
        ? [
            {
              icon: "delete" as const,
              label: "Delete expense",
              danger: true,
              onSelect: () => setPendingDelete(expense),
            },
          ]
        : []),
    ];
  }

  const overlays = (
    <>
      {drawer ? (
        <ExpenseDrawer
          weddingId={weddingId}
          currency={currency}
          events={events}
          vendors={vendors}
          mode={drawer}
          onClose={() => setDrawer(null)}
          onSaved={() => {
            setDrawer(null);
            router.refresh();
          }}
        />
      ) : null}
      {payment ? (
        <PaymentDrawer
          weddingId={weddingId}
          expenseId={payment.expense.id}
          currency={currency}
          timezone={timezone}
          mode={payment.mode}
          onClose={() => setPayment(null)}
          onSaved={(result) => {
            if (result.exceedsAgreedAmount) {
              toast({
                type: "warning",
                title: "Payments are above the agreed amount",
                message: `They now total ${formatMoney(result.scheduledAmountMinor, currency)} for ${payment.expense.title}.`,
              });
            }
            setPayment(null);
            router.refresh();
          }}
        />
      ) : null}
      {pendingDelete ? (
        <ConfirmDialog
          title="Delete this expense?"
          confirmLabel="Delete expense"
          danger
          busy={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        >
          <p>
            <strong className="font-semibold text-on-surface">{pendingDelete.title}</strong> and any
            payment records on it will be removed for everyone on your team.
          </p>
        </ConfirmDialog>
      ) : null}
    </>
  );

  return { openDrawer: setDrawer, openPayment, menuItems, overlays };
}
