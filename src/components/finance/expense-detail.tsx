"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { EventMenu, type EventMenuItem } from "@/components/events/event-menu";
import { deletePayment, updatePayment } from "@/components/finance/finance-api";
import { PaymentDrawer, type PaymentDrawerMode } from "@/components/finance/payment-drawer";
import { BUTTON_PRIMARY, Chip, EmptyState } from "@/components/finance/ui";
import { useExpenseActions } from "@/components/finance/use-expense-actions";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/client/api-client";
import { formatShortDate } from "@/lib/dates";
import {
  EXPENSE_CATEGORY_LABEL,
  PAYMENT_METHOD_LABEL,
  PAYMENT_STATUS_LABEL,
  VENDOR_STATUS_LABEL,
} from "@/lib/finance/labels";
import { formatMoney } from "@/lib/finance/money";
import { instantToWallClock } from "@/lib/zoned-time";
import type { VendorStatus } from "@/lib/constants/enums";
import type { ExpenseDetailDto, PaymentDto } from "@/modules/expenses/expense.dto";

// Stitch screen "Expense Detail & Payment Recording". Everyone sees the expense and its payments;
// only owners and admins record, change or delete payments; a member edits only what they recorded.

const CARD = "rounded-2xl border border-[#2A2622]/[0.06] bg-surface-container-lowest";

const VENDOR_TONE: Record<VendorStatus, "green" | "terracotta" | "red" | "neutral"> = {
  booked: "green",
  contacted: "terracotta",
  shortlisted: "neutral",
  rejected: "red",
};

