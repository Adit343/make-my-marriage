"use client";

import { useState } from "react";
import { DrawerShell } from "@/components/finance/drawer-shell";
import {
  createPayment,
  updatePayment,
  type PaymentInput,
  type PaymentResult,
} from "@/components/finance/finance-api";
import { AmountField, Field, FIELD, PICKER, SelectField } from "@/components/finance/ui";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { ApiError, errorMessage } from "@/lib/client/api-client";
import { PAYMENT_STATUSES, type PaymentMethod, type PaymentStatus } from "@/lib/constants/enums";
import { MAX_PAYMENT_NOTES, MAX_PAYMENT_REFERENCE } from "@/lib/constants/finance";
import {
  PAYMENT_METHOD_LABEL,
  PAYMENT_METHOD_ORDER,
  PAYMENT_STATUS_LABEL,
} from "@/lib/finance/labels";
import { formatMoney, minorToInput, parseAmountToMinor } from "@/lib/finance/money";
import { instantToWallClock, wallClockToInstant } from "@/lib/zoned-time";
import type { PaymentDto } from "@/modules/expenses/expense.dto";

// The "Add payment" slide-over from the Stitch expense page. It writes down a payment someone has
// made or still owes; the app never moves money.

export type PaymentDrawerMode =
  { kind: "create"; remainingMinor: number } | { kind: "edit"; payment: PaymentDto };

const STATUS_DOT: Record<PaymentStatus, string> = {
  pending: "bg-[#B5714A]",
  paid: "bg-[#1F4D3D]",
  cancelled: "bg-[#9A938A]",
};

