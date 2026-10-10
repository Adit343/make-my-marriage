"use client";

import { useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/ui/icon";

export interface EventMenuItem {
  icon: IconName;
  label: string;
  danger?: boolean;
  /** Choosing the item does this... */
  onSelect?: () => void;
  /** ...or, with a submenu, opens these choices inside the same popover (the task menu's "Change status"). */
  submenu?: { label: string; active?: boolean; onSelect: () => void }[];
}

/**
 * The "more" popover on an event (and, with submenus, on a task) (Stitch "Events Timeline": Edit event, Manage guests, Duplicate,
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
  const [expanded, setExpanded] = useState<string | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = () => {
      setOpen(false);
      setExpanded(null);
    };
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

  // Opening the menu with the keyboard (or mouse) puts focus on its first entry.
  useEffect(() => {
    if (open && position) {
      menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    }
  }, [open, position]);

  /** Arrow keys, Home and End move between entries; Tab leaves the menu (closing it). */
  function onMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const entries = [
      ...(menu.current?.querySelectorAll<HTMLElement>(
        '[role="menuitem"], [role="menuitemradio"]',
      ) ?? []),
    ];
    if (entries.length === 0) return;
    const at = entries.indexOf(document.activeElement as HTMLElement);
    let next: number | null = null;
    if (event.key === "ArrowDown") next = (at + 1) % entries.length;
    else if (event.key === "ArrowUp") next = (at - 1 + entries.length) % entries.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = entries.length - 1;
    else if (event.key === "Tab") {
      setOpen(false);
      setExpanded(null);
      return;
    }
    if (next === null) return;
    event.preventDefault();
    entries[next]?.focus();
  }

  function toggle() {
    if (!open && button.current) {
      const rect = button.current.getBoundingClientRect();
      setPosition({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
    }
    setExpanded(null);
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
          aria-label={`Options for ${eventName}`}
          onKeyDown={onMenuKeyDown}
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
                aria-haspopup={item.submenu ? "menu" : undefined}
                aria-expanded={item.submenu ? expanded === item.label : undefined}
                onClick={() => {
                  if (item.submenu) {
                    setExpanded(expanded === item.label ? null : item.label);
                    return;
                  }
                  setOpen(false);
                  // Focus goes back to the button first, so a dialog this opens remembers it and
                  // returns here when it closes.
                  button.current?.focus();
                  item.onSelect?.();
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
                {item.submenu ? (
                  <Icon
                    name="expand_more"
                    className={`ml-auto text-[16px] text-outline transition-transform ${expanded === item.label ? "rotate-180" : ""}`}
                  />
                ) : null}
              </button>
              {item.submenu && expanded === item.label ? (
                <div className="mx-2 mb-1 rounded-lg bg-surface-container-low py-1">
                  {item.submenu.map((choice) => (
                    <button
                      key={choice.label}
                      type="button"
                      role="menuitemradio"
                      aria-checked={choice.active ?? false}
                      onClick={() => {
                        setOpen(false);
                        setExpanded(null);
                        button.current?.focus();
                        choice.onSelect();
                      }}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left font-body-sm text-[13px] text-[#2A2622] transition-colors hover:bg-surface-container hover:text-primary"
                    >
                      <Icon
                        name="check"
                        className={`text-[15px] ${choice.active ? "text-primary" : "text-transparent"}`}
                      />
                      <span className={choice.active ? "font-semibold" : ""}>{choice.label}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}
