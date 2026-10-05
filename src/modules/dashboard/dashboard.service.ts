import "server-only";
import type { MemberRelationship, MemberRole } from "@/lib/constants/enums";
import { daysUntil, formatCalendarDate } from "@/lib/dates";
import { initialsOf } from "@/lib/text/initials";
import type { AuthContext } from "@/modules/auth/session.service";
import { findActiveMembershipByUser, listMembers } from "@/modules/members/member.repository";
import { findUserSummaries } from "@/modules/users/user.repository";
import { findWedding } from "@/modules/weddings/wedding.repository";

// Everything the member dashboard (Stitch "Member Wedding Dashboard") shows, from real data only.
// Widgets for modules that don't exist yet (events, guests, tasks, vendors) get zero counts and
// render their designed empty states; each module fills its widget in when it is built.

export interface TeamMember {
  id: string;
  name: string;
  initials: string;
  role: MemberRole;
  relationship: MemberRelationship | null;
  isYou: boolean;
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
      counts: { events: 0, guests: 0, pendingTasks: 0, vendors: 0 },
    },
  };
}
