"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DrawerShell } from "@/components/finance/drawer-shell";
import { FIELD, LABEL, SelectField } from "@/components/finance/ui";
import { DateTimeField } from "@/components/ui/date-time-field";
import {
  createStream,
  updateStream,
  type StreamInput,
} from "@/components/livestream/livestream-api";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { ApiError, errorMessage } from "@/lib/client/api-client";
import {
  STREAM_PROVIDERS,
  STREAM_STATUSES,
  type StreamProvider,
  type StreamStatus,
} from "@/lib/constants/enums";
import { MAX_STREAM_DESCRIPTION, MAX_STREAM_TITLE } from "@/lib/constants/website";
import { timeZoneAbbreviation } from "@/lib/events/format";
import { checkStreamUrl, PROVIDER_LABEL } from "@/lib/livestream/provider";
import { STREAM_STATUS_LABEL } from "@/lib/livestream/view";
import { instantToWallClock, wallClockToInstant } from "@/lib/zoned-time";
import type { StreamDto } from "@/modules/livestream/stream.dto";

// The "Add stream" / "Edit stream" slide-over (Stitch "Add Stream (Slide-over)"): title, event,
// platform, link, start, description, status, and the guest link once it exists.

export interface StreamEventChoice {
  id: string;
  name: string;
  timezone: string;
}

export type StreamDrawerMode =
  { kind: "add"; eventId?: string | null } | { kind: "edit"; stream: StreamDto };

interface FormState {
  title: string;
  eventId: string;
  provider: StreamProvider;
  url: string;
  start: string;
  description: string;
  status: StreamStatus;
}

