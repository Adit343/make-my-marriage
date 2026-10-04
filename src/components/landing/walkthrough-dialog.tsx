"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";

// "Schedule a walkthrough" CTA + dialog from the landing design. Nothing is stored or sent yet —
// there is no demo-booking backend — so the inputs are not submitted anywhere.
export function WalkthroughDialog() {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    firstFieldRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  function confirm() {
    setOpen(false);
    toast({
      type: "success",
      message: "Demo booking request confirmed! Check WhatsApp for details.",
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-lg border border-surface-bright/30 px-8 py-4 text-center font-title text-title text-surface-bright transition-all duration-200 hover:bg-primary sm:w-auto"
      >
        Schedule a walkthrough
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-on-surface/40 p-4 backdrop-blur-xs"
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="walkthrough-title"
            className="custom-elevation-elevated w-full max-w-md animate-fade-up rounded-2xl border border-on-surface/10 bg-surface-container-lowest p-6 text-left"
          >
            <div className="mb-4 flex items-center justify-between border-b border-on-surface/10 pb-3">
              <h3 id="walkthrough-title" className="font-title text-title text-on-surface">
                Schedule a 15-min Walkthrough
              </h3>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="text-on-surface-variant hover:text-on-surface"
              >
                <Icon name="close" className="text-[20px]" />
              </button>
            </div>
            <p className="mb-4 font-body-sm text-body-sm text-on-surface-variant">
              See how Make My Marriage streamlines multi-day celebrations, budgets, and RSVP
              manifests for families.
            </p>
            <div className="space-y-3">
              <input
                ref={firstFieldRef}
                type="text"
                placeholder="Your Full Name"
                aria-label="Your full name"
                className="w-full rounded-lg border border-on-surface/15 bg-surface-container-lowest px-3.5 py-2.5 text-body-sm text-on-surface focus:border-primary focus:outline-hidden"
              />
              <input
                type="tel"
                placeholder="WhatsApp Phone (+91)"
                aria-label="WhatsApp phone number"
                className="w-full rounded-lg border border-on-surface/15 bg-surface-container-lowest px-3.5 py-2.5 text-body-sm text-on-surface focus:border-primary focus:outline-hidden"
              />
              <input
                type="date"
                aria-label="Preferred date"
                className="w-full rounded-lg border border-on-surface/15 bg-surface-container-lowest px-3.5 py-2.5 text-body-sm text-on-surface focus:border-primary focus:outline-hidden"
              />
              <button
                type="button"
                onClick={confirm}
                className="mt-2 w-full rounded-lg bg-primary-container py-3 font-title text-title text-on-primary transition-colors hover:bg-primary"
              >
                Confirm Demo Slot
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
