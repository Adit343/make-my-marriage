import type { MemberRelationship, MemberRole } from "@/lib/constants/enums";

export const ROLE_LABEL: Record<MemberRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

export const RELATIONSHIP_LABEL: Record<MemberRelationship, string> = {
  couple: "Couple",
  parent: "Parent",
  sibling: "Sibling",
  relative: "Family Coordinator",
  friend: "Friend",
  planner: "Wedding Planner",
  other: "Family & Friends",
};

/** Plain names, as in the Team screen's table and the invite form's relationship select. */
export const RELATIONSHIP_PLAIN: Record<MemberRelationship, string> = {
  couple: "Couple",
  parent: "Parent",
  sibling: "Sibling",
  relative: "Relative",
  friend: "Friend",
  planner: "Planner",
  other: "Other",
};

export const WEDDING_STATUS_LABEL: Record<string, string> = {
  planning: "Planning Active",
  completed: "Completed",
  archived: "Archived",
};

/** D3 role matrix: only owners and admins invite or manage members. */
export function canManageMembers(role: MemberRole | null): boolean {
  return role === "owner" || role === "admin";
}
