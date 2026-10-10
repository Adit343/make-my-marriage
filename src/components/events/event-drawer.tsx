"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  createEvent,
  updateEvent,
  type EventInput,
  type EventLocation,
} from "@/components/events/events-api";
import { Icon } from "@/components/ui/icon";
import { useDialogFocus } from "@/components/ui/use-dialog-focus";
import { useToast } from "@/components/ui/toast";
import { ApiError, errorMessage } from "@/lib/client/api-client";
import { EVENT_TYPES, type EventType } from "@/lib/constants/enums";
import { EVENT_TYPE_LABEL, type EventView } from "@/lib/events/view";
import { instantToWallClock, wallClockToInstant } from "@/lib/zoned-time";

// The "Add / Edit Event" slide-over from the Stitch design. The same form creates an event, edits
// one, or starts a new event as a copy of another ("Duplicate").

export type DrawerMode =
  { kind: "create" } | { kind: "duplicate"; from: EventView } | { kind: "edit"; event: EventView };

const TIMEZONES: { value: string; label: string }[] = [
  { value: "Asia/Kolkata", label: "Asia/Kolkata (IST)" },
  { value: "Asia/Dubai", label: "Asia/Dubai (GST)" },
  { value: "Europe/London", label: "Europe/London (GMT/BST)" },
  { value: "America/New_York", label: "America/New_York (EST)" },
  { value: "Asia/Singapore", label: "Asia/Singapore (SGT)" },
];

const LABEL = "block font-label-md text-label-md font-semibold text-[#2A2622]";
const FIELD =
  "w-full rounded-lg border border-[#2A2622]/15 bg-[#FFFDF9] px-3.5 py-2.5 font-body-md text-body-md text-[#2A2622] outline-none transition-all placeholder:text-[#2A2622]/35 focus:border-[#1F4D3D] focus:shadow-[0_0_0_3px_rgba(31,77,61,0.08)]";
const FIELD_SM = FIELD.replace("font-body-md text-body-md", "font-body-sm text-body-sm");
const INNER_FIELD =
  "w-full rounded-lg border border-[#2A2622]/10 bg-[#FAF6F0] px-3 py-2 font-body-sm text-body-sm text-[#2A2622] outline-none transition-all placeholder:text-[#2A2622]/35 focus:border-[#1F4D3D] focus:bg-[#FFFDF9] focus:shadow-[0_0_0_3px_rgba(31,77,61,0.08)]";
// A native date-time field whose own picker icon is stretched over the whole input (and made
// invisible) so the designed icon shows and a click anywhere opens the picker.
const PICKER =
  "relative [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0";

interface FormState {
  name: string;
  type: EventType;
  starts: string;
  ends: string;
  timezone: string;
  venue: string;
  address: string;
  dressCode: string;
  description: string;
  isPublic: boolean;
}

type Errors = Partial<Record<"name" | "starts" | "ends", string>>;

function initialState(mode: DrawerMode, weddingTimezone: string): FormState {
  const source = mode.kind === "edit" ? mode.event : mode.kind === "duplicate" ? mode.from : null;
  if (!source) {
    return {
      name: "",
      type: "mehendi",
      starts: "",
      ends: "",
      timezone: weddingTimezone,
      venue: "",
      address: "",
      dressCode: "",
      description: "",
      isPublic: false,
    };
  }
  const location = (source.location ?? {}) as EventLocation;
  const zone = source.timezone;
  return {
    name: mode.kind === "duplicate" ? `${source.name} (copy)`.slice(0, 120) : source.name,
    type: source.type,
    starts: instantToWallClock(new Date(source.startsAt), zone),
    ends: source.endsAt ? instantToWallClock(new Date(source.endsAt), zone) : "",
    timezone: zone,
    venue: location.label ?? "",
    address: location.address?.line1 ?? "",
    dressCode: source.dressCode ?? "",
    description: source.description ?? "",
    isPublic: source.isPublic,
  };
}

