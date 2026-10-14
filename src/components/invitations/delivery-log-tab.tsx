"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchEmailLogs,
  retryEmailLog,
  type EmailLogPage,
} from "@/components/invitations/invitations-api";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/client/api-client";
import type { EmailStatus } from "@/lib/constants/enums";
import { logNote, logTimestamp } from "@/lib/invitations/view";
import type { EmailLogDto } from "@/modules/guest-invitations/invitation-overview.service";

// Stitch "Invitations Hub", Delivery log: every guest email attempt, newest first, with its status
// and the provider's error. Owners and admins only (the guests' email addresses are listed). The log
// never holds an email's body or link.

const STATUS_FILTERS: { value: EmailStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "failed", label: "Failed" },
  { value: "sent", label: "Sent" },
];

export function DeliveryLogTab({
  weddingId,
  timezone,
  batchId,
  onClearBatch,
  onChanged,
}: {
  weddingId: string;
  timezone: string;
  /** Show only one send batch (from "View" in Recent sends). */
  batchId: string | null;
  onClearBatch: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [status, setStatus] = useState<EmailStatus | "all">("all");
  const [text, setText] = useState("");
  // What was loaded, and for which filters: while the filters differ, the log is still loading.
  const key = `${status}|${batchId ?? ""}`;
  const [result, setResult] = useState<{
    key: string;
    rows: EmailLogDto[];
    page: Pick<EmailLogPage, "nextCursor" | "hasMore">;
    failed: boolean;
  } | null>(null);
  const [reloads, setReloads] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [retrying, setRetrying] = useState<string | null>(null);

  const current = result?.key === key ? result : null;
  const rows = useMemo(() => current?.rows ?? [], [current]);
  const page = current?.page ?? null;
  const loading = current === null;
  const failed = current?.failed ?? false;

  useEffect(() => {
    const controller = new AbortController();
    fetchEmailLogs(
      weddingId,
      { status: status === "all" ? undefined : status, batchId: batchId ?? undefined, limit: 20 },
      controller.signal,
    )
      .then((loaded) =>
        setResult({
          key,
          rows: loaded.items,
          page: { nextCursor: loaded.nextCursor, hasMore: loaded.hasMore },
          failed: false,
        }),
      )
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setResult({ key, rows: [], page: { nextCursor: null, hasMore: false }, failed: true });
      });
    return () => controller.abort();
  }, [weddingId, status, batchId, key, reloads]);

  async function loadMore() {
    if (!page?.nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const more = await fetchEmailLogs(weddingId, {
        status: status === "all" ? undefined : status,
        batchId: batchId ?? undefined,
        cursor: page.nextCursor,
        limit: 20,
      });
      setResult((latest) =>
        latest?.key === key
          ? {
              ...latest,
              rows: [...latest.rows, ...more.items],
              page: { nextCursor: more.nextCursor, hasMore: more.hasMore },
            }
          : latest,
      );
    } catch (error) {
      toast({ type: "error", title: "Couldn't load more", message: errorMessage(error) });
    } finally {
      setLoadingMore(false);
    }
  }

  async function retry(row: EmailLogDto) {
    setRetrying(row.id);
    try {
      const result = await retryEmailLog(weddingId, row.id);
      toast(
        result.sent > 0
          ? { type: "success", title: "Email sent", message: row.recipientEmail }
          : {
              type: "error",
              title: "Still couldn't send",
              message:
                result.results[0]?.error?.message ??
                result.results[0]?.reason ??
                "Try again later.",
            },
      );
      setReloads((value) => value + 1);
      onChanged();
    } catch (error) {
      toast({ type: "error", title: "Couldn't retry", message: errorMessage(error) });
    } finally {
      setRetrying(null);
    }
  }

  const visible = useMemo(() => {
    const query = text.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter(
      (row) =>
        row.recipientEmail.toLowerCase().includes(query) ||
        (row.guestName ?? "").toLowerCase().includes(query),
    );
  }, [rows, text]);

  return (
    <section className="space-y-4 rounded-xl border border-on-surface/5 bg-surface-container-lowest p-6 shadow-[0_2px_12px_-2px_rgba(42,38,34,0.04),0_1px_3px_0_rgba(42,38,34,0.02)]">
      <div className="flex flex-col justify-between gap-3 border-b border-on-surface/5 pb-4 sm:flex-row sm:items-center">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-headline-sm text-headline-sm font-medium text-on-surface">
            Delivery log
          </h2>
          <span className="flex items-center gap-1 rounded bg-surface-container-high px-2.5 py-1 font-label-sm text-label-sm tracking-wider text-on-surface-variant uppercase">
            <Icon name="lock" className="text-[14px]" />
            Visible to owners and admins only
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div
            role="group"
            aria-label="Filter by status"
            className="flex rounded-lg border border-on-surface/15 p-0.5"
          >
            {STATUS_FILTERS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={status === option.value}
                onClick={() => setStatus(option.value)}
                className={`rounded-md px-3 py-1 font-label-md text-label-md transition-colors ${
                  status === option.value
                    ? "bg-primary-container text-on-primary"
                    : "text-on-surface-variant hover:bg-surface-container"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="relative">
            <Icon
              name="search"
              className="pointer-events-none absolute top-2 left-2.5 text-[18px] text-outline"
            />
            <input
              type="search"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Filter by name or email..."
              aria-label="Filter the log by name or email"
              className="w-64 rounded-lg border border-on-surface/15 bg-surface-container-low py-1.5 pr-3 pl-8 font-body-sm text-body-sm text-on-surface transition-all placeholder:text-on-surface-variant/40 focus:border-primary-container focus:bg-surface-container-lowest focus:ring-0 focus:outline-hidden"
            />
          </div>
        </div>
      </div>

      {batchId ? (
        <div className="flex items-center justify-between rounded-lg bg-surface-container-low px-4 py-2.5 font-body-sm text-body-sm text-on-surface-variant">
          <span>Showing one send batch (#{batchId.slice(0, 6).toUpperCase()}).</span>
          <button
            type="button"
            onClick={onClearBatch}
            className="font-label-md text-label-md font-semibold text-primary hover:underline"
          >
            Show all
          </button>
        </div>
      ) : null}

      {failed ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="font-body-md text-body-md text-error">
            Couldn&apos;t load the delivery log.
          </p>
          <button
            type="button"
            onClick={() => setReloads((value) => value + 1)}
            className="rounded-lg border border-on-surface/20 px-4 py-2 font-label-md text-label-md hover:bg-surface-container"
          >
            Try again
          </button>
        </div>
      ) : loading && rows.length === 0 ? (
        <div role="status" aria-label="Loading the delivery log" className="space-y-3 py-4">
          {[0, 1, 2].map((key) => (
            <div key={key} className="h-12 animate-pulse rounded-lg bg-surface-container" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <p className="py-10 text-center font-body-md text-body-md text-on-surface-variant">
          {rows.length === 0
            ? "No emails have been sent yet."
            : "Nothing in the loaded log matches that search."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="stack-table w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-on-surface/5 font-label-sm text-label-sm tracking-wider text-on-surface-variant uppercase">
                <th className="py-3 font-semibold">Recipient email</th>
                <th className="py-3 font-semibold">Type</th>
                <th className="py-3 font-semibold">Status</th>
                <th className="py-3 font-semibold">Timestamp</th>
                <th className="py-3 font-semibold">Error code / Notes</th>
                <th className="py-3 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-on-surface/5 text-body-sm">
              {visible.map((row) => (
                <tr key={row.id} className="transition-colors hover:bg-surface-container-low/40">
                  <td data-slot="main" className="py-3.5 font-mono text-[13px] text-on-surface">
                    {row.recipientEmail}
                    {row.guestName ? (
                      <div
                        className="font-body-sm text-body-sm text-on-surface-variant"
                        style={{ fontFamily: "var(--font-jakarta), sans-serif" }}
                      >
                        {row.guestName}
                      </div>
                    ) : null}
                  </td>
                  <td data-label="Type" className="py-3.5">
                    <span
                      className={`rounded px-2 py-0.5 font-label-sm text-label-sm font-medium ${
                        row.type === "rsvp_reminder"
                          ? "bg-surface-container-high text-on-surface-variant"
                          : "bg-surface-container text-primary"
                      }`}
                    >
                      {row.type === "rsvp_reminder" ? "Reminder" : "Invitation"}
                    </span>
                  </td>
                  <td data-label="Status" className="py-3.5">
                    <span
                      className={`inline-flex items-center gap-1.5 font-semibold ${row.status === "failed" ? "text-secondary" : "text-primary"}`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${row.status === "failed" ? "bg-secondary" : "bg-primary-container"}`}
                      />
                      {row.status === "failed" ? "Failed" : "Sent"}
                    </span>
                  </td>
                  <td
                    data-label="Time"
                    className="py-3.5 font-mono text-[12px] text-on-surface-variant"
                  >
                    {logTimestamp(row.sentAt ?? row.createdAt, timezone)}
                    {row.attempts > 1 ? (
                      <div className="font-body-sm text-[11px]">{row.attempts} attempts</div>
                    ) : null}
                  </td>
                  <td
                    data-label="Notes"
                    className={`py-3.5 font-mono text-[12px] ${row.status === "failed" ? "text-secondary" : "text-on-surface-variant"}`}
                  >
                    {row.status === "failed"
                      ? logNote(row.error)
                      : "None (delivered to the provider)"}
                  </td>
                  <td data-slot="actions" className="py-3.5 text-right">
                    {row.status === "failed" ? (
                      <button
                        type="button"
                        onClick={() => void retry(row)}
                        disabled={retrying !== null}
                        aria-label={`Retry ${row.recipientEmail}`}
                        className="rounded border border-on-surface/10 bg-surface px-3 py-1 font-label-md text-label-md text-primary transition-colors hover:bg-surface-container disabled:opacity-60"
                      >
                        {retrying === row.id ? "Retrying…" : "Retry"}
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between border-t border-on-surface/5 pt-3 text-body-sm text-on-surface-variant">
        <div>
          Showing {visible.length} {visible.length === 1 ? "attempt" : "attempts"}
          {page?.hasMore ? " so far" : ""}
        </div>
        {page?.hasMore ? (
          <button
            type="button"
            disabled={loadingMore}
            onClick={() => void loadMore()}
            className="rounded border border-on-surface/10 px-3 py-1 font-label-md text-label-md transition-colors hover:bg-surface-container disabled:opacity-50"
          >
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        ) : null}
      </div>
    </section>
  );
}
