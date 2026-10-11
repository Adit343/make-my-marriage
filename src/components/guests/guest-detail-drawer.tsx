"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EventMenu } from "@/components/events/event-menu";
import {
  assignEvent,
  fetchGuest,
  recordReply,
  removeFromEvent,
} from "@/components/guests/guests-api";
import {
  ensureGuestLink,
  getGuestLink,
  rotateGuestLink,
} from "@/components/invitations/invitations-api";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { useDialogFocus } from "@/components/ui/use-dialog-focus";
import { errorMessage } from "@/lib/client/api-client";
import { RSVP_STATUSES, type InviteChannel, type RsvpStatus } from "@/lib/constants/enums";
import { formatPhone } from "@/lib/guests/phone";
import type { GuestEventInfo, GuestGroupInfo } from "@/lib/guests/types";
import {
  AGE_LABEL,
  DIETARY_LABEL,
  invitationDisplay,
  lastUpdatedLabel,
  RSVP_LABEL,
  shortDate,
  sideLabel,
  type Partners,
} from "@/lib/guests/view";
import { initialsOf } from "@/lib/text/initials";
import type { GuestDetailDto, GuestEventResponseDto } from "@/modules/guests/guest.dto";

// The "Guest Detail" slide-over from the Stitch design: who the guest is, how they replied to each
// event (with "Record response manually" for a phone call), and the invitation card. Changes made
// here (assigning an event, recording a reply) save at once and refresh the list behind.

const CHIP =
  "inline-flex items-center gap-1.5 rounded-lg border border-[rgba(42,38,34,0.06)] bg-[#FFFDF9] px-3 py-1.5 font-body-sm text-body-sm text-on-surface shadow-xs";
const CARD = "space-y-4 rounded-xl border border-[rgba(42,38,34,0.06)] bg-[#FFFDF9] p-5";
const OUTLINE_BUTTON =
  "flex items-center justify-center gap-2 rounded-lg border border-[rgba(42,38,34,0.15)] bg-transparent px-4 py-2.5 font-label-md text-label-md font-medium text-[#2A2622] transition-all hover:bg-[#F4EFEA] active:scale-[0.99]";

const DOT: Record<RsvpStatus, string> = {
  attending: "bg-[#1F4D3D]",
  maybe: "bg-[#C89B3C]",
  declined: "bg-secondary",
  pending: "bg-outline-variant",
};
const TEXT: Record<RsvpStatus, string> = {
  attending: "font-medium text-[#1F4D3D]",
  maybe: "font-medium text-[#78401d]",
  declined: "font-medium text-secondary",
  pending: "text-on-surface-variant",
};