/** Keeps whatever else the event's location holds (city, coordinates, place id) when editing. */
function buildLocation(
  previous: EventLocation | null,
  venue: string,
  address: string,
): EventLocation | null {
  const next: EventLocation = { ...previous };
  const label = venue.trim();
  if (label) next.label = label;
  else delete next.label;

  const nextAddress = { ...previous?.address };
  const line1 = address.trim();
  if (line1) nextAddress.line1 = line1;
  else delete nextAddress.line1;
  const hasAddress = Object.entries(nextAddress).some(([key, value]) => key !== "country" && value);
  if (hasAddress) next.address = nextAddress;
  else delete next.address;

  return Object.keys(next).length > 0 ? next : null;
}

function Counter({ error }: { error?: string }) {
  return error ? <span className="text-[11px] text-error">{error}</span> : null;
}

export function EventDrawer({
  weddingId,
  weddingTimezone,
  mode,
  onClose,
  onSaved,
}: {
  weddingId: string;
  weddingTimezone: string;
  mode: DrawerMode;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef);
  const editing = mode.kind === "edit";
  const [form, setForm] = useState<FormState>(() => initialState(mode, weddingTimezone));
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const timezoneOptions = TIMEZONES.some((zone) => zone.value === form.timezone)
    ? TIMEZONES
    : [...TIMEZONES, { value: form.timezone, label: form.timezone }];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: Errors = {};
    const name = form.name.trim();
    if (!name) next.name = "Name required";
    const startsAt = form.starts ? wallClockToInstant(form.starts, form.timezone) : null;
    if (!startsAt) next.starts = "Start required";
    const endsAt = form.ends ? wallClockToInstant(form.ends, form.timezone) : null;
    if (form.ends && !endsAt) next.ends = "Not a valid time";
    else if (startsAt && endsAt && endsAt.getTime() <= startsAt.getTime()) {
      next.ends = "Must be after the start";
    }
    setErrors(next);
    if (next.name || next.starts || next.ends || !startsAt) return;

    const previousLocation = editing
      ? ((mode.event.location ?? null) as EventLocation | null)
      : mode.kind === "duplicate"
        ? ((mode.from.location ?? null) as EventLocation | null)
        : null;
    const input: EventInput = {
      name,
      type: form.type,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt ? endsAt.toISOString() : null,
      timezone: form.timezone,
      location: buildLocation(previousLocation, form.venue, form.address),
      dressCode: form.dressCode.trim() || null,
      description: form.description.trim() || null,
      isPublic: form.isPublic,
    };

    setSaving(true);
    try {
      if (mode.kind === "edit") {
        await updateEvent(weddingId, mode.event.id, mode.event.version, input);
      } else {
        await createEvent(weddingId, {
          ...input,
          // A copy keeps the original's run-of-show (new lines, so each gets its own id).
          ...(mode.kind === "duplicate" && mode.from.schedule.length > 0
            ? {
                schedule: mode.from.schedule.map((item) => ({
                  time: item.time,
                  title: item.title,
                  ...(item.notes ? { notes: item.notes } : {}),
                  isPublic: item.isPublic,
                })),
              }
            : {}),
        });
      }
      toast({
        type: "success",
        title: editing
          ? "Event updated"
          : mode.kind === "duplicate"
            ? "Event duplicated"
            : "Event added",
        message: `${name} is on your timeline.`,
      });
      onSaved();
    } catch (error) {
      setSaving(false);
      toast({
        type: "error",
        title:
          error instanceof ApiError && error.code === "VERSION_CONFLICT"
            ? "Someone else just changed this event"
            : "Couldn't save the event",
        message: errorMessage(error),
      });
    }
  }

  const title = editing
    ? "Edit event"
    : mode.kind === "duplicate"
      ? "Duplicate event"
      : "Add event";
  const subtitle = editing
    ? "Update the details of this ceremony or celebration."
    : mode.kind === "duplicate"
      ? "Review the copy, then save it as a new event."
      : "Add a ceremony or celebration to your wedding schedule.";

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
        aria-labelledby="event-drawer-title"
        className="fixed inset-y-0 right-0 flex w-[480px] max-w-full flex-col border-l border-[#E5DDD2] bg-[#FAF6F0] shadow-2xl"
      >
        <form noValidate onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
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
                  id="event-drawer-title"
                  className="font-headline-sm text-2xl font-medium tracking-tight text-[#2A2622]"
                >
                  {title}
                </h2>
                <p className="pt-0.5 font-body-sm text-body-sm text-on-surface-variant">
                  {subtitle}
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

          <div className="custom-scrollbar flex-1 space-y-6 overflow-y-auto px-7 py-6">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="event-name" className={LABEL}>
                  Event name <span className="text-secondary">*</span>
                </label>
                <Counter error={errors.name} />
              </div>
              <div className="relative">
                <input
                  id="event-name"
                  type="text"
                  autoFocus
                  autoComplete="off"
                  maxLength={120}
                  placeholder="e.g., Sangeet night"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  aria-invalid={Boolean(errors.name)}
                  className={`${FIELD} pr-10 ${errors.name ? "border-error" : ""}`}
                />
                <Icon
                  name="celebration"
                  className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[18px] text-surface-tint"
                />
              </div>
              <p className="font-body-sm text-[12px] text-on-surface-variant">
                Displayed as the primary headline on digital invitations &amp; schedules.
              </p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="event-type" className={LABEL}>
                Event type <span className="text-secondary">*</span>
              </label>
              <div className="relative">
                <select
                  id="event-type"
                  value={form.type}
                  onChange={(e) => set("type", e.target.value as EventType)}
                  className={`${FIELD} cursor-pointer appearance-none`}
                >
                  {EVENT_TYPES.map((value) => (
                    <option key={value} value={value}>
                      {EVENT_TYPE_LABEL[value]}
                    </option>
                  ))}
                </select>
                <Icon
                  name="expand_more"
                  className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-[18px] text-on-surface-variant"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="event-start" className={LABEL}>
                    Starts <span className="text-secondary">*</span>
                  </label>
                  <Counter error={errors.starts} />
                </div>
                <div className="relative">
                  <input
                    id="event-start"
                    type="datetime-local"
                    value={form.starts}
                    onChange={(e) => set("starts", e.target.value)}
                    aria-invalid={Boolean(errors.starts)}
                    className={`${FIELD_SM} ${PICKER} pr-8 pl-3 ${errors.starts ? "border-error" : ""}`}
                  />
                  <Icon
                    name="calendar_today"
                    className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-[16px] text-on-surface-variant"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="event-end"
                    className="block font-label-md text-label-md font-medium text-[#2A2622]"
                  >
                    Ends <span className="font-normal text-on-surface-variant">(optional)</span>
                  </label>
                </div>
                <div className="relative">
                  <input
                    id="event-end"
                    type="datetime-local"
                    value={form.ends}
                    onChange={(e) => set("ends", e.target.value)}
                    aria-invalid={Boolean(errors.ends)}
                    className={`${FIELD_SM} ${PICKER} pr-8 pl-3 ${errors.ends ? "border-error" : ""}`}
                  />
                  <Icon
                    name="schedule"
                    className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-[16px] text-on-surface-variant"
                  />
                </div>
                {errors.ends ? <p className="text-[11px] text-error">{errors.ends}</p> : null}
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="event-timezone" className={LABEL}>
                Timezone
              </label>
              <div className="relative">
                <select
                  id="event-timezone"
                  value={form.timezone}
                  onChange={(e) => set("timezone", e.target.value)}
                  className={`${FIELD_SM} cursor-pointer appearance-none`}
                >
                  {timezoneOptions.map((zone) => (
                    <option key={zone.value} value={zone.value}>
                      {zone.label}
                    </option>
                  ))}
                </select>
                <Icon
                  name="public"
                  className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-[18px] text-on-surface-variant"
                />
              </div>
              <p className="font-body-sm text-[12px] text-on-surface-variant">
                The start and end times above are read in this timezone.
              </p>
            </div>

            <div className="space-y-4 rounded-xl border border-[#2A2622]/[0.08] bg-[#FFFDF9] p-4">
              <div className="flex items-center gap-2 border-b border-[#2A2622]/[0.04] pb-1">
                <Icon name="pin_drop" className="text-[18px] text-[#1F4D3D]" />
                <span className="font-title text-[14px] text-[#2A2622]">Venue &amp; Location</span>
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="event-venue"
                  className="block font-label-md text-label-md font-medium text-[#2A2622]"
                >
                  Venue name
                </label>
                <input
                  id="event-venue"
                  type="text"
                  maxLength={200}
                  autoComplete="off"
                  placeholder="e.g., Grand Ballroom, Marriott Surat"
                  value={form.venue}
                  onChange={(e) => set("venue", e.target.value)}
                  className={INNER_FIELD}
                />
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="event-address"
                  className="block font-label-md text-label-md font-medium text-[#2A2622]"
                >
                  Address
                </label>
                <input
                  id="event-address"
                  type="text"
                  maxLength={200}
                  autoComplete="off"
                  placeholder="e.g., Dumas Road, Piplod, Surat, Gujarat 395007"
                  value={form.address}
                  onChange={(e) => set("address", e.target.value)}
                  className={INNER_FIELD}
                />
                <p className="font-body-sm text-[12px] text-on-surface-variant">
                  Type the full address. Guests get a Google Maps link from it.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="event-dress"
                className="block font-label-md text-label-md font-medium text-[#2A2622]"
              >
                Dress code <span className="font-normal text-on-surface-variant">(optional)</span>
              </label>
              <div className="relative">
                <input
                  id="event-dress"
                  type="text"
                  maxLength={200}
                  autoComplete="off"
                  placeholder="e.g., Indo-Western Glitz & Glam / Formal Indian"
                  value={form.dressCode}
                  onChange={(e) => set("dressCode", e.target.value)}
                  className={`${FIELD} pr-10`}
                />
                <Icon
                  name="apparel"
                  className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[18px] text-on-surface-variant"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="event-description"
                className="block font-label-md text-label-md font-medium text-[#2A2622]"
              >
                Description <span className="font-normal text-on-surface-variant">(optional)</span>
              </label>
              <textarea
                id="event-description"
                rows={4}
                maxLength={2000}
                placeholder="Add details about traditions, schedule, or notes for your guests."
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                className={`${FIELD_SM} resize-none`}
              />
            </div>

            <div className="flex items-start justify-between gap-4 rounded-xl border border-[#2A2622]/[0.08] bg-[#FFFDF9] p-4">
              <div className="space-y-1">
                <label
                  htmlFor="event-public"
                  className="block cursor-pointer font-title text-[14px] font-semibold text-[#2A2622]"
                >
                  Show on wedding website
                </label>
                <p className="font-body-sm text-[12px] leading-relaxed text-on-surface-variant">
                  Visible to anyone with your public website link. Leave off for private family-only
                  rituals.
                </p>
              </div>
              <div className="flex-shrink-0 pt-0.5">
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    id="event-public"
                    type="checkbox"
                    checked={form.isPublic}
                    onChange={(e) => set("isPublic", e.target.checked)}
                    className="peer sr-only"
                  />
                  <div className="h-6 w-11 rounded-full bg-[#E5DDD2] transition-colors after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform after:content-[''] peer-checked:bg-[#1F4D3D] peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-[#B5714A] peer-focus-visible:ring-offset-2" />
                </label>
              </div>
            </div>
          </div>

          <footer className="flex flex-shrink-0 items-center justify-between gap-3 border-t border-[#E8E1D7] bg-[#FAF6F0]/95 px-7 py-4 backdrop-blur-md">
            <div className="flex min-w-0 items-center gap-2 font-body-sm text-body-sm text-on-surface-variant">
              <Icon name="lock" className="shrink-0 text-[16px] text-surface-tint" />
              <span className="truncate">Shared with your team</span>
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
                className="flex shrink-0 items-center gap-2 rounded-xl bg-[#1F4D3D] px-6 py-2.5 font-label-md text-label-md font-medium text-[#FAF6F0] shadow-sm transition-all hover:-translate-y-0.5 hover:bg-[#16382c] focus:ring-2 focus:ring-[#B5714A] focus:ring-offset-2 focus:outline-none active:scale-[0.99] disabled:opacity-70"
              >
                <Icon name="check" className="text-[16px]" />
                {saving ? "Saving..." : "Save event"}
              </button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
}
