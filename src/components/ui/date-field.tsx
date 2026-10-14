"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import {
  MONTH_NAMES,
  WEEKDAYS,
  addDaysTo,
  addMonths,
  compareDates,
  displayDate,
  monthGrid,
  parseDate,
  todayString,
  toDateString,
  weekdayOf,
  type Ymd,
} from "@/lib/calendar";
import { FIELD, FIELD_SM } from "@/components/ui/field-styles";
import { Icon } from "@/components/ui/icon";
import { Popover, useCompactScreen } from "@/components/ui/popover";

// A calendar drawn in the app's own style, replacing the browser's native date picker (which
// ignores the theme and differs on every device). Values are "YYYY-MM-DD" strings. On a phone it
// opens as a bottom sheet. Keyboard: arrows move by day and week, PageUp/PageDown by month
// (Shift for year), Home/End to the ends of the week, Enter picks, Escape closes.

type View = "days" | "months" | "years";

const NAV_BUTTON =
  "flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:outline-hidden disabled:opacity-30";

export function DateField({
  id,
  value,
  onChange,
  min,
  max,
  placeholder = "Select a date",
  clearable = true,
  disabled,
  invalid,
  ariaLabel,
  describedBy,
  title = "Choose a date",
  size = "md",
  fieldClass,
  className = "",
}: {
  id: string;
  /** "YYYY-MM-DD" or "". */
  value: string;
  onChange: (value: string) => void;
  /** Earliest and latest pickable day, "YYYY-MM-DD". */
  min?: string;
  max?: string;
  placeholder?: string;
  /** Show a "Clear" button (leave off for a field that must keep a value). */
  clearable?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  ariaLabel?: string;
  describedBy?: string;
  /** Heading of the phone bottom sheet. */
  title?: string;
  size?: "md" | "sm";
  /** Replaces the standard field look so a screen with its own input style can match it. */
  fieldClass?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const display = displayDate(value);

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
        <Icon name="calendar_today" className="shrink-0 text-[18px] text-[#1F4D3D]" />
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
          <Calendar
            value={value}
            min={min}
            max={max}
            clearable={clearable}
            onPick={(next) => {
              setOpen(false);
              onChange(next);
            }}
          />
        </Popover>
      ) : null}
    </>
  );
}

