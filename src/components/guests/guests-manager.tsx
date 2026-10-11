"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { EventMenu } from "@/components/events/event-menu";
import { GroupsDialog } from "@/components/guests/groups-dialog";
import { GuestDetailDrawer } from "@/components/guests/guest-detail-drawer";
import { GuestDrawer, type GuestDrawerMode } from "@/components/guests/guest-drawer";
import {
  bulkDeleteGuests,
  bulkSetGroup,
  deleteGuest,
  fetchGroups,
  fetchGuest,
  fetchGuests,
  fetchGuestSummary,
  type GuestListQuery,
  type GuestPage,
} from "@/components/guests/guests-api";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/client/api-client";
import {
  DIETARY_PREFERENCES,
  GUEST_SIDES,
  RSVP_STATUSES,
  type DietaryPreference,
  type GuestInviteStatus,
  type GuestSide,
  type RsvpStatus,
} from "@/lib/constants/enums";
import { GUEST_LIST_PAGE_SIZE } from "@/lib/constants/guests";
import { formatPhone } from "@/lib/guests/phone";
import type { GuestEventInfo, GuestGroupInfo } from "@/lib/guests/types";
import {
  DIETARY_LABEL,
  invitationDisplay,
  namesSummary,
  relativeAgo,
  replyDisplay,
  RSVP_LABEL,
  sideLabel,
  type Partners,
  type ReplyTone,
} from "@/lib/guests/view";
import { initialsOf } from "@/lib/text/initials";
import type { GuestDetailDto, GuestListItemDto } from "@/modules/guests/guest.dto";
import type { GuestSummary } from "@/modules/guests/guest.service";

// Stitch screens: "Guests List (Owner View)", with the "Add / Edit Guest" and "Guest Detail"
// slide-overs. The list is read from the API a page at a time (A to Z), so search, filters and
// "Load more" are answered by the database rather than by filtering a long list in the browser.

const CARD = "rounded-xl bg-[#FFFDF9] elevation-1";
const ALL = "all";

interface Filters {
  group: string;
  side: GuestSide | typeof ALL;
  invite: GuestInviteStatus | typeof ALL;
  rsvp: RsvpStatus | typeof ALL;
  dietary: DietaryPreference | typeof ALL;
}

const NO_FILTERS: Filters = { group: ALL, side: ALL, invite: ALL, rsvp: ALL, dietary: ALL };

interface Loaded {
  key: string;
  items: GuestListItemDto[];
  nextCursor: string | null;
  hasMore: boolean;
  /** When this page was read; null for the page the server rendered. */
  at: number | null;
}

type DrawerState =
  | null
  | { kind: "create" }
  | { kind: "detail"; guestId: string }
  | { kind: "edit"; guest: GuestDetailDto; backToDetail: boolean };

interface DeleteRequest {
  ids: string[];
  names: string[];
  /** Deleting from the detail drawer also closes it. */
  closeDrawer: boolean;
}