export function GuestDetailDrawer({
  weddingId,
  guestId,
  partners,
  groups,
  events,
  timezone,
  onClose,
  onChanged,
  onEdit,
  onDelete,
  onSend,
}: {
  weddingId: string;
  guestId: string;
  partners: Partners;
  groups: GuestGroupInfo[];
  events: GuestEventInfo[];
  /** The wedding's timezone, for "Last updated" and invitation dates. */
  timezone: string;
  onClose: () => void;
  /** A reply or assignment changed: the list behind the drawer should refresh. */
  onChanged: () => void;
  onEdit: (guest: GuestDetailDto) => void;
  onDelete: (guest: GuestDetailDto) => void;
  /** Opens the Send dialog for this guest, on the chosen channel. */
  onSend: (guest: GuestDetailDto, channel: InviteChannel) => void;
}) {
  const toast = useToast();
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef);
  const [guest, setGuest] = useState<GuestDetailDto | null>(null);
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const [recording, setRecording] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  // The guest's personal link, once they have one (it is created by "Copy link" or by sending).
  const [link, setLink] = useState<string | null>(null);
  const [linkBusy, setLinkBusy] = useState(false);
  const [replacing, setReplacing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchGuest(weddingId, guestId)
      .then((loaded) => {
        if (!cancelled) setGuest(loaded);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [weddingId, guestId, reload]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const changed = useCallback(() => {
    setReload((value) => value + 1);
    onChanged();
  }, [onChanged]);

  const group = guest?.groupId ? groups.find((g) => g.id === guest.groupId) : null;
  const unassigned = guest
    ? events.filter((event) => !guest.responses.some((r) => r.eventId === event.id))
    : [];

  async function assign(eventId: string) {
    if (!guest) return;
    try {
      await assignEvent(weddingId, guest.id, eventId);
      setAssigning(false);
      changed();
    } catch (error) {
      toast({ type: "error", title: "Couldn't assign the event", message: errorMessage(error) });
    }
  }

  // Reading the link never creates it: a guest who was never invited has none yet.
  useEffect(() => {
    let cancelled = false;
    getGuestLink(weddingId, guestId)
      .then((found) => {
        if (!cancelled) setLink(found?.inviteUrl ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [weddingId, guestId, reload]);

  async function copyLink(replace = false) {
    setLinkBusy(true);
    try {
      const { inviteUrl } = replace
        ? await rotateGuestLink(weddingId, guestId)
        : await ensureGuestLink(weddingId, guestId);
      setLink(inviteUrl);
      await navigator.clipboard.writeText(inviteUrl);
      toast({
        type: "success",
        title: replace ? "New link copied" : "Link copied",
        message: replace
          ? "The old link no longer works."
          : "Share it with the guest yourself, for example on WhatsApp.",
      });
    } catch (error) {
      toast({ type: "error", title: "Couldn't copy the link", message: errorMessage(error) });
    } finally {
      setLinkBusy(false);
      setReplacing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-[#2A2622]/20 backdrop-blur-[2px]" onMouseDown={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={guest ? `Guest details for ${guest.name}` : "Guest details"}
        className="fixed inset-y-0 right-0 flex w-full max-w-[530px] flex-col justify-between overflow-hidden border-l border-[rgba(42,38,34,0.06)] bg-[#FAF6F0] shadow-[-16px_0_48px_-8px_rgba(42,38,34,0.14)]"
      >
        <div className="flex items-center justify-between border-b border-[rgba(42,38,34,0.05)] bg-[#FAF6F0]/80 px-8 pt-7 pb-4 backdrop-blur-sm">
          <nav
            aria-label="Breadcrumb"
            className="flex items-center space-x-2 font-body-sm text-body-sm"
          >
            <button
              type="button"
              onClick={onClose}
              className="text-on-surface-variant transition-colors hover:text-primary"
            >
              Guests
            </button>
            <span className="text-xs text-outline">/</span>
            <span className="font-semibold text-primary">{guest?.name ?? "…"}</span>
          </nav>
          <button
            type="button"
            aria-label="Close panel"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant transition-all duration-150 hover:bg-[rgba(42,38,34,0.04)] hover:text-primary"
          >
            <Icon name="close" className="text-[20px]" />
          </button>
        </div>

        {failed ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
            <Icon name="error" className="text-[28px] text-outline" />
            <p className="font-body-md text-body-md text-on-surface-variant">
              This guest could not be loaded. They may have been removed.
            </p>
            <button type="button" onClick={onClose} className={OUTLINE_BUTTON}>
              Back to guests
            </button>
          </div>
        ) : !guest ? (
          <div role="status" aria-label="Loading guest" className="flex-1 space-y-4 px-8 py-8">
            <div className="h-16 w-2/3 animate-pulse rounded-xl bg-[#F4EFEA]" />
            <div className="h-10 w-full animate-pulse rounded-xl bg-[#F4EFEA]" />
            <div className="h-48 w-full animate-pulse rounded-xl bg-[#F4EFEA]" />
          </div>
        ) : (
          <>
            <div className="custom-scrollbar flex-1 space-y-7 overflow-y-auto px-8 py-6">
              <section className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-primary-container/20 bg-primary-container font-headline-md text-[26px] tracking-tight text-on-primary-fixed shadow-sm">
                    {initialsOf(guest.name)}
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-headline-md text-headline-md font-medium tracking-tight text-primary">
                      {guest.name}
                    </h2>
                    <p className="mt-0.5 font-body-sm text-body-sm text-on-surface-variant">
                      {[guest.relationLabel, group?.name, sideLabel(guest.side, partners)]
                        .filter(Boolean)
                        .map((part, index) => (
                          <span key={index}>
                            {index > 0 ? (
                              <span className="mx-1.5 text-outline-variant">•</span>
                            ) : null}
                            {part}
                          </span>
                        ))}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => onEdit(guest)}
                    className="flex items-center gap-1.5 rounded-lg border border-[rgba(42,38,34,0.15)] bg-[#FFFDF9] px-3.5 py-1.5 font-label-md text-label-md text-on-surface transition-all hover:bg-[#F4EFEA] active:scale-[0.98]"
                  >
                    <Icon name="edit" className="text-[16px] text-on-surface-variant" />
                    <span>Edit</span>
                  </button>
                  <EventMenu
                    eventName={guest.name}
                    trigger="horizontal"
                    items={[
                      {
                        icon: "send",
                        label: "Send invitation",
                        onSelect: () => onSend(guest, "email"),
                      },
                      {
                        icon: "link",
                        label: "Copy invite link",
                        onSelect: () => void copyLink(),
                      },
                      {
                        icon: "delete",
                        label: "Delete guest",
                        danger: true,
                        onSelect: () => onDelete(guest),
                      },
                    ]}
                  />
                </div>
              </section>

              <section aria-label="Guest attributes" className="flex flex-wrap gap-2 pt-1">
                {guest.phone ? (
                  <div className={CHIP}>
                    <Icon name="call" className="text-[16px] text-outline" />
                    <span>{formatPhone(guest.phone)}</span>
                  </div>
                ) : null}
                {guest.email ? (
                  <div className={CHIP}>
                    <Icon name="mail" className="text-[16px] text-outline" />
                    <span className="break-all">{guest.email}</span>
                  </div>
                ) : null}
                <div className={CHIP}>
                  <Icon name="group" className="text-[16px] text-outline" />
                  <span>{sideLabel(guest.side, partners)}</span>
                </div>
                <div className={CHIP}>
                  <Icon name="badge" className="text-[16px] text-outline" />
                  <span>{AGE_LABEL[guest.ageCategory]}</span>
                </div>
                {guest.dietaryPreference ? (
                  <div className={CHIP}>
                    <Icon name="restaurant" className="text-[16px] text-outline" />
                    <span>{DIETARY_LABEL[guest.dietaryPreference]}</span>
                  </div>
                ) : null}
                <div className={CHIP}>
                  <Icon name="person_add" className="text-[16px] text-outline" />
                  <span>Plus-ones allowed: {guest.plusOnesAllowed}</span>
                </div>
                {guest.address ? (
                  <div className={CHIP}>
                    <Icon name="pin_drop" className="text-[16px] text-outline" />
                    <span>
                      {[guest.address.line1, guest.address.city, guest.address.postalCode]
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                  </div>
                ) : null}
              </section>

              <section className={CARD}>
                <div className="flex items-center justify-between border-b border-[rgba(42,38,34,0.04)] pb-3">
                  <h3 className="font-title text-title text-on-surface">Event responses</h3>
                  <span className="rounded-full bg-surface-container px-2.5 py-0.5 font-label-sm text-label-sm text-on-surface-variant">
                    {guest.responses.length}{" "}
                    {guest.responses.length === 1 ? "event assigned" : "events assigned"}
                  </span>
                </div>

                {guest.responses.length === 0 ? (
                  <p className="py-1 font-body-sm text-body-sm text-on-surface-variant">
                    {events.length === 0
                      ? "There are no events yet. Add events, then invite this guest to them."
                      : "Not invited to any event yet."}
                  </p>
                ) : (
                  <ul className="space-y-0">
                    {guest.responses.map((response, index) => (
                      <li
                        // The row's own form state restarts whenever its reply changes.
                        key={`${response.eventId}:${response.status}:${response.attendingCount}:${response.note ?? ""}`}
                        className={index > 0 ? "border-t border-[rgba(42,38,34,0.04)] pt-3" : ""}
                      >
                        <ResponseRow
                          weddingId={weddingId}
                          guest={guest}
                          response={response}
                          timezone={timezone}
                          open={recording === response.eventId}
                          onToggle={() =>
                            setRecording(recording === response.eventId ? null : response.eventId)
                          }
                          onDone={() => {
                            setRecording(null);
                            changed();
                          }}
                        />
                      </li>
                    ))}
                  </ul>
                )}

                {unassigned.length > 0 ? (
                  <div className="border-t border-[rgba(42,38,34,0.04)] pt-2">
                    {assigning ? (
                      <div className="space-y-1.5">
                        <p className="font-label-sm text-label-sm tracking-wider text-outline uppercase">
                          Invite to
                        </p>
                        <ul className="flex flex-wrap gap-2">
                          {unassigned.map((event) => (
                            <li key={event.id}>
                              <button
                                type="button"
                                onClick={() => void assign(event.id)}
                                className="rounded-full border border-[rgba(42,38,34,0.12)] bg-[#FAF6F0] px-3 py-1 font-body-sm text-body-sm text-on-surface transition-colors hover:border-primary/40 hover:text-primary"
                              >
                                {event.name} · {event.dateLabel}
                              </button>
                            </li>
                          ))}
                          <li>
                            <button
                              type="button"
                              onClick={() => setAssigning(false)}
                              className="px-2 py-1 font-body-sm text-body-sm text-outline hover:text-on-surface"
                            >
                              Cancel
                            </button>
                          </li>
                        </ul>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setAssigning(true)}
                        className="flex items-center gap-1 font-body-sm text-body-sm font-medium text-[#1F4D3D] transition-colors hover:text-primary"
                      >
                        <span>+ Assign to another event</span>
                      </button>
                    )}
                  </div>
                ) : null}
              </section>

              <section className={CARD}>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-title text-title text-on-surface">
                    Invitation &amp; RSVP Link
                  </h3>
                  <InvitationPill guest={guest} timezone={timezone} />
                </div>
                <p className="-mt-2 font-body-sm text-body-sm text-outline">
                  {guest.invitation.sendCount === 0
                    ? "Not sent yet"
                    : `Sent ${guest.invitation.sendCount} ${guest.invitation.sendCount === 1 ? "time" : "times"}`}
                </p>
                <div className="space-y-1.5">
                  <span className="font-label-sm text-label-sm tracking-wider text-outline uppercase">
                    Unique Guest Invitation Link
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 truncate rounded-lg border border-[rgba(42,38,34,0.08)] bg-[#F4EFEA] px-3.5 py-2 font-mono text-body-sm text-on-surface-variant">
                      {link ?? "Created when you copy it or send the invitation"}
                    </div>
                    <button
                      type="button"
                      disabled={linkBusy}
                      onClick={() => void copyLink()}
                      className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[rgba(42,38,34,0.15)] bg-[#FFFDF9] px-4 py-2 font-label-md text-label-md text-on-surface transition-all hover:bg-[#F4EFEA] active:scale-[0.98]"
                    >
                      <Icon name="content_copy" className="text-[16px] text-outline" />
                      <span>Copy link</span>
                    </button>
                  </div>
                  {link ? (
                    <button
                      type="button"
                      onClick={() => setReplacing(true)}
                      className="font-body-sm text-[12px] text-on-surface-variant underline decoration-[rgba(42,38,34,0.2)] underline-offset-2 hover:text-primary"
                    >
                      Replace this link (the old one stops working)
                    </button>
                  ) : null}
                </div>
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => onSend(guest, "email")}
                    className="flex items-center justify-center gap-2 rounded-lg bg-[#1F4D3D] px-4 py-2.5 font-label-md text-label-md font-medium text-[#FAF6F0] shadow-xs transition-all hover:bg-[#163A2E] active:scale-[0.99]"
                  >
                    <Icon name="send" className="text-[18px]" />
                    <span>Send invitation</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onSend(guest, "whatsapp")}
                    className={OUTLINE_BUTTON}
                  >
                    <Icon name="chat" className="text-[18px] text-emerald-700" />
                    <span>Share on WhatsApp</span>
                  </button>
                </div>
              </section>

              <section className={`${CARD} !space-y-3`}>
                <div className="flex items-center gap-2">
                  <Icon name="lock" className="text-[16px] text-outline" />
                  <h3 className="font-title text-title text-on-surface">
                    Private notes (Team only)
                  </h3>
                </div>
                {guest.notes ? (
                  <div className="rounded-lg border border-[rgba(42,38,34,0.04)] bg-[#F4EFEA]/80 p-3.5 font-body-md text-body-md leading-relaxed whitespace-pre-wrap text-on-surface-variant">
                    {guest.notes}
                  </div>
                ) : (
                  <p className="font-body-sm text-body-sm text-outline">
                    No notes yet. Add some from Edit; guests never see them.
                  </p>
                )}
              </section>
            </div>

            <div className="flex items-center justify-between border-t border-[rgba(42,38,34,0.06)] bg-[#FAF6F0] px-8 py-5">
              <button
                type="button"
                onClick={() => onDelete(guest)}
                className="-ml-2 flex items-center gap-1.5 rounded-lg px-2 py-1 font-body-sm text-body-sm font-medium text-error transition-colors hover:bg-error-container/20 hover:text-on-error-container"
              >
                <Icon name="delete" className="text-[16px]" />
                <span>Delete guest</span>
              </button>
              <span className="font-label-sm text-label-sm text-outline">
                Last updated: {lastUpdatedLabel(guest.updatedAt, timezone)}
              </span>
            </div>
          </>
        )}
      </div>
      {replacing ? (
        <ConfirmDialog
          title="Replace this guest's link?"
          confirmLabel="Replace link"
          busy={linkBusy}
          onConfirm={() => void copyLink(true)}
          onCancel={() => setReplacing(false)}
        >
          <p>
            A new link is created and copied. The old one stops working at once, so anything you
            already sent them will show &ldquo;This link isn&rsquo;t working&rdquo;.
          </p>
        </ConfirmDialog>
      ) : null}
    </div>
  );
}

function InvitationPill({ guest, timezone }: { guest: GuestDetailDto; timezone: string }) {
  const display = invitationDisplay(guest.invitation, timezone);
  if (!display.sent) {
    return (
      <span className="inline-flex items-center rounded-full border border-[rgba(42,38,34,0.08)] bg-[#FAF6F0] px-2.5 py-1 font-label-sm text-label-sm text-on-surface-variant/80">
        Not sent
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-tertiary-fixed px-2.5 py-1 font-label-sm text-label-sm text-[#133429]">
      <Icon name="check_circle" className="text-[14px]" />
      <span>
        {display.label}
        {display.dateLabel ? ` on ${display.dateLabel}` : ""}
      </span>
    </span>
  );
}

function ResponseRow({
  weddingId,
  guest,
  response,
  timezone,
  open,
  onToggle,
  onDone,
}: {
  weddingId: string;
  guest: GuestDetailDto;
  response: GuestEventResponseDto;
  timezone: string;
  open: boolean;
  onToggle: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const maxCount = 1 + guest.plusOnesAllowed;
  const [status, setStatus] = useState<RsvpStatus>(
    response.status === "pending" ? "attending" : response.status,
  );
  const [count, setCount] = useState(Math.max(1, response.attendingCount));
  const [note, setNote] = useState(response.note ?? "");
  const [saving, setSaving] = useState(false);
  const comes = status === "attending" || status === "maybe";

  const dateLabel = shortDate(response.startsAt, response.timezone || timezone);
  const people =
    response.attendingCount > 1
      ? `${response.attendingCount} attending (${guest.name.split(" ")[0]} + ${response.attendingCount - 1})`
      : response.attendingCount === 1
        ? "1 attending"
        : null;

  async function save() {
    setSaving(true);
    try {
      await recordReply(weddingId, guest.id, response.eventId, {
        status,
        ...(comes ? { attendingCount: count } : {}),
        note: note.trim() || null,
      });
      toast({
        type: "success",
        title: "Reply recorded",
        message: `${guest.name}: ${RSVP_LABEL[status]} for ${response.eventName}`,
      });
      setSaving(false);
      onDone();
    } catch (error) {
      setSaving(false);
      toast({ type: "error", title: "Couldn't record the reply", message: errorMessage(error) });
    }
  }

  async function remove() {
    setSaving(true);
    try {
      await removeFromEvent(weddingId, guest.id, response.eventId);
      toast({ type: "success", title: "Removed from event", message: response.eventName });
      setSaving(false);
      onDone();
    } catch (error) {
      setSaving(false);
      toast({ type: "error", title: "Couldn't remove the guest", message: errorMessage(error) });
    }
  }

  return (
    <div className="py-1">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-body-md text-body-md font-medium text-on-surface">
            {response.eventName}
          </div>
          <div className="font-body-sm text-body-sm text-outline">{dateLabel}</div>
        </div>
        <div className="text-right">
          <div className="flex items-center justify-end gap-2">
            <span className={`h-2 w-2 rounded-full ${DOT[response.status]}`} />
            <span className={`font-body-sm text-body-sm ${TEXT[response.status]}`}>
              {RSVP_LABEL[response.status]}
            </span>
            {response.status === "pending" ? (
              <>
                <span className="text-xs text-outline-variant">•</span>
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={onToggle}
                  className="text-left font-body-sm text-body-sm font-medium text-secondary transition-colors hover:text-on-secondary-container"
                >
                  Record response manually
                </button>
              </>
            ) : people ? (
              <>
                <span className="text-xs text-outline-variant">•</span>
                <span className="font-body-sm text-body-sm text-on-surface-variant">{people}</span>
              </>
            ) : null}
          </div>
          {response.status !== "pending" ? (
            <div className="mt-0.5 flex items-center justify-end gap-3">
              {response.note ? (
                <span className="font-body-sm text-body-sm text-outline">
                  Note: {response.note}
                </span>
              ) : null}
              <button
                type="button"
                aria-expanded={open}
                onClick={onToggle}
                className="font-body-sm text-[12px] font-medium text-secondary hover:underline"
              >
                Change
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {open ? (
        <div className="mt-3 space-y-3 rounded-lg border border-[rgba(42,38,34,0.08)] bg-[#FAF6F0] p-3.5">
          <div
            role="radiogroup"
            aria-label={`Reply for ${response.eventName}`}
            className="flex items-center rounded-lg border border-on-surface/5 bg-[#F4EFEA] p-1"
          >
            {RSVP_STATUSES.map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={status === value}
                onClick={() => setStatus(value)}
                className={`flex-1 rounded px-2 py-1.5 text-center font-label-sm text-label-sm transition-all ${
                  status === value
                    ? "bg-[#FFFDF9] font-semibold text-primary shadow-[0_1px_3px_rgba(42,38,34,0.06)]"
                    : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                {RSVP_LABEL[value]}
              </button>
            ))}
          </div>

          {comes ? (
            <div className="flex items-center justify-between gap-3">
              <span className="font-body-sm text-body-sm text-on-surface">
                People coming (including {guest.name.split(" ")[0]})
              </span>
              <div className="flex items-center rounded-lg border border-on-surface/15 bg-[#FFFDF9] px-1.5 py-1">
                <button
                  type="button"
                  aria-label="Fewer people"
                  disabled={count <= 1}
                  onClick={() => setCount(count - 1)}
                  className="flex h-6 w-6 items-center justify-center rounded bg-[#F4EFEA] hover:bg-surface-variant disabled:opacity-40"
                >
                  <Icon name="remove" className="text-sm" />
                </button>
                <span
                  aria-live="polite"
                  className="w-8 text-center font-body-sm font-semibold text-primary"
                >
                  {count}
                </span>
                <button
                  type="button"
                  aria-label="More people"
                  disabled={count >= maxCount}
                  onClick={() => setCount(count + 1)}
                  className="flex h-6 w-6 items-center justify-center rounded bg-[#F4EFEA] hover:bg-surface-variant disabled:opacity-40"
                >
                  <Icon name="add" className="text-sm" />
                </button>
              </div>
            </div>
          ) : null}

          <input
            type="text"
            aria-label="Note"
            maxLength={500}
            placeholder="Add a note (optional)"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className="w-full rounded border border-on-surface/10 bg-[#FFFDF9] px-3 py-2 font-body-sm text-body-sm text-on-surface placeholder:text-on-surface/40 focus:border-primary-container focus:ring-0 focus:outline-none"
          />

          <div className="flex items-center justify-between">
            <button
              type="button"
              disabled={saving}
              onClick={() => void remove()}
              className="font-body-sm text-[12px] text-error hover:underline disabled:opacity-60"
            >
              Remove from this event
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={onToggle}
                className="rounded-lg border border-on-surface/15 px-3 py-1.5 font-body-sm text-body-sm text-on-surface hover:bg-surface-variant disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void save()}
                className="rounded-lg bg-primary-container px-4 py-1.5 font-label-md text-label-md text-[#FAF6F0] hover:bg-[#163A2E] disabled:opacity-70"
              >
                {saving ? "Saving..." : "Save reply"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
