"use client";

import { useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/ui/icon";

export interface EventMenuItem {
  icon: IconName;
  label: string;
  danger?: boolean;
  onSelect: () => void;
}

/**
 * The "more" popover on an event (Stitch "Events Timeline": Edit event, Manage guests, Duplicate,
 * Delete event). Positioned with `fixed` so a card's overflow can't clip it; closes on outside
 * click, Escape, scroll and resize.
 */
export function EventMenu({
  eventName,
  items,
  trigger = "vertical",
}: {
  eventName: string;
  items: EventMenuItem[];
  trigger?: "vertical" | "horizontal";
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; right: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menu.current?.contains(target) || button.current?.contains(target)) return;
      close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
        button.current?.focus();
      }
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    document.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      document.removeEventListener("scroll", close, true);
    };
  }, [open]);

  function toggle() {
    if (!open && button.current) {
      const rect = button.current.getBoundingClientRect();
      setPosition({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
    }
    setOpen((value) => !value);
  }

  const firstDanger = items.findIndex((item) => item.danger);
  const horizontal = trigger === "horizontal";

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-label={`Options for ${eventName}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
        className={
          horizontal
            ? "flex h-9 w-9 items-center justify-center rounded-lg border border-[#D9D1C7] bg-[#FFFDF9] text-[#2A2622] shadow-sm transition-colors hover:bg-[#F4EFEA]"
            : `flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                open
                  ? "bg-surface-container text-primary ring-2 ring-primary/20"
                  : "text-outline hover:bg-surface-container-low hover:text-[#2A2622]"
              }`
        }
      >
        <Icon name={horizontal ? "more_horiz" : "more_vert"} className="text-[18px]" />
      </button>
      {open && position ? (
        <div
          ref={menu}
          role="menu"
          style={{ top: position.top, right: position.right }}
          className="elevation-2 fixed z-50 w-48 rounded-xl border border-[#2A2622]/[0.08] bg-[#FFFDF9] py-1.5"
        >
          {items.map((item, index) => (
            <div key={item.label}>
              {index === firstDanger && index > 0 ? (
                <div className="my-1 border-t border-[#2A2622]/[0.06]" />
              ) : null}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
                className={`flex w-full items-center gap-2.5 px-3.5 py-1.5 text-left font-body-sm text-[13px] transition-colors ${
                  item.danger
                    ? "text-[#B33A3A] hover:bg-error-container/40"
                    : "text-[#2A2622] hover:bg-surface-container hover:text-primary"
                }`}
              >
                <Icon
                  name={item.icon}
                  className={`text-[16px] ${item.danger ? "text-[#B33A3A]" : "text-outline"}`}
                />
                <span>{item.label}</span>
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}
