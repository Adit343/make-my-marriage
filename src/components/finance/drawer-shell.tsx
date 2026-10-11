"use client";

import { useEffect, useRef, type FormEvent, type ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { useDialogFocus } from "@/components/ui/use-dialog-focus";

/**
 * The slide-over frame the Stitch Expense, Payment and Vendor forms share: dimmed backdrop, a
 * header with a close button, a scrolling body and a footer with Cancel and Save. Focus moves in
 * and stays inside while it is open; Escape and the backdrop close it unless a save is running.
 */
export function DrawerShell({
  id,
  title,
  subtitle,
  note,
  widthClass = "w-[540px]",
  saveLabel,
  saving,
  onClose,
  onSubmit,
  children,
}: {
  id: string;
  title: string;
  subtitle?: string;
  /** The small lock line at the bottom left ("Shared with your team"); leave out for a plain footer. */
  note?: string;
  /** The panel width class; the Expense and Vendor forms use the default. */
  widthClass?: string;
  saveLabel: string;
  saving: boolean;
  onClose: () => void;
  onSubmit: () => void;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div
        className="absolute inset-0 bg-[#2A2622]/25 backdrop-blur-[2px]"
        onMouseDown={() => {
          if (!saving) onClose();
        }}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        className={`fixed inset-y-0 right-0 flex ${widthClass} max-w-full flex-col border-l border-[#E5DDD2] bg-[#FFFDF9] shadow-2xl`}
      >
        <form noValidate onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <header className="flex-shrink-0 border-b border-[#2A2622]/[0.06] px-8 pt-8 pb-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <h2
                  id={`${id}-title`}
                  className="font-headline-md text-headline-md font-normal text-[#2A2622]"
                >
                  {title}
                </h2>
                {subtitle ? (
                  <p className="max-w-md font-body-sm text-body-sm text-on-surface-variant">
                    {subtitle}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                aria-label="Close panel"
                onClick={onClose}
                className="-mt-1 -mr-2 rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-[#F2ECE3] hover:text-[#2A2622]"
              >
                <Icon name="close" />
              </button>
            </div>
          </header>

          <div className="custom-scrollbar flex-1 space-y-6 overflow-y-auto px-8 py-6">
            {children}
          </div>

          <footer className="flex flex-shrink-0 items-center justify-between gap-3 border-t border-[#E8E1D7] bg-[#FAF6F0]/95 px-8 py-4 backdrop-blur-md">
            {note ? (
              <div className="flex min-w-0 items-center gap-2 font-body-sm text-body-sm text-on-surface-variant">
                <Icon name="lock" className="shrink-0 text-[16px] text-surface-tint" />
                <span className="truncate">{note}</span>
              </div>
            ) : null}
            <div className="ml-auto flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="shrink-0 rounded-lg border border-[#D5CCC0] px-5 py-2.5 font-label-md text-label-md font-medium text-[#2A2622] transition-colors hover:bg-[#F2ECE3] focus:ring-2 focus:ring-[#B5714A] focus:outline-none active:scale-[0.99]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex shrink-0 items-center gap-2 rounded-xl bg-[#1F4D3D] px-6 py-2.5 font-label-md text-label-md font-medium whitespace-nowrap text-[#FAF6F0] shadow-sm transition-all hover:-translate-y-0.5 hover:bg-[#16382c] focus:ring-2 focus:ring-[#B5714A] focus:ring-offset-2 focus:outline-none active:scale-[0.99] disabled:opacity-70"
              >
                {saving ? "Saving..." : saveLabel}
                {saving ? null : <Icon name="check" className="text-[16px]" />}
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
}