export function ExpenseDetail({
  weddingId,
  currency,
  timezone,
  today,
  detail,
  events,
  vendors,
  canRecordPayments,
  canSeeVendors,
}: {
  weddingId: string;
  currency: string;
  timezone: string;
  today: string;
  detail: ExpenseDetailDto;
  events: { id: string; name: string }[];
  vendors: { id: string; name: string }[];
  canRecordPayments: boolean;
  canSeeVendors: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const { expense, payments, vendor } = detail;
  const money = (minor: number) => formatMoney(minor, currency);

  const actions = useExpenseActions({
    weddingId,
    currency,
    timezone,
    events,
    vendors,
    canRecordPayments,
    afterDelete: () => router.push("/dashboard/expenses?tab=all"),
  });
  const [payment, setPayment] = useState<PaymentDrawerMode | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PaymentDto | null>(null);
  const [busy, setBusy] = useState(false);

  const cost = expense.costMinor;
  const percent = cost > 0 ? Math.min(100, (expense.paidAmountMinor / cost) * 100) : 0;
  const over = Math.max(0, detail.scheduledAmountMinor - cost);

  async function markPaid(target: PaymentDto) {
    try {
      await updatePayment(weddingId, target.id, target.version, {
        amountMinor: target.amountMinor,
        status: "paid",
        dueDate: target.dueDate,
        paidAt: new Date().toISOString(),
        method: target.method,
        reference: target.reference,
        notes: target.notes,
      });
      toast({ type: "success", title: "Marked as paid", message: money(target.amountMinor) });
      router.refresh();
    } catch (error) {
      toast({ type: "error", title: "Couldn't update the payment", message: errorMessage(error) });
    }
  }

  async function confirmDeletePayment() {
    if (!pendingDelete) return;
    setBusy(true);
    try {
      await deletePayment(weddingId, pendingDelete.id);
      toast({
        type: "success",
        title: "Payment deleted",
        message: money(pendingDelete.amountMinor),
      });
      setPendingDelete(null);
      setBusy(false);
      router.refresh();
    } catch (error) {
      setBusy(false);
      setPendingDelete(null);
      toast({ type: "error", title: "Couldn't delete the payment", message: errorMessage(error) });
    }
  }

  function paymentMenu(target: PaymentDto): EventMenuItem[] {
    return [
      {
        icon: "edit",
        label: "Edit payment",
        onSelect: () => setPayment({ kind: "edit", payment: target }),
      },
      ...(target.status === "pending"
        ? [
            {
              icon: "check_circle" as const,
              label: "Mark as paid",
              onSelect: () => void markPaid(target),
            },
          ]
        : []),
      {
        icon: "delete",
        label: "Delete payment",
        danger: true,
        onSelect: () => setPendingDelete(target),
      },
    ];
  }

  const dateCell = (item: PaymentDto) => {
    if (item.status === "paid" && item.paidAt) {
      return formatShortDate(instantToWallClock(new Date(item.paidAt), timezone).slice(0, 10));
    }
    if (item.dueDate) {
      return (
        <span className={item.isOverdue ? "text-secondary" : undefined}>
          Due {formatShortDate(item.dueDate)}
        </span>
      );
    }
    return <span className="text-on-surface-variant">No due date</span>;
  };

  return (
    <div className="mx-auto max-w-[1240px] space-y-7 pb-10">
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-2 font-body-sm text-body-sm text-on-surface-variant"
      >
        <Link href="/dashboard/expenses" className="hover:text-primary hover:underline">
          Expenses
        </Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page" className="font-medium text-on-surface">
          {expense.title}
        </span>
      </nav>

      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div className="min-w-0">
          <h1 className="font-headline-lg text-headline-lg font-normal tracking-tight text-primary">
            {expense.title}
          </h1>
          <ul className="mt-3 flex flex-wrap items-center gap-2 font-body-sm text-body-sm">
            <li>
              <Chip>Category: {EXPENSE_CATEGORY_LABEL[expense.category]}</Chip>
            </li>
            <li>
              <Chip>Event: {expense.eventName ?? "Not linked"}</Chip>
            </li>
            {expense.expenseDate ? (
              <li>
                <Chip>Date: {formatShortDate(expense.expenseDate)}</Chip>
              </li>
            ) : null}
          </ul>
          {expense.createdByName ? (
            <p className="mt-2 font-body-sm text-[12px] text-on-surface-variant">
              Recorded by {expense.createdByName}
            </p>
          ) : null}
        </div>
        {expense.canManage ? (
          <button
            type="button"
            onClick={() => actions.openDrawer({ kind: "edit", expense })}
            className="flex items-center gap-2 self-start rounded-lg border border-[#D5CCC0] px-4 py-2 font-body-sm text-body-sm font-medium text-[#2A2622] transition-colors hover:bg-[#F2ECE3] md:self-auto"
          >
            <Icon name="edit" className="text-[17px]" />
            Edit
          </button>
        ) : null}
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section aria-label="Money" className={`${CARD} p-6 lg:col-span-2`}>
          <dl className="grid grid-cols-2 gap-6 md:grid-cols-4">
            <Figure
              label="Estimated"
              value={
                expense.estimatedAmountMinor !== null ? money(expense.estimatedAmountMinor) : "–"
              }
            />
            <Figure
              label="Agreed"
              value={expense.agreedAmountMinor !== null ? money(expense.agreedAmountMinor) : "–"}
            />
            <Figure label="Paid" value={money(expense.paidAmountMinor)} dot="bg-primary" />
            <Figure
              label="Remaining"
              value={money(expense.remainingAmountMinor)}
              dot="bg-secondary"
              tone="terracotta"
            />
          </dl>
          <div className="mt-6">
            <div
              role="progressbar"
              aria-label="Paid so far"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(percent)}
              className="h-2 w-full overflow-hidden rounded-full bg-surface-container-high"
            >
              <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
            </div>
            <div className="mt-2 flex items-center justify-between font-body-sm text-[12px] text-on-surface-variant">
              <span>
                {percent.toFixed(1)}% of{" "}
                {expense.agreedAmountMinor !== null ? "agreed" : "estimated"} total paid
              </span>
              <span>
                {expense.agreedAmountMinor !== null ? "Agreed" : "Estimated"}: {money(cost)}
              </span>
            </div>
          </div>
        </section>

        <section aria-label="Linked vendor" className={`${CARD} p-6`}>
          <h2 className="mb-4 font-label-sm text-[11px] font-semibold tracking-wider text-on-surface-variant uppercase">
            Linked vendor
          </h2>
          {vendor ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-headline-sm text-headline-sm text-on-surface">{vendor.name}</p>
                <Chip tone={VENDOR_TONE[vendor.status as VendorStatus] ?? "neutral"} dot>
                  {VENDOR_STATUS_LABEL[vendor.status as VendorStatus] ?? vendor.status}
                </Chip>
              </div>
              {vendor.phone ? (
                <a
                  href={`tel:${vendor.phone}`}
                  className="flex items-center gap-2 font-body-sm text-body-sm text-on-surface-variant hover:text-primary"
                >
                  <Icon name="call" className="text-[16px]" />
                  {vendor.phone}
                </a>
              ) : null}
              {canSeeVendors ? (
                <Link
                  href={`/dashboard/vendors/${vendor.id}`}
                  className="inline-flex items-center gap-1.5 font-body-sm text-body-sm font-medium text-primary hover:underline"
                >
                  View vendor
                  <Icon name="arrow_forward" className="text-[16px]" />
                </Link>
              ) : null}
            </div>
          ) : (
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              No vendor is linked to this expense.
            </p>
          )}
        </section>
      </div>

      <section aria-labelledby="payments-heading" className={`${CARD} overflow-hidden`}>
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-5">
          <div className="flex items-center gap-3">
            <h2 id="payments-heading" className="font-headline-sm text-headline-sm text-primary">
              Payments
            </h2>
            <span className="rounded-full bg-surface-container-high px-2.5 py-0.5 font-label-sm text-[11px] text-on-surface-variant">
              {payments.length} {payments.length === 1 ? "record" : "records"}
            </span>
          </div>
          {canRecordPayments ? (
            <button
              type="button"
              onClick={() =>
                setPayment({ kind: "create", remainingMinor: expense.remainingAmountMinor })
              }
              className={BUTTON_PRIMARY}
            >
              <Icon name="add" className="text-[18px]" />
              Add payment
            </button>
          ) : (
            <p className="flex items-center gap-2 font-body-sm text-[12px] text-on-surface-variant">
              <Icon name="lock" className="text-[15px]" />
              Only owners and admins can record payments.
            </p>
          )}
        </div>

        {payments.length === 0 ? (
          <div className="px-6 pb-8">
            <EmptyState
              icon="payments"
              title="No payments yet"
              message={
                canRecordPayments
                  ? "Record an advance you paid, or a balance that is coming due."
                  : "Payments recorded by an owner or admin will appear here."
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="stack-table w-full border-collapse text-left md:min-w-[760px]">
              <caption className="sr-only">Payments recorded for {expense.title}</caption>
              <thead>
                <tr className="bg-surface-container-low">
                  {["Date or due date", "Amount", "Status", "Method", "Reference"].map(
                    (heading) => (
                      <th
                        key={heading}
                        scope="col"
                        className="px-6 py-3 font-label-md text-[12px] font-semibold tracking-wider text-on-surface-variant uppercase"
                      >
                        {heading}
                      </th>
                    ),
                  )}
                  <th scope="col" className="px-4 py-3">
                    <span className="sr-only">Action</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A2622]/[0.06]">
                {payments.map((item) => (
                  <tr
                    key={item.id}
                    className={item.status === "cancelled" ? "opacity-70" : undefined}
                  >
                    <td
                      data-slot="main"
                      className="px-6 py-4 font-body-sm text-body-sm whitespace-nowrap text-on-surface"
                    >
                      {dateCell(item)}
                    </td>
                    <td
                      data-label="Amount"
                      className={`px-6 py-4 font-title text-body-sm font-semibold whitespace-nowrap ${item.status === "cancelled" ? "text-on-surface-variant line-through" : "text-on-surface"}`}
                    >
                      {money(item.amountMinor)}
                    </td>
                    <td data-label="Status" className="px-6 py-4">
                      {item.status === "paid" ? (
                        <Chip tone="green" dot>
                          {PAYMENT_STATUS_LABEL.paid}
                        </Chip>
                      ) : item.status === "pending" ? (
                        <Chip tone={item.isOverdue ? "terracotta" : "neutral"} dot>
                          {item.isOverdue ? "Overdue" : PAYMENT_STATUS_LABEL.pending}
                        </Chip>
                      ) : (
                        <Chip tone="grey" dot>
                          {PAYMENT_STATUS_LABEL.cancelled}
                        </Chip>
                      )}
                    </td>
                    <td
                      data-label="Method"
                      className="px-6 py-4 font-body-sm text-body-sm text-on-surface-variant"
                    >
                      {item.method ? PAYMENT_METHOD_LABEL[item.method] : "–"}
                    </td>
                    <td
                      data-label="Reference"
                      className="max-w-[220px] px-6 py-4 font-body-sm text-body-sm text-on-surface-variant"
                    >
                      <span className="block truncate" title={item.notes ?? undefined}>
                        {item.reference ?? "–"}
                      </span>
                    </td>
                    <td data-slot="actions" className="px-4 py-4 text-right">
                      {canRecordPayments ? (
                        <EventMenu
                          eventName={`${money(item.amountMinor)} payment`}
                          items={paymentMenu(item)}
                          trigger="inline"
                        />
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {detail.exceedsAgreedAmount ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-secondary/25 bg-secondary-fixed/25 px-5 py-4"
        >
          <Icon name="info" className="mt-0.5 text-[20px] text-secondary" />
          <div>
            <p className="font-title text-body-sm font-semibold text-on-secondary-container">
              Payments total {money(detail.scheduledAmountMinor)}, which is {money(over)} more than
              the {expense.agreedAmountMinor !== null ? "agreed" : "estimated"} amount.
            </p>
            <p className="mt-0.5 font-body-sm text-body-sm text-on-secondary-container/80">
              Review pending payments, or adjust the agreed figure in the expense details if add-ons
              were commissioned.
            </p>
          </div>
        </div>
      ) : null}

      <section aria-labelledby="notes-heading" className={`${CARD} p-6`}>
        <div className="mb-3 flex items-center gap-2">
          <Icon name="lock" className="text-[18px] text-on-surface-variant" />
          <h2 id="notes-heading" className="font-headline-sm text-headline-sm text-primary">
            Private internal notes
          </h2>
          <span className="font-body-sm text-[12px] text-on-surface-variant">
            Never shown to guests or vendors
          </span>
        </div>
        {expense.notes ? (
          <p className="font-body-md text-body-md whitespace-pre-line text-on-surface">
            {expense.notes}
          </p>
        ) : (
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            No notes yet.
            {expense.canManage ? " Use Edit to add the contract terms or who you spoke to." : ""}
          </p>
        )}
      </section>

      {actions.overlays}
      {payment ? (
        <PaymentDrawer
          weddingId={weddingId}
          expenseId={expense.id}
          currency={currency}
          timezone={timezone}
          mode={payment}
          onClose={() => setPayment(null)}
          onSaved={(result) => {
            if (result.exceedsAgreedAmount) {
              toast({
                type: "warning",
                title: "Payments are above the agreed amount",
                message: `They now total ${money(result.scheduledAmountMinor)}.`,
              });
            }
            setPayment(null);
            router.refresh();
          }}
        />
      ) : null}
      {pendingDelete ? (
        <ConfirmDialog
          title="Delete this payment?"
          confirmLabel="Delete payment"
          danger
          busy={busy}
          onConfirm={confirmDeletePayment}
          onCancel={() => setPendingDelete(null)}
        >
          <p>
            The {money(pendingDelete.amountMinor)}{" "}
            {PAYMENT_STATUS_LABEL[pendingDelete.status].toLowerCase()} payment will be removed and
            the totals will change.
          </p>
        </ConfirmDialog>
      ) : null}
    </div>
  );
}

function Figure({
  label,
  value,
  dot,
  tone,
}: {
  label: string;
  value: string;
  dot?: string;
  tone?: "terracotta";
}) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 font-label-sm text-[11px] tracking-wider text-on-surface-variant uppercase">
        {dot ? <span className={`h-1.5 w-1.5 rounded-full ${dot}`} /> : null}
        {label}
      </dt>
      <dd
        className={`mt-1 font-headline-sm text-headline-sm ${tone === "terracotta" ? "text-secondary" : "text-on-surface"}`}
      >
        {value}
      </dd>
    </div>
  );
}
