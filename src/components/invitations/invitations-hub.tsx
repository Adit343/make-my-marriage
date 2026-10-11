"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchGuests } from "@/components/guests/guests-api";
import { DeliveryLogTab } from "@/components/invitations/delivery-log-tab";
import { fetchOverview, fetchReplies, sendBatch } from "@/components/invitations/invitations-api";
import { OverviewTab } from "@/components/invitations/overview-tab";
import { RecordResponseDrawer } from "@/components/invitations/record-response-drawer";
import { ResponsesTab } from "@/components/invitations/responses-tab";
import { SendDialog, type SendGuest } from "@/components/invitations/send-dialog";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/client/api-client";
import type { InviteChannel } from "@/lib/constants/enums";
import { MAX_BATCH_GUESTS } from "@/lib/constants/invitations";
import type { GuestEventInfo } from "@/lib/guests/types";
import type { SendKind } from "@/lib/invitations/messages";
import type {
  EventReplies,
  EventReplyRow,
  InvitationsOverview,
} from "@/modules/guest-invitations/invitation-overview.service";

// Stitch "Invitations Hub" and "RSVP Tracker" (three tabs: Overview, RSVP responses, Delivery log),
// with the "Send Invitations Dialog" and the "Record response" slide-over on top.

export type InvitationsTab = "overview" | "responses" | "log";

interface SendRequest {
  kind: SendKind;
  guests: SendGuest[];
  extraCount: number;
  channel: InviteChannel;
}

