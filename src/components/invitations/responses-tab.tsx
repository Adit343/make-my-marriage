"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon, type IconName } from "@/components/ui/icon";
import type { GuestEventInfo } from "@/lib/guests/types";
import { initialsOf } from "@/lib/text/initials";
import { feedWhen, invitedAgo, peopleLabel, percent, replySegments } from "@/lib/invitations/view";
import type {
  EventReplies,
  EventReplyRow,
} from "@/modules/guest-invitations/invitation-overview.service";

// Stitch "RSVP Tracker" (the RSVP responses tab): pick an event, see its headcount, chase the guests
// who haven't answered, and read the latest replies and messages. All of it comes from the guests'
// real RSVP rows.

const CARD =
  "rounded-xl border border-[rgba(42,38,34,0.04)] bg-surface-container-lowest shadow-[0_2px_12px_-2px_rgba(42,38,34,0.04)]";

const AVATAR_TONES = [
  "bg-surface-container-high text-primary",
  "bg-secondary-fixed text-on-secondary-fixed",
  "bg-primary-fixed text-on-primary-fixed",
];

const CHANNEL_ICON: Record<"email" | "whatsapp" | "manual", { icon: IconName; title: string }> = {
  email: { icon: "mail", title: "Email" },
  whatsapp: { icon: "chat", title: "WhatsApp" },
  manual: { icon: "fact_check", title: "Told in person" },
};

const DOT = {
  attending: "bg-primary-container",
  declined: "bg-secondary",
  maybe: "bg-secondary-container",
  pending: "bg-outline-variant",
} as const;

