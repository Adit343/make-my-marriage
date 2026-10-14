"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { batchWhen, percent } from "@/lib/invitations/view";
import type { InvitationsOverview } from "@/modules/guest-invitations/invitation-overview.service";

// Stitch "Invitations Hub", Overview tab: four numbers, how many guests have been invited and how,
// what needs attention, and the latest email batches. Every number is computed from the real
// guests and email logs.

const CARD =
  "rounded-xl border border-on-surface/5 bg-surface-container-lowest shadow-[0_2px_12px_-2px_rgba(42,38,34,0.04),0_1px_3px_0_rgba(42,38,34,0.02)]";

export function OverviewTab({
  overview,
  timezone,
  now,
  canViewLog,
  retryingKey,
  onRetryOne,
  onRetryAll,
  onViewBatch,
}: {
  overview: InvitationsOverview;
  timezone: string;
  now: Date;
  canViewLog: boolean;
  /** The failure (or "all") being retried right now. */
  retryingKey: string | null;
  onRetryOne: (failure: InvitationsOverview["failures"][number]) => void;
  onRetryAll: () => void;
  onViewBatch: (batchId: string) => void;
}) {
  const { totals, channels, failures, batches, noContactGuests } = overview;
  const coverage = percent(totals.invited, totals.guests);
  const remaining = totals.guests - totals.invited;
  const failed = failures.length;
  // The three channel segments of the progress bar, as a share of ALL guests.
  const segments = [
    { key: "email", count: channels.email, className: "bg-primary-container" },
    { key: "whatsapp", count: channels.whatsapp, className: "bg-secondary" },
    { key: "manual", count: channels.manual, className: "bg-outline-variant" },
  ];

  return (
    <div className="space-y-8">
      <section
        aria-label="Invitation numbers"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <div className={`${CARD} flex flex-col justify-between p-5`}>
          <div className="flex items-center justify-between">
            <span className="font-label-md text-label-md tracking-wide text-on-surface-variant">
              Not invited yet
            </span>
            {totals.notInvited > 0 ? (
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-secondary-container opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-secondary" />
              </span>
            ) : null}
          </div>
          <div className="mt-3">
            <div className="font-headline-md text-headline-md font-medium tracking-tight text-on-surface">
              {totals.notInvited}
            </div>
            <p className="mt-0.5 font-body-sm text-body-sm text-on-surface-variant">
              {totals.notInvited === 1 ? "guest left to invite" : "guests left to invite"}
            </p>
          </div>
        </div>

        <div className={`${CARD} flex flex-col justify-between p-5`}>
          <div className="flex items-center justify-between">
            <span className="font-label-md text-label-md tracking-wide text-on-surface-variant">
              Invited
            </span>
            <Icon name="verified" className="text-[18px] text-primary-container" />
          </div>
          <div className="mt-3">
            <div className="font-headline-md text-headline-md font-medium tracking-tight text-primary">
              {totals.invited}
            </div>
            <p className="mt-0.5 font-body-sm text-body-sm text-on-surface-variant">
              invited guests
            </p>
          </div>
        </div>

        <div
          className={`flex flex-col justify-between rounded-xl border p-5 shadow-[0_2px_12px_-2px_rgba(42,38,34,0.04),0_1px_3px_0_rgba(42,38,34,0.02)] ${
            failed > 0
              ? "border-secondary/20 bg-secondary-fixed/5"
              : "border-on-surface/5 bg-surface-container-lowest"
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`flex items-center gap-1.5 font-label-md text-label-md tracking-wide ${
                failed > 0 ? "font-semibold text-secondary" : "text-on-surface-variant"
              }`}
            >
              {failed > 0 ? <Icon name="error" className="text-[17px] text-secondary" /> : null}
              Delivery issue
            </span>
            {failed > 0 ? (
              <a
                href="#needs-attention"
                className="font-label-sm text-label-sm font-semibold text-secondary hover:underline"
              >
                Review
              </a>
            ) : null}
          </div>
          <div className="mt-3">
            <div
              className={`font-headline-md text-headline-md font-medium tracking-tight ${failed > 0 ? "text-secondary" : "text-on-surface"}`}
            >
              {failed} {failed === 1 ? "email" : "emails"} failed
            </div>
            <p
              className={`mt-0.5 font-body-sm text-body-sm ${failed > 0 ? "text-secondary" : "text-on-surface-variant"}`}
            >
              {failed > 0 ? "Needs your attention" : "All clear"}
            </p>
          </div>
        </div>

        <div className={`${CARD} flex flex-col justify-between p-5`}>
          <div className="flex items-center justify-between">
            <span className="font-label-md text-label-md tracking-wide text-on-surface-variant">
              Incomplete registry
            </span>
            <Icon name="contact_phone" className="text-[18px] text-outline" />
          </div>
          <div className="mt-3">
            <div className="font-headline-md text-headline-md font-medium tracking-tight text-on-surface">
              {totals.noContact}
            </div>
            <p className="mt-0.5 font-body-sm text-body-sm text-on-surface-variant">
              guests with no contact details
            </p>
          </div>
        </div>
      </section>

      <section className={`${CARD} p-6`}>
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-baseline">
          <div>
            <h2 className="font-headline-sm text-headline-sm font-medium tracking-tight text-on-surface">
              {totals.invited} of {totals.guests} guests invited
            </h2>
            <p className="mt-0.5 font-body-sm text-body-sm text-on-surface-variant">
              {totals.guests === 0
                ? "Add guests, then invite them from here."
                : remaining === 0
                  ? "Everyone on your list has been invited."
                  : `${remaining} ${remaining === 1 ? "guest is" : "guests are"} still to invite.`}
            </p>
          </div>
          <div className="font-title text-title font-semibold text-primary-container">
            {coverage}%{" "}
            <span className="font-body-sm text-body-sm font-normal text-on-surface-variant">
              coverage
            </span>
          </div>
        </div>
        <div
          role="progressbar"
          aria-label="Guests invited"
          aria-valuenow={coverage}
          aria-valuemin={0}
          aria-valuemax={100}
          className="mt-4 flex h-2 w-full overflow-hidden rounded-full bg-surface-container-high"
        >
          {segments.map((segment) =>
            segment.count > 0 ? (
              <div
                key={segment.key}
                className={`h-full transition-all duration-500 ease-out ${segment.className}`}
                style={{ width: `${(segment.count / Math.max(1, totals.guests)) * 100}%` }}
              />
            ) : null,
          )}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-on-surface/5 pt-3 font-body-sm text-body-sm text-on-surface">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary-container" />
            <span>
              Sent by email (
              <strong className="font-semibold text-primary">{channels.email}</strong>)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-secondary" />
            <span>
              Shared on WhatsApp (<strong className="font-semibold">{channels.whatsapp}</strong>)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-outline-variant" />
            <span>
              Marked as invited in person (
              <strong className="font-semibold">{channels.manual}</strong>)
            </span>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <div id="needs-attention" className={`${CARD} space-y-6 p-6`}>
          <div className="flex items-center justify-between gap-3 border-b border-on-surface/5 pb-4">
            <div>
              <h2 className="flex items-center gap-2 font-title text-title text-on-surface">
                <Icon name="notification_important" className="text-[20px] text-secondary" />
                Needs attention
              </h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Resolve delivery exceptions and guests nobody can reach.
              </p>
            </div>
            {failed > 0 ? (
              <button
                type="button"
                onClick={onRetryAll}
                disabled={retryingKey !== null}
                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-on-surface/20 px-3 py-1.5 font-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container disabled:opacity-60"
              >
                <Icon name="replay" className="text-[16px]" />
                {retryingKey === "all" ? "Retrying…" : "Retry all failed"}
              </button>
            ) : null}
          </div>

          {failed === 0 && totals.noContact === 0 ? (
            <div className="flex items-center gap-3 rounded-lg bg-surface-container-low/60 p-4">
              <Icon name="check_circle" className="text-[22px] text-primary-container" />
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Nothing needs attention. Every email went out and everyone has a way to be reached.
              </p>
            </div>
          ) : null}

          {failed > 0 ? (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-label-md text-label-md font-semibold tracking-wider text-secondary uppercase">
                  <span className="h-1.5 w-1.5 rounded-full bg-secondary" />
                  Group A: Failed emails ({failed})
                </div>
              </div>
              <ul className="space-y-2.5">
                {failures.map((failure) => (
                  <li
                    key={failure.guestId}
                    className="flex items-center justify-between gap-3 rounded-lg border border-on-surface/5 bg-surface-container-low/60 p-3 text-body-sm"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="font-semibold text-on-surface">{failure.name}</div>
                      <div className="truncate font-mono text-[12px] text-on-surface-variant">
                        {failure.email}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1 font-label-sm text-label-sm text-secondary">
                        <Icon name="info" className="text-[14px]" />
                        <span>
                          {failure.error?.message ??
                            failure.error?.code ??
                            "The email could not be sent"}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRetryOne(failure)}
                      disabled={retryingKey !== null}
                      aria-label={`Retry ${failure.name}`}
                      className="shrink-0 rounded border border-on-surface/10 bg-surface px-3 py-1 font-label-md text-label-md text-primary transition-colors hover:bg-surface-container disabled:opacity-60"
                    >
                      {retryingKey === failure.guestId ? "Retrying…" : "Retry"}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {totals.noContact > 0 ? (
            <div className={failed > 0 ? "border-t border-on-surface/5 pt-2" : ""}>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-label-md text-label-md font-semibold tracking-wider text-on-surface uppercase">
                  <span className="h-1.5 w-1.5 rounded-full bg-outline" />
                  Group B: No contact details ({noContactGuests.length} of {totals.noContact})
                </div>
                <Link
                  href="/dashboard/guests"
                  className="font-label-sm text-label-sm text-primary hover:underline"
                >
                  View all {totals.noContact}
                </Link>
              </div>
              <ul className="divide-y divide-on-surface/5">
                {noContactGuests.map((guest) => (
                  <li
                    key={guest.id}
                    className="flex items-center justify-between gap-3 py-2.5 text-body-sm"
                  >
                    <div className="min-w-0">
                      <span className="font-medium text-on-surface">{guest.name}</span>
                      {guest.label ? (
                        <span className="ml-2 text-on-surface-variant">{guest.label}</span>
                      ) : null}
                    </div>
                    <Link
                      href={`/dashboard/guests?guest=${guest.id}`}
                      className="shrink-0 font-label-md text-label-md font-semibold text-primary transition-colors hover:text-secondary"
                    >
                      Add phone or email
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className={`${CARD} flex flex-col justify-between p-6`}>
          <div>
            <div className="mb-4 flex items-center justify-between gap-3 border-b border-on-surface/5 pb-4">
              <div>
                <h2 className="flex items-center gap-2 font-title text-title text-on-surface">
                  <Icon name="history" className="text-[20px] text-primary-container" />
                  Recent sends
                </h2>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  The latest email invitations and reminders.
                </p>
              </div>
            </div>
            {batches.length === 0 ? (
              <p className="py-6 text-center font-body-sm text-body-sm text-on-surface-variant">
                Nothing sent yet. Choose &quot;Send invitations&quot; to email your guests.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="stack-table w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-on-surface/5 font-label-sm text-label-sm tracking-wider text-on-surface-variant uppercase">
                      <th className="pb-2.5 font-semibold">Date &amp; time</th>
                      <th className="pb-2.5 font-semibold">Channel</th>
                      <th className="pb-2.5 font-semibold">Guests</th>
                      <th className="pb-2.5 font-semibold">Result</th>
                      {canViewLog ? (
                        <th className="pb-2.5 text-right font-semibold">Action</th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-on-surface/5 text-body-sm">
                    {batches.map((batch) => (
                      <tr
                        key={batch.batchId}
                        className="transition-colors hover:bg-surface-container-low/40"
                      >
                        <td data-slot="main" className="py-3.5 font-medium text-on-surface">
                          {batchWhen(batch.at, timezone, now)}
                          <div className="font-label-sm text-label-sm font-normal text-on-surface-variant">
                            {batch.kind === "reminder" ? "RSVP reminder" : "Invitation"}
                          </div>
                        </td>
                        <td data-label="Channel" className="py-3.5">
                          <span className="inline-flex items-center gap-1 rounded bg-surface-container px-2 py-0.5 font-label-sm text-label-sm font-medium text-primary">
                            <Icon name="mail" className="text-[13px]" />
                            Email
                          </span>
                        </td>
                        <td data-label="Guests" className="py-3.5 text-on-surface">
                          {batch.total} {batch.total === 1 ? "guest" : "guests"}
                        </td>
                        <td data-label="Result" className="py-3.5">
                          {batch.failed > 0 ? (
                            <div className="flex items-center gap-1">
                              <span>{batch.sent} sent,</span>
                              <span className="font-semibold text-secondary">
                                {batch.failed} failed
                              </span>
                            </div>
                          ) : (
                            <span className="font-medium text-primary">{batch.sent} sent</span>
                          )}
                        </td>
                        {canViewLog ? (
                          <td data-label="Details" className="py-3.5 text-right">
                            <button
                              type="button"
                              onClick={() => onViewBatch(batch.batchId)}
                              className="font-label-md text-label-md font-semibold text-primary transition-colors hover:text-secondary"
                            >
                              View
                            </button>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-surface-container-low p-3 text-label-md text-on-surface-variant">
            <Icon name="chat" className="text-[16px] text-primary" />
            WhatsApp messages open pre-filled on your phone for you to send, so they aren&apos;t
            listed here.
          </div>
        </div>
      </section>
    </div>
  );
}
