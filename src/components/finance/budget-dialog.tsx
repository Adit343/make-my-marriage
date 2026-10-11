"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AmountField, Field } from "@/components/finance/ui";
import { useDialogFocus } from "@/components/ui/use-dialog-focus";
import { useToast } from "@/components/ui/toast";
import { apiRequest, ApiError, errorMessage } from "@/lib/client/api-client";
import { minorToInput, parseAmountToMinor } from "@/lib/finance/money";

// Sets the wedding's overall budget (owners and admins). It is the same wedding PATCH the Settings
// page uses; the Expenses overview is where people look for it, so it is reachable from here.

export function BudgetDialog({
  weddingId,
  weddingVersion,
  currency,
  currentMinor,
  onClose,
}: {
  weddingId: string;
  weddingVersion: number;
  currency: string;
  currentMinor: number | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef);
  const [amount, setAmount] = useState(minorToInput(currentMinor));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  async function save() {
    // An empty box clears the budget.
    const minor = amount.trim() === "" ? null : parseAmountToMinor(amount);
    if (amount.trim() !== "" && minor === null) {
      setError("Enter an amount like 25,00,000");
      return;
    }
    setSaving(true);
    try {
      await apiRequest(`/api/v1/weddings/${weddingId}`, {
        method: "PATCH",
        body: { version: weddingVersion, budgetTotalMinor: minor },
      });
      toast({
        type: "success",
        title: minor === null ? "Budget cleared" : "Budget saved",
        message: "The overall wedding budget was updated.",
      });
      onClose();
      router.refresh();
    } catch (failure) {
      setSaving(false);
      toast({
        type: "error",
        title:
          failure instanceof ApiError && failure.code === "VERSION_CONFLICT"
            ? "Wedding details changed elsewhere"
            : "Couldn't save the budget",
        message:
          failure instanceof ApiError && failure.code === "VERSION_CONFLICT"
            ? "Refresh the page and try again."
            : errorMessage(failure),
      });
    }
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="budget-dialog-title"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[#2A2622]/40 px-4 backdrop-blur-xs"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
        className="w-full max-w-md rounded-xl border border-[#2A2622]/10 bg-[#FFFDF9] p-7 shadow-2xl"
      >
        <h3
          id="budget-dialog-title"
          className="mb-1 font-headline-sm text-xl font-medium text-on-surface"
        >
          Total wedding budget
        </h3>
        <p className="mb-5 font-body-sm text-body-sm text-on-surface-variant">
          The ceiling for everything you spend. Only owners and admins can see it.
        </p>
        <Field label="Total budget" htmlFor="budget-amount" error={error}>
          <AmountField
            id="budget-amount"
            value={amount}
            onChange={(value) => {
              setAmount(value);
              setError(null);
            }}
            currency={currency}
            invalid={Boolean(error)}
            autoFocus
          />
        </Field>
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="rounded-lg border border-[#2A2622]/15 px-4 py-2 font-title text-body-sm font-semibold text-on-surface transition-colors hover:bg-[#F4EFEA] disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-[#1F4D3D] px-5 py-2 font-title text-body-sm font-semibold text-[#FAF6F0] transition-colors hover:bg-[#163A2E] disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save budget"}
          </button>
        </div>
      </form>
    </div>
  );
}
