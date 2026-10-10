import "server-only";
import type { MemberRelationship, MemberRole } from "@/lib/constants/enums";
import { daysUntil, formatCalendarDate } from "@/lib/dates";
import { calendarDayIn, formatLongDate, formatTimeRange, venueLine } from "@/lib/events/format";
import { initialsOf } from "@/lib/text/initials";
import type { AuthContext } from "@/modules/auth/session.service";
import { countEvents, findNextEvent } from "@/modules/events/event.repository";
import { findActiveMembershipByUser, listMembers } from "@/modules/members/member.repository";
import { findUserSummaries } from "@/modules/users/user.repository";
import { findWedding } from "@/modules/weddings/wedding.repository";

// Everything the member dashboard (Stitch "Member Wedding Dashboard") shows, from real data only.
// Widgets for modules that don't exist yet (guests, tasks, vendors) get zero counts and
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
  } | null;
}

export { initialsOf };

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

  const [eventCount, nextEventRow] = await Promise.all([
    countEvents(wedding._id),
    findNextEvent(wedding._id, new Date()),
  ]);
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
      counts: { events: eventCount, guests: 0, pendingTasks: 0, vendors: 0 },
      nextEvent,
    },
  };
}
