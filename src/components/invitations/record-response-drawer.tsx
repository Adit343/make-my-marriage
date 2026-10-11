"use client";

import { useEffect, useId, useRef, useState } from "react";
import { recordReply } from "@/components/guests/guests-api";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { useDialogFocus } from "@/components/ui/use-dialog-focus";
import { errorMessage } from "@/lib/client/api-client";
import { MAX_RSVP_NOTE } from "@/lib/constants/guests";
import type { RsvpStatus } from "@/lib/constants/enums";
import type { EventReplyRow } from "@/modules/guest-invitations/invitation-overview.service";

// Stitch "RSVP Tracker" slide-over: "Record response for <guest>". A member writes down an answer the
// guest gave by phone or in person. The count is everyone coming, the guest included, and cannot
// pass 1 + the plus-ones the couple allowed (the server refuses it with a clear message).

type Answer = Exclude<RsvpStatus, "pending">;

const OPTIONS: { value: Answer; label: string }[] = [
  { value: "attending", label: "Attending" },
  { value: "maybe", label: "Maybe" },
  { value: "declined", label: "Declined" },
];

export function RecordResponseDrawer({
  weddingId,
  row,
  eventId,
  eventName,
  viewerLabel,
  onClose,
  onSaved,
}: {
  weddingId: string;
  row: EventReplyRow;
  eventId: string;
  eventName: string;
  /** "Diya Singhania (Owner)": who is entering this. */
  viewerLabel: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef);

  const [status, setStatus] = useState<Answer>(row.status === "pending" ? "attending" : row.status);
  const [count, setCount] = useState(Math.max(1, row.attendingCount || 1));
  const [note, setNote] = useState(row.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const max = 1 + row.plusOnesAllowed;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await recordReply(weddingId, row.guestId, eventId, {
        status,
        ...(status === "declined" ? {} : { attendingCount: count }),
        note: note.trim() === "" ? null : note.trim(),
      });
      toast({ type: "success", title: "Response saved", message: `${row.name} · ${eventName}` });
      onSaved();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div
        className="absolute inset-0 bg-inverse-surface/20 backdrop-blur-[2px]"
        onMouseDown={() => {
          if (!busy) onClose();
        }}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="fixed inset-y-0 right-0 flex w-full max-w-[400px] flex-col justify-between border-l border-[rgba(42,38,34,0.08)] bg-surface-container-lowest shadow-[0_24px_48px_-8px_rgba(42,38,34,0.18)]"
      >
        <div className="border-b border-[rgba(42,38,34,0.06)] p-6">
          <div className="mb-3 flex items-center justify-between">
            <span className="rounded-full bg-surface-container px-2.5 py-0.5 font-label-sm text-label-sm font-semibold tracking-wider text-secondary uppercase">
              {eventName}
            </span>
            <button
              type="button"
              aria-label="Close drawer"
              onClick={onClose}
              disabled={busy}
              className="rounded p-1 text-outline transition-colors hover:bg-surface-container hover:text-on-surface"
            >
              <Icon name="close" />
            </button>
          </div>
          <h2 id={titleId} className="font-headline-sm text-headline-sm text-primary">
            Record response for {row.name}
          </h2>
          <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
            Manual entry by {viewerLabel}
          </p>
        </div>

        <div className="custom-scrollbar flex-1 space-y-6 overflow-y-auto p-6">
          <div>
            <p className="mb-2 block font-label-md text-label-md font-semibold text-on-surface">
              RSVP Status
            </p>
            <div
              role="radiogroup"
              aria-label="RSVP status"
              className="grid grid-cols-3 rounded-lg border border-[rgba(42,38,34,0.06)] bg-surface-container p-1 text-center"
            >
              {OPTIONS.map((option) => {
                const selected = status === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setStatus(option.value)}
                    className={`flex items-center justify-center gap-1.5 rounded-md py-2 font-body-sm text-body-sm transition-colors focus:ring-2 focus:ring-secondary focus:outline-hidden ${
                      selected
                        ? "bg-primary-container font-semibold text-surface-container-lowest shadow-sm"
                        : "text-on-surface-variant hover:text-primary"
                    }`}
                  >
                    {selected ? (
                      <span className="h-2 w-2 rounded-full bg-surface-container-lowest" />
                    ) : null}
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          {status === "declined" ? null : (
            <>
              <div>
                <div className="mb-2 flex items-baseline justify-between">
                  <p className="font-label-md text-label-md font-semibold text-on-surface">
                    Number of people
                  </p>
                  <span className="font-label-sm text-label-sm text-outline">
                    up to {max} {max === 1 ? "person" : "people"} allowed
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-[rgba(42,38,34,0.1)] bg-surface-container-low p-3">
                  <span className="font-body-sm text-body-sm text-on-surface-variant">
                    Confirmed Headcount
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      aria-label="Fewer people"
                      disabled={count <= 1}
                      onClick={() => setCount((value) => Math.max(1, value - 1))}
                      className="flex h-8 w-8 items-center justify-center rounded-md border border-[rgba(42,38,34,0.1)] bg-surface-container-lowest text-title text-on-surface transition-colors hover:bg-surface-container disabled:opacity-40"
                    >
                      −
                    </button>
                    <span
                      aria-live="polite"
                      className="w-5 text-center font-title text-title text-primary"
                    >
                      {count}
                    </span>
                    <button
                      type="button"
                      aria-label="More people"
                      disabled={count >= max}
                      onClick={() => setCount((value) => Math.min(max, value + 1))}
                      className="flex h-8 w-8 items-center justify-center rounded-md border border-[rgba(42,38,34,0.1)] bg-surface-container-lowest text-title text-on-surface transition-colors hover:bg-surface-container disabled:opacity-40"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-[rgba(42,38,34,0.06)] bg-surface-container/60 p-3.5">
                <div className="flex items-center justify-between font-body-sm text-body-sm">
                  <span className="font-semibold text-primary">{row.name}</span>
                  <span className="font-label-sm text-label-sm font-medium text-primary-container">
                    Included
                  </span>
                </div>
                <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
                  {row.plusOnesAllowed === 0
                    ? "This invitation is for one person."
                    : `Can bring up to ${row.plusOnesAllowed} ${row.plusOnesAllowed === 1 ? "guest" : "guests"}. The count includes ${row.name.split(" ")[0]}.`}
                </p>
              </div>
            </>
          )}

          <div>
            <label
              htmlFor={`${titleId}-note`}
              className="mb-2 block font-label-md text-label-md font-semibold text-on-surface"
            >
              Note / Remarks (Optional)
            </label>
            <textarea
              id={`${titleId}-note`}
              rows={4}
              maxLength={MAX_RSVP_NOTE}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Spoke on phone, confirmed both him and partner"
              className="w-full resize-none rounded-lg border border-[rgba(42,38,34,0.1)] bg-surface-container-lowest p-3 font-body-sm text-body-sm text-on-surface placeholder:text-on-surface-variant/40 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-hidden"
            />
            <p className="mt-1.5 font-label-sm text-label-sm text-outline">
              Visible to everyone on the planning team.
            </p>
          </div>

          {error ? (
            <p
              role="alert"
              className="rounded-lg border border-error/20 bg-error-container/30 px-3 py-2 font-body-sm text-body-sm text-error"
            >
              {error}
            </p>
          ) : null}
        </div>

        <div className="border-t border-[rgba(42,38,34,0.06)] bg-surface-container-low p-6">
          <p className="mb-4 font-body-sm text-body-sm text-on-surface-variant italic">
            Use this when a guest replied by phone or in person.
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="flex-1 rounded-lg border border-[rgba(42,38,34,0.15)] py-2.5 font-body-sm text-body-sm font-medium text-on-surface transition-colors hover:bg-surface-container"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="flex-1 rounded-lg bg-primary-container py-2.5 font-body-sm text-body-sm font-semibold text-surface-container-lowest shadow-sm transition-all hover:bg-primary disabled:opacity-60"
            >
              {busy ? "Saving…" : "Save response"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
