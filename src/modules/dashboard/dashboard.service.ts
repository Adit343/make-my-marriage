import "server-only";
import type { MemberRelationship, MemberRole } from "@/lib/constants/enums";
import { daysUntil, formatCalendarDate, formatShortDate, todayIn } from "@/lib/dates";
import { calendarDayIn, formatLongDate, formatTimeRange, venueLine } from "@/lib/events/format";
import { isOverdue } from "@/lib/tasks/view";
import { initialsOf } from "@/lib/text/initials";
import type { AuthContext } from "@/modules/auth/session.service";
import { countEvents, findNextEvent } from "@/modules/events/event.repository";
import { countGuests, listGuestsPage } from "@/modules/guests/guest.repository";
import { replyCountsByGuest } from "@/modules/guests/rsvp.repository";
import { findActiveMembershipByUser, listMembers } from "@/modules/members/member.repository";
import { countOpenTasks, listUpcomingOpenTasks } from "@/modules/tasks/task.repository";
import { findUserSummaries } from "@/modules/users/user.repository";
import { findWedding } from "@/modules/weddings/wedding.repository";

// Everything the member dashboard (Stitch "Member Wedding Dashboard") shows, from real data only.
// Widgets for modules that don't exist yet (vendors) get zero counts and
// render their designed empty states; each module fills its widget in when it is built.

export interface TeamMember {
  id: string;
  name: string;
  initials: string;
  role: MemberRole;
  relationship: MemberRelationship | null;
  isYou: boolean;
}

export interface NextEvent {
  id: string;
  name: string;
  /** "Saturday, 13 February 2027 · 10:00 AM – 01:00 PM IST" */
  whenLabel: string;
  venue: string | null;
  /** Whole days until it starts in its own timezone: 0 today, negative while under way. */
  daysUntil: number;
}

export interface UpcomingTask {
  id: string;
  title: string;
  priority: "low" | "medium" | "high";
  status: "todo" | "in_progress" | "done";
  /** "11 Feb 2027", or null when the task has no due date. */
  dueLabel: string | null;
  isOverdue: boolean;
  assigneeInitials: string[];
}

export interface Dashboard {
  viewer: {
    name: string;
    email: string;
    initials: string;
    role: MemberRole | null;
    relationship: MemberRelationship | null;
  };
  workspace: {
    weddingId: string;
    title: string;
    status: string;
    dateLabel: string | null;
    locationLabel: string | null;
    city: string | null;
    /** null when no date is set; 0 on the day; negative once it has passed. */
    daysUntilWedding: number | null;
    team: TeamMember[];
    counts: { events: number; guests: number; pendingTasks: number; vendors: number };
    /** The soonest event that hasn't finished, or null when there are none. */
    nextEvent: NextEvent | null;
    /** The next few tasks that aren't done: soonest due first. */
    upcomingTasks: UpcomingTask[];
    /** Where the guests stand, one line per guest (see summarizeReplies). */
    rsvp: RsvpOverview;
  } | null;
}

export interface RsvpOverview {
  /** Guests invited to at least one event. */
  invited: number;
  attending: number;
  declined: number;
  /** Not confirmed yet: still pending, or "maybe". */
  pending: number;
  /** Share of invited guests who have given an answer, 0 to 100; null with nobody invited. */
  responseRate: number | null;
  /** A few guests who still owe an answer, A to Z. */
  followUp: { id: string; name: string; waitingOn: number }[];
  /** All guests who still owe an answer (the list above shows a few). */
  pendingTotal: number;
}

export { initialsOf };

/**
 * One answer per guest: attending if they are coming to any event; otherwise not confirmed while
 * any reply is pending or maybe; otherwise declined. Same reading as the Guests screen's RSVP column.
 */
export function summarizeReplies(
  rows: { guestId: string; attending: number; maybe: number; pending: number; declined: number }[],
) {
  const overview = { invited: rows.length, attending: 0, declined: 0, pending: 0 };
  const waiting: { guestId: string; waitingOn: number }[] = [];
  for (const row of rows) {
    if (row.attending > 0) overview.attending++;
    else if (row.pending > 0 || row.maybe > 0) {
      overview.pending++;
      // The guests to chase are exactly the ones counted as not confirmed.
      waiting.push({ guestId: row.guestId, waitingOn: row.pending + row.maybe });
    } else overview.declined++;
  }
  return { overview, waiting };
}

const ROLE_ORDER: Record<MemberRole, number> = { owner: 0, admin: 1, member: 2 };

