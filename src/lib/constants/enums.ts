// Single source of truth for enum values, shared by Zod schemas and Mongoose models
// (DB Design §3.6, Appendix A). Add each phase's enums when that phase is built.

export const USER_STATUSES = ["active", "disabled", "pending_deletion"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const AUTH_PROVIDERS = ["google"] as const;
export type AuthProvider = (typeof AUTH_PROVIDERS)[number];

export const WEDDING_STATUSES = ["planning", "completed", "archived"] as const;
export type WeddingStatus = (typeof WEDDING_STATUSES)[number];

export const MEMBER_ROLES = ["owner", "admin", "member"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export const MEMBER_RELATIONSHIPS = [
  "couple",
  "parent",
  "sibling",
  "relative",
  "friend",
  "planner",
  "other",
] as const;
export type MemberRelationship = (typeof MEMBER_RELATIONSHIPS)[number];

export const MEMBER_STATUSES = ["active", "suspended"] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];

export const INVITATION_STATUSES = ["pending", "accepted", "revoked"] as const;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

export const EMAIL_TYPES = [
  "member_invitation",
  "guest_invitation",
  "rsvp_reminder",
  "password_reset",
  "other",
] as const;
export type EmailType = (typeof EMAIL_TYPES)[number];

export const EMAIL_STATUSES = ["sent", "failed"] as const;
export type EmailStatus = (typeof EMAIL_STATUSES)[number];
