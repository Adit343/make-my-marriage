import "server-only";
import { GUEST_LIST_PAGE_SIZE } from "@/lib/constants/guests";
import { formatDayMonth, formatLongDate, todayIn } from "@/lib/dates";
import { AppError } from "@/lib/errors";
import { getEnv } from "@/lib/env";
import { calendarDayIn, nextEventLabel, venueLine } from "@/lib/events/format";
import { toEventDetailView, toEventViews } from "@/lib/events/view";
import type { GuestEventInfo } from "@/lib/guests/types";
import { partnersOf } from "@/lib/guests/view";
import { summarize, toTaskViews, type TaskEventInfo, type TaskMember } from "@/lib/tasks/view";
import { describeUserAgent, lastActiveLabel, type DeviceKind } from "@/lib/user-agent";
import { getCurrentUser, listSessions } from "@/modules/auth/auth.service";
import type { AuthContext } from "@/modules/auth/session.service";
import { getDashboard } from "@/modules/dashboard/dashboard.service";
import {
  getExpenseDetail,
  getExpenseSummary,
  listEveryExpense,
  listVendorChoices,
} from "@/modules/expenses/expense.service";
import type { EventDto } from "@/modules/events/event.dto";
import { getEvent, listEvents } from "@/modules/events/event.service";
import { listGroups } from "@/modules/guest-groups/guest-group.service";
import {
  getEventReplies,
  getInvitationsOverview,
} from "@/modules/guest-invitations/invitation-overview.service";
import {
  getEventHeadcount,
  getGuestNumbersByEvent,
  getGuestSummary,
  listGuests,
} from "@/modules/guests/guest.service";
import { getWeddingAuth } from "@/modules/members/guards";
import type { InvitationDto } from "@/modules/members/invitation.dto";
import { listInvitations } from "@/modules/members/invitation.service";
import { countActiveMembers } from "@/modules/members/member.repository";
import { listTeam } from "@/modules/members/member.service";
import { can } from "@/modules/members/permissions";
import { listEveryTask, listEventTasks } from "@/modules/tasks/task.service";
import { listAccessTokens } from "@/modules/gallery/access-token.service";
import { getGallerySettings, listAlbums } from "@/modules/gallery/gallery.service";
import { listStreams } from "@/modules/livestream/stream.service";
import { getVendorDetail, listEveryVendor } from "@/modules/vendors/vendor.service";
import {
  getEditorData as getWebsiteEditorData,
  getWebsitePreview,
} from "@/modules/website/website.service";
import { getWeddingFor } from "@/modules/weddings/wedding.service";

// Data for the Team and Settings pages. Server Components call the same services the REST API
// does, behind the same permission checks, so what a page shows can never exceed what the API
// would return to that member. Relative times ("Expires in 5 days") are computed here, on the
// server, so the page doesn't render differently on the server and in the browser.

const ALL = { page: 1, pageSize: 100 };
const DAY_MS = 24 * 60 * 60 * 1000;

export type PendingInvitation = InvitationDto & { expiresLabel: string };

function expiresLabel(invitation: InvitationDto): string {
  if (invitation.status === "expired") return "Expired";
  const days = Math.ceil((new Date(invitation.expiresAt).getTime() - Date.now()) / DAY_MS);
  if (days <= 0) return "Expires today";
  return `Expires in ${days} ${days === 1 ? "day" : "days"}`;
}

function daysAgoLabel(iso: string | null): string | null {
  if (!iso) return null;
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS);
  if (days <= 0) return "Last changed today";
  return `Last changed ${days} ${days === 1 ? "day" : "days"} ago`;
}

