"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { EventMenu, type EventMenuItem } from "@/components/events/event-menu";
import {
  deleteStream,
  rotateStreamLink,
  updateStream,
} from "@/components/livestream/livestream-api";
import {
  StreamDrawer,
  type StreamDrawerMode,
  type StreamEventChoice,
} from "@/components/livestream/stream-drawer";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { ApiError, errorMessage } from "@/lib/client/api-client";
import { STREAM_STATUSES, type StreamProvider, type StreamStatus } from "@/lib/constants/enums";
import { formatClock, formatLongDate, timeZoneAbbreviation } from "@/lib/events/format";
import { PROVIDER_LABEL } from "@/lib/livestream/provider";
import { startedAgoLabel, STREAM_STATUS_LABEL } from "@/lib/livestream/view";
import type { StreamDto } from "@/modules/livestream/stream.dto";

// The Live streams manager (Stitch "Live Streams Manager"): one card per stream with its guest
// link and a status the team sets by hand (there are no webhooks), plus an empty-state card for
// the next event without a stream. The video itself plays on YouTube or Vimeo.

const PROVIDER_BADGE: Record<StreamProvider, string> = {
  youtube: "border-[#8b4f2b]/15 bg-[#FAF2EE] text-[#8b4f2b]",
  vimeo: "border-[#1D5E88]/15 bg-[#EAF2F8] text-[#1D5E88]",
  other: "border-[#2A2622]/15 bg-[#F4EFEA] text-[#2A2622]",
};

function whenLabel(stream: StreamDto): string {
  const at = new Date(stream.startTime);
  return `${formatLongDate(at, stream.timezone)}, ${formatClock(at, stream.timezone, false)} ${timeZoneAbbreviation(stream.timezone, at)}`;
}

function shortDay(stream: StreamDto): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: stream.timezone,
  }).format(new Date(stream.startTime));
}

function StatusPill({ status }: { status: StreamStatus }) {
  if (status === "live") {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-emerald-900/15 bg-emerald-50 px-3 py-1">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-primary-container" />
        </span>
        <span className="text-xs font-bold tracking-wide text-primary-container uppercase">
          Live
        </span>
      </div>
    );
  }
  if (status === "scheduled") {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-[#B5714A]/20 bg-[#FAF2EE] px-3 py-1">
        <span className="size-2 rounded-full bg-[#B5714A]" />
        <span className="text-xs font-semibold tracking-wide text-[#A0623C]">Scheduled</span>
      </div>
    );
  }
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-[#2A2622]/[0.08] bg-[#F4EFEA] px-3 py-1">
      <span className="size-2 rounded-full bg-[#686F6A]" />
      <span className="text-xs font-medium text-[#686F6A]">{STREAM_STATUS_LABEL[status]}</span>
    </div>
  );
}

const STATUS_HELP: Record<StreamStatus, string> = {
  scheduled: "Update this yourself when the stream starts or ends.",
  live: "Currently streaming live to guests.",
  ended: "Recording remains available if hosted on the provider.",
  cancelled: "Guests see that this stream was cancelled.",
};

