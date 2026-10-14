"use client";

import { useState } from "react";
import { DrawerShell } from "@/components/finance/drawer-shell";
import { createExpense, updateExpense, type ExpenseInput } from "@/components/finance/finance-api";
import { AmountField, Field, FIELD, SelectField } from "@/components/finance/ui";
import { DateField } from "@/components/ui/date-field";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { ApiError, errorMessage } from "@/lib/client/api-client";
import { EXPENSE_CATEGORIES, type ExpenseCategory } from "@/lib/constants/enums";
import { MAX_EXPENSE_NOTES, MAX_EXPENSE_TITLE } from "@/lib/constants/finance";
import { EXPENSE_CATEGORY_LABEL } from "@/lib/finance/labels";
import { minorToInput, parseAmountToMinor } from "@/lib/finance/money";
import type { ExpenseDto } from "@/modules/expenses/expense.dto";

// The "Add / Edit Expense" slide-over from the Stitch design. One form records an expense or edits
// one. Budget totals use the agreed amount when it is set, otherwise the estimate.

export type ExpenseDrawerMode =
  | { kind: "create"; eventId?: string | null; vendorId?: string | null }
  | { kind: "edit"; expense: ExpenseDto };

interface Errors {
  title?: string;
  estimated?: string;
  agreed?: string;
}

const AMOUNT_HELP = "Enter an amount like 1,65,000";

export function ExpenseDrawer({
  weddingId,
  currency,
  events,
  vendors,
  mode,
  onClose,
  onSaved,
}: {
  weddingId: string;
  currency: string;
  events: { id: string; name: string }[];
  vendors: { id: string; name: string }[];
  mode: ExpenseDrawerMode;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const editing = mode.kind === "edit";
  const initial = mode.kind === "edit" ? mode.expense : null;

  const [title, setTitle] = useState(initial?.title ?? "");
  const [category, setCategory] = useState<ExpenseCategory>(initial?.category ?? "other");
  const [date, setDate] = useState(initial?.expenseDate ?? "");
  const [eventId, setEventId] = useState(
    initial ? (initial.eventId ?? "") : mode.kind === "create" ? (mode.eventId ?? "") : "",
  );
  const [vendorId, setVendorId] = useState(
    initial ? (initial.vendorId ?? "") : mode.kind === "create" ? (mode.vendorId ?? "") : "",
  );
  const [estimated, setEstimated] = useState(minorToInput(initial?.estimatedAmountMinor));
  const [agreed, setAgreed] = useState(minorToInput(initial?.agreedAmountMinor));
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  async function save() {
    const next: Errors = {};
    const cleanTitle = title.trim();
    if (!cleanTitle) next.title = "Title required";
    const estimatedMinor = estimated.trim() === "" ? null : parseAmountToMinor(estimated);
    const agreedMinor = agreed.trim() === "" ? null : parseAmountToMinor(agreed);
    if (estimated.trim() !== "" && estimatedMinor === null) next.estimated = AMOUNT_HELP;
    if (agreed.trim() !== "" && agreedMinor === null) next.agreed = AMOUNT_HELP;
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const input: ExpenseInput = {
      title: cleanTitle,
      category,
      expenseDate: date || null,
      eventId: eventId || null,
      vendorId: vendorId || null,
      estimatedAmountMinor: estimatedMinor,
      agreedAmountMinor: agreedMinor,
      notes: notes.trim() || null,
    };

    setSaving(true);
    try {
      if (mode.kind === "edit") {
        await updateExpense(weddingId, mode.expense.id, mode.expense.version, input);
      } else {
        await createExpense(weddingId, input);
      }
      toast({
        type: "success",
        title: editing ? "Expense updated" : "Expense added",
        message: cleanTitle,
      });
      onSaved();
    } catch (error) {
      setSaving(false);
      toast({
        type: "error",
        title:
          error instanceof ApiError && error.code === "VERSION_CONFLICT"
            ? "Someone else just changed this expense"
            : "Couldn't save the expense",
        message: errorMessage(error),
      });
    }
  }

  return (
    <DrawerShell
      id="expense-drawer"
      title={editing ? "Edit expense" : "Add expense"}
      subtitle="Record vendor contracts and itemized commitments"
      note="Shared with your team"
      saveLabel="Save expense"
      saving={saving}
      onClose={onClose}
      onSubmit={save}
    >
      <Field label="Expense title" htmlFor="expense-title" required error={errors.title}>
        <div className="relative">
          <input
            id="expense-title"
            type="text"
            autoFocus
            autoComplete="off"
            maxLength={MAX_EXPENSE_TITLE}
            placeholder="e.g., Photography package"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              if (event.target.value.trim())
                setErrors((current) => ({ ...current, title: undefined }));
            }}
            aria-invalid={Boolean(errors.title)}
            className={`${FIELD} pr-10 ${errors.title ? "border-error" : ""}`}
          />
          <Icon
            name="edit"
            className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-[16px] text-on-surface-variant"
          />
        </div>
      </Field>

      <Field label="Category" htmlFor="expense-category" required>
        <SelectField
          id="expense-category"
          value={category}
          onChange={(value) => setCategory(value as ExpenseCategory)}
        >
          {EXPENSE_CATEGORIES.map((value) => (
            <option key={value} value={value}>
              {EXPENSE_CATEGORY_LABEL[value]}
            </option>
          ))}
        </SelectField>
      </Field>

      <Field label="Date" htmlFor="expense-date" optional hint="When it was booked or incurred">
        <DateField id="expense-date" value={date} onChange={setDate} title="Expense date" />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Event" htmlFor="expense-event">
          <SelectField id="expense-event" value={eventId} onChange={setEventId}>
            <option value="">Not linked to an event</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.name}
              </option>
            ))}
          </SelectField>
        </Field>
        <Field label="Vendor" htmlFor="expense-vendor">
          <SelectField id="expense-vendor" value={vendorId} onChange={setVendorId}>
            <option value="">None</option>
            {vendors.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.name}
              </option>
            ))}
          </SelectField>
        </Field>
      </div>

      <div className="rounded-xl border border-[#2A2622]/[0.06] bg-surface-container-low p-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Estimated amount"
            htmlFor="expense-estimated"
            error={errors.estimated}
            hint="Your planning figure"
          >
            <AmountField
              id="expense-estimated"
              value={estimated}
              onChange={setEstimated}
              currency={currency}
              invalid={Boolean(errors.estimated)}
            />
          </Field>
          <Field
            label="Agreed amount"
            htmlFor="expense-agreed"
            error={errors.agreed}
            hint="Settled with vendor"
          >
            <AmountField
              id="expense-agreed"
              value={agreed}
              onChange={setAgreed}
              currency={currency}
              invalid={Boolean(errors.agreed)}
            />
          </Field>
        </div>
        <p className="mt-4 flex items-start gap-2 border-t border-[#2A2622]/[0.08] pt-3 font-body-sm text-[12px] text-secondary italic">
          <Icon name="info" className="mt-0.5 shrink-0 text-[14px]" />
          Budget totals use the agreed amount when set, otherwise the estimate.
        </p>
      </div>

      <Field
        label={
          <span className="flex items-center gap-2">
            Notes <span className="font-normal text-on-surface-variant">(optional)</span>
          </span>
        }
        htmlFor="expense-notes"
        hint="Private to your team, never shown to guests."
      >
        <textarea
          id="expense-notes"
          rows={4}
          maxLength={MAX_EXPENSE_NOTES}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Package contents, contract terms, who you spoke to..."
          className={`${FIELD} resize-none font-body-sm text-body-sm`}
        />
      </Field>
    </DrawerShell>
  );
}