export async function getTeamPage(auth: AuthContext) {
  const dashboard = await getDashboard(auth);
  const weddingAuth = await getWeddingAuth(auth);
  if (!dashboard.workspace || !weddingAuth) return null;

  const canManage = can(weddingAuth.membership.role, "members:manage");
  const [team, invitations] = await Promise.all([
    listTeam(weddingAuth, ALL),
    // Pending invitations list emails of people not yet in the wedding: admins and owners only.
    canManage ? listInvitations(weddingAuth, ALL) : Promise.resolve(null),
  ]);

  const pending: PendingInvitation[] = (invitations?.items ?? [])
    .filter((item) => item.status === "pending" || item.status === "expired")
    .map((item) => ({ ...item, expiresLabel: expiresLabel(item) }));

  return {
    dashboard: { viewer: dashboard.viewer, workspace: dashboard.workspace },
    members: team.items,
    invitations: pending,
    viewer: { memberId: weddingAuth.membership.id, role: weddingAuth.membership.role },
    weddingTitle: dashboard.workspace.title,
  };
}

export interface SessionRow {
  id: string;
  label: string;
  kind: DeviceKind;
  isCurrent: boolean;
  activity: string;
}

export async function getSettingsPage(auth: AuthContext) {
  const dashboard = await getDashboard(auth);
  const weddingAuth = await getWeddingAuth(auth);
  if (!dashboard.workspace || !weddingAuth) return null;

  const [{ wedding }, user, activeMemberCount, sessions] = await Promise.all([
    getWeddingFor(weddingAuth),
    getCurrentUser(auth),
    countActiveMembers(weddingAuth.weddingId),
    listSessions(auth),
  ]);

  const sessionRows: SessionRow[] = sessions
    .map((session) => ({ session, device: describeUserAgent(session.userAgent) }))
    .sort((a, b) => Number(b.session.isCurrent) - Number(a.session.isCurrent))
    .map(({ session, device }) => ({
      id: session.id,
      label: device.label,
      kind: device.kind,
      isCurrent: session.isCurrent,
      activity: session.isCurrent ? "Active now" : lastActiveLabel(new Date(session.lastUsedAt)),
    }));

  return {
    dashboard: { viewer: dashboard.viewer, workspace: dashboard.workspace },
    wedding,
    user: {
      name: user.name,
      email: user.email,
      hasPassword: user.hasPassword,
      passwordChangedLabel: daysAgoLabel(user.passwordChangedAt),
      hasGoogle: user.authProviders.includes("google"),
    },
    sessions: sessionRows,
    viewer: { memberId: weddingAuth.membership.id, role: weddingAuth.membership.role },
    canEditWedding: can(weddingAuth.membership.role, "wedding:update"),
    activeMemberCount,
  };
}

/** Data for the Events timeline (Stitch "Events Timeline"). */
export async function getEventsPage(auth: AuthContext) {
  const dashboard = await getDashboard(auth);
  const weddingAuth = await getWeddingAuth(auth);
  if (!dashboard.workspace || !weddingAuth) return null;

  const [events, { wedding }, guestNumbers] = await Promise.all([
    listEvents(weddingAuth),
    getWeddingFor(weddingAuth),
    getGuestNumbersByEvent(weddingAuth),
  ]);
  const now = new Date();
  return {
    dashboard: { viewer: dashboard.viewer, workspace: dashboard.workspace },
    weddingId: weddingAuth.weddingId,
    weddingTimezone: wedding.timezone,
    events: toEventViews(events, now),
    guestNumbers,
    summary: {
      count: events.length,
      next: nextEventLabel(
        events.map((event) => ({
          startsAt: new Date(event.startsAt),
          endsAt: event.endsAt ? new Date(event.endsAt) : null,
          timezone: event.timezone,
        })),
        now,
      ),
    },
    canCreate: can(weddingAuth.membership.role, "events:edit"),
  };
}

