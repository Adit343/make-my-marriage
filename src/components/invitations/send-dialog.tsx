"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ensureGuestLink, sendBatch, sendOne } from "@/components/invitations/invitations-api";
import { Icon, type IconName } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { useDialogFocus } from "@/components/ui/use-dialog-focus";
import { errorMessage } from "@/lib/client/api-client";
import type { InviteChannel } from "@/lib/constants/enums";
import { MAX_BATCH_GUESTS } from "@/lib/constants/invitations";
import type { SendKind } from "@/lib/invitations/messages";
import { initialsOf } from "@/lib/text/initials";
import type {
  SendResultItem,
  SendSummary,
} from "@/modules/guest-invitations/guest-invitation.service";

// Stitch "Send Invitations Dialog": pick a channel, check every recipient, send, and read the
// dispatch summary beside it. The same dialog sends first invitations and RSVP reminders.
//   Email     the app sends it; each failure is shown and can be retried.
//   WhatsApp  the app only prepares a pre-filled message per guest; the member opens it and presses
//             Send themselves (there is no WhatsApp API), and opening it records the guest.
//   Mark as invited  "I told them in person".

/** What the dialog needs to know about a guest, from whichever screen opened it. */
export interface SendGuest {
  id: string;
  name: string;
  /** "College friend", the group, or whatever helps tell people apart. */
  label: string | null;
  email: string | null;
  phone: string | null;
  /** How many events they are invited to; null when the caller doesn't know. */
  eventCount: number | null;
  /** Whether they were invited already (a reminder needs that); undefined when the caller doesn't know. */
  invited?: boolean;
}

const AVATAR_TONES = [
  "bg-primary-fixed text-primary",
  "bg-secondary-fixed text-secondary",
  "bg-surface-variant text-on-surface-variant",
];

