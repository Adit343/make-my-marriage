import type { MemberRole } from "@/lib/constants/enums";

// The role matrix (decision D3, API Design §3.2) as data, so it is one reviewable table rather than
// role checks scattered across services. Add each module's permissions when that module is built
// (events/tasks/guests/gallery edit → every member; expenses/vendors → admin+; and so on).

const OWNER = ["owner"] as const;
const ADMIN_UP = ["owner", "admin"] as const;
const EVERYONE = ["owner", "admin", "member"] as const;

export const PERMISSIONS = {
  /** View the wedding and its team list. */
  "wedding:view": EVERYONE,
  "wedding:update": ADMIN_UP,
  /** Delete and restore the wedding; hand ownership to someone else. */
  "wedding:delete": OWNER,
  "ownership:transfer": OWNER,
  /** Change members' roles, remove members, and (step 1.7) invite people. */
  "members:manage": ADMIN_UP,
  /**
   * Create events, and edit or delete the ones you created (the service checks who created it).
   * Owner decision 2026-10-10: a member may delete only their own; admin and owner may delete any.
   */
  "events:edit": EVERYONE,
  /** Edit or delete events other people created. */
  "events:manage-any": ADMIN_UP,
  /**
   * Create tasks and edit ANY task (assignees must be able to update the status of tasks other
   * people created). Deleting is narrower: your own, unless you have tasks:manage-any.
   */
  "tasks:edit": EVERYONE,
  /** Delete tasks other people created (owner decision 2026-10-10, same pattern as events). */
  "tasks:manage-any": ADMIN_UP,
  /**
   * Add, edit and remove guests and groups, assign them to events, and record their replies.
   * Every role (DB Design §15 item 3: members edit the guest list).
   */
  "guests:edit": EVERYONE,
  /**
   * Send invitations and RSVP reminders (email, WhatsApp, in person) and copy or rotate a guest's
   * personal link. Every role: a parent and the planner share the sending (decided 2026-10-11).
   */
  "invitations:send": EVERYONE,
  /** The delivery log of guest emails and retrying one from it (API Design §13, Stitch: owners and admins only). */
  "invitations:logs": ADMIN_UP,
  /**
   * Record expenses and edit or delete the ones you recorded (the service checks who recorded it).
   * Every role: family members keep the ledger together (owner decision 2026-10-10, overriding D3).
   */
  "expenses:edit": EVERYONE,
  /** Edit or delete expenses other people recorded. */
  "expenses:manage-any": ADMIN_UP,
  /** Record, change and delete payments against an expense (members read them). */
  "payments:record": ADMIN_UP,
  /** Everything about vendors: the list, contact details, adding, editing, deleting, place search (decision D3). */
  "vendors:manage": ADMIN_UP,
  /** Edit, publish and unpublish the wedding website (API Design §10, decision D3: admin and up). */
  "website:manage": ADMIN_UP,
  /**
   * Add, edit, delete and re-link live streams and set their status (API Design §11: every role,
   * so whoever is at the venue can press Live).
   */
  "livestream:edit": EVERYONE,
} as const satisfies Record<string, readonly MemberRole[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: MemberRole, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly MemberRole[]).includes(role);
}