/** Data for one event's page (Stitch "Event Detail"); "not_found" when it isn't in this wedding. */
export async function getEventPage(auth: AuthContext, eventId: string) {
  const dashboard = await getDashboard(auth);
  const weddingAuth = await getWeddingAuth(auth);
  if (!dashboard.workspace || !weddingAuth) return null;

  try {
    const [event, { wedding }, allEvents, team, eventTasks, replies, allExpenses] =
      await Promise.all([
        getEvent(weddingAuth, eventId),
        getWeddingFor(weddingAuth),
        listEvents(weddingAuth),
        listTeam(weddingAuth, ALL),
        listEventTasks(weddingAuth, eventId),
        getEventHeadcount(weddingAuth, eventId),
        listEveryExpense(weddingAuth),
      ]);
    const context = taskContext(allEvents, team.items, wedding.timezone);
    return {
      dashboard: { viewer: dashboard.viewer, workspace: dashboard.workspace },
      weddingId: weddingAuth.weddingId,
      weddingTimezone: wedding.timezone,
      event: toEventDetailView(event),
      replies,
      tasks: toTaskViews(eventTasks, context),
      // The expenses recorded against this event (every member sees every expense).
      expenses: allExpenses.filter((expense) => expense.eventId === eventId),
      currency: wedding.currency,
      taskForm: { events: context.events, members: context.members, today: context.today },
    };
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") return "not_found" as const;
    throw error;
  }
}

/** What turns task rows into screen rows: who the members are, which events exist, what "today" is. */
function taskContext(
  events: EventDto[],
  members: { id: string; user: { name: string }; relationship: string | null; status: string }[],
  timezone: string,
): { events: TaskEventInfo[]; members: TaskMember[]; today: string; timezone: string } {
  return {
    events: events.map((event) => ({
      id: event.id,
      name: event.name,
      type: event.type,
      startsAt: event.startsAt,
      timezone: event.timezone,
      venue: venueLine(event.location),
    })),
    // Only active members can be given a task (the service refuses anyone else).
    members: members
      .filter((member) => member.status === "active")
      .map((member) => ({
        id: member.id,
        name: member.user.name,
        relationship: member.relationship,
      })),
    today: todayIn(timezone),
    timezone,
  };
}

/** Data for the Tasks screens (Stitch "Tasks (List View Grouped by Event)" and "(Board View)"). */
export async function getTasksPage(auth: AuthContext) {
  const dashboard = await getDashboard(auth);
  const weddingAuth = await getWeddingAuth(auth);
  if (!dashboard.workspace || !weddingAuth) return null;

  const [tasks, events, team, { wedding }] = await Promise.all([
    listEveryTask(weddingAuth),
    listEvents(weddingAuth),
    listTeam(weddingAuth, ALL),
    getWeddingFor(weddingAuth),
  ]);
  const context = taskContext(events, team.items, wedding.timezone);
  const views = toTaskViews(tasks, context);
  return {
    dashboard: { viewer: dashboard.viewer, workspace: dashboard.workspace },
    weddingId: weddingAuth.weddingId,
    events: context.events,
    members: context.members,
    today: context.today,
    tasks: views,
    summary: summarize(views),
  };
}

/**
 * Data for the Guests screen (Stitch "Guests List"): the first page of the list, the groups, the
 * wedding's events as invitation choices, and the four numbers above the list. Later pages,
 * searches and filters are read by the browser through the REST API.
 */
export async function getGuestsPage(auth: AuthContext, options: { eventId?: string } = {}) {
  const dashboard = await getDashboard(auth);
  const weddingAuth = await getWeddingAuth(auth);
  if (!dashboard.workspace || !weddingAuth) return null;

  const [events, groups, { wedding }] = await Promise.all([
    listEvents(weddingAuth),
    listGroups(weddingAuth),
    getWeddingFor(weddingAuth),
  ]);
  // An event in the address that is not (or is no longer) this wedding's is ignored.
  const eventId = events.some((event) => event.id === options.eventId)
    ? options.eventId
    : undefined;
  const [page, summary] = await Promise.all([
    listGuests(weddingAuth, { limit: GUEST_LIST_PAGE_SIZE }),
    getGuestSummary(weddingAuth, eventId),
  ]);

  const eventInfo: GuestEventInfo[] = events.map((event) => ({
    id: event.id,
    name: event.name,
    type: event.type,
    startsAt: event.startsAt,
    timezone: event.timezone,
    detail: [venueLine(event.location), event.dressCode].filter(Boolean).join(" • ") || null,
    dateLabel: formatDayMonth(calendarDayIn(new Date(event.startsAt), event.timezone)),
  }));

  return {
    dashboard: { viewer: dashboard.viewer, workspace: dashboard.workspace },
    weddingId: weddingAuth.weddingId,
    timezone: wedding.timezone,
    partners: partnersOf(wedding.partners),
    events: eventInfo,
    groups: groups.map((group) => ({
      id: group.id,
      name: group.name,
      side: group.side,
      guestCount: group.guestCount,
      version: group.version,
    })),
    page: { items: page.items, nextCursor: page.meta.nextCursor, hasMore: page.meta.hasMore },
    summary,
    eventId,
    canViewLog: can(weddingAuth.membership.role, "invitations:logs"),
  };
}

