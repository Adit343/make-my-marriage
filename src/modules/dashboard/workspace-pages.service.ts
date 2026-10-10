import "server-only";
import { AppError } from "@/lib/errors";
import { nextEventLabel } from "@/lib/events/format";
import { toEventDetailView, toEventViews } from "@/lib/events/view";
import { describeUserAgent, lastActiveLabel, type DeviceKind } from "@/lib/user-agent";
import { getCurrentUser, listSessions } from "@/modules/auth/auth.service";
import type { AuthContext } from "@/modules/auth/session.service";
import { getDashboard } from "@/modules/dashboard/dashboard.service";
import { getEvent, listEvents } from "@/modules/events/event.service";
import { getWeddingAuth } from "@/modules/members/guards";
import type { InvitationDto } from "@/modules/members/invitation.dto";
import { listInvitations } from "@/modules/members/invitation.service";
import { countActiveMembers } from "@/modules/members/member.repository";
import { listTeam } from "@/modules/members/member.service";
import { can } from "@/modules/members/permissions";
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

  const [events, { wedding }] = await Promise.all([
    listEvents(weddingAuth),
    getWeddingFor(weddingAuth),
  ]);
  const now = new Date();
  return {
    dashboard: { viewer: dashboard.viewer, workspace: dashboard.workspace },
    weddingId: weddingAuth.weddingId,
    weddingTimezone: wedding.timezone,
    events: toEventViews(events, now),
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
    const [event, { wedding }] = await Promise.all([
      getEvent(weddingAuth, eventId),
      getWeddingFor(weddingAuth),
    ]);
    return {
      dashboard: { viewer: dashboard.viewer, workspace: dashboard.workspace },
      weddingId: weddingAuth.weddingId,
      weddingTimezone: wedding.timezone,
      event: toEventDetailView(event),
    };
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") return "not_found" as const;
    throw error;
  }
}
