// Single source of truth for enum values, shared by Zod schemas and Mongoose models
// (DB Design §3.6, Appendix A). Add each phase's enums when that phase is built.

export const USER_STATUSES = ["active", "disabled", "pending_deletion"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const AUTH_PROVIDERS = ["google"] as const;
export type AuthProvider = (typeof AUTH_PROVIDERS)[number];

export const PASSWORD_HASH_ALGORITHMS = ["scrypt"] as const;
export type PasswordHashAlgorithm = (typeof PASSWORD_HASH_ALGORITHMS)[number];

export const WEDDING_STATUSES = ["planning", "completed", "archived"] as const;
export type WeddingStatus = (typeof WEDDING_STATUSES)[number];

export const MEMBER_ROLES = ["owner", "admin", "member"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

/** Roles an invitation may grant: ownership only ever moves by transfer (DB Design §6.6). */
export const INVITATION_ROLES = ["admin", "member"] as const;
export type InvitationRole = (typeof INVITATION_ROLES)[number];

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

// Phase 2 — Planning (DB Design Appendix A).
/** `ceremony` is the main wedding ceremony. */
export const EVENT_TYPES = [
  "mehendi",
  "haldi",
  "sangeet",
  "engagement",
  "ceremony",
  "reception",
  "other",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const TASK_STATUSES = ["todo", "in_progress", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ["low", "medium", "high"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
