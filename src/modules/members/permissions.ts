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
} as const satisfies Record<string, readonly MemberRole[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: MemberRole, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly MemberRole[]).includes(role);
}
