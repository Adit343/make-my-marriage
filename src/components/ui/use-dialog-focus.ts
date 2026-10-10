"use client";

import { useEffect, useState, type RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusableIn(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (element) => element.getClientRects().length > 0,
  );
}

/**
 * Keyboard focus for a modal dialog (slide-overs and confirmations):
 *  - on open, focus moves into the dialog (unless something inside already took it, like an
 *    autofocused field);
 *  - Tab and Shift+Tab stay inside the dialog instead of walking into the page behind it;
 *  - on close, focus returns to the control that opened it, so a keyboard user isn't dropped back
 *    at the top of the page.
 */
export function useDialogFocus(dialog: RefObject<HTMLElement | null>) {
  // The opener is noted during the FIRST RENDER, before the dialog is in the page: once it is,
  // an autofocused field has already taken focus and would be mistaken for the opener.
  const [opener] = useState<HTMLElement | null>(() =>
    typeof document !== "undefined" && document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  );

  useEffect(() => {
    const container = dialog.current;
    if (!container) return;

    if (!container.contains(document.activeElement)) {
      (focusableIn(container)[0] ?? container).focus();
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const items = focusableIn(container);
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !container.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !container.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (opener?.isConnected) opener.focus();
    };
  }, [dialog, opener]);
}