function initialForm(
  mode: StreamDrawerMode,
  timezone: string,
  events: StreamEventChoice[],
): FormState {
  if (mode.kind === "edit") {
    const { stream } = mode;
    return {
      title: stream.title,
      eventId: stream.eventId ?? "",
      provider: stream.provider,
      url: stream.streamUrl,
      start: instantToWallClock(new Date(stream.startTime), stream.timezone),
      description: stream.description ?? "",
      status: stream.status,
    };
  }
  const event = events.find((choice) => choice.id === mode.eventId);
  return {
    title: event ? `${event.name} live` : "",
    eventId: event?.id ?? "",
    provider: "youtube",
    url: "",
    start: "",
    description: "",
    status: "scheduled",
  };
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  columns,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  columns: string;
}) {
  return (
    <div className="space-y-1.5">
      <span id={`seg-${label}`} className={LABEL}>
        {label}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={`seg-${label}`}
        className={`grid gap-1 rounded-lg bg-[#F4EFEA] p-1 ${columns}`}
      >
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option.value)}
              className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-2 font-label-md text-label-md transition-all ${
                selected
                  ? "bg-[#1F4D3D] font-semibold text-[#FAF6F0] shadow-sm"
                  : "text-[#2A2622] hover:text-primary"
              }`}
            >
              {selected && option.value === "youtube" ? (
                <span className="size-2 rounded-full bg-emerald-300" />
              ) : null}
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function StreamDrawer({
  weddingId,
  mode,
  timezone,
  events,
  onClose,
}: {
  weddingId: string;
  mode: StreamDrawerMode;
  /** The wedding's timezone: where a stream with no event takes its time from. */
  timezone: string;
  events: StreamEventChoice[];
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const editing = mode.kind === "edit";
  const [form, setForm] = useState(() => initialForm(mode, timezone, events));
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [copied, setCopied] = useState(false);

  const linkedEvent = events.find((event) => event.id === form.eventId);
  const zone = linkedEvent?.timezone ?? (editing ? mode.stream.timezone : timezone);
  const zoneName = timeZoneAbbreviation(zone, new Date());

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  // Tell the person at once when the link doesn't belong to the chosen platform.
  const urlCheck = form.url.trim() ? checkStreamUrl(form.provider, form.url) : null;
  const urlWarning = urlCheck && !urlCheck.ok ? urlCheck.message : null;

  function validate(): StreamInput | null {
    const next: typeof errors = {};
    if (!form.title.trim()) next.title = "Give the stream a title.";
    if (!form.url.trim()) next.url = "Paste the stream link.";
    else if (urlWarning) next.url = urlWarning;
    const start = form.start ? wallClockToInstant(form.start, zone) : null;
    if (!start) next.start = "Choose when the stream starts.";
    setErrors(next);
    if (Object.keys(next).length > 0 || !start) return null;
    return {
      eventId: form.eventId || null,
      provider: form.provider,
      streamUrl: form.url.trim(),
      title: form.title.trim(),
      description: form.description.trim() || null,
      startTime: start.toISOString(),
      status: form.status,
    };
  }

  async function submit() {
    const input = validate();
    if (!input) return;
    setSaving(true);
    try {
      if (mode.kind === "edit") {
        await updateStream(weddingId, mode.stream.id, mode.stream.version, input);
        toast({ type: "success", title: "Stream saved", message: input.title });
      } else {
        await createStream(weddingId, input);
        toast({
          type: "success",
          title: "Stream added",
          message: "Copy its guest link from the card and share it.",
        });
      }
      router.refresh();
      onClose();
    } catch (error) {
      setSaving(false);
      if (error instanceof ApiError && error.code === "VALIDATION_ERROR") {
        const detail = (error.details as { path?: string; message?: string }[] | undefined)?.[0];
        if (detail?.path === "streamUrl") {
          setErrors({ url: detail.message ?? error.message });
          return;
        }
      }
      toast({
        type: "error",
        title:
          error instanceof ApiError && error.code === "VERSION_CONFLICT"
            ? "Updated elsewhere"
            : "Couldn't save the stream",
        message: errorMessage(error),
      });
    }
  }

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ type: "warning", title: "Couldn't copy", message: "Select the link and copy it." });
    }
  }

  const inviteUrl = editing ? mode.stream.inviteUrl : null;

  return (
    <DrawerShell
      id="stream-drawer"
      title={editing ? "Edit stream" : "Add stream"}
      subtitle="Set up a live stream link for remote guests and relatives."
      saveLabel="Save stream"
      saving={saving}
      widthClass="w-[480px]"
      onClose={onClose}
      onSubmit={() => void submit()}
    >
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="stream-title" className={LABEL}>
            Stream title
          </label>
          <span className="font-label-sm text-label-sm text-on-surface-variant">
            {form.title.length} / {MAX_STREAM_TITLE}
          </span>
        </div>
        <input
          id="stream-title"
          autoFocus
          value={form.title}
          maxLength={MAX_STREAM_TITLE}
          aria-invalid={Boolean(errors.title)}
          onChange={(event) => set("title", event.target.value)}
          className={`${FIELD} ${errors.title ? "border-error" : ""}`}
        />
        {errors.title ? (
          <p role="alert" className="font-body-sm text-body-sm text-error">
            {errors.title}
          </p>
        ) : (
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Displayed as the main headline on the watch page your guests open.
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="stream-event" className={LABEL}>
          Event
        </label>
        <SelectField
          id="stream-event"
          value={form.eventId}
          onChange={(value) => set("eventId", value)}
        >
          <option value="">Not linked to an event</option>
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.name}
            </option>
          ))}
        </SelectField>
      </div>

      <Segmented
        label="Platform"
        value={form.provider}
        columns="grid-cols-3"
        options={STREAM_PROVIDERS.map((provider) => ({
          value: provider,
          label: PROVIDER_LABEL[provider],
        }))}
        onChange={(value) => set("provider", value)}
      />

      <div className="space-y-1.5">
        <label htmlFor="stream-link" className={LABEL}>
          Stream link
        </label>
        <div className="relative">
          <Icon
            name="link"
            className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-[18px] text-on-surface-variant"
          />
          <input
            id="stream-link"
            type="url"
            inputMode="url"
            autoComplete="off"
            placeholder="https://"
            value={form.url}
            aria-invalid={Boolean(errors.url) || Boolean(urlWarning)}
            onChange={(event) => set("url", event.target.value)}
            className={`${FIELD} pl-10 ${errors.url || urlWarning ? "border-[#C25443]" : ""}`}
          />
        </div>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Paste the link from YouTube or Vimeo. It must start with https://
        </p>
        {urlWarning || errors.url ? (
          <div
            role="alert"
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-[#C25443]/20 bg-[#C25443]/10 px-3 py-1.5 text-[#B4412F]"
          >
            <Icon name="warning" className="text-[16px]" />
            <span className="font-label-sm text-label-sm font-medium tracking-normal">
              {urlWarning ?? errors.url}
            </span>
          </div>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="stream-start" className={LABEL}>
          Start date and time
        </label>
        <DateTimeField
          id="stream-start"
          value={form.start}
          onChange={(value) => set("start", value)}
          invalid={Boolean(errors.start)}
          defaultTime="18:00"
          timeLabel="Start time"
          title="Stream start date"
        />
        {errors.start ? (
          <p role="alert" className="font-body-sm text-body-sm text-error">
            {errors.start}
          </p>
        ) : (
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Times shown in {zone.replace("_", " ")} ({zoneName})
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="stream-description" className={`${LABEL} flex items-center gap-1.5`}>
            Description
            <span className="font-label-sm text-label-sm font-normal text-on-surface-variant italic">
              (optional)
            </span>
          </label>
          <span className="font-label-sm text-label-sm text-on-surface-variant">
            {form.description.length} / {MAX_STREAM_DESCRIPTION}
          </span>
        </div>
        <textarea
          id="stream-description"
          rows={3}
          value={form.description}
          maxLength={MAX_STREAM_DESCRIPTION}
          onChange={(event) => set("description", event.target.value)}
          className={`${FIELD} resize-none`}
        />
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Shown to guests on the watch page.
        </p>
      </div>

      <Segmented
        label="Status"
        value={form.status}
        columns="grid-cols-4"
        options={STREAM_STATUSES.map((status) => ({
          value: status,
          label: STREAM_STATUS_LABEL[status],
        }))}
        onChange={(value) => set("status", value)}
      />

      <div className="space-y-3 rounded-xl border border-[#2A2622]/[0.08] bg-[#FBF8F4] p-4">
        <div className="flex items-center justify-between">
          <span className="font-label-md text-label-md font-semibold text-primary">
            Generated guest link
          </span>
          <span className="rounded bg-[#1F4D3D]/10 px-2 py-0.5 font-label-sm text-label-sm font-medium text-[#1F4D3D]">
            {inviteUrl ? "Ready" : "On save"}
          </span>
        </div>
        {inviteUrl ? (
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1 truncate rounded-lg border border-[#2A2622]/[0.12] bg-[#FFFDF9] px-3 py-2 font-mono text-body-sm text-on-surface select-all">
              {inviteUrl.replace(/^https?:\/\//, "")}
            </div>
            <button
              type="button"
              onClick={() => void copyLink(inviteUrl)}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[#2A2622]/[0.18] px-3.5 py-2 font-label-md text-label-md text-on-surface transition-colors hover:bg-[#F4EFEA]"
            >
              <Icon name={copied ? "check" : "content_copy"} className="text-[16px]" />
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
        ) : (
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            The guest link is created as soon as you save the stream.
          </p>
        )}
        <div className="flex items-start gap-1.5 text-on-surface-variant">
          <Icon name="lock_open" className="mt-0.5 text-[16px]" />
          <p className="font-body-sm text-body-sm">
            Anyone who has this link can open the watch page.
          </p>
        </div>
      </div>
    </DrawerShell>
  );
}