export function PaymentDrawer({
  weddingId,
  expenseId,
  currency,
  timezone,
  mode,
  onClose,
  onSaved,
}: {
  weddingId: string;
  expenseId: string;
  currency: string;
  timezone: string;
  mode: PaymentDrawerMode;
  onClose: () => void;
  onSaved: (result: PaymentResult) => void;
}) {
  const toast = useToast();
  const editing = mode.kind === "edit";
  const initial = mode.kind === "edit" ? mode.payment : null;

  const [amount, setAmount] = useState(
    initial
      ? minorToInput(initial.amountMinor)
      : mode.kind === "create" && mode.remainingMinor > 0
        ? minorToInput(mode.remainingMinor)
        : "",
  );
  // Most people open this to record a payment they have just made.
  const [status, setStatus] = useState<PaymentStatus>(initial?.status ?? "paid");
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? "");
  const [paidOn, setPaidOn] = useState(() =>
    instantToWallClock(initial?.paidAt ? new Date(initial.paidAt) : new Date(), timezone),
  );
  // UPI is the usual way to pay, so a new payment starts there; it is only kept if the payment
  // is paid or the person chose it (a pending payment has no method until it is made).
  const [method, setMethod] = useState<PaymentMethod | "">(initial?.method ?? "upi");
  const [methodChosen, setMethodChosen] = useState(Boolean(initial?.method));
  const [reference, setReference] = useState(initial?.reference ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [errors, setErrors] = useState<{ amount?: string; paidOn?: string }>({});
  const [saving, setSaving] = useState(false);

  async function save() {
    const next: { amount?: string; paidOn?: string } = {};
    const amountMinor = parseAmountToMinor(amount);
    if (amountMinor === null || amountMinor <= 0) next.amount = "Enter an amount above zero";
    const paidAt = status === "paid" ? wallClockToInstant(paidOn, timezone) : null;
    if (status === "paid" && !paidAt) next.paidOn = "Enter when it was paid";
    setErrors(next);
    if (Object.keys(next).length > 0 || amountMinor === null) return;

    const input: PaymentInput = {
      amountMinor,
      status,
      dueDate: dueDate || null,
      paidAt: paidAt ? paidAt.toISOString() : null,
      method: status !== "paid" && !methodChosen ? null : method || null,
      reference: reference.trim() || null,
      notes: notes.trim() || null,
    };

    setSaving(true);
    try {
      const result =
        mode.kind === "edit"
          ? await updatePayment(weddingId, mode.payment.id, mode.payment.version, input)
          : await createPayment(weddingId, expenseId, input);
      toast({
        type: "success",
        title: editing ? "Payment updated" : "Payment recorded",
        message: formatMoney(amountMinor, currency),
      });
      onSaved(result);
    } catch (error) {
      setSaving(false);
      toast({
        type: "error",
        title:
          error instanceof ApiError && error.code === "VERSION_CONFLICT"
            ? "Someone else just changed this payment"
            : "Couldn't save the payment",
        message: errorMessage(error),
      });
    }
  }

  return (
    <DrawerShell
      id="payment-drawer"
      title={editing ? "Edit payment" : "Add payment"}
      note="Only owners and admins record payments"
      saveLabel="Save payment"
      saving={saving}
      onClose={onClose}
      onSubmit={save}
    >
      <Field label="Amount" htmlFor="payment-amount" required error={errors.amount}>
        <AmountField
          id="payment-amount"
          value={amount}
          onChange={(value) => {
            setAmount(value);
            setErrors((current) => ({ ...current, amount: undefined }));
          }}
          currency={currency}
          invalid={Boolean(errors.amount)}
          autoFocus
        />
      </Field>

      <div className="space-y-1.5">
        <span
          id="payment-status-label"
          className="block font-label-md text-label-md font-semibold text-[#2A2622]"
        >
          Status
        </span>
        <div
          role="radiogroup"
          aria-labelledby="payment-status-label"
          className="grid grid-cols-3 gap-1 rounded-lg border border-[#2A2622]/10 bg-[#F5EFEB] p-1"
        >
          {PAYMENT_STATUSES.map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={status === value}
              onClick={() => setStatus(value)}
              className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 font-body-sm text-body-sm transition-colors ${
                status === value
                  ? "bg-[#1F4D3D] font-medium text-[#FAF6F0] shadow-sm"
                  : "text-on-surface-variant hover:text-[#2A2622]"
              }`}
            >
              {status === value ? null : (
                <span className={`h-2 w-2 rounded-full ${STATUS_DOT[value]}`} />
              )}
              {PAYMENT_STATUS_LABEL[value]}
            </button>
          ))}
        </div>
      </div>

      <Field label="Due date" htmlFor="payment-due" optional>
        <div className="relative">
          <input
            id="payment-due"
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            className={`${FIELD} ${PICKER} pr-11 font-body-sm text-body-sm`}
          />
          <Icon
            name="calendar_today"
            className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-[18px] text-on-surface-variant"
          />
        </div>
      </Field>

      {status === "paid" ? (
        <Field label="Paid on date & time" htmlFor="payment-paid-on" error={errors.paidOn}>
          <div className="relative">
            <input
              id="payment-paid-on"
              type="datetime-local"
              value={paidOn}
              onChange={(event) => setPaidOn(event.target.value)}
              aria-invalid={Boolean(errors.paidOn)}
              className={`${FIELD} ${PICKER} pr-11 font-body-sm text-body-sm`}
            />
            <Icon
              name="schedule"
              className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-[18px] text-on-surface-variant"
            />
          </div>
        </Field>
      ) : null}

      <Field label="Payment method" htmlFor="payment-method">
        <SelectField
          id="payment-method"
          value={method}
          onChange={(value) => {
            setMethod(value as PaymentMethod | "");
            setMethodChosen(true);
          }}
        >
          <option value="">Not recorded</option>
          {PAYMENT_METHOD_ORDER.map((value) => (
            <option key={value} value={value}>
              {PAYMENT_METHOD_LABEL[value]}
            </option>
          ))}
        </SelectField>
      </Field>

      <Field label="Reference" htmlFor="payment-reference" optional>
        <input
          id="payment-reference"
          type="text"
          autoComplete="off"
          maxLength={MAX_PAYMENT_REFERENCE}
          placeholder="e.g., UPI ID, cheque number..."
          value={reference}
          onChange={(event) => setReference(event.target.value)}
          className={FIELD}
        />
      </Field>

      <Field label="Payment notes" htmlFor="payment-notes" optional>
        <textarea
          id="payment-notes"
          rows={3}
          maxLength={MAX_PAYMENT_NOTES}
          placeholder="Optional notes for this specific transaction..."
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className={`${FIELD} resize-none font-body-sm text-body-sm`}
        />
      </Field>

      <p className="flex items-start gap-2.5 rounded-lg bg-surface-container-low px-4 py-3 font-body-sm text-[12px] text-on-surface-variant">
        <Icon name="shield" className="mt-0.5 shrink-0 text-[16px]" />
        This only records a payment you&apos;ve made. Make My Marriage doesn&apos;t move money.
      </p>
    </DrawerShell>
  );
}