function StreamCard({
  stream,
  now,
  busy,
  onStatus,
  onEdit,
  onDelete,
  onRotate,
}: {
  stream: StreamDto;
  now: number;
  busy: boolean;
  onStatus: (stream: StreamDto, status: StreamStatus) => void;
  onEdit: () => void;
  onDelete: () => void;
  onRotate: () => void;
}) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const closed = stream.status === "ended" || stream.status === "cancelled";
  const live = stream.status === "live";

  async function copy() {
    if (!stream.inviteUrl) return;
    try {
      await navigator.clipboard.writeText(stream.inviteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ type: "warning", title: "Couldn't copy", message: "Select the link and copy it." });
    }
  }

  const menu: EventMenuItem[] = [
    { icon: "edit", label: "Edit stream", onSelect: onEdit },
    ...(stream.inviteUrl
      ? [
          {
            icon: "open_in_new" as const,
            label: "Open guest page",
            onSelect: () => window.open(stream.inviteUrl!, "_blank", "noopener"),
          },
        ]
      : []),
    { icon: "delete", label: "Delete stream", danger: true, onSelect: onDelete },
  ];

  return (
    <article
      aria-label={stream.title}
      className={`relative overflow-hidden rounded-2xl border bg-white p-7 shadow-[0_2px_12px_-2px_rgba(42,38,34,0.04),0_1px_3px_0_rgba(42,38,34,0.02)] transition-all duration-200 hover:shadow-md ${
        live ? "border-emerald-800/10" : "border-[#2A2622]/[0.04]"
      } ${closed ? "opacity-80 hover:opacity-100" : ""}`}
    >
      {live ? <div className="absolute inset-y-0 left-0 w-1.5 bg-primary-container" /> : null}

      <div className="flex items-start justify-between gap-4 border-b border-[#2A2622]/[0.06] pb-6">
        <div className="min-w-0 space-y-2.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="font-headline-sm text-headline-sm font-medium text-[#2A2622]">
              {stream.title}
            </h2>
            {stream.eventName ? (
              <span className="rounded-full bg-[#F4EFEA] px-2.5 py-0.5 text-xs font-medium text-[#2A2622]">
                {stream.eventName}
              </span>
            ) : null}
            <span
              className={`rounded border px-2 py-0.5 text-[11px] font-semibold tracking-wide ${PROVIDER_BADGE[stream.provider]}`}
            >
              {PROVIDER_LABEL[stream.provider]}
            </span>
          </div>
          <div
            className={`flex items-center gap-2 font-body-sm text-body-sm ${
              live ? "font-medium text-[#1F4D3D]" : "text-[#686F6A]"
            }`}
          >
            <Icon
              name={
                live ? "timer" : stream.status === "ended" ? "event_available" : "calendar_today"
              }
              className="text-[18px]"
            />
            <span>
              {live
                ? startedAgoLabel(stream.startTime, new Date(now))
                : stream.status === "ended"
                  ? `Broadcast completed on ${shortDay(stream)}`
                  : stream.status === "cancelled"
                    ? `Was planned for ${shortDay(stream)}`
                    : whenLabel(stream)}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <StatusPill status={stream.status} />
          <EventMenu eventName={stream.title} items={menu} trigger="horizontal" />
        </div>
      </div>

      <div className="space-y-2 border-b border-[#2A2622]/[0.06] py-6">
        <p className="text-xs font-semibold tracking-wider text-[#686F6A] uppercase">
          {closed ? "Archived stream link" : "Guest shareable link"}
        </p>
        {stream.inviteUrl ? (
          <>
            <div className="flex items-center gap-3">
              <div className="relative flex min-w-0 flex-1 items-center">
                <Icon
                  name="link"
                  className="pointer-events-none absolute left-3 text-[18px] text-[#686F6A]"
                />
                <input
                  readOnly
                  aria-label={`Guest link for ${stream.title}`}
                  value={stream.inviteUrl.replace(/^https?:\/\//, "")}
                  onFocus={(event) => event.currentTarget.select()}
                  className="w-full rounded-lg border border-[#2A2622]/10 bg-[#FAF6F0] py-2.5 pr-4 pl-10 font-mono text-xs text-[#2A2622] select-all focus:border-primary-container focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => void copy()}
                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[#2A2622]/15 px-4 py-2.5 text-xs font-semibold text-[#2A2622] transition-colors hover:bg-[#FAF6F0] active:scale-[0.98]"
              >
                <Icon name={copied ? "check" : "content_copy"} className="text-[16px]" />
                <span className={copied ? "text-primary-container" : ""}>
                  {copied ? "Copied!" : "Copy link"}
                </span>
              </button>
            </div>
            {!closed ? (
              <div className="flex items-center gap-2 pt-1 text-xs">
                <button
                  type="button"
                  onClick={onRotate}
                  className="flex items-center gap-1 font-semibold text-primary-container hover:underline"
                >
                  <Icon name="refresh" className="text-[16px]" />
                  <span>Generate new link</span>
                </button>
                <span className="text-[#686F6A]">• The old link stops working immediately.</span>
              </div>
            ) : null}
          </>
        ) : (
          <div className="flex items-center gap-3 rounded-lg bg-[#FAF6F0] p-3">
            <p className="flex-1 font-body-sm text-body-sm text-[#686F6A]">
              This stream&apos;s link can&apos;t be shown any more. Make a new one to share.
            </p>
            <button
              type="button"
              onClick={onRotate}
              className="rounded-lg bg-primary-container px-3.5 py-2 text-xs font-semibold text-[#FAF6F0]"
            >
              Generate new link
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col justify-between gap-4 pt-6 md:flex-row md:items-center">
        <div>
          <span className="block text-xs font-semibold tracking-wider text-[#2A2622] uppercase">
            Stream status
          </span>
          <p className="mt-0.5 text-xs text-[#686F6A]">{STATUS_HELP[stream.status]}</p>
        </div>
        <div
          role="radiogroup"
          aria-label={`Status of ${stream.title}`}
          className="inline-flex rounded-xl border border-[#2A2622]/[0.04] bg-[#F4EFEA] p-1"
        >
          {STREAM_STATUSES.map((status) => {
            const selected = stream.status === status;
            return (
              <button
                key={status}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={busy}
                onClick={() => onStatus(stream, status)}
                className={`rounded-lg px-4 py-1.5 text-xs transition-colors disabled:opacity-60 ${
                  selected
                    ? status === "live"
                      ? "bg-primary-container font-semibold text-[#FAF6F0] shadow-sm"
                      : "bg-white font-semibold text-primary-container shadow-xs"
                    : "font-medium text-[#686F6A] hover:text-[#2A2622]"
                }`}
              >
                {STREAM_STATUS_LABEL[status]}
              </button>
            );
          })}
        </div>
      </div>
    </article>
  );
}

export function StreamsManager({
  weddingId,
  timezone,
  streams,
  events,
  nowIso,
}: {
  weddingId: string;
  timezone: string;
  streams: StreamDto[];
  events: StreamEventChoice[];
  nowIso: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [drawer, setDrawer] = useState<StreamDrawerMode | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<StreamDto | null>(null);
  const [pendingRotate, setPendingRotate] = useState<StreamDto | null>(null);
  const [working, setWorking] = useState(false);
  const [now, setNow] = useState(() => new Date(nowIso).getTime());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const linked = new Set(streams.flatMap((stream) => (stream.eventId ? [stream.eventId] : [])));
  const nextWithoutStream = events.find((event) => !linked.has(event.id));

  async function setStatus(stream: StreamDto, status: StreamStatus) {
    if (status === stream.status) return;
    setBusyId(stream.id);
    try {
      await updateStream(weddingId, stream.id, stream.version, { status });
      toast({
        type: "success",
        title:
          status === "live"
            ? "Stream is live"
            : `Marked as ${STREAM_STATUS_LABEL[status].toLowerCase()}`,
        message:
          status === "live" ? "Guests who open the link will now see the video." : stream.title,
      });
      router.refresh();
    } catch (error) {
      toast({
        type: "error",
        title:
          error instanceof ApiError && error.code === "VERSION_CONFLICT"
            ? "Updated elsewhere"
            : "Couldn't change the status",
        message: errorMessage(error),
      });
      if (error instanceof ApiError && error.code === "VERSION_CONFLICT") router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setWorking(true);
    try {
      await deleteStream(weddingId, pendingDelete.id);
      toast({
        type: "success",
        title: "Stream deleted",
        message: "Its guest link no longer works.",
      });
      setPendingDelete(null);
      router.refresh();
    } catch (error) {
      toast({ type: "error", title: "Couldn't delete the stream", message: errorMessage(error) });
    } finally {
      setWorking(false);
    }
  }

  async function confirmRotate() {
    if (!pendingRotate) return;
    setWorking(true);
    try {
      await rotateStreamLink(weddingId, pendingRotate.id);
      toast({
        type: "success",
        title: "New link ready",
        message: "The old link no longer works. Share the new one.",
      });
      setPendingRotate(null);
      router.refresh();
    } catch (error) {
      toast({ type: "error", title: "Couldn't make a new link", message: errorMessage(error) });
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-headline-lg font-normal tracking-tight text-[#2A2622]">
            Live stream
          </h1>
          <p className="mt-1 font-body-md text-body-md text-[#686F6A]">
            Share a link so family who can&apos;t attend can watch.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDrawer({ kind: "add" })}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-container px-5 py-2.5 text-sm font-medium text-[#FAF6F0] shadow-sm transition-all duration-150 hover:bg-[#163A2E] focus:ring-2 focus:ring-[#B5714A]/40 focus:outline-none active:scale-[0.99]"
        >
          <Icon name="add" />
          <span>Add stream</span>
        </button>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-emerald-900/10 bg-emerald-50/70 px-5 py-3.5 font-body-sm text-body-sm">
        <Icon name="info" className="text-primary-container" />
        <p className="leading-relaxed text-[#1F4D3D]">
          Make My Marriage shares your stream link. The video itself plays on YouTube or Vimeo, so
          set its privacy there too.
        </p>
      </div>

      {streams.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-[#2A2622]/20 bg-[#FAF6F0]/50 px-8 py-14 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-[#F2ECE3] text-[#686F6A]">
            <Icon name="videocam_off" className="text-[24px]" />
          </div>
          <div>
            <p className="font-headline-sm text-headline-sm font-medium text-[#2A2622]">
              No streams yet
            </p>
            <p className="mx-auto mt-1 max-w-md text-xs text-[#686F6A]">
              Add the YouTube or Vimeo link for a function and share the watch page with relatives
              who can&apos;t be there in person.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDrawer({ kind: "add", eventId: nextWithoutStream?.id ?? null })}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary-container px-5 py-2.5 text-sm font-medium text-[#FAF6F0] shadow-sm hover:bg-[#163A2E]"
          >
            <Icon name="add" />
            Add your first stream
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {streams.map((stream) => (
            <StreamCard
              key={stream.id}
              stream={stream}
              now={now}
              busy={busyId === stream.id}
              onStatus={(item, status) => void setStatus(item, status)}
              onEdit={() => setDrawer({ kind: "edit", stream })}
              onDelete={() => setPendingDelete(stream)}
              onRotate={() => setPendingRotate(stream)}
            />
          ))}
          {nextWithoutStream ? (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-dashed border-[#2A2622]/20 bg-[#FAF6F0]/50 p-8 transition-all hover:border-[#2A2622]/30 hover:bg-[#FAF6F0]">
              <div className="flex items-center gap-4">
                <div className="flex size-10 items-center justify-center rounded-full bg-[#F2ECE3] text-[#686F6A]">
                  <Icon name="videocam_off" />
                </div>
                <div>
                  <p className="font-headline-sm text-headline-sm font-medium text-[#2A2622]">
                    No stream for {nextWithoutStream.name} yet
                  </p>
                  <p className="mt-0.5 text-xs text-[#686F6A]">
                    Add a link ahead of time so remote guests have one place to watch.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDrawer({ kind: "add", eventId: nextWithoutStream.id })}
                className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-primary-container transition-colors hover:bg-emerald-950/[0.05] focus:outline-none"
              >
                <Icon name="add" />
                <span>Add stream</span>
              </button>
            </div>
          ) : null}
        </div>
      )}

      {drawer ? (
        <StreamDrawer
          key={drawer.kind === "edit" ? drawer.stream.id : "new"}
          weddingId={weddingId}
          mode={drawer}
          timezone={timezone}
          events={events}
          onClose={() => setDrawer(null)}
        />
      ) : null}

      {pendingDelete ? (
        <ConfirmDialog
          title="Delete this stream?"
          confirmLabel="Delete stream"
          danger
          busy={working}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setPendingDelete(null)}
        >
          &ldquo;{pendingDelete.title}&rdquo; is removed and its guest link stops working at once.
          The video on YouTube or Vimeo is not touched.
        </ConfirmDialog>
      ) : null}

      {pendingRotate ? (
        <ConfirmDialog
          title="Generate a new link?"
          confirmLabel="Generate new link"
          busy={working}
          onConfirm={() => void confirmRotate()}
          onCancel={() => setPendingRotate(null)}
        >
          The link you already shared stops working immediately, so anyone who has it will see
          &ldquo;This link isn&apos;t working&rdquo;. You&apos;ll need to send the new link.
        </ConfirmDialog>
      ) : null}
    </div>
  );
}
