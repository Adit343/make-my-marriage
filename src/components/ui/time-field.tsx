"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  displayTime,
  from12Hour,
  parseTime,
  to12Hour,
  toTimeString,
  type Meridiem,
} from "@/lib/calendar";
import { FIELD, FIELD_SM } from "@/components/ui/field-styles";
import { Icon } from "@/components/ui/icon";
import { Popover, useCompactScreen } from "@/components/ui/popover";

// A clock picker in the app's own style, replacing the browser's native time input: pick the hour,
// the minute and AM or PM from three short columns. Values are 24-hour "HH:mm" strings.

const HOURS = Array.from({ length: 12 }, (_, index) => index + 1);

export function TimeField({
  id,
  value,
  onChange,
  step = 5,
  defaultTime = "09:00",
  placeholder = "Select a time",
  clearable = false,
  disabled,
  invalid,
  ariaLabel,
  describedBy,
  title = "Choose a time",
  size = "md",
  fieldClass,
  className = "",
}: {
  id: string;
  /** "HH:mm" (24-hour) or "". */
  value: string;
  onChange: (value: string) => void;
  /** Minutes between choices in the minute column. */
  step?: number;
  /** Where the clock starts when nothing is chosen yet. */
  defaultTime?: string;
  placeholder?: string;
  clearable?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  ariaLabel?: string;
  describedBy?: string;
  title?: string;
  size?: "md" | "sm";
  /** Replaces the standard field look so a screen with its own input style can match it. */
  fieldClass?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const display = displayTime(value);

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        aria-describedby={describedBy}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className={`${fieldClass ?? (size === "sm" ? FIELD_SM : FIELD)} flex cursor-pointer items-center gap-2 text-left ${
          invalid ? "border-error" : ""
        } ${className}`}
      >
        <Icon name="schedule" className="shrink-0 text-[18px] text-[#1F4D3D]" />
        <span className={`min-w-0 flex-1 truncate ${display ? "" : "text-[#6A645D]"}`}>
          {display || placeholder}
        </span>
      </button>
      {open ? (
        <Popover
          anchorRef={triggerRef}
          onClose={() => setOpen(false)}
          title={title}
          trapFocus
          maxHeight={480}
        >
          <Clock
            value={value}
            step={step}
            defaultTime={defaultTime}
            clearable={clearable}
            onChange={onChange}
            onDone={() => setOpen(false)}
          />
        </Popover>
      ) : null}
    </>
  );
}

function Clock({
  value,
  step,
  defaultTime,
  clearable,
  onChange,
  onDone,
}: {
  value: string;
  step: number;
  defaultTime: string;
  clearable: boolean;
  onChange: (value: string) => void;
  onDone: () => void;
}) {
  const compact = useCompactScreen();
  const parsed = parseTime(value);
  const base = parsed ?? parseTime(defaultTime) ?? { h: 9, min: 0 };
  const { hour, meridiem } = to12Hour(base.h);

  const minutes = Array.from({ length: Math.ceil(60 / step) }, (_, index) => index * step);
  // A time typed elsewhere (say 10:07) must still show as chosen in the minute column.
  if (parsed && !minutes.includes(parsed.min)) minutes.push(parsed.min);
  minutes.sort((a, b) => a - b);

  const set = (next: { hour?: number; min?: number; meridiem?: Meridiem }) =>
    onChange(
      toTimeString({
        h: from12Hour(next.hour ?? hour, next.meridiem ?? meridiem),
        min: next.min ?? base.min,
      }),
    );

  return (
    <div className={`p-3 ${compact ? "mx-auto w-full max-w-sm" : "w-[17rem]"}`}>
      <p
        aria-live="polite"
        className="mb-3 rounded-lg bg-surface-container-low py-2.5 text-center font-headline-sm text-headline-sm font-medium text-primary"
      >
        {parsed ? displayTime(value) : "--:-- --"}
      </p>
      <div className="grid grid-cols-[1fr_1fr_0.8fr] gap-2">
        <Column label="Hour">
          {HOURS.map((item) => (
            <Choice
              key={item}
              active={Boolean(parsed) && item === hour}
              fallback={!parsed && item === hour}
              onPick={() => set({ hour: item })}
            >
              {item}
            </Choice>
          ))}
        </Column>
        <Column label="Minute">
          {minutes.map((item) => (
            <Choice
              key={item}
              active={Boolean(parsed) && item === base.min}
              fallback={!parsed && item === base.min}
              onPick={() => set({ min: item })}
            >
              {String(item).padStart(2, "0")}
            </Choice>
          ))}
        </Column>
        <Column label="AM or PM">
          {(["AM", "PM"] as const).map((item) => (
            <Choice
              key={item}
              active={Boolean(parsed) && item === meridiem}
              fallback={!parsed && item === meridiem}
              onPick={() => set({ meridiem: item })}
            >
              {item}
            </Choice>
          ))}
        </Column>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-[#2A2622]/[0.07] pt-2.5">
        {clearable && value ? (
          <button
            type="button"
            onClick={() => {
              onChange("");
              onDone();
            }}
            className="rounded-lg px-3 py-1.5 font-label-md text-label-md font-medium text-on-surface-variant transition-colors hover:bg-surface-container focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:outline-hidden"
          >
            Clear
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={() => {
            if (!parsed) onChange(toTimeString(base));
            onDone();
          }}
          className="rounded-lg bg-primary-container px-5 py-1.5 font-label-md text-label-md font-semibold text-on-primary transition-colors hover:bg-primary focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:outline-hidden"
        >
          Done
        </button>
      </div>
    </div>
  );
}

/** One scrolling column of choices with a single tab stop and Up/Down arrow movement. */
function Column({ label, children }: { label: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  // Scroll the chosen item to the middle of the column when the clock opens.
  useEffect(() => {
    const column = ref.current;
    const chosen = column?.querySelector<HTMLElement>('[aria-checked="true"], [data-fallback]');
    if (column && chosen) {
      column.scrollTop = chosen.offsetTop - column.clientHeight / 2 + chosen.clientHeight / 2;
    }
  }, []);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const items = [...event.currentTarget.querySelectorAll<HTMLElement>("button")];
    const index = items.indexOf(document.activeElement as HTMLElement);
    const next = items[index + (event.key === "ArrowDown" ? 1 : -1)];
    if (!next) return;
    event.preventDefault();
    next.focus();
    next.click();
  }

  return (
    <div>
      <p className="pb-1.5 text-center font-label-sm text-label-sm tracking-wider text-outline uppercase">
        {label}
      </p>
      <div
        ref={ref}
        role="radiogroup"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="custom-scrollbar relative flex max-h-52 flex-col gap-0.5 overflow-y-auto overscroll-contain rounded-lg border border-[#2A2622]/[0.07] p-1"
      >
        {children}
      </div>
    </div>
  );
}

function Choice({
  active,
  fallback,
  onPick,
  children,
}: {
  active: boolean;
  /** Marks where the clock starts when nothing is chosen yet, without calling it chosen. */
  fallback: boolean;
  onPick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      data-fallback={fallback ? "" : undefined}
      data-autofocus={active || fallback ? "" : undefined}
      tabIndex={active || fallback ? 0 : -1}
      onClick={onPick}
      className={`shrink-0 rounded-md py-2 text-center font-body-sm text-body-sm transition-colors focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-hidden ${
        active
          ? "bg-primary-container font-semibold text-on-primary"
          : fallback
            ? "bg-surface-container text-[#2A2622]"
            : "text-[#2A2622] hover:bg-surface-container"
      }`}
    >
      {children}
    </button>
  );
}
