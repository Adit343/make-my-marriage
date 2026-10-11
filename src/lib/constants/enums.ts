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

// Phase 4 — Financials & Vendors (DB Design Appendix A).
export const EXPENSE_CATEGORIES = [
  "venue",
  "catering",
  "decor",
  "photography_video",
  "attire",
  "jewellery",
  "makeup_beauty",
  "music_entertainment",
  "invitations_stationery",
  "rituals_ceremony",
  "travel_stay",
  "gifts_favours",
  "other",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const VENDOR_CATEGORIES = [
  "venue",
  "caterer",
  "decorator",
  "photographer",
  "videographer",
  "makeup_artist",
  "mehendi_artist",
  "music_entertainment",
  "officiant",
  "florist",
  "jeweller",
  "tailor_designer",
  "other",
] as const;
export type VendorCategory = (typeof VENDOR_CATEGORIES)[number];

export const VENDOR_STATUSES = ["shortlisted", "contacted", "booked", "rejected"] as const;
export type VendorStatus = (typeof VENDOR_STATUSES)[number];

export const VENDOR_SOURCES = ["manual", "google_places"] as const;
export type VendorSource = (typeof VENDOR_SOURCES)[number];

export const PAYMENT_STATUSES = ["pending", "paid", "cancelled"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_METHODS = ["cash", "upi", "bank_transfer", "cheque", "card", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
