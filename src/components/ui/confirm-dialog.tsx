"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { useDialogFocus } from "@/components/ui/use-dialog-focus";

/**
 * A modal confirmation, styled like the Stitch Settings screen's modals. `requireText` makes the
 * person type a phrase (e.g. the wedding's title) before the confirm button works. Escape and the
 * backdrop cancel; focus starts on the first control (autoFocus is right for a modal that just
 * opened).
 */
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  busy = false,
  danger = false,
  requireText,
  onConfirm,
  onCancel,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  busy?: boolean;
  danger?: boolean;
  requireText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef);
  const [typed, setTyped] = useState("");
  const allowed = !requireText || typed.trim() === requireText;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[#2A2622]/40 px-4 backdrop-blur-xs"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <div
        className={`w-full max-w-md rounded-xl border bg-[#FFFDF9] p-7 shadow-2xl ${
          danger ? "border-red-200" : "border-[#2A2622]/10"
        }`}
      >
        <div
          className={`mb-4 flex items-center gap-3 ${danger ? "text-error" : "text-on-surface"}`}
        >
          {danger ? <Icon name="error" className="text-[24px]" /> : null}
          <h3 id={titleId} className="font-headline-sm text-xl font-medium">
            {title}
          </h3>
        </div>
        <div className="space-y-3 font-body-md text-body-md text-on-surface-variant">
          {children}
        </div>

        {requireText ? (
          <label className="mt-5 block">
            <span className="mb-1.5 block font-title text-body-sm font-semibold text-on-surface">
              Type <strong>{requireText}</strong> to confirm
            </span>
            <input
              autoFocus
              type="text"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              className="w-full rounded-lg border border-[#2A2622]/15 bg-[#FFFDF9] px-4 py-2.5 font-body-md text-on-surface focus:border-[#1F4D3D] focus:shadow-[0_0_0_3px_rgba(31,77,61,0.09)] focus:outline-hidden"
            />
          </label>
        ) : null}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded-lg border border-[#2A2622]/15 px-4 py-2 font-title text-body-sm font-semibold text-on-surface transition-colors hover:bg-[#F4EFEA] disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            autoFocus={!requireText}
            disabled={busy || !allowed}
            onClick={onConfirm}
            className={`rounded-lg px-5 py-2 font-title text-body-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              danger
                ? "bg-red-700 text-white hover:bg-red-800"
                : "bg-[#1F4D3D] text-[#FAF6F0] hover:bg-[#163A2E]"
            }`}
          >
            {busy ? "Working..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
