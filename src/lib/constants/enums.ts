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

// Phase 3 — Guests & Invitations (DB Design Appendix A).
export const GUEST_SIDES = ["partnerOne", "partnerTwo", "both"] as const;
export type GuestSide = (typeof GUEST_SIDES)[number];

export const AGE_CATEGORIES = ["adult", "child", "infant"] as const;
export type AgeCategory = (typeof AGE_CATEGORIES)[number];

export const DIETARY_PREFERENCES = [
  "no_preference",
  "vegetarian",
  "non_vegetarian",
  "vegan",
  "jain",
  "other",
] as const;
export type DietaryPreference = (typeof DIETARY_PREFERENCES)[number];

export const GUEST_INVITE_STATUSES = ["not_invited", "invited"] as const;
export type GuestInviteStatus = (typeof GUEST_INVITE_STATUSES)[number];

export const INVITE_CHANNELS = ["email", "whatsapp", "manual"] as const;
export type InviteChannel = (typeof INVITE_CHANNELS)[number];

export const RSVP_STATUSES = ["pending", "attending", "declined", "maybe"] as const;
export type RsvpStatus = (typeof RSVP_STATUSES)[number];

export const RESPONDED_VIA = ["guest_link", "member"] as const;
export type RespondedVia = (typeof RESPONDED_VIA)[number];
