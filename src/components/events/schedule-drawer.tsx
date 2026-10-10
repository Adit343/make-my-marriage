"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { updateSchedule } from "@/components/events/events-api";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { ApiError, errorMessage } from "@/lib/client/api-client";
import { MAX_SCHEDULE_ITEMS } from "@/lib/constants/events";
import type { EventView } from "@/lib/events/view";

// "Edit schedule" slide-over. No Stitch design exists for it: owner approved building it in the
// existing style (2026-10-10), reusing the Add / Edit Event slide-over's header, fields, footer
// and buttons. A schedule line is a timed entry in the event's run-of-show ("7:00 AM Makeup"),
// not a task. The whole list is saved at once; the server puts it in time order.

const FIELD =
  "w-full rounded-lg border border-[#2A2622]/15 bg-[#FFFDF9] px-3 py-2 font-body-sm text-body-sm text-[#2A2622] outline-none transition-all placeholder:text-[#2A2622]/35 focus:border-[#1F4D3D] focus:shadow-[0_0_0_3px_rgba(31,77,61,0.08)]";

interface Row {
  key: string;
  /** Present for a line that already exists, so its id stays the same. */
  id?: string;
  time: string;
  title: string;
  notes: string;
  isPublic: boolean;
}

type RowErrors = { time?: boolean; title?: boolean };

let nextKey = 0;
const newKey = () => `row-${(nextKey += 1)}`;

