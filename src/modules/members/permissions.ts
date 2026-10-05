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
} as const satisfies Record<string, readonly MemberRole[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: MemberRole, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly MemberRole[]).includes(role);
}
