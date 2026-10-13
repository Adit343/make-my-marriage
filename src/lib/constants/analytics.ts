// Product analytics (Phase 7, step 7.7). Only counts of things that happened, per day: no user,
// wedding, guest or request is ever recorded, so there is no personal data to protect or erase.

export const ANALYTICS_EVENTS = [
  "signup",
  "wedding_created",
  "member_invited",
  "member_joined",
  "event_created",
  "guest_created",
  "invitation_sent",
  "reminder_sent",
  "rsvp_answered",
  "website_published",
  "website_viewed",
  "photo_uploaded",
] as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];

/** Daily counts are kept this long, then removed by a TTL index. */
export const ANALYTICS_RETENTION_DAYS = 400;