function Calendar({
  value,
  min,
  max,
  clearable,
  onPick,
}: {
  value: string;
  min?: string;
  max?: string;
  clearable: boolean;
  onPick: (value: string) => void;
}) {
  const compact = useCompactScreen();
  const today = todayString();
  const selected = parseDate(value);
  const start = selected ?? parseDate(today)!;
  const [cursor, setCursor] = useState<Ymd>(start);
  const [view, setView] = useState<View>("days");
  const [yearPage, setYearPage] = useState(Math.floor(start.y / 12) * 12);
  const gridRef = useRef<HTMLDivElement>(null);

  const outOfRange = (date: string) =>
    (min ? compareDates(date, min) < 0 : false) || (max ? compareDates(date, max) > 0 : false);

  /** Moves the keyboard cursor, then puts DOM focus on the matching day once it is drawn. */
  function moveCursor(next: Ymd) {
    setCursor(next);
    requestAnimationFrame(() => {
      gridRef.current
        ?.querySelector<HTMLElement>(`[data-date="${toDateString(next)}"]`)
        ?.focus({ preventScroll: true });
    });
  }

  function onGridKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const steps: Record<string, Ymd | undefined> = {
      ArrowLeft: addDaysTo(cursor, -1),
      ArrowRight: addDaysTo(cursor, 1),
      ArrowUp: addDaysTo(cursor, -7),
      ArrowDown: addDaysTo(cursor, 7),
      Home: addDaysTo(cursor, -weekdayOf(cursor.y, cursor.m, cursor.d)),
      End: addDaysTo(cursor, 6 - weekdayOf(cursor.y, cursor.m, cursor.d)),
      PageUp: addMonths(cursor, event.shiftKey ? -12 : -1),
      PageDown: addMonths(cursor, event.shiftKey ? 12 : 1),
    };
    const next = steps[event.key];
    if (!next) return;
    event.preventDefault();
    moveCursor(next);
  }

  const heading = `${MONTH_NAMES[cursor.m - 1]} ${cursor.y}`;
  const cell = compact ? "h-11 w-11" : "h-10 w-10";

  return (
    <div className={`p-3 ${compact ? "mx-auto w-full max-w-sm" : "w-[19.5rem]"}`}>
      <div className="mb-2 flex items-center justify-between gap-1">
        <button
          type="button"
          aria-label={
            view === "days"
              ? "Previous month"
              : view === "months"
                ? "Previous year"
                : "Earlier years"
          }
          onClick={() => {
            if (view === "days") setCursor(addMonths(cursor, -1));
            else if (view === "months") setCursor(addMonths(cursor, -12));
            else setYearPage(yearPage - 12);
          }}
          className={NAV_BUTTON}
        >
          <Icon name="chevron_left" />
        </button>
        <button
          type="button"
          aria-live="polite"
          onClick={() => {
            if (view === "days") setView("months");
            else if (view === "months") {
              setYearPage(Math.floor(cursor.y / 12) * 12);
              setView("years");
            } else setView("days");
          }}
          className="flex min-w-0 items-center gap-1 rounded-lg px-3 py-1.5 font-title text-body-md font-semibold text-[#2A2622] transition-colors hover:bg-surface-container focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:outline-hidden"
        >
          <span className="truncate">
            {view === "days"
              ? heading
              : view === "months"
                ? cursor.y
                : `${yearPage} – ${yearPage + 11}`}
          </span>
          <Icon
            name="expand_more"
            className={`text-[18px] text-on-surface-variant transition-transform ${view === "days" ? "" : "rotate-180"}`}
          />
        </button>
        <button
          type="button"
          aria-label={
            view === "days" ? "Next month" : view === "months" ? "Next year" : "Later years"
          }
          onClick={() => {
            if (view === "days") setCursor(addMonths(cursor, 1));
            else if (view === "months") setCursor(addMonths(cursor, 12));
            else setYearPage(yearPage + 12);
          }}
          className={NAV_BUTTON}
        >
          <Icon name="chevron_right" />
        </button>
      </div>

      {view === "days" ? (
        <>
          <div className="grid grid-cols-7" aria-hidden="true">
            {WEEKDAYS.map((weekday) => (
              <span
                key={weekday.long}
                className="py-1.5 text-center font-label-md text-label-md text-outline"
              >
                {weekday.short}
              </span>
            ))}
          </div>
          <div
            ref={gridRef}
            role="group"
            aria-label={heading}
            onKeyDown={onGridKeyDown}
            className="grid grid-cols-7 gap-y-0.5"
          >
            {monthGrid(cursor.y, cursor.m).map((day) => {
              const date = toDateString(day);
              const inMonth = day.m === cursor.m;
              const isSelected = date === value;
              const isToday = date === today;
              const isCursor = date === toDateString(cursor);
              const blocked = outOfRange(date);
              return (
                <button
                  key={date}
                  type="button"
                  data-date={date}
                  data-autofocus={isCursor && inMonth ? "" : undefined}
                  tabIndex={isCursor ? 0 : -1}
                  disabled={blocked}
                  aria-pressed={isSelected}
                  aria-current={isToday ? "date" : undefined}
                  aria-label={`${WEEKDAYS[weekdayOf(day.y, day.m, day.d)]!.long}, ${day.d} ${MONTH_NAMES[day.m - 1]} ${day.y}`}
                  onClick={() => onPick(date)}
                  className={`mx-auto flex items-center justify-center rounded-full font-body-sm text-body-sm transition-colors focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-30 ${cell} ${
                    isSelected
                      ? "bg-primary-container font-semibold text-on-primary"
                      : isToday
                        ? "font-semibold text-primary ring-1 ring-primary/40 hover:bg-primary-fixed/50"
                        : inMonth
                          ? "text-[#2A2622] hover:bg-surface-container"
                          : "text-outline hover:bg-surface-container"
                  }`}
                >
                  {day.d}
                </button>
              );
            })}
          </div>
        </>
      ) : view === "months" ? (
        <div className="grid grid-cols-3 gap-1.5 py-1">
          {MONTH_NAMES.map((name, index) => {
            const isCurrent = index + 1 === cursor.m;
            return (
              <button
                key={name}
                type="button"
                data-autofocus={isCurrent ? "" : undefined}
                onClick={() => {
                  setCursor({ ...cursor, m: index + 1, d: Math.min(cursor.d, 28) });
                  setView("days");
                }}
                className={`h-11 rounded-lg font-body-sm text-body-sm transition-colors focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-hidden ${
                  isCurrent
                    ? "bg-primary-container font-semibold text-on-primary"
                    : "text-[#2A2622] hover:bg-surface-container"
                }`}
              >
                {name.slice(0, 3)}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1.5 py-1">
          {Array.from({ length: 12 }, (_, index) => yearPage + index).map((year) => {
            const isCurrent = year === cursor.y;
            return (
              <button
                key={year}
                type="button"
                data-autofocus={isCurrent ? "" : undefined}
                onClick={() => {
                  setCursor({ ...cursor, y: year, d: Math.min(cursor.d, 28) });
                  setView("months");
                }}
                className={`h-11 rounded-lg font-body-sm text-body-sm transition-colors focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-hidden ${
                  isCurrent
                    ? "bg-primary-container font-semibold text-on-primary"
                    : "text-[#2A2622] hover:bg-surface-container"
                }`}
              >
                {year}
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-2 flex items-center justify-between border-t border-[#2A2622]/[0.07] pt-2.5">
        <button
          type="button"
          disabled={outOfRange(today)}
          onClick={() => onPick(today)}
          className="rounded-lg px-3 py-1.5 font-label-md text-label-md font-semibold text-primary transition-colors hover:bg-primary-fixed/40 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:outline-hidden disabled:opacity-40"
        >
          Today
        </button>
        {clearable && value ? (
          <button
            type="button"
            onClick={() => onPick("")}
            className="rounded-lg px-3 py-1.5 font-label-md text-label-md font-medium text-on-surface-variant transition-colors hover:bg-surface-container focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:outline-hidden"
          >
            Clear
          </button>
        ) : null}
      </div>
    </div>
  );
}
