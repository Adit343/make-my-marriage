"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/ui/icon";

// The floating panel behind the custom dropdowns and pickers. On a laptop it hangs under the
// control (flipping above when there is no room, never wider than the screen); on a phone it
// becomes a bottom sheet with a dimmed backdrop, so options are big enough to tap and are never
// clipped by a slide-over's own scrolling.

const COMPACT_QUERY = "(max-width: 639px)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(COMPACT_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** True on phone-sized screens, where panels become bottom sheets. */
export function useCompactScreen(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(COMPACT_QUERY).matches,
    () => false,
  );
}

/** Panels currently open, oldest first: only the newest answers Escape, and a click inside a newer panel is not "outside" an older one (a date picker opened from a filter panel). */
const openPanels: { element: () => HTMLElement | null }[] = [];

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), [tabindex="0"]';

export function Popover({
  anchorRef,
  onClose,
  title,
  id,
  matchWidth = false,
  maxHeight = 320,
  trapFocus = false,
  className = "",
  children,
}: {
  /** The control the panel hangs from; it keeps its own clicks and gets focus back on close. */
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  /** Heading shown on the phone bottom sheet. */
  title: string;
  id?: string;
  /** Make the panel exactly as wide as the control (dropdowns); pickers keep their own width. */
  matchWidth?: boolean;
  maxHeight?: number;
  /** Pickers move focus inside and keep Tab there; dropdowns leave focus on the control. */
  trapFocus?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const compact = useCompactScreen();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Position under (or over) the control, written straight to the element so scrolling never
  // re-renders the contents.
  useLayoutEffect(() => {
    if (compact) return;
    const panel = panelRef.current;
    const anchor = anchorRef.current;
    if (!panel || !anchor) return;

    const place = () => {
      const rect = anchor.getBoundingClientRect();
      const viewportWidth = document.documentElement.clientWidth;
      const viewportHeight = window.innerHeight;
      if (rect.bottom < 0 || rect.top > viewportHeight) {
        onCloseRef.current();
        return;
      }
      panel.style.minWidth = `${Math.min(rect.width, viewportWidth - 16)}px`;
      panel.style.width = matchWidth ? `${rect.width}px` : "";
      const natural = Math.min(panel.scrollHeight, maxHeight);
      const below = viewportHeight - rect.bottom - 14;
      const above = rect.top - 14;
      const openUp = natural > below && above > below;
      panel.style.maxHeight = `${Math.max(140, Math.min(maxHeight, openUp ? above : below))}px`;
      const left = Math.max(8, Math.min(rect.left, viewportWidth - panel.offsetWidth - 8));
      panel.style.left = `${left}px`;
      if (openUp) {
        panel.style.top = "auto";
        panel.style.bottom = `${viewportHeight - rect.top + 6}px`;
      } else {
        panel.style.bottom = "auto";
        panel.style.top = `${rect.bottom + 6}px`;
      }
      panel.style.visibility = "visible";
    };
    const onScroll = (event: Event) => {
      if (!panel.contains(event.target as Node)) place();
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [compact, matchWidth, maxHeight, anchorRef]);

  // Escape, Tab and outside clicks are caught on the window in the capture phase, ahead of the
  // slide-over underneath, so Escape closes only this panel and a click outside only dismisses it.
  useEffect(() => {
    const me = { element: () => panelRef.current };
    openPanels.push(me);
    const isTop = () => openPanels[openPanels.length - 1] === me;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isTop()) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !trapFocus) return;
      const panel = panelRef.current;
      if (!panel) return;
      event.stopPropagation();
      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement;
      if (!panel.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || anchorRef.current?.contains(target)) return;
      const newer = openPanels.slice(openPanels.indexOf(me) + 1);
      if (newer.some((panel) => panel.element()?.contains(target))) return;
      event.stopPropagation();
      onCloseRef.current();
    };
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("mousedown", onMouseDown, true);
    return () => {
      openPanels.splice(openPanels.indexOf(me), 1);
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("mousedown", onMouseDown, true);
    };
  }, [anchorRef, trapFocus]);

  // Pickers take focus on open; either kind gives it back to the control when closed.
  useEffect(() => {
    const anchor = anchorRef.current;
    if (trapFocus) {
      const panel = panelRef.current;
      const target =
        panel?.querySelector<HTMLElement>("[data-autofocus]") ??
        panel?.querySelector<HTMLElement>(FOCUSABLE);
      target?.focus({ preventScroll: true });
    }
    return () => {
      const active = document.activeElement;
      if (!active || active === document.body) anchor?.focus({ preventScroll: true });
    };
  }, [anchorRef, trapFocus]);

  const stop = (event: { stopPropagation: () => void }) => event.stopPropagation();

  if (compact) {
    return createPortal(
      <div className="fixed inset-0 z-[70]" onMouseDown={stop} onClick={stop}>
        <div className="absolute inset-0 bg-[#2A2622]/35 backdrop-blur-[2px]" aria-hidden="true" />
        <div
          ref={panelRef}
          id={id}
          role="dialog"
          aria-label={title}
          className={`absolute inset-x-0 bottom-0 flex max-h-[82dvh] flex-col rounded-t-2xl border-t border-[#E5DDD2] bg-surface-container-lowest pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl ${className}`}
        >
          <div className="flex shrink-0 items-center justify-between gap-3 px-5 pt-4 pb-2">
            <span
              aria-hidden="true"
              className="absolute top-1.5 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-[#2A2622]/15"
            />
            <span className="truncate font-title text-body-md font-semibold text-[#2A2622]">
              {title}
            </span>
            <button
              type="button"
              aria-label="Close"
              onClick={() => onCloseRef.current()}
              className="-mr-2 rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container"
            >
              <Icon name="close" />
            </button>
          </div>
          <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-1">
            {children}
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div
      ref={panelRef}
      id={id}
      role={trapFocus ? "dialog" : undefined}
      aria-label={trapFocus ? title : undefined}
      style={{ position: "fixed", visibility: "hidden" }}
      onMouseDown={stop}
      onClick={stop}
      className={`custom-scrollbar elevation-2 z-[70] overflow-y-auto overscroll-contain rounded-xl border border-[#2A2622]/[0.1] bg-surface-container-lowest ${className}`}
    >
      {children}
    </div>,
    document.body,
  );
}