export function ResponsesTab({
  events,
  eventId,
  replies,
  loading,
  failed,
  now,
  timezone,
  busy,
  onSelectEvent,
  onRecord,
  onSendReminder,
  onMarkInvited,
  onReload,
}: {
  events: GuestEventInfo[];
  eventId: string | null;
  replies: EventReplies | null;
  loading: boolean;
  failed: boolean;
  now: number;
  timezone: string;
  busy: boolean;
  onSelectEvent: (eventId: string) => void;
  onRecord: (row: EventReplyRow) => void;
  onSendReminder: (rows: EventReplyRow[]) => void;
  onMarkInvited: (rows: EventReplyRow[]) => void;
  onReload: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filtering, setFiltering] = useState(false);
  const [query, setQuery] = useState("");

  const event = events.find((candidate) => candidate.id === eventId) ?? null;
  const rows = useMemo(() => replies?.rows ?? [], [replies]);
  const pending = useMemo(() => rows.filter((row) => row.status === "pending"), [rows]);
  const visiblePending = useMemo(() => {
    const text = query.trim().toLowerCase();
    return text ? pending.filter((row) => row.name.toLowerCase().includes(text)) : pending;
  }, [pending, query]);
  const selectedRows = pending.filter((row) => selected.has(row.guestId));

  const byStatus = replies?.byStatus ?? { attending: 0, declined: 0, maybe: 0, pending: 0 };
  const totalGuests = byStatus.attending + byStatus.declined + byStatus.maybe + byStatus.pending;
  const replied = totalGuests - byStatus.pending;
  const widths = replySegments(byStatus);

  const latest = useMemo(
    () =>
      rows
        .filter((row) => row.respondedAt)
        .sort((a, b) => b.respondedAt!.localeCompare(a.respondedAt!)),
    [rows],
  );
  const withNotes = useMemo(() => latest.filter((row) => row.note), [latest]);

  function toggle(guestId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(guestId)) next.delete(guestId);
      else next.add(guestId);
      return next;
    });
  }

  const allShownSelected =
    visiblePending.length > 0 && visiblePending.every((row) => selected.has(row.guestId));

  function exportCsv() {
    const header = ["Name", "Group", "Reply", "People coming", "Note", "Replied on"];
    const lines = rows.map((row) =>
      [
        row.name,
        row.groupName ?? "",
        row.status,
        row.attendingCount,
        row.note ?? "",
        row.respondedAt ?? "",
      ]
        .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
        .join(","),
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `rsvp-${(event?.name ?? "event").toLowerCase().replace(/\W+/g, "-")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[#2A2622]/15 bg-surface-container-lowest px-6 py-16 text-center">
        <Icon name="event" className="text-[28px] text-outline" />
        <h2 className="font-headline-sm text-headline-sm font-medium text-[#2A2622]">
          Add an event first
        </h2>
        <p className="max-w-md font-body-md text-body-md text-on-surface-variant">
          Replies are collected per event. Create your Haldi, Sangeet or ceremony, then invite
          guests to it.
        </p>
        <Link
          href="/dashboard/events"
          className="rounded-lg bg-primary-container px-4 py-2.5 font-label-md text-label-md text-on-primary"
        >
          Go to Events
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div
        role="tablist"
        aria-label="Event"
        className="custom-scrollbar flex items-center gap-2 overflow-x-auto pb-2"
      >
        {events.map((candidate) => {
          const active = candidate.id === eventId;
          return (
            <button
              key={candidate.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setSelected(new Set());
                setQuery("");
                onSelectEvent(candidate.id);
              }}
              className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 font-body-sm text-body-sm font-medium whitespace-nowrap transition-colors ${
                active
                  ? "bg-primary-container text-surface-container-lowest shadow-sm"
                  : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high hover:text-primary"
              }`}
            >
              <span>{candidate.name}</span>
              {active ? <span className="h-1.5 w-1.5 rounded-full bg-secondary-fixed" /> : null}
            </button>
          );
        })}
      </div>

      <section aria-label={`${event?.name ?? "Event"} headcount`} className={`${CARD} p-6 md:p-8`}>
        <div className="mb-4 flex flex-col justify-between gap-4 md:flex-row md:items-baseline">
          <div>
            <div className="mb-1 font-label-sm text-label-sm font-semibold tracking-wider text-outline uppercase">
              {event?.name} attendee projection
            </div>
            <h2 className="font-headline-lg text-headline-lg leading-none text-primary">
              {replies?.totalAttendingCount ?? 0} attending
            </h2>
          </div>
          <div className="flex items-start gap-4 md:text-right">
            <div>
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                {replied} of {totalGuests} {totalGuests === 1 ? "guest has" : "guests have"} replied
              </span>
              <div className="mt-0.5 font-label-sm text-label-sm font-medium text-primary">
                {percent(replied, totalGuests)}% replied
              </div>
            </div>
            <button
              type="button"
              onClick={exportCsv}
              disabled={rows.length === 0}
              className="flex items-center gap-2 rounded-lg border border-[rgba(42,38,34,0.15)] px-3 py-1.5 font-body-sm text-body-sm font-medium text-on-surface transition-colors hover:bg-surface-container disabled:opacity-50"
            >
              <Icon name="ios_share" className="text-[18px]" />
              Export CSV
            </button>
          </div>
        </div>

        <div
          role="img"
          aria-label={`Attending ${byStatus.attending}, declined ${byStatus.declined}, maybe ${byStatus.maybe}, pending ${byStatus.pending}`}
          className="mb-4 flex h-3 w-full overflow-hidden rounded-full bg-surface-container"
        >
          {(["attending", "declined", "maybe", "pending"] as const).map((status) =>
            widths[status] > 0 ? (
              <div
                key={status}
                title={`${status}: ${byStatus[status]}`}
                className={`h-full ${DOT[status]}`}
                style={{ width: `${widths[status]}%` }}
              />
            ) : null,
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-2">
          {(
            [
              [
                "attending",
                "Attending:",
                `${byStatus.attending} ${byStatus.attending === 1 ? "guest" : "guests"}`,
              ],
              ["declined", "Declined:", String(byStatus.declined)],
              ["maybe", "Maybe:", String(byStatus.maybe)],
              ["pending", "Pending:", String(byStatus.pending)],
            ] as const
          ).map(([status, label, value]) => (
            <div key={status} className="flex items-center gap-2">
              <span className={`h-3 w-3 rounded-full ${DOT[status]}`} />
              <span className="font-body-sm text-body-sm font-medium text-on-surface">{label}</span>
              <span
                className={`font-body-sm text-body-sm ${status === "attending" ? "font-bold text-primary" : "text-on-surface-variant"}`}
              >
                {value}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-4 border-t border-[rgba(42,38,34,0.06)] pt-3 font-body-sm text-body-sm text-outline">
          Headcount counts everyone who confirmed, including plus-ones.
        </p>
      </section>

      {failed ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-error/20 bg-error-container/20 p-8 text-center">
          <p className="font-body-md text-body-md text-error">Couldn&apos;t load the replies.</p>
          <button
            type="button"
            onClick={onReload}
            className="rounded-lg border border-on-surface/20 px-4 py-2 font-label-md text-label-md text-on-surface hover:bg-surface-container"
          >
            Try again
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className={`${CARD} flex flex-col overflow-hidden lg:col-span-7`}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[rgba(42,38,34,0.06)] bg-surface-container-low px-6 py-3.5">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  aria-label="Select everyone shown"
                  checked={allShownSelected}
                  disabled={visiblePending.length === 0}
                  onChange={() =>
                    setSelected(
                      allShownSelected
                        ? new Set()
                        : new Set(visiblePending.map((row) => row.guestId)),
                    )
                  }
                  className="h-4 w-4 rounded border-outline/40 text-primary-container focus:ring-primary"
                />
                {selectedRows.length > 0 ? (
                  <>
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary-container font-label-sm text-label-sm font-semibold text-surface-container-lowest">
                      {selectedRows.length}
                    </span>
                    <span className="font-body-sm text-body-sm font-semibold text-primary">
                      {selectedRows.length} selected
                    </span>
                    <span className="text-xs text-outline">• of {pending.length} pending</span>
                  </>
                ) : (
                  <span className="font-body-sm text-body-sm text-on-surface-variant">
                    Select guests to remind them
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={selectedRows.length === 0 || busy}
                  onClick={() => onMarkInvited(selectedRows)}
                  className="rounded-lg px-3 py-1.5 font-body-sm text-body-sm text-on-surface-variant transition-colors hover:bg-surface-container hover:text-primary disabled:opacity-40"
                >
                  Mark as invited
                </button>
                <button
                  type="button"
                  disabled={selectedRows.length === 0 || busy}
                  onClick={() => onSendReminder(selectedRows)}
                  className="flex items-center gap-1.5 rounded-lg bg-primary-container px-3.5 py-1.5 font-body-sm text-body-sm font-semibold text-surface-container-lowest shadow-sm transition-colors hover:bg-primary disabled:opacity-40"
                >
                  <Icon name="send" className="text-[16px]" />
                  Send reminder
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between border-b border-[rgba(42,38,34,0.04)] px-6 py-4">
              <div>
                <h3 className="font-title text-title text-primary">Not replied yet</h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Guests awaiting first response for {event?.name}
                </p>
              </div>
              <button
                type="button"
                aria-label="Search the list"
                aria-pressed={filtering}
                onClick={() => {
                  setFiltering((value) => !value);
                  setQuery("");
                }}
                className="rounded p-1.5 text-on-surface-variant hover:bg-surface-container hover:text-primary"
              >
                <Icon name="filter_list" />
              </button>
            </div>
            {filtering ? (
              <div className="border-b border-[rgba(42,38,34,0.04)] px-6 py-3">
                <input
                  type="search"
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search by name"
                  aria-label="Search guests by name"
                  className="w-full rounded-lg border border-on-surface/15 bg-surface-container-low px-3 py-1.5 font-body-sm text-body-sm focus:border-primary-container focus:ring-0 focus:outline-hidden"
                />
              </div>
            ) : null}

            {loading && !replies ? (
              <div role="status" aria-label="Loading replies" className="space-y-3 p-6">
                {[0, 1, 2].map((key) => (
                  <div key={key} className="h-12 animate-pulse rounded-lg bg-surface-container" />
                ))}
              </div>
            ) : rows.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
                <Icon name="group" className="text-[28px] text-outline" />
                <p className="font-body-md text-body-md text-on-surface-variant">
                  Nobody is invited to {event?.name} yet.
                </p>
                <Link
                  href={`/dashboard/guests?event=${eventId}`}
                  className="font-label-md text-label-md font-semibold text-primary hover:underline"
                >
                  Manage guests
                </Link>
              </div>
            ) : visiblePending.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
                <Icon name="check_circle" className="text-[28px] text-primary-container" />
                <p className="font-body-md text-body-md text-on-surface-variant">
                  {pending.length === 0
                    ? `Everyone has replied for ${event?.name}.`
                    : "No one matches that search."}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-[rgba(42,38,34,0.04)]">
                {visiblePending.map((row, index) => {
                  const channel = row.invitedVia ? CHANNEL_ICON[row.invitedVia] : null;
                  const checked = selected.has(row.guestId);
                  return (
                    <li
                      key={row.guestId}
                      className={`flex items-center justify-between px-6 py-3.5 transition-colors hover:bg-surface-container-low/50 ${checked ? "bg-surface-container-low/20" : ""}`}
                    >
                      <div className="flex min-w-0 items-center gap-3.5">
                        <input
                          type="checkbox"
                          aria-label={`Select ${row.name}`}
                          checked={checked}
                          onChange={() => toggle(row.guestId)}
                          className="h-4 w-4 rounded border-outline/40 text-primary-container focus:ring-primary"
                        />
                        <div
                          aria-hidden="true"
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-label-md text-label-md font-semibold ${AVATAR_TONES[index % AVATAR_TONES.length]}`}
                        >
                          {initialsOf(row.name)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-body-sm text-body-sm font-semibold text-primary">
                              {row.name}
                            </span>
                            {row.groupName ? (
                              <span className="shrink-0 rounded bg-surface-container px-2 py-0.5 text-[11px] font-medium text-on-surface-variant">
                                {row.groupName}
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-0.5 flex items-center gap-2 font-body-sm text-body-sm text-outline">
                            {channel ? (
                              <Icon name={channel.icon} className="text-[15px]" />
                            ) : (
                              <Icon name="hourglass_empty" className="text-[15px]" />
                            )}
                            <span title={channel?.title}>{invitedAgo(row.invitedAt, now)}</span>
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRecord(row)}
                        className="ml-4 shrink-0 font-body-sm text-body-sm font-semibold text-primary underline decoration-[rgba(181,113,74,0.4)] underline-offset-4 hover:text-secondary"
                      >
                        Record response
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className={`${CARD} flex flex-col justify-between p-6 lg:col-span-5`}>
            <div>
              <div className="mb-5 flex items-center justify-between border-b border-[rgba(42,38,34,0.04)] pb-3">
                <div>
                  <h3 className="font-title text-title text-primary">Latest responses</h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Replies from guest links and your own entries
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onReload}
                  aria-label="Refresh replies"
                  title="Refresh"
                  className="rounded p-1.5 text-on-surface-variant hover:bg-surface-container hover:text-primary"
                >
                  <Icon name="sync" className="text-[18px]" />
                </button>
              </div>
              {latest.length === 0 ? (
                <p className="py-6 text-center font-body-sm text-body-sm text-on-surface-variant">
                  No replies yet for {event?.name}.
                </p>
              ) : (
                <ul className="space-y-4">
                  {latest.slice(0, 5).map((row) => (
                    <li key={row.guestId}>
                      <button
                        type="button"
                        onClick={() => onRecord(row)}
                        className="flex w-full items-start gap-3 rounded-lg text-left font-body-sm text-body-sm transition-colors hover:bg-surface-container-low/60"
                      >
                        <span
                          className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${DOT[row.status]}`}
                          title={row.status}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-1">
                            <span className="truncate font-medium text-on-surface">
                              <span className="font-semibold text-primary">{row.name}</span>
                              {row.status === "attending" ? (
                                <>
                                  {" "}
                                  is attending{" "}
                                  <span className="font-normal text-on-surface-variant">
                                    ({peopleLabel(row.attendingCount)})
                                  </span>
                                </>
                              ) : row.status === "maybe" ? (
                                " marked Maybe"
                              ) : (
                                " declined"
                              )}
                            </span>
                            <span className="text-xs whitespace-nowrap text-outline">
                              {feedWhen(row.respondedAt!, now, timezone)}
                            </span>
                          </span>
                          {row.note ? (
                            <span className="mt-0.5 flex items-center gap-1.5 text-xs text-on-surface-variant">
                              <Icon name="sticky_note_2" className="text-[14px] text-secondary" />
                              <span className="truncate italic">&ldquo;{row.note}&rdquo;</span>
                            </span>
                          ) : (
                            <span className="mt-0.5 block text-xs text-on-surface-variant">
                              {row.respondedVia === "guest_link"
                                ? "Confirmed via guest link"
                                : "Recorded by the team"}
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="mt-6 flex items-center justify-between border-t border-[rgba(42,38,34,0.06)] pt-4">
              <span className="font-body-sm text-body-sm text-outline">
                Showing recent {Math.min(5, latest.length)} of {latest.length}{" "}
                {latest.length === 1 ? "reply" : "replies"}
              </span>
              <Link
                href={`/dashboard/guests?event=${eventId}`}
                className="font-body-sm text-body-sm font-medium text-primary hover:text-secondary"
              >
                Open guest list →
              </Link>
            </div>
          </div>
        </div>
      )}

      {withNotes.length > 0 ? (
        <section className={`${CARD} p-6 md:p-8`}>
          <div className="mb-6 flex items-center justify-between border-b border-[rgba(42,38,34,0.04)] pb-2">
            <div>
              <h3 className="font-title text-title text-primary">Guest messages</h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Personal notes shared during RSVP
              </p>
            </div>
            <span className="rounded-md bg-surface-container px-2.5 py-1 font-label-md text-label-md font-medium text-on-surface">
              {withNotes.length} total {withNotes.length === 1 ? "note" : "notes"}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {withNotes.slice(0, 3).map((row) => (
              <figure
                key={row.guestId}
                className="relative flex flex-col justify-between rounded-xl border border-[rgba(42,38,34,0.04)] bg-surface-container-low/70 p-5"
              >
                <blockquote>
                  <span
                    aria-hidden="true"
                    className="font-display text-2xl leading-none text-secondary"
                  >
                    “
                  </span>
                  <p className="mt-1 mb-4 font-headline-sm text-headline-sm text-primary italic">
                    {row.note}
                  </p>
                </blockquote>
                <figcaption className="flex items-center justify-between border-t border-[rgba(42,38,34,0.06)] pt-3">
                  <div>
                    <span className="block font-body-sm text-body-sm font-semibold text-primary">
                      {row.name}
                    </span>
                    {row.groupName ? (
                      <span className="font-label-sm text-label-sm text-outline">
                        {row.groupName}
                      </span>
                    ) : null}
                  </div>
                  <span className="rounded bg-surface-container-highest px-2 py-0.5 text-[11px] font-medium text-on-surface-variant">
                    {event?.name}
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