export function GuestsManager({
  weddingId,
  timezone,
  partners,
  events,
  initialGroups,
  initialPage,
  initialSummary,
  initialEvent,
  initialRsvp,
}: {
  weddingId: string;
  timezone: string;
  partners: Partners;
  events: GuestEventInfo[];
  initialGroups: GuestGroupInfo[];
  initialPage: GuestPage;
  initialSummary: GuestSummary;
  /** From `?event=` (the Events screen's "Manage guests"). */
  initialEvent?: string;
  /** From `?rsvp=`: start filtered to one reply state. */
  initialRsvp?: RsvpStatus;
}) {
  const router = useRouter();
  const toast = useToast();

  const [groups, setGroups] = useState(initialGroups);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filters, setFilters] = useState<Filters>({ ...NO_FILTERS, rsvp: initialRsvp ?? ALL });
  const [eventId, setEventId] = useState<string>(
    initialEvent && events.some((event) => event.id === initialEvent) ? initialEvent : ALL,
  );
  const [reload, setReload] = useState(0);
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [selected, setSelected] = useState<Map<string, string>>(new Map());
  const [pendingDelete, setPendingDelete] = useState<DeleteRequest | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Typing in the search box asks the server only after a short pause.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const rsvpEvent = eventId === ALL ? null : eventId;
  const query = useMemo<GuestListQuery>(
    () => ({
      limit: GUEST_LIST_PAGE_SIZE,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...(filters.group !== ALL ? { groupId: filters.group } : {}),
      ...(filters.side !== ALL ? { side: filters.side } : {}),
      ...(filters.invite !== ALL ? { inviteStatus: filters.invite } : {}),
      ...(filters.dietary !== ALL ? { dietaryPreference: filters.dietary } : {}),
      // The event only narrows the list together with an RSVP filter ("pending for Haldi");
      // alone it just chooses which event's replies the RSVP column shows.
      ...(filters.rsvp !== ALL
        ? { rsvpStatus: filters.rsvp, ...(rsvpEvent ? { eventId: rsvpEvent } : {}) }
        : {}),
    }),
    [debouncedSearch, filters, rsvpEvent],
  );
  const listKey = `${JSON.stringify(query)}#${reload}`;
  const initialKey = `${JSON.stringify({ limit: GUEST_LIST_PAGE_SIZE })}#0`;

  const [loaded, setLoaded] = useState<Loaded>({
    key: initialKey,
    items: initialPage.items,
    nextCursor: initialPage.nextCursor,
    hasMore: initialPage.hasMore,
    at: null,
  });
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const loading = loaded.key !== listKey && failedKey !== listKey;
  const failed = failedKey === listKey && loaded.key !== listKey;

  useEffect(() => {
    if (loaded.key === listKey) return;
    const controller = new AbortController();
    fetchGuests(weddingId, query, controller.signal)
      .then((page) =>
        setLoaded({
          key: listKey,
          items: page.items,
          nextCursor: page.nextCursor,
          hasMore: page.hasMore,
          at: Date.now(),
        }),
      )
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setFailedKey(listKey);
      });
    return () => controller.abort();
    // `loaded.key` is deliberately not a dependency: a finished load must not start another.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listKey, query, weddingId]);

  // The four numbers above the list follow the chosen event.
  const summaryKey = `${eventId}#${reload}`;
  const [summaryState, setSummaryState] = useState<{ key: string; data: GuestSummary }>({
    key: `${initialEvent && events.some((event) => event.id === initialEvent) ? initialEvent : ALL}#0`,
    data: initialSummary,
  });
  useEffect(() => {
    if (summaryState.key === summaryKey) return;
    const controller = new AbortController();
    fetchGuestSummary(weddingId, rsvpEvent ?? undefined, controller.signal)
      .then((data) => setSummaryState({ key: summaryKey, data }))
      .catch(() => {
        // Keep the numbers on screen; the list itself reports its own failures.
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summaryKey, weddingId, rsvpEvent]);
  const summary = summaryState.data;

  // "Updated 4 mins ago": a clock that only starts in the browser, so server and browser agree.
  const [clock, setClock] = useState<{ now: number; start: number } | null>(null);
  useEffect(() => {
    const start = setTimeout(() => setClock({ now: Date.now(), start: Date.now() }), 0);
    const tick = setInterval(() => setClock((c) => (c ? { ...c, now: Date.now() } : c)), 30_000);
    return () => {
      clearTimeout(start);
      clearInterval(tick);
    };
  }, []);

  /** Re-reads the list, the numbers and the groups after any change, and the sidebar's count. */
  function refresh() {
    setReload((value) => value + 1);
    router.refresh();
    fetchGroups(weddingId)
      .then(setGroups)
      .catch(() => {
        // The old group choices stay; they are corrected on the next successful refresh.
      });
  }

  const filtering =
    Boolean(debouncedSearch) || JSON.stringify(filters) !== JSON.stringify(NO_FILTERS);
  const groupById = new Map(groups.map((group) => [group.id, group]));
  const items = loaded.items;
  const allSelected = items.length > 0 && items.every((guest) => selected.has(guest.id));
  const someSelected = items.some((guest) => selected.has(guest.id));

  function clearFilters() {
    setSearch("");
    setDebouncedSearch("");
    setFilters(NO_FILTERS);
  }

  function chooseEvent(next: string) {
    setEventId(next);
    const url = new URL(window.location.href);
    if (next === ALL) url.searchParams.delete("event");
    else url.searchParams.set("event", next);
    window.history.replaceState(null, "", url);
  }

  function toggle(guest: GuestListItemDto) {
    setSelected((current) => {
      const next = new Map(current);
      if (next.has(guest.id)) next.delete(guest.id);
      else next.set(guest.id, guest.name);
      return next;
    });
  }

  function toggleAll() {
    setSelected((current) => {
      const next = new Map(current);
      if (allSelected) for (const guest of items) next.delete(guest.id);
      else for (const guest of items) next.set(guest.id, guest.name);
      return next;
    });
  }

  async function loadMore() {
    if (!loaded.nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await fetchGuests(weddingId, { ...query, cursor: loaded.nextCursor });
      setLoaded((current) =>
        current.key !== loaded.key
          ? current
          : {
              ...current,
              items: [
                ...current.items,
                ...page.items.filter((g) => !current.items.some((i) => i.id === g.id)),
              ],
              nextCursor: page.nextCursor,
              hasMore: page.hasMore,
            },
      );
    } catch (error) {
      toast({ type: "error", title: "Couldn't load more guests", message: errorMessage(error) });
    } finally {
      setLoadingMore(false);
    }
  }

  async function openEdit(guestId: string, backToDetail: boolean) {
    try {
      const guest = await fetchGuest(weddingId, guestId);
      setDrawer({ kind: "edit", guest, backToDetail });
    } catch (error) {
      toast({ type: "error", title: "Couldn't open the guest", message: errorMessage(error) });
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      if (pendingDelete.ids.length === 1) await deleteGuest(weddingId, pendingDelete.ids[0]!);
      else await bulkDeleteGuests(weddingId, pendingDelete.ids);
      const count = pendingDelete.ids.length;
      toast({
        type: "success",
        title: count === 1 ? "Guest deleted" : `${count} guests deleted`,
        message: count === 1 ? (pendingDelete.names[0] ?? "") : namesSummary(pendingDelete.names),
      });
      setSelected((current) => {
        const next = new Map(current);
        for (const id of pendingDelete.ids) next.delete(id);
        return next;
      });
      if (pendingDelete.closeDrawer) setDrawer(null);
      setPendingDelete(null);
      setDeleting(false);
      refresh();
    } catch (error) {
      setDeleting(false);
      setPendingDelete(null);
      toast({ type: "error", title: "Couldn't delete", message: errorMessage(error) });
    }
  }

  async function moveSelectedTo(groupId: string | null, label: string) {
    const ids = [...selected.keys()];
    try {
      await bulkSetGroup(weddingId, ids, groupId);
      toast({
        type: "success",
        title: "Group changed",
        message: `${ids.length} ${ids.length === 1 ? "guest" : "guests"} → ${label}`,
      });
      refresh();
    } catch (error) {
      toast({ type: "error", title: "Couldn't change the group", message: errorMessage(error) });
    }
  }

  const comingSoon = (title: string) =>
    toast({
      type: "info",
      title,
      message: "Sending invitations and personal RSVP links arrive with the next step.",
    });

  const selectedNames = [...selected.values()];
  const noGuestsAtAll = !filtering && summary.totalGuests === 0 && items.length === 0 && !loading;
  const updatedLabel = clock
    ? `Updated ${relativeAgo(loaded.at ?? clock.start, clock.now)}`
    : "Updated just now";

  return (
    <div className="mx-auto max-w-[1240px] space-y-6 pb-10">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="font-headline-lg text-headline-lg font-normal tracking-tight text-primary">
            Guests
          </h1>
          <p className="mt-1 font-body-md text-body-md text-on-surface-variant">
            Everyone on your list, and who has replied.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setGroupsOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-[#2A2622]/15 bg-[#FAF6F0] px-4 py-2.5 font-label-md text-label-md text-on-surface transition-colors hover:bg-[#F4EFEA]"
          >
            <Icon name="category" className="text-[18px]" />
            Manage groups
          </button>
          <button
            type="button"
            onClick={() => setDrawer({ kind: "create" })}
            className="inline-flex items-center gap-2 rounded-lg bg-[#1F4D3D] px-4 py-2.5 font-label-md text-label-md text-[#FAF6F0] shadow-sm transition-all duration-150 hover:bg-[#163A2E]"
          >
            <Icon name="person_add" className="text-[18px]" />
            Add guest
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total Registered"
            icon="groups"
            value={summary.totalGuests}
            unit="guests"
          />
          <StatCard
            label="Expected Headcount"
            icon="how_to_reg"
            iconClass="text-primary-container"
            value={summary.expectedHeadcount}
            unit="expected attending"
          />
          <StatCard
            label="Unsent Invitations"
            icon="mark_email_unread"
            value={summary.unsentInvitations}
            unit="invitations not sent"
            accent
          />
          <StatCard
            label="Awaiting Response"
            icon="hourglass_empty"
            value={summary.awaitingResponse}
            unit="awaiting reply"
            plainValue
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="inline-flex items-center gap-2">
            <label
              htmlFor="guest-event"
              className="font-body-sm text-body-sm font-medium text-on-surface-variant"
            >
              Showing responses for:
            </label>
            <div className="relative inline-block">
              <select
                id="guest-event"
                value={eventId}
                onChange={(event) => chooseEvent(event.target.value)}
                className="cursor-pointer appearance-none rounded-lg border border-[#2A2622]/12 bg-[#FFFDF9] py-1.5 pr-8 pl-3 font-body-sm text-body-sm font-semibold text-primary hover:bg-[#F4EFEA] focus:ring-1 focus:ring-primary focus:outline-none"
              >
                <option value={ALL}>All events</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name} ({event.dateLabel})
                  </option>
                ))}
              </select>
              <Icon
                name="expand_more"
                className="pointer-events-none absolute top-2 right-2 text-[18px] text-on-surface-variant"
              />
            </div>
          </div>
          <span className="font-label-sm text-label-sm text-on-surface-variant/60">
            {updatedLabel}
          </span>
        </div>
      </div>

      <div className={`${CARD} space-y-3.5 p-4`}>
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div className="relative max-w-md flex-1">
            <Icon
              name="search"
              className="pointer-events-none absolute top-2.5 left-3.5 text-[20px] text-on-surface-variant/60"
            />
            <input
              type="search"
              aria-label="Search guests by name"
              placeholder="Search by name"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full rounded-lg border-0 bg-[#FAF6F0] py-2 pr-32 pl-10 font-body-md text-body-md text-on-surface shadow-[inset_0_0_0_1px_rgba(42,38,34,0.08)] transition-all placeholder:text-on-surface/40 focus:bg-white focus:ring-2 focus:ring-[#1F4D3D]/20 focus:outline-none"
            />
            <div
              title="Matches names that start with your text"
              className="pointer-events-none absolute top-2.5 right-3 flex items-center gap-1 text-on-surface-variant/50"
            >
              <span className="font-label-sm text-label-sm">Matches name</span>
              <Icon name="info" className="text-[15px]" />
            </div>
          </div>
          <button
            type="button"
            onClick={clearFilters}
            disabled={!filtering}
            className="self-center font-body-sm text-body-sm font-medium text-[#B5714A] hover:underline disabled:opacity-0"
          >
            Clear filters
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-[#2A2622]/[0.04] pt-3 font-body-sm text-body-sm">
          <FilterPill
            label="Group"
            value={filters.group}
            onChange={(group) => setFilters({ ...filters, group })}
            options={[
              { value: ALL, label: "All" },
              { value: "none", label: "No group" },
              ...groups.map((group) => ({ value: group.id, label: group.name })),
            ]}
          />
          <FilterPill
            label="Side"
            value={filters.side}
            onChange={(side) => setFilters({ ...filters, side: side as Filters["side"] })}
            options={[
              { value: ALL, label: "All" },
              ...GUEST_SIDES.map((side) => ({ value: side, label: sideLabel(side, partners) })),
            ]}
          />
          <FilterPill
            label="Invitation"
            value={filters.invite}
            onChange={(invite) => setFilters({ ...filters, invite: invite as Filters["invite"] })}
            options={[
              { value: ALL, label: "All" },
              { value: "not_invited", label: "Not sent" },
              { value: "invited", label: "Sent" },
            ]}
          />
          <FilterPill
            label="RSVP"
            value={filters.rsvp}
            onChange={(rsvp) => setFilters({ ...filters, rsvp: rsvp as Filters["rsvp"] })}
            options={[
              { value: ALL, label: "All" },
              ...RSVP_STATUSES.map((status) => ({ value: status, label: RSVP_LABEL[status] })),
            ]}
          />
          <FilterPill
            label="Dietary"
            value={filters.dietary}
            onChange={(dietary) =>
              setFilters({ ...filters, dietary: dietary as Filters["dietary"] })
            }
            options={[
              { value: ALL, label: "All" },
              ...DIETARY_PREFERENCES.map((diet) => ({ value: diet, label: DIETARY_LABEL[diet] })),
            ]}
          />
        </div>
      </div>

      {selected.size > 0 ? (
        <div
          role="region"
          aria-label="Selected guests"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-[#FFFDF9] px-5 py-3 elevation-1"
        >
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              aria-label="Clear selection"
              onClick={() => setSelected(new Map())}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[#1F4D3D] text-[#FAF6F0]"
            >
              <Icon name="check" className="text-[16px]" />
            </button>
            <span className="font-body-md text-body-md font-semibold whitespace-nowrap text-primary">
              {selected.size} {selected.size === 1 ? "guest" : "guests"} selected
            </span>
            <span className="text-on-surface-variant/40">|</span>
            <span className="truncate font-body-sm text-body-sm text-on-surface-variant">
              {namesSummary(selectedNames)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => comingSoon("Sending invitations is coming soon")}
              className="inline-flex items-center gap-2 rounded-lg bg-[#1F4D3D] px-3.5 py-1.5 font-label-md text-label-md text-[#FAF6F0] shadow-sm transition-all duration-150 hover:bg-[#163A2E]"
            >
              <Icon name="send" className="text-[16px]" />
              Send invitations
            </button>
            <ChangeGroupMenu groups={groups} onChoose={moveSelectedTo} />
            <button
              type="button"
              onClick={() =>
                setPendingDelete({
                  ids: [...selected.keys()],
                  names: selectedNames,
                  closeDrawer: false,
                })
              }
              className="px-2 font-body-sm text-body-sm font-medium text-[#ba1a1a] hover:text-[#93000a] hover:underline"
            >
              Delete
            </button>
          </div>
        </div>
      ) : null}

      {noGuestsAtAll ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[#2A2622]/15 bg-surface-container-lowest px-6 py-16 text-center">
          <Icon name="group" className="text-[28px] text-outline" />
          <h2 className="font-headline-sm text-headline-sm font-medium text-[#2A2622]">
            Your guest list is empty
          </h2>
          <p className="max-w-md font-body-md text-body-md text-on-surface-variant">
            Add the people you want to invite, put them in groups like family or college friends,
            and choose which events each of them is invited to.
          </p>
          <button
            type="button"
            onClick={() => setDrawer({ kind: "create" })}
            className="mt-2 inline-flex items-center gap-2 rounded-lg bg-[#1F4D3D] px-4 py-2.5 font-label-md text-label-md text-[#FAF6F0] shadow-sm hover:bg-[#163A2E]"
          >
            <Icon name="person_add" className="text-[18px]" />
            Add your first guest
          </button>
        </div>
      ) : (
        <div className={`${CARD} relative overflow-visible`}>
          <div
            className={`overflow-x-auto transition-opacity ${loading ? "opacity-50" : ""}`}
            aria-busy={loading}
          >
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-[#2A2622]/[0.08] bg-[#FAF6F0]/80 font-label-sm text-label-sm tracking-wider text-on-surface-variant uppercase">
                  <th scope="col" className="w-12 px-4 py-3.5">
                    <input
                      type="checkbox"
                      aria-label="Select all guests shown"
                      checked={allSelected}
                      ref={(element) => {
                        if (element) element.indeterminate = someSelected && !allSelected;
                      }}
                      onChange={toggleAll}
                      className="h-4 w-4 cursor-pointer rounded border-gray-300 text-[#1F4D3D] focus:ring-[#1F4D3D]"
                    />
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Guest
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Group
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Side
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Contact
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Invitation
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    RSVP
                  </th>
                  <th scope="col" className="w-12 px-4 py-3.5 text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A2622]/[0.04] font-body-sm text-body-sm text-on-surface">
                {items.map((guest) => (
                  <GuestRow
                    key={guest.id}
                    guest={guest}
                    groupName={guest.groupId ? (groupById.get(guest.groupId)?.name ?? null) : null}
                    partners={partners}
                    timezone={timezone}
                    rsvpEvent={rsvpEvent}
                    selected={selected.has(guest.id)}
                    onToggle={() => toggle(guest)}
                    onView={() => setDrawer({ kind: "detail", guestId: guest.id })}
                    onEdit={() => void openEdit(guest.id, false)}
                    onDelete={() =>
                      setPendingDelete({ ids: [guest.id], names: [guest.name], closeDrawer: false })
                    }
                    onComingSoon={comingSoon}
                  />
                ))}
                {items.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-16 text-center">
                      <p className="font-body-md text-body-md text-on-surface-variant">
                        {failed
                          ? "The guest list couldn't be loaded."
                          : "No guests match these filters."}
                      </p>
                      <button
                        type="button"
                        onClick={failed ? refresh : clearFilters}
                        className="mt-2 font-body-sm text-body-sm font-medium text-[#B5714A] hover:underline"
                      >
                        {failed ? "Try again" : "Clear filters"}
                      </button>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col items-center justify-between gap-4 border-t border-[#2A2622]/[0.06] px-6 py-4 sm:flex-row">
            <span className="font-body-sm text-body-sm text-on-surface-variant/70" role="status">
              Showing <strong className="font-semibold text-on-surface">{items.length}</strong>
              {!filtering && summary.totalGuests > 0 ? (
                <>
                  {" "}
                  of{" "}
                  <strong className="font-semibold text-on-surface">{summary.totalGuests}</strong>
                </>
              ) : filtering ? (
                <> matching {items.length === 1 ? "guest" : "guests"}</>
              ) : null}
            </span>
            {loaded.hasMore ? (
              <button
                type="button"
                onClick={() => void loadMore()}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 rounded-lg border border-[#2A2622]/12 bg-[#FAF6F0] px-4 py-2 font-body-sm text-body-sm font-medium text-on-surface transition-colors hover:bg-[#F4EFEA] disabled:opacity-60"
              >
                <Icon name="expand_more" className="text-[16px] text-outline" />
                {loadingMore ? "Loading..." : "Load more guests"}
              </button>
            ) : null}
          </div>
        </div>
      )}

      {drawer?.kind === "create" ? (
        <GuestDrawer
          weddingId={weddingId}
          partners={partners}
          groups={groups}
          events={events}
          mode={{ kind: "create" }}
          onClose={() => setDrawer(null)}
          onChanged={refresh}
          onSaved={() => setDrawer(null)}
        />
      ) : null}
      {drawer?.kind === "edit" ? (
        <GuestDrawer
          weddingId={weddingId}
          partners={partners}
          groups={groups}
          events={events}
          mode={{ kind: "edit", guest: drawer.guest } satisfies GuestDrawerMode}
          onClose={() =>
            setDrawer(drawer.backToDetail ? { kind: "detail", guestId: drawer.guest.id } : null)
          }
          onChanged={refresh}
          onSaved={(saved) =>
            setDrawer(drawer.backToDetail ? { kind: "detail", guestId: saved.id } : null)
          }
        />
      ) : null}
      {drawer?.kind === "detail" ? (
        <GuestDetailDrawer
          weddingId={weddingId}
          guestId={drawer.guestId}
          partners={partners}
          groups={groups}
          events={events}
          timezone={timezone}
          onClose={() => setDrawer(null)}
          onChanged={refresh}
          onEdit={(guest) => setDrawer({ kind: "edit", guest, backToDetail: true })}
          onDelete={(guest) =>
            setPendingDelete({ ids: [guest.id], names: [guest.name], closeDrawer: true })
          }
        />
      ) : null}
      {groupsOpen ? (
        <GroupsDialog
          weddingId={weddingId}
          groups={groups}
          partners={partners}
          onClose={() => setGroupsOpen(false)}
          onChanged={refresh}
        />
      ) : null}
      {pendingDelete ? (
        <ConfirmDialog
          title={pendingDelete.ids.length === 1 ? "Delete this guest?" : "Delete these guests?"}
          confirmLabel={
            pendingDelete.ids.length === 1
              ? "Delete guest"
              : `Delete ${pendingDelete.ids.length} guests`
          }
          danger
          busy={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        >
          <p>
            <strong className="font-semibold text-on-surface">
              {pendingDelete.ids.length === 1
                ? pendingDelete.names[0]
                : `${pendingDelete.ids.length} guests`}
            </strong>{" "}
            will be removed from your guest list for everyone on your team, along with their event
            replies.
          </p>
          {pendingDelete.ids.length > 1 ? (
            <p className="text-[13px]">{namesSummary(pendingDelete.names, 5)}</p>
          ) : null}
        </ConfirmDialog>
      ) : null}
    </div>
  );
}

function StatCard({
  label,
  icon,
  iconClass = "text-outline",
  value,
  unit,
  accent = false,
  plainValue = false,
}: {
  label: string;
  icon: Parameters<typeof Icon>[0]["name"];
  iconClass?: string;
  value: number;
  unit: string;
  accent?: boolean;
  plainValue?: boolean;
}) {
  return (
    <div
      className={`flex flex-col justify-between ${CARD} p-4`}
      style={accent ? { borderLeft: "3px solid #B5714A" } : undefined}
    >
      <div className="flex items-center justify-between text-on-surface-variant">
        <span
          className={`font-label-md text-label-md tracking-wider uppercase ${
            accent ? "text-[#B5714A]" : "text-on-surface-variant/70"
          }`}
        >
          {label}
        </span>
        <Icon name={icon} className={accent ? "text-[#B5714A]" : iconClass} />
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span
          className={`font-headline-md text-headline-md ${
            accent ? "text-[#B5714A]" : plainValue ? "text-on-surface" : "text-primary"
          }`}
        >
          {value}
        </span>
        <span className="font-body-sm text-body-sm text-on-surface-variant">{unit}</span>
      </div>
    </div>
  );
}

function FilterPill({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  const selected = options.find((option) => option.value === value);
  return (
    <label className="relative inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#2A2622]/[0.08] bg-[#FAF6F0] px-2.5 py-1 text-on-surface-variant focus-within:border-primary/50 hover:border-[#2A2622]/20">
      <span className="font-label-sm text-label-sm text-on-surface-variant/60 uppercase">
        {label}:
      </span>
      <span className="max-w-[150px] truncate font-medium text-on-surface">{selected?.label}</span>
      <Icon name="keyboard_arrow_down" className="text-[16px] text-on-surface-variant/60" />
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

const REPLY_STYLE: Record<ReplyTone, { dot: string; text: string }> = {
  attending: { dot: "bg-[#1F4D3D]", text: "font-medium text-primary" },
  maybe: { dot: "bg-[#C89B3C]", text: "font-medium text-[#78401d]" },
  declined: { dot: "bg-[#B5714A]", text: "font-medium text-[#B5714A]" },
  pending: { dot: "bg-[#717974]", text: "text-on-surface-variant" },
  none: { dot: "bg-outline-variant", text: "text-on-surface-variant/70" },
};

function GuestRow({
  guest,
  groupName,
  partners,
  timezone,
  rsvpEvent,
  selected,
  onToggle,
  onView,
  onEdit,
  onDelete,
  onComingSoon,
}: {
  guest: GuestListItemDto;
  groupName: string | null;
  partners: Partners;
  timezone: string;
  rsvpEvent: string | null;
  selected: boolean;
  onToggle: () => void;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onComingSoon: (title: string) => void;
}) {
  const reply = replyDisplay(guest.rsvps, rsvpEvent);
  const style = REPLY_STYLE[reply.tone];
  const invitation = invitationDisplay(guest.invitation, timezone);

  return (
    <tr className={`transition-colors hover:bg-[#FAF6F0] ${selected ? "bg-[#1F4D3D]/[0.02]" : ""}`}>
      <td className="px-4 py-3.5 align-middle">
        <input
          type="checkbox"
          aria-label={`Select ${guest.name}`}
          checked={selected}
          onChange={onToggle}
          className="h-4 w-4 cursor-pointer rounded border-gray-300 text-[#1F4D3D] focus:ring-[#1F4D3D]"
        />
      </td>
      <td className="px-4 py-3.5 align-middle">
        <button
          type="button"
          onClick={onView}
          className="flex items-center gap-3 text-left"
          aria-label={`View details for ${guest.name}`}
        >
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/10 bg-[#FAF6F0] font-label-md text-label-md font-medium text-primary"
          >
            {initialsOf(guest.name)}
          </span>
          <span>
            <span className="block leading-tight font-medium text-on-surface">{guest.name}</span>
            {guest.relationLabel ? (
              <span className="font-body-sm text-[12px] text-on-surface-variant/60">
                {guest.relationLabel}
              </span>
            ) : null}
          </span>
        </button>
      </td>
      <td className="px-4 py-3.5 align-middle">
        {groupName ? (
          <span className="inline-block rounded-md bg-[#FAF6F0] px-2.5 py-1 font-label-sm text-label-sm text-on-surface-variant">
            {groupName}
          </span>
        ) : (
          <span className="text-on-surface-variant/50">—</span>
        )}
      </td>
      <td className="px-4 py-3.5 align-middle text-on-surface-variant">
        {sideLabel(guest.side, partners)}
      </td>
      <td className="px-4 py-3.5 align-middle">
        <div className="flex items-center gap-2">
          {guest.phone ? (
            <span>{formatPhone(guest.phone)}</span>
          ) : (
            <span className="text-on-surface-variant/50">No phone</span>
          )}
          {guest.email ? (
            <Icon
              name="mail"
              className="text-[16px] text-on-surface-variant/60"
              // Icons are hidden from assistive tech, so the meaning is carried by the cell's text.
            />
          ) : null}
          {guest.email ? <span className="sr-only">Email available</span> : null}
        </div>
      </td>
      <td className="px-4 py-3.5 align-middle">
        {invitation.sent ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#1F4D3D]/10 px-2.5 py-1 font-label-sm text-label-sm font-medium text-primary">
            <Icon
              name={invitation.channel === "whatsapp" ? "chat" : "forward_to_inbox"}
              className="text-[13px]"
            />
            {invitation.label}
            {invitation.dateLabel ? (
              <span className="text-primary/70">({invitation.dateLabel})</span>
            ) : null}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#2A2622]/[0.08] bg-[#FAF6F0] px-2.5 py-1 font-label-sm text-label-sm text-on-surface-variant/80">
            Not sent
          </span>
        )}
      </td>
      <td className="px-4 py-3.5 align-middle">
        <div className="flex items-center gap-2" title={reply.hint}>
          <span className={`h-2 w-2 rounded-full ${style.dot}`} />
          <span className={style.text}>{reply.label}</span>
          {reply.extra ? (
            <span className="rounded bg-[#FAF6F0] px-1.5 py-0.5 text-[11px] font-medium text-on-surface-variant">
              +{reply.extra}
            </span>
          ) : null}
        </div>
      </td>
      <td className="px-4 py-3.5 text-right align-middle">
        <EventMenu
          eventName={guest.name}
          trigger="inline"
          items={[
            { icon: "visibility", label: "View details", onSelect: onView },
            { icon: "edit", label: "Edit guest", onSelect: onEdit },
            {
              icon: "send",
              label: "Send invitation",
              onSelect: () => onComingSoon("Sending invitations is coming soon"),
            },
            {
              icon: "link",
              label: "Copy invite link",
              onSelect: () => onComingSoon("Invite links are coming soon"),
            },
            { icon: "delete", label: "Delete guest", danger: true, onSelect: onDelete },
          ]}
        />
      </td>
    </tr>
  );
}

/** "Change group" in the selection bar: a small menu of the wedding's groups. */
function ChangeGroupMenu({
  groups,
  onChoose,
}: {
  groups: GuestGroupInfo[];
  onChoose: (groupId: string | null, label: string) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (wrapper.current && !wrapper.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapper} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[#2A2622]/15 bg-[#FAF6F0] px-3 py-1.5 font-label-md text-label-md text-on-surface transition-colors hover:bg-[#F4EFEA]"
      >
        <Icon name="folder_shared" className="text-[16px]" />
        Change group
      </button>
      {open ? (
        <div
          role="menu"
          aria-label="Move selected guests to"
          className="elevation-2 absolute right-0 z-40 mt-2 max-h-72 w-56 overflow-y-auto rounded-xl border border-[#2A2622]/[0.08] bg-[#FFFDF9] py-1.5"
        >
          {groups.map((group) => (
            <button
              key={group.id}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                void onChoose(group.id, group.name);
              }}
              className="flex w-full items-center px-3.5 py-2 text-left font-body-sm text-body-sm text-on-surface transition-colors hover:bg-[#FAF6F0]"
            >
              {group.name}
            </button>
          ))}
          {groups.length > 0 ? <div className="my-1 border-t border-[#2A2622]/[0.06]" /> : null}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              void onChoose(null, "No group");
            }}
            className="flex w-full items-center px-3.5 py-2 text-left font-body-sm text-body-sm text-on-surface-variant transition-colors hover:bg-[#FAF6F0]"
          >
            No group
          </button>
        </div>
      ) : null}
    </div>
  );
}