/**
 * Data for the Invitations screens (Stitch "Invitations Hub" and "RSVP Tracker"): the overview
 * numbers, the events as tracker pills, and, when the RSVP tab is open, the chosen event's replies.
 * Later changes are read by the browser through the REST API.
 */
export async function getInvitationsPage(
  auth: AuthContext,
  options: { eventId?: string; wantReplies: boolean },
) {
  const dashboard = await getDashboard(auth);
  const weddingAuth = await getWeddingAuth(auth);
  if (!dashboard.workspace || !weddingAuth) return null;

  const [events, { wedding }, overview] = await Promise.all([
    listEvents(weddingAuth),
    getWeddingFor(weddingAuth),
    getInvitationsOverview(weddingAuth),
  ]);
  const eventInfo: GuestEventInfo[] = events.map((event) => ({
    id: event.id,
    name: event.name,
    type: event.type,
    startsAt: event.startsAt,
    timezone: event.timezone,
    detail: [venueLine(event.location), event.dressCode].filter(Boolean).join(" • ") || null,
    dateLabel: formatDayMonth(calendarDayIn(new Date(event.startsAt), event.timezone)),
  }));

  // An event in the address that is not (or is no longer) this wedding's is ignored; the tracker
  // starts on the first event that hasn't finished, else the last one.
  const nowMs = Date.now();
  const upcoming = events.find(
    (event) => new Date(event.endsAt ?? event.startsAt).getTime() >= nowMs,
  );
  const eventId =
    events.find((event) => event.id === options.eventId)?.id ??
    upcoming?.id ??
    events[events.length - 1]?.id ??
    null;
  const replies =
    options.wantReplies && eventId ? await getEventReplies(weddingAuth, eventId) : null;

  return {
    dashboard: { viewer: dashboard.viewer, workspace: dashboard.workspace },
    weddingId: weddingAuth.weddingId,
    timezone: wedding.timezone,
    events: eventInfo,
    overview,
    eventId,
    replies,
    canViewLog: can(weddingAuth.membership.role, "invitations:logs"),
    viewer: { name: dashboard.viewer.name, role: weddingAuth.membership.role },
  };
}

/** The events an expense can be linked to: id and name, in timeline order. */
function eventChoices(events: EventDto[]) {
  return events.map((event) => ({ id: event.id, name: event.name }));
}

/**
 * Data for the Expenses screens (Stitch "Expenses & Budget Overview" and "All Expenses & Ledger"):
 * the budget overview, every expense with what has been paid, and the choices the form needs.
 * Everyone in the wedding sees all of it except the overall budget (owners and admins only).
 */