const CHANNELS: {
  value: InviteChannel;
  icon: IconName;
  title: string;
  hint: string;
  requirement: string;
}[] = [
  {
    value: "email",
    icon: "mail",
    title: "Email",
    hint: "Sent automatically via email",
    requirement: "Channel requirement: a valid email address",
  },
  {
    value: "whatsapp",
    icon: "chat",
    title: "WhatsApp",
    hint: "Opens pre-filled message for you to send",
    requirement: "Channel requirement: a phone number",
  },
  {
    value: "manual",
    icon: "fact_check",
    title: "Mark as invited",
    hint: "You already invited them in person",
    requirement: "No contact details needed",
  },
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Why this guest would be skipped on this channel, or null if they're fine. */
export function skipWarning(
  guest: SendGuest,
  channel: InviteChannel,
  kind: SendKind,
): string | null {
  if (kind === "invitation" && guest.eventCount === 0) {
    return "Not invited to any event, will be skipped";
  }
  if (kind === "reminder" && guest.invited === false) return "Not invited yet, will be skipped";
  if (channel === "email") {
    if (!guest.email) return "No email on file, will be skipped";
    if (!EMAIL_PATTERN.test(guest.email)) return "Email looks invalid, will be skipped";
  }
  if (channel === "whatsapp" && !guest.phone) return "No phone on file, will be skipped";
  return null;
}

const OUTCOME_COPY: Record<
  SendResultItem["outcome"],
  { label: string; icon: IconName; tone: string }
> = {
  sent: { label: "Sent", icon: "check", tone: "bg-primary-fixed text-primary" },
  marked: { label: "Marked", icon: "check", tone: "bg-primary-fixed text-primary" },
  prepared: { label: "Ready", icon: "chat", tone: "bg-secondary-fixed text-secondary" },
  failed: { label: "Failed", icon: "error", tone: "bg-error-container text-error" },
  skipped: { label: "Skipped", icon: "block", tone: "bg-surface-variant text-on-surface-variant" },
};

export function SendDialog({
  weddingId,
  kind,
  guests,
  extraCount = 0,
  initialChannel = "email",
  canViewLog,
  onClose,
  onSent,
}: {
  weddingId: string;
  kind: SendKind;
  guests: SendGuest[];
  /** Guests the screen selected beyond what one send can carry (the dialog says so). */
  extraCount?: number;
  initialChannel?: InviteChannel;
  /** Owners and admins can open the delivery log. */
  canViewLog: boolean;
  onClose: () => void;
  /** Called after anything was recorded, so the screen behind can refresh. */
  onSent: () => void;
}) {
  const toast = useToast();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef);

  const [channel, setChannel] = useState<InviteChannel>(initialChannel);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<SendSummary | null>(null);
  const [opened, setOpened] = useState<Set<string>>(new Set());
  const [retrying, setRetrying] = useState(false);

  const shown = guests.slice(0, MAX_BATCH_GUESTS);
  const leftOut = Math.max(0, guests.length - shown.length) + extraCount;
  const noun = kind === "reminder" ? "reminder" : "invitation";

  const checks = useMemo(
    () => shown.map((guest) => ({ guest, warning: skipWarning(guest, channel, kind) })),
    [shown, channel, kind],
  );
  const sendable = checks.filter((check) => !check.warning).length;
  const skipped = checks.length - sendable;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const infoByGuest = useMemo(() => new Map(guests.map((guest) => [guest.id, guest])), [guests]);

  async function run(ids: string[], batchId?: string) {
    const result = await sendBatch(weddingId, { guestIds: ids, channel, kind, batchId });
    setSummary(result);
    onSent();
    return result;
  }

  async function send() {
    setBusy(true);
    try {
      await run(shown.map((guest) => guest.id));
    } catch (error) {
      toast({ type: "error", title: "Couldn't send", message: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  async function retryFailed() {
    if (!summary || summary.failedGuestIds.length === 0) return;
    setRetrying(true);
    try {
      // The same batch id: guests who were delivered are never emailed again.
      const retried = await sendBatch(weddingId, {
        guestIds: summary.failedGuestIds,
        channel,
        kind,
        batchId: summary.batchId,
      });
      // Fold the new results into the summary the member is looking at.
      const byId = new Map(retried.results.map((item) => [item.guestId, item]));
      const merged = summary.results.map((item) => byId.get(item.guestId) ?? item);
      const count = (outcome: SendResultItem["outcome"]) =>
        merged.filter((item) => item.outcome === outcome).length;
      setSummary({
        ...summary,
        results: merged,
        sent: count("sent"),
        failed: count("failed"),
        skipped: count("skipped"),
        marked: count("marked"),
        prepared: count("prepared"),
        failedGuestIds: merged.filter((item) => item.outcome === "failed").map((i) => i.guestId),
      });
      onSent();
    } catch (error) {
      toast({ type: "error", title: "Couldn't retry", message: errorMessage(error) });
    } finally {
      setRetrying(false);
    }
  }

  async function openWhatsapp(item: SendResultItem) {
    // The link itself opens in a new tab; this records that the member opened it.
    setOpened((current) => new Set(current).add(item.guestId));
    try {
      await sendOne(weddingId, item.guestId, { channel: "whatsapp", kind });
      onSent();
    } catch (error) {
      toast({ type: "error", title: "Couldn't record that", message: errorMessage(error) });
    }
  }

  async function copyLink(guestId: string) {
    try {
      const { inviteUrl } = await ensureGuestLink(weddingId, guestId);
      await navigator.clipboard.writeText(inviteUrl);
      toast({
        type: "success",
        title: "Link copied",
        message: "Share it with the guest yourself.",
      });
    } catch (error) {
      toast({ type: "error", title: "Couldn't copy the link", message: errorMessage(error) });
    }
  }

  const heading = kind === "reminder" ? "Send RSVP reminders" : "Send invitations";
  const buttonLabel =
    channel === "manual"
      ? `Mark ${sendable} as invited`
      : channel === "whatsapp"
        ? `Prepare ${sendable} ${sendable === 1 ? "message" : "messages"}`
        : `Send ${sendable} ${sendable === 1 ? noun : `${noun}s`}`;

  const sentCount = summary ? summary.sent + summary.marked + summary.prepared : 0;
  const bar = summary
    ? [
        { key: "ok", width: sentCount, className: "bg-primary-container", title: "Done" },
        { key: "failed", width: summary.failed, className: "bg-error", title: "Failed" },
        {
          key: "skipped",
          width: summary.skipped,
          className: "bg-outline-variant",
          title: "Skipped",
        },
      ]
    : [];
  const barTotal = bar.reduce((sum, part) => sum + part.width, 0) || 1;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-inverse-surface/40 backdrop-blur-[4px]">
      <div
        className="absolute inset-0"
        onMouseDown={() => {
          if (!busy) onClose();
        }}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative mx-auto flex min-h-full w-full max-w-6xl flex-col items-center justify-center gap-6 p-4 md:p-8 lg:flex-row lg:items-start"
      >
        <section className="flex w-full max-w-[560px] flex-col overflow-hidden rounded-2xl border border-on-surface/10 bg-surface-container-lowest shadow-[0_24px_48px_-8px_rgba(42,38,34,0.14),0_4px_12px_rgba(42,38,34,0.06)]">
          <div className="flex items-start justify-between border-b border-on-surface/[0.06] bg-surface/50 px-7 pt-7 pb-5">
            <div>
              <h2
                id={titleId}
                className="font-headline-md text-headline-md font-medium tracking-tight text-primary"
              >
                {heading}
              </h2>
              <p className="mt-1 flex items-center gap-1.5 font-body-sm text-body-sm text-on-surface-variant">
                <span className="inline-block h-2 w-2 rounded-full bg-secondary" />
                <span>
                  {guests.length + extraCount}{" "}
                  {guests.length + extraCount === 1 ? "guest" : "guests"} selected from your list.
                </span>
              </p>
            </div>
            <button
              type="button"
              aria-label="Close dialog"
              onClick={onClose}
              disabled={busy}
              className="flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant transition-colors duration-150 hover:bg-surface-container hover:text-on-surface"
            >
              <Icon name="close" className="text-[20px]" />
            </button>
          </div>

          <div className="space-y-6 bg-surface-container-lowest px-7 py-6">
            <div>
              <p className="mb-2.5 font-label-md text-label-md tracking-wide text-on-surface-variant uppercase">
                Delivery channel
              </p>
              <div
                role="radiogroup"
                aria-label="Delivery channel"
                className="grid grid-cols-1 gap-3 sm:grid-cols-3"
              >
                {CHANNELS.map((option) => {
                  const selected = channel === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={busy || summary !== null}
                      onClick={() => setChannel(option.value)}
                      className={`group relative flex flex-col justify-between rounded-xl p-3.5 text-left transition-all duration-150 focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:outline-hidden disabled:cursor-default ${
                        selected
                          ? "border-2 border-primary-container bg-primary-fixed/20 shadow-sm"
                          : "border border-on-surface/15 bg-surface hover:border-on-surface/30 hover:bg-surface-container-low disabled:opacity-60"
                      }`}
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                            selected
                              ? "bg-primary-container text-on-primary"
                              : "bg-surface-container text-on-surface-variant group-hover:text-primary"
                          }`}
                        >
                          <Icon name={option.icon} className="text-[18px]" />
                        </div>
                        {selected ? (
                          <Icon name="check_circle" className="text-[20px] text-primary" />
                        ) : (
                          <div className="h-4 w-4 rounded-full border border-on-surface/30" />
                        )}
                      </div>
                      <div>
                        <span
                          className={`block font-title text-[15px] leading-tight font-semibold ${selected ? "text-primary" : "text-on-surface"}`}
                        >
                          {option.title}
                        </span>
                        <span className="mt-1 block font-body-sm text-[11px] leading-snug text-on-surface-variant">
                          {option.hint}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="mb-2.5 flex items-center justify-between gap-3">
                <p className="font-label-md text-label-md tracking-wide text-on-surface-variant uppercase">
                  Recipient verification ({shown.length})
                </p>
                <span className="text-right font-label-sm text-label-sm text-outline">
                  {CHANNELS.find((option) => option.value === channel)?.requirement}
                </span>
              </div>
              <ul className="custom-scrollbar max-h-64 divide-y divide-on-surface/[0.06] overflow-y-auto rounded-xl border border-on-surface/10 bg-surface">
                {checks.map(({ guest, warning }, index) => (
                  <li
                    key={guest.id}
                    className={`flex items-center justify-between gap-3 p-3.5 ${warning ? "bg-surface-container-low/40" : ""}`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold tracking-wider ${AVATAR_TONES[index % AVATAR_TONES.length]}`}
                      >
                        {initialsOf(guest.name)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-title text-[14px] font-semibold text-on-surface">
                            {guest.name}
                          </span>
                          {guest.label ? (
                            <span className="hidden text-[12px] text-on-surface-variant sm:inline">
                              • {guest.label}
                            </span>
                          ) : null}
                        </div>
                        <span
                          className={`block truncate text-[13px] ${
                            warning && channel !== "manual"
                              ? "text-[12px] text-secondary italic"
                              : "text-on-surface-variant"
                          }`}
                        >
                          {channel === "whatsapp"
                            ? (guest.phone ?? "No phone on file")
                            : channel === "email"
                              ? (guest.email ?? "No email on file")
                              : (guest.email ?? guest.phone ?? "No contact details")}
                        </span>
                      </div>
                    </div>
                    {warning ? (
                      <div className="flex shrink-0 items-center gap-1.5 rounded-md border border-secondary/20 bg-secondary-container/30 px-2.5 py-1 text-on-secondary-container">
                        <Icon name="warning" className="text-[15px] text-secondary" />
                        <span className="max-w-[170px] text-right font-label-sm text-label-sm font-semibold text-secondary">
                          {warning}
                        </span>
                      </div>
                    ) : (
                      <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-primary-fixed/40 px-2.5 py-1 text-primary">
                        <Icon name="check_circle" className="text-[16px]" />
                        <span className="font-label-md text-[11px]">Valid</span>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              {leftOut > 0 ? (
                <p className="mt-2 font-body-sm text-[12px] text-on-surface-variant">
                  One send carries up to {MAX_BATCH_GUESTS} guests. {leftOut} more{" "}
                  {leftOut === 1 ? "guest isn't" : "guests aren't"} included: send again for the
                  rest.
                </p>
              ) : null}
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-on-surface/5 bg-surface-container-low p-3.5">
              <Icon name="verified_user" className="mt-0.5 text-[20px] text-primary" />
              <p className="text-[13px] leading-relaxed text-on-surface-variant">
                Each guest receives a unique, secure RSVP link. No account or password required.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-on-surface/[0.06] bg-surface px-7 py-4">
            <div className="flex items-center gap-1.5 font-body-sm text-body-sm text-on-surface-variant">
              <Icon name="info" className="text-[16px] text-secondary" />
              <span>
                {summary
                  ? "Done. You can close this window."
                  : skipped === 0
                    ? "Everyone can be reached"
                    : `${skipped} ${skipped === 1 ? "guest" : "guests"} will be skipped`}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="rounded-lg border border-on-surface/20 px-4 py-2.5 font-body-md text-body-md font-medium text-on-surface transition-all duration-150 hover:bg-surface-container active:scale-[0.99]"
              >
                {summary ? "Close" : "Cancel"}
              </button>
              {summary ? null : (
                <button
                  type="button"
                  onClick={send}
                  disabled={busy || sendable === 0}
                  className="flex items-center gap-2 rounded-lg bg-primary-container px-5 py-2.5 font-body-md text-body-md font-semibold text-on-primary shadow-sm transition-all duration-150 hover:bg-primary hover:shadow active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span>{busy ? "Working…" : buttonLabel}</span>
                  {busy ? null : <span className="text-primary-fixed">→</span>}
                </button>
              )}
            </div>
          </div>
        </section>

        {summary ? (
          <aside
            aria-labelledby={`${titleId}-summary`}
            className="flex w-full max-w-[360px] flex-col overflow-hidden rounded-2xl border border-on-surface/10 bg-surface-container-lowest shadow-[0_16px_36px_-6px_rgba(42,38,34,0.12)]"
          >
            <div className="border-b border-on-surface/[0.06] bg-surface p-5 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon name="notifications_active" className="text-[20px] text-primary" />
                  <h3 id={`${titleId}-summary`} className="font-title text-[16px] text-primary">
                    Dispatch summary
                  </h3>
                </div>
                <span className="rounded bg-primary-fixed px-2 py-0.5 font-label-sm text-label-sm font-bold text-primary">
                  LIVE STATE
                </span>
              </div>
              <div className="mt-3 flex items-baseline justify-between gap-3">
                <div role="status" className="font-headline-sm text-headline-sm text-primary">
                  {summaryHeadline(summary)}
                </div>
                <span className="shrink-0 font-label-sm text-label-sm font-medium text-on-surface-variant">
                  Batch #{summary.batchId.slice(0, 6).toUpperCase()}
                </span>
              </div>
              <div className="mt-2 flex h-1.5 w-full overflow-hidden rounded-full bg-surface-container">
                {bar.map((part) =>
                  part.width > 0 ? (
                    <div
                      key={part.key}
                      title={`${part.title}: ${part.width}`}
                      className={`h-full ${part.className}`}
                      style={{ width: `${(part.width / barTotal) * 100}%` }}
                    />
                  ) : null,
                )}
              </div>
            </div>

            <ul className="custom-scrollbar max-h-[420px] space-y-3 overflow-y-auto p-5">
              {summary.results.map((item) => {
                const copy = OUTCOME_COPY[item.outcome];
                const guest = infoByGuest.get(item.guestId);
                const failed = item.outcome === "failed";
                const skippedItem = item.outcome === "skipped";
                return (
                  <li
                    key={item.guestId}
                    className={`flex items-start gap-3 rounded-xl p-3 ${
                      failed
                        ? "border border-error/20 bg-error-container/20"
                        : skippedItem
                          ? "border border-dashed border-on-surface/20 bg-surface"
                          : "border border-on-surface/5 bg-surface-container-low/50"
                    }`}
                  >
                    <div
                      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${copy.tone}`}
                    >
                      <Icon name={copy.icon} className="text-[15px]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-title text-[13px] font-semibold text-on-surface">
                          {item.name}
                        </span>
                        <span
                          className={`font-label-sm text-label-sm font-bold tracking-wider uppercase ${
                            failed
                              ? "text-error"
                              : skippedItem
                                ? "text-on-surface-variant"
                                : "text-primary"
                          }`}
                        >
                          {copy.label}
                        </span>
                      </div>
                      {item.outcome === "sent" ? (
                        <p className="truncate text-[12px] text-on-surface-variant">
                          Sent to {item.email}
                        </p>
                      ) : null}
                      {item.outcome === "marked" ? (
                        <p className="truncate text-[12px] text-on-surface-variant">
                          Recorded as invited
                        </p>
                      ) : null}
                      {failed ? (
                        <p className="text-[12px] text-error">
                          {item.error?.message ?? `Couldn't send (${item.error?.code ?? "error"})`}
                        </p>
                      ) : null}
                      {skippedItem ? (
                        <p className="text-[12px] text-on-surface-variant">{item.reason}</p>
                      ) : null}
                      {item.outcome === "prepared" && item.whatsappUrl ? (
                        <div className="mt-1.5 flex items-center gap-3">
                          <a
                            href={item.whatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => void openWhatsapp(item)}
                            className="inline-flex items-center gap-1 font-label-md text-label-md font-semibold text-primary hover:underline"
                          >
                            <Icon name="chat" className="text-[14px]" />
                            {opened.has(item.guestId) ? "Open again" : "Open WhatsApp"}
                          </a>
                          {opened.has(item.guestId) ? (
                            <span className="text-[11px] text-primary">Recorded as invited</span>
                          ) : null}
                        </div>
                      ) : null}
                      {failed ? (
                        <div className="mt-2 flex items-center justify-between border-t border-error/10 pt-2">
                          <button
                            type="button"
                            onClick={retryFailed}
                            disabled={retrying}
                            className="flex items-center gap-1 font-label-md text-label-md text-secondary transition-colors hover:text-on-secondary-container disabled:opacity-60"
                          >
                            <Icon name="refresh" className="text-[14px]" />
                            <span>{retrying ? "Retrying…" : "Retry failed"}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => void copyLink(item.guestId)}
                            className="text-[11px] text-on-surface-variant hover:text-primary hover:underline"
                          >
                            Or copy link
                          </button>
                        </div>
                      ) : null}
                      {skippedItem &&
                      guest &&
                      /no (email|phone)|contact/i.test(item.reason ?? "") ? (
                        <div className="mt-2 border-t border-on-surface/10 pt-2">
                          <Link
                            href={`/dashboard/guests?guest=${item.guestId}`}
                            className="flex items-center gap-1 font-label-md text-label-md text-secondary transition-colors hover:text-on-secondary-container hover:underline"
                          >
                            <Icon name="add" className="text-[14px]" />
                            <span>
                              {channel === "whatsapp" ? "Add phone number" : "Add email address"}
                            </span>
                          </Link>
                        </div>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="flex items-center justify-between border-t border-on-surface/[0.06] bg-surface p-4">
              <span className="text-[12px] text-on-surface-variant">
                Logs retained for 180 days
              </span>
              {canViewLog && channel === "email" ? (
                <Link
                  href={`/dashboard/invitations?tab=log&batch=${summary.batchId}`}
                  className="font-label-md text-label-md font-semibold text-primary hover:underline"
                >
                  View full log →
                </Link>
              ) : null}
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}

/** "1 sent, 1 failed", "3 ready to open", "2 marked as invited". */
export function summaryHeadline(summary: SendSummary): string {
  const parts: string[] = [];
  if (summary.sent > 0) parts.push(`${summary.sent} sent`);
  if (summary.prepared > 0) parts.push(`${summary.prepared} ready to open`);
  if (summary.marked > 0) parts.push(`${summary.marked} marked as invited`);
  if (summary.failed > 0) parts.push(`${summary.failed} failed`);
  if (summary.skipped > 0 && parts.length === 0) parts.push(`${summary.skipped} skipped`);
  return parts.join(", ") || "Nothing to send";
}