export function InvitationsHub({
  weddingId,
  timezone,
  events,
  initialOverview,
  canViewLog,
  viewerLabel,
  initialTab,
  initialEventId,
  initialReplies,
  initialBatch,
  serverNow,
}: {
  weddingId: string;
  timezone: string;
  events: GuestEventInfo[];
  initialOverview: InvitationsOverview;
  canViewLog: boolean;
  /** "Diya Singhania (Owner)": who is entering manual replies. */
  viewerLabel: string;
  initialTab: InvitationsTab;
  initialEventId: string | null;
  initialReplies: EventReplies | null;
  initialBatch: string | null;
  /** When the server rendered: relative times start from this, so server and browser agree. */
  serverNow: string;
}) {
  const toast = useToast();
  const [tab, setTab] = useState<InvitationsTab>(initialTab);
  const [overview, setOverview] = useState(initialOverview);
  const [now, setNow] = useState(() => new Date(serverNow));
  const [eventId, setEventId] = useState<string | null>(initialEventId);
  const [replies, setReplies] = useState<EventReplies | null>(initialReplies);
  const [repliesLoading, setRepliesLoading] = useState(false);
  const [repliesFailed, setRepliesFailed] = useState(false);
  const [batch, setBatch] = useState<string | null>(initialBatch);
  const [sending, setSending] = useState<SendRequest | null>(null);
  const [recording, setRecording] = useState<EventReplyRow | null>(null);
  const [retryingKey, setRetryingKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const loadedReplies = useRef<string | null>(initialReplies ? initialEventId : null);

  // Keep the address in step with what is on screen, so a refresh or a shared link lands here.
  useEffect(() => {
    const params = new URLSearchParams();
    if (tab !== "overview") params.set("tab", tab);
    if (tab === "responses" && eventId) params.set("event", eventId);
    if (tab === "log" && batch) params.set("batch", batch);
    const query = params.toString();
    window.history.replaceState(null, "", `/dashboard/invitations${query ? `?${query}` : ""}`);
  }, [tab, eventId, batch]);

  const reloadOverview = useCallback(async () => {
    try {
      setOverview(await fetchOverview(weddingId));
      setNow(new Date());
    } catch {
      // A stale number is better than an error toast on top of a send that worked.
    }
  }, [weddingId]);

  const loadReplies = useCallback(
    async (id: string, signal?: AbortSignal) => {
      setRepliesLoading(true);
      setRepliesFailed(false);
      try {
        setReplies(await fetchReplies(weddingId, id, signal));
        loadedReplies.current = id;
        setNow(new Date());
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setRepliesFailed(true);
      } finally {
        setRepliesLoading(false);
      }
    },
    [weddingId],
  );

  useEffect(() => {
    if (tab !== "responses" || !eventId || loadedReplies.current === eventId) return;
    const controller = new AbortController();
    void loadReplies(eventId, controller.signal);
    return () => controller.abort();
  }, [tab, eventId, loadReplies]);

  const afterChange = useCallback(() => {
    void reloadOverview();
    if (eventId) void loadReplies(eventId);
  }, [eventId, loadReplies, reloadOverview]);

  async function openSendInvitations() {
    setPreparing(true);
    try {
      const page = await fetchGuests(weddingId, {
        inviteStatus: "not_invited",
        limit: MAX_BATCH_GUESTS,
      });
      if (page.items.length === 0) {
        toast({
          type: "info",
          title: "Everyone has been invited",
          message: "To nudge people who haven't replied, use the RSVP responses tab.",
        });
        return;
      }
      setSending({
        kind: "invitation",
        guests: page.items.map((guest) => ({
          id: guest.id,
          name: guest.name,
          label: guest.relationLabel,
          email: guest.email,
          phone: guest.phone,
          eventCount: guest.rsvps.length,
          invited: false,
        })),
        extraCount: Math.max(0, overview.totals.notInvited - page.items.length),
        channel: "email",
      });
    } catch (error) {
      toast({ type: "error", title: "Couldn't load your guests", message: errorMessage(error) });
    } finally {
      setPreparing(false);
    }
  }

  async function retryFailures(failures: InvitationsOverview["failures"], key: string) {
    setRetryingKey(key);
    try {
      let sent = 0;
      let failedAgain = 0;
      for (const kind of ["invitation", "reminder"] as const) {
        const ids = failures.filter((failure) => failure.kind === kind).map((f) => f.guestId);
        if (ids.length === 0) continue;
        const result = await sendBatch(weddingId, { guestIds: ids, channel: "email", kind });
        sent += result.sent;
        failedAgain += result.failed + result.skipped;
      }
      toast(
        failedAgain === 0
          ? {
              type: "success",
              title: "Sent",
              message: `${sent} ${sent === 1 ? "email" : "emails"} went out.`,
            }
          : {
              type: "warning",
              title: "Some emails still failed",
              message: `${sent} sent, ${failedAgain} still need attention.`,
            },
      );
      afterChange();
    } catch (error) {
      toast({ type: "error", title: "Couldn't retry", message: errorMessage(error) });
    } finally {
      setRetryingKey(null);
    }
  }

  const asSendGuest = (row: EventReplyRow): SendGuest => ({
    id: row.guestId,
    name: row.name,
    label: row.groupName,
    email: row.email,
    phone: row.phone,
    eventCount: 1,
    invited: row.invitationStatus === "invited",
  });

  async function markInvited(rows: EventReplyRow[]) {
    setBusy(true);
    try {
      const result = await sendBatch(weddingId, {
        guestIds: rows.map((row) => row.guestId),
        channel: "manual",
        kind: "invitation",
      });
      toast({
        type: "success",
        title: "Marked as invited",
        message: `${result.marked} ${result.marked === 1 ? "guest" : "guests"} recorded as invited in person.`,
      });
      afterChange();
    } catch (error) {
      toast({ type: "error", title: "Couldn't update the guests", message: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  const tabs: { id: InvitationsTab; label: string; badge?: number; dot?: boolean }[] = [
    { id: "overview", label: "Overview", dot: overview.failures.length > 0 },
    { id: "responses", label: "RSVP responses", badge: overview.responseCount },
    ...(canViewLog ? [{ id: "log" as const, label: "Delivery log" }] : []),
  ];

  const event = events.find((candidate) => candidate.id === eventId);

  return (
    <div className="mx-auto max-w-[1240px] space-y-8 pb-10">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="font-headline-lg text-headline-lg tracking-tight text-on-surface">
            Invitations
          </h1>
          <p className="mt-1.5 max-w-2xl font-body-md text-body-md text-on-surface-variant">
            Send invitations and keep track of what was delivered across email, WhatsApp, and
            offline hand-deliveries.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={() => void openSendInvitations()}
            disabled={preparing}
            className="flex items-center gap-2 rounded-lg bg-primary-container px-5 py-2.5 font-label-md text-label-md text-on-primary shadow-sm transition-all duration-200 hover:bg-primary active:scale-[0.99] disabled:opacity-60"
          >
            <Icon name="send" className="text-[18px]" />
            <span>{preparing ? "Loading…" : "Send invitations"}</span>
          </button>
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Invitations"
        className="flex space-x-8 border-b border-on-surface/10"
      >
        {tabs.map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`tab-${item.id}`}
              aria-selected={active}
              aria-controls={`panel-${item.id}`}
              onClick={() => {
                setTab(item.id);
                if (item.id === "responses" && !eventId && events[0]) setEventId(events[0].id);
              }}
              className={`flex items-center gap-2 border-b-2 pb-3 font-body-md text-body-md transition-colors ${
                active
                  ? "border-primary-container font-semibold text-primary"
                  : "border-transparent text-on-surface-variant hover:text-primary"
              }`}
            >
              <span>{item.label}</span>
              {item.dot ? (
                <span title="Needs attention" className="h-1.5 w-1.5 rounded-full bg-secondary" />
              ) : null}
              {item.badge !== undefined ? (
                <span className="rounded-full bg-surface-container px-1.5 font-label-sm text-label-sm text-on-surface-variant">
                  {item.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "overview" ? (
          <OverviewTab
            overview={overview}
            timezone={timezone}
            now={now}
            canViewLog={canViewLog}
            retryingKey={retryingKey}
            onRetryOne={(failure) => void retryFailures([failure], failure.guestId)}
            onRetryAll={() => void retryFailures(overview.failures, "all")}
            onViewBatch={(batchId) => {
              setBatch(batchId);
              setTab("log");
            }}
          />
        ) : null}

        {tab === "responses" ? (
          <ResponsesTab
            events={events}
            eventId={eventId}
            replies={replies}
            loading={repliesLoading}
            failed={repliesFailed}
            now={now.getTime()}
            timezone={timezone}
            busy={busy}
            onSelectEvent={(id) => {
              setReplies(null);
              setEventId(id);
            }}
            onRecord={setRecording}
            onSendReminder={(rows) =>
              setSending({
                kind: "reminder",
                guests: rows.slice(0, MAX_BATCH_GUESTS).map(asSendGuest),
                extraCount: Math.max(0, rows.length - MAX_BATCH_GUESTS),
                channel: "email",
              })
            }
            onMarkInvited={(rows) => void markInvited(rows)}
            onReload={() => eventId && void loadReplies(eventId)}
          />
        ) : null}

        {tab === "log" && canViewLog ? (
          <DeliveryLogTab
            weddingId={weddingId}
            timezone={timezone}
            batchId={batch}
            onClearBatch={() => setBatch(null)}
            onChanged={() => void reloadOverview()}
          />
        ) : null}
      </div>

      {sending ? (
        <SendDialog
          weddingId={weddingId}
          kind={sending.kind}
          guests={sending.guests}
          extraCount={sending.extraCount}
          initialChannel={sending.channel}
          canViewLog={canViewLog}
          onClose={() => setSending(null)}
          onSent={afterChange}
        />
      ) : null}

      {recording && eventId && event ? (
        <RecordResponseDrawer
          weddingId={weddingId}
          row={recording}
          eventId={eventId}
          eventName={event.name}
          viewerLabel={viewerLabel}
          onClose={() => setRecording(null)}
          onSaved={() => {
            setRecording(null);
            afterChange();
          }}
        />
      ) : null}
    </div>
  );
}