export function ScheduleDrawer({
  weddingId,
  event,
  timeZoneLabel,
  onClose,
  onSaved,
}: {
  weddingId: string;
  event: EventView;
  /** The event's zone as people read it, e.g. "IST". */
  timeZoneLabel: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [rows, setRows] = useState<Row[]>(() =>
    event.schedule.map((line) => ({
      key: newKey(),
      id: line.id,
      time: line.time,
      title: line.title,
      notes: line.notes ?? "",
      isPublic: line.isPublic,
    })),
  );
  const [errors, setErrors] = useState<Record<string, RowErrors>>({});
  const [saving, setSaving] = useState(false);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const bodyEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key === "Escape" && !saving) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  const change = (key: string, patch: Partial<Row>) => {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
    setErrors((current) => (current[key] ? { ...current, [key]: {} } : current));
  };

  function addLine() {
    if (rows.length >= MAX_SCHEDULE_ITEMS) return;
    const key = newKey();
    // A new line starts from the last one's time: lines usually follow each other.
    const last = rows[rows.length - 1];
    setRows([...rows, { key, time: last?.time ?? "", title: "", notes: "", isPublic: false }]);
    setFocusKey(key);
    requestAnimationFrame(() => bodyEnd.current?.scrollIntoView({ behavior: "smooth" }));
  }

  async function handleSubmit(submitEvent: FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault();
    const next: Record<string, RowErrors> = {};
    for (const row of rows) {
      const problem: RowErrors = {};
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(row.time)) problem.time = true;
      if (!row.title.trim()) problem.title = true;
      if (problem.time || problem.title) next[row.key] = problem;
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      await updateSchedule(
        weddingId,
        event.id,
        event.version,
        rows.map((row) => ({
          ...(row.id ? { id: row.id } : {}),
          time: row.time,
          title: row.title.trim(),
          ...(row.notes.trim() ? { notes: row.notes.trim() } : {}),
          isPublic: row.isPublic,
        })),
      );
      toast({
        type: "success",
        title: "Schedule saved",
        message: `${event.name} now has ${rows.length} ${rows.length === 1 ? "line" : "lines"} in its schedule.`,
      });
      onSaved();
    } catch (error) {
      setSaving(false);
      toast({
        type: "error",
        title:
          error instanceof ApiError && error.code === "VERSION_CONFLICT"
            ? "Someone else just changed this event"
            : "Couldn't save the schedule",
        message: errorMessage(error),
      });
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div
        className="absolute inset-0 bg-[#2A2622]/25 backdrop-blur-[2px]"
        onMouseDown={() => {
          if (!saving) onClose();
        }}
      />
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-drawer-title"
        noValidate
        onSubmit={handleSubmit}
        className="fixed inset-y-0 right-0 flex w-[480px] max-w-full flex-col border-l border-[#E5DDD2] bg-[#FAF6F0] shadow-2xl"
      >
        <header className="flex-shrink-0 border-b border-[#2A2622]/[0.06] bg-[#FAF6F0] px-7 pt-7 pb-5">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-secondary" />
                <span className="font-label-sm text-label-sm font-semibold tracking-wider text-secondary uppercase">
                  Itinerary Builder
                </span>
              </div>
              <h2
                id="schedule-drawer-title"
                className="font-headline-sm text-2xl font-medium tracking-tight text-[#2A2622]"
              >
                Edit schedule
              </h2>
              <p className="pt-0.5 font-body-sm text-body-sm text-on-surface-variant">
                The timed lines for {event.name}, like 7:00 AM Makeup. Times are in {timeZoneLabel}.
              </p>
            </div>
            <button
              type="button"
              aria-label="Close panel"
              onClick={onClose}
              className="-mr-2 rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-[#F2ECE3] hover:text-[#2A2622]"
            >
              <Icon name="close" />
            </button>
          </div>
        </header>

        <div className="custom-scrollbar flex-1 space-y-4 overflow-y-auto px-7 py-6">
          {rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-[#2A2622]/15 bg-[#FFFDF9] px-6 py-10 text-center">
              <Icon name="schedule" className="text-[24px] text-outline" />
              <p className="font-title text-body-sm text-[#2A2622]">No schedule lines yet</p>
              <p className="max-w-xs font-body-sm text-[12px] text-on-surface-variant">
                Add the moments of the day in order, from makeup to the last dance.
              </p>
            </div>
          ) : null}

          {rows.map((row, index) => {
            const problem = errors[row.key] ?? {};
            return (
              <div
                key={row.key}
                className="space-y-3 rounded-xl border border-[#2A2622]/[0.08] bg-[#FFFDF9] p-4"
              >
                <div className="flex items-start gap-2.5">
                  <div className="w-[116px] shrink-0">
                    <input
                      type="time"
                      aria-label={`Time for line ${index + 1}`}
                      aria-invalid={Boolean(problem.time)}
                      value={row.time}
                      onChange={(e) => change(row.key, { time: e.target.value })}
                      className={`${FIELD} ${problem.time ? "border-error" : ""}`}
                    />
                    {problem.time ? (
                      <p className="mt-1 text-[11px] text-error">Time required</p>
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <input
                      type="text"
                      aria-label={`What happens in line ${index + 1}`}
                      aria-invalid={Boolean(problem.title)}
                      autoFocus={focusKey === row.key}
                      maxLength={200}
                      autoComplete="off"
                      placeholder="e.g., Makeup & hair"
                      value={row.title}
                      onChange={(e) => change(row.key, { title: e.target.value })}
                      className={`${FIELD} ${problem.title ? "border-error" : ""}`}
                    />
                    {problem.title ? (
                      <p className="mt-1 text-[11px] text-error">What happens? Required</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove line ${index + 1}`}
                    onClick={() => setRows(rows.filter((other) => other.key !== row.key))}
                    className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-outline transition-colors hover:bg-error-container/40 hover:text-[#B33A3A]"
                  >
                    <Icon name="delete" className="text-[18px]" />
                  </button>
                </div>
                <input
                  type="text"
                  aria-label={`Notes for line ${index + 1}`}
                  maxLength={500}
                  autoComplete="off"
                  placeholder="Notes (optional)"
                  value={row.notes}
                  onChange={(e) => change(row.key, { notes: e.target.value })}
                  className={FIELD}
                />
                <label className="flex cursor-pointer items-center gap-2 font-body-sm text-[12px] text-on-surface-variant">
                  <input
                    type="checkbox"
                    checked={row.isPublic}
                    onChange={(e) => change(row.key, { isPublic: e.target.checked })}
                    className="h-4 w-4 cursor-pointer rounded border-[#2A2622]/30 accent-[#1F4D3D]"
                  />
                  Show on wedding website
                </label>
              </div>
            );
          })}

          <button
            type="button"
            onClick={addLine}
            disabled={rows.length >= MAX_SCHEDULE_ITEMS}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#1F4D3D]/40 bg-transparent px-4 py-3 font-title text-body-sm font-semibold text-[#1F4D3D] transition-colors hover:bg-[#1F4D3D]/[0.04] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon name="add" className="text-[18px]" />
            Add line
          </button>
          <div ref={bodyEnd} />
        </div>

        <footer className="flex flex-shrink-0 items-center justify-between gap-3 border-t border-[#E8E1D7] bg-[#FAF6F0]/95 px-7 py-4 backdrop-blur-md">
          <div className="flex min-w-0 items-center gap-2 font-body-sm text-body-sm text-on-surface-variant">
            <Icon name="schedule" className="shrink-0 text-[16px] text-surface-tint" />
            <span className="truncate">
              {rows.length} of {MAX_SCHEDULE_ITEMS} lines
            </span>
          </div>
          <div className="flex items-center gap-3">
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
              <Icon name="check" className="text-[16px]" />
              {saving ? "Saving..." : "Save schedule"}
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
}
