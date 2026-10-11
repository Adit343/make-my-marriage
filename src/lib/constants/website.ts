// Limits and fixed choices for the wedding website and live streams (DB Design §6.15, §6.16).
// Shared by the Zod request schemas, the Mongoose models and the screens so they can never drift.

export const MAX_WEBSITE_TITLE = 120;
export const MAX_WEBSITE_TAGLINE = 200;
export const MAX_WEBSITE_WELCOME = 1000;
export const MAX_SECTIONS = 20;
export const MAX_SECTION_TITLE = 80;
export const MAX_SECTION_BODY = 3000;
export const MAX_PUBLIC_EVENTS = 20;
export const MAX_SEO_TITLE = 60;
export const MAX_SEO_DESCRIPTION = 160;
export const MIN_SLUG = 3;
export const MAX_SLUG = 40;
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const ACCENT_PATTERN = /^#[0-9A-Fa-f]{6}$/;

/** The five accent colours offered on the Design and settings tab; the first is the default. */
export const ACCENT_COLORS = [
  { value: "#1F4D3D", label: "Deep emerald" },
  { value: "#1B4D5C", label: "Deep teal" },
  { value: "#B5714A", label: "Brass" },
  { value: "#2A2622", label: "Warm charcoal" },
  { value: "#5A3D4E", label: "Muted plum" },
] as const;
export const DEFAULT_ACCENT = ACCENT_COLORS[0].value;

/**
 * Names the public address can never take: app routes and anything that would confuse a guest
 * (DB Design §6.15 plus the routes this app really has).
 */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  "api",
  "dashboard",
  "login",
  "signup",
  "invite",
  "rsvp",
  "gallery",
  "live",
  "admin",
  "www",
  "app",
  "static",
  "join",
  "onboarding",
  "forgot-password",
  "reset-password",
  "w",
  "i",
  "help",
  "support",
  "about",
  "terms",
  "privacy",
  "settings",
  "health",
  "make-my-marriage",
  "makemymarriage",
]);

// Live streams (DB Design §6.16).
export const MAX_STREAM_TITLE = 120;
export const MAX_STREAM_DESCRIPTION = 1000;
export const MAX_STREAM_URL = 500;