export async function getExpensesPage(auth: AuthContext) {
  const dashboard = await getDashboard(auth);
  const weddingAuth = await getWeddingAuth(auth);
  if (!dashboard.workspace || !weddingAuth) return null;

  const [summary, expenses, events, vendors, { wedding }] = await Promise.all([
    getExpenseSummary(weddingAuth),
    listEveryExpense(weddingAuth),
    listEvents(weddingAuth),
    listVendorChoices(weddingAuth),
    getWeddingFor(weddingAuth),
  ]);
  return {
    dashboard: { viewer: dashboard.viewer, workspace: dashboard.workspace },
    weddingId: weddingAuth.weddingId,
    currency: wedding.currency,
    timezone: wedding.timezone,
    today: todayIn(wedding.timezone),
    weddingVersion: wedding.version,
    summary,
    expenses,
    events: eventChoices(events),
    vendors,
    canRecordPayments: can(weddingAuth.membership.role, "payments:record"),
    canSeeVendors: can(weddingAuth.membership.role, "vendors:manage"),
    // The overall budget is for the people who may change the wedding's details.
    canSetBudget: can(weddingAuth.membership.role, "wedding:update"),
  };
}

/** Data for one expense (Stitch "Expense Detail & Payment Recording"); "not_found" when it is not in this wedding. */
export async function getExpensePage(auth: AuthContext, expenseId: string) {
  const dashboard = await getDashboard(auth);
  const weddingAuth = await getWeddingAuth(auth);
  if (!dashboard.workspace || !weddingAuth) return null;

  try {
    const [detail, events, vendors, { wedding }] = await Promise.all([
      getExpenseDetail(weddingAuth, expenseId),
      listEvents(weddingAuth),
      listVendorChoices(weddingAuth),
      getWeddingFor(weddingAuth),
    ]);
    return {
      dashboard: { viewer: dashboard.viewer, workspace: dashboard.workspace },
      weddingId: weddingAuth.weddingId,
      currency: wedding.currency,
      timezone: wedding.timezone,
      today: todayIn(wedding.timezone),
      detail,
      events: eventChoices(events),
      vendors,
      canRecordPayments: can(weddingAuth.membership.role, "payments:record"),
      canSeeVendors: can(weddingAuth.membership.role, "vendors:manage"),
    };
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") return "not_found" as const;
    throw error;
  }
}

/**
 * Data for the Vendors screen (Stitch "Vendors List"). A member gets "forbidden": vendors hold
 * contact details and terms, so they are for owners and admins (decision D3).
 */
export async function getVendorsPage(auth: AuthContext) {
  const dashboard = await getDashboard(auth);
  const weddingAuth = await getWeddingAuth(auth);
  if (!dashboard.workspace || !weddingAuth) return null;
  if (!can(weddingAuth.membership.role, "vendors:manage")) {
    return {
      dashboard: { viewer: dashboard.viewer, workspace: dashboard.workspace },
      forbidden: true as const,
    };
  }

  const [vendors, { wedding }] = await Promise.all([
    listEveryVendor(weddingAuth),
    getWeddingFor(weddingAuth),
  ]);
  return {
    dashboard: { viewer: dashboard.viewer, workspace: dashboard.workspace },
    forbidden: false as const,
    weddingId: weddingAuth.weddingId,
    currency: wedding.currency,
    vendors,
    placesConfigured: Boolean(getEnv().GOOGLE_PLACES_API_KEY),
  };
}

/** Data for one vendor (Stitch "Vendor Detail"); "not_found" when it is not in this wedding. */
export async function getVendorPage(auth: AuthContext, vendorId: string) {
  const dashboard = await getDashboard(auth);
  const weddingAuth = await getWeddingAuth(auth);
  if (!dashboard.workspace || !weddingAuth) return null;
  if (!can(weddingAuth.membership.role, "vendors:manage")) {
    return {
      dashboard: { viewer: dashboard.viewer, workspace: dashboard.workspace },
      forbidden: true as const,
    };
  }

  try {
    const [detail, { wedding }, events, vendorChoices] = await Promise.all([
      getVendorDetail(weddingAuth, vendorId),
      getWeddingFor(weddingAuth),
      listEvents(weddingAuth),
      listVendorChoices(weddingAuth),
    ]);
    return {
      dashboard: { viewer: dashboard.viewer, workspace: dashboard.workspace },
      forbidden: false as const,
      weddingId: weddingAuth.weddingId,
      currency: wedding.currency,
      timezone: wedding.timezone,
      today: todayIn(wedding.timezone),
      detail,
      events: eventChoices(events),
      vendorChoices,
      placesConfigured: Boolean(getEnv().GOOGLE_PLACES_API_KEY),
    };
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") return "not_found" as const;
    throw error;
  }
}