export async function getDashboard(auth: AuthContext): Promise<Dashboard> {
  const viewer = {
    name: auth.user.name,
    email: auth.user.email,
    initials: initialsOf(auth.user.name),
    role: null,
    relationship: null,
  };

  const membership = await findActiveMembershipByUser(auth.userId);
  const wedding = membership ? await findWedding(membership.weddingId) : null;
  if (!membership || !wedding) return { viewer, workspace: null };

  const members = await listMembers(wedding._id);
  const users = await findUserSummaries(members.map((member) => member.userId));
  const nameById = new Map(users.map((user) => [user._id.toString(), user.name]));

  const team = members
    .map((member) => {
      const name = nameById.get(member.userId.toString()) ?? "Former member";
      return {
        id: member._id.toString(),
        name,
        initials: initialsOf(name),
        role: member.role,
        relationship: member.relationship ?? null,
        isYou: member.userId.toString() === auth.userId,
      };
    })
    .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]);

  const [eventCount, guestCount, nextEventRow, openTaskCount, upcomingTaskRows, replyRows] =
    await Promise.all([
      countEvents(wedding._id),
      countGuests(wedding._id),
      findNextEvent(wedding._id, new Date()),
      countOpenTasks(wedding._id),
      listUpcomingOpenTasks(wedding._id, 4),
      replyCountsByGuest(wedding._id),
    ]);
  const { overview, waiting } = summarizeReplies(replyRows);
  const waitingById = new Map(waiting.map((row) => [row.guestId, row.waitingOn]));
  // The first few guests still owing an answer, A to Z.
  const followUpRows =
    waiting.length > 0
      ? await listGuestsPage(wedding._id, { idIn: waiting.map((row) => row.guestId) }, { limit: 4 })
      : [];
  const today = todayIn(wedding.timezone);
  const initialsByMember = new Map(team.map((member) => [member.id, member.initials]));
  const upcomingTasks: UpcomingTask[] = upcomingTaskRows.map((task) => ({
    id: task._id.toString(),
    title: task.title,
    priority: task.priority,
    status: task.status,
    dueLabel: task.dueDate ? formatShortDate(task.dueDate) : null,
    isOverdue: isOverdue({ dueDate: task.dueDate ?? null, status: task.status }, today),
    assigneeInitials: (task.assigneeMemberIds ?? []).flatMap((id) => {
      const initials = initialsByMember.get(id.toString());
      return initials ? [initials] : [];
    }),
  }));
  const nextEvent: NextEvent | null = nextEventRow
    ? {
        id: nextEventRow._id.toString(),
        name: nextEventRow.name,
        whenLabel: `${formatLongDate(nextEventRow.startsAt, nextEventRow.timezone)} · ${formatTimeRange(
          nextEventRow.startsAt,
          nextEventRow.endsAt ?? null,
          nextEventRow.timezone,
        )}`,
        venue: venueLine(nextEventRow.location),
        daysUntil: daysUntil(
          calendarDayIn(nextEventRow.startsAt, nextEventRow.timezone),
          nextEventRow.timezone,
        ),
      }
    : null;

  const address = wedding.location?.address;
  const city = address?.city ?? null;
  const locationLabel =
    [address?.city, address?.state].filter(Boolean).join(", ") || wedding.location?.label || null;

  return {
    viewer: {
      ...viewer,
      role: membership.role,
      relationship: membership.relationship ?? null,
    },
    workspace: {
      weddingId: wedding._id.toString(),
      title: wedding.title,
      status: wedding.status,
      dateLabel: wedding.weddingDate ? formatCalendarDate(wedding.weddingDate) : null,
      locationLabel,
      city,
      daysUntilWedding: wedding.weddingDate
        ? daysUntil(wedding.weddingDate, wedding.timezone)
        : null,
      team,
      counts: { events: eventCount, guests: guestCount, pendingTasks: openTaskCount, vendors: 0 },
      nextEvent,
      upcomingTasks,
      rsvp: {
        ...overview,
        responseRate:
          overview.invited > 0
            ? Math.round(((overview.attending + overview.declined) / overview.invited) * 100)
            : null,
        followUp: followUpRows.slice(0, 4).map((guest) => ({
          id: guest._id.toString(),
          name: guest.name,
          waitingOn: waitingById.get(guest._id.toString()) ?? 0,
        })),
        pendingTotal: waiting.length,
      },
    },
  };
}