/**
 * Data for the Website editor (Stitch "Wedding Website Editor" and "Website Design and Settings").
 * Owners and admins only (decision D3): a member gets "forbidden" and the page says so.
 */
export async function getWebsitePage(auth: AuthContext) {
  const dashboard = await getDashboard(auth);
  const weddingAuth = await getWeddingAuth(auth);
  if (!dashboard.workspace || !weddingAuth) return null;
  const shell = { viewer: dashboard.viewer, workspace: dashboard.workspace };
  if (!can(weddingAuth.membership.role, "website:manage")) {
    return { dashboard: shell, forbidden: true as const };
  }
  const data = await getWebsiteEditorData(weddingAuth, getEnv().APP_URL);
  if (!data) return null;
  return {
    dashboard: shell,
    forbidden: false as const,
    weddingId: weddingAuth.weddingId,
    data,
    nowIso: new Date().toISOString(),
  };
}

/** The member's own preview of the site, exactly as guests will see it (works for a draft too). */
export async function getWebsitePreviewPage(auth: AuthContext) {
  const weddingAuth = await getWeddingAuth(auth);
  if (!weddingAuth) return null;
  if (!can(weddingAuth.membership.role, "website:manage")) return "forbidden" as const;
  const view = await getWebsitePreview(weddingAuth);
  return view ? { view, nowIso: new Date().toISOString() } : ("none" as const);
}

/** Data for the Live streams manager (Stitch "Live Streams Manager" and "Add Stream"). Every role. */
export async function getLiveStreamsPage(auth: AuthContext) {
  const dashboard = await getDashboard(auth);
  const weddingAuth = await getWeddingAuth(auth);
  if (!dashboard.workspace || !weddingAuth) return null;

  const [streams, events, { wedding }] = await Promise.all([
    listStreams(weddingAuth),
    listEvents(weddingAuth),
    getWeddingFor(weddingAuth),
  ]);
  return {
    dashboard: { viewer: dashboard.viewer, workspace: dashboard.workspace },
    weddingId: weddingAuth.weddingId,
    timezone: wedding.timezone,
    streams,
    events: events.map((event) => ({
      id: event.id,
      name: event.name,
      startsAt: event.startsAt,
      timezone: event.timezone,
    })),
    nowIso: new Date().toISOString(),
  };
}

/**
 * Data for the Gallery (Stitch "Gallery Home", album, approval queue, sharing and settings). Every
 * role sees and adds photos; owners and admins also get the approval queue and the shared links.
 * The photos themselves are loaded by the page through the REST API, a page at a time.
 */
export async function getGalleryPage(auth: AuthContext) {
  const dashboard = await getDashboard(auth);
  const weddingAuth = await getWeddingAuth(auth);
  if (!dashboard.workspace || !weddingAuth) return null;

  const canManage = can(weddingAuth.membership.role, "gallery:manage");
  const [settings, albums, events, links, { wedding }] = await Promise.all([
    getGallerySettings(weddingAuth),
    listAlbums(weddingAuth),
    listEvents(weddingAuth),
    canManage ? listAccessTokens(weddingAuth) : Promise.resolve([]),
    getWeddingFor(weddingAuth),
  ]);
  return {
    dashboard: { viewer: dashboard.viewer, workspace: dashboard.workspace },
    weddingId: weddingAuth.weddingId,
    canManage,
    settings,
    albums,
    links,
    events: events.map((event) => ({ id: event.id, name: event.name })),
    coupleNames:
      wedding.partners
        .map((partner) => partner.name.trim())
        .filter(Boolean)
        .join(" & ") || wedding.title,
    dateLabel: wedding.weddingDate ? formatLongDate(wedding.weddingDate) : null,
    timezone: wedding.timezone,
    nowIso: new Date().toISOString(),
  };
}
