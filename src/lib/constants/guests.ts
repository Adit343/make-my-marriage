// Limits for guests, groups and RSVP rows (DB Design §6.9 to §6.11). Shared by the Zod request
// schemas, the Mongoose models and the guest forms so they can never drift apart.

export const MAX_GUEST_NAME = 120;
export const MAX_GUEST_RELATION = 80;
export const MAX_GUEST_NOTES = 1000;
export const MAX_PLUS_ONES = 10;
export const MAX_GROUP_NAME = 100;
export const MAX_GROUP_NOTES = 1000;
export const MAX_RSVP_NOTE = 500;
/** A bulk action (delete, change group) takes at most this many guests at once. */
export const MAX_BULK_GUESTS = 200;
/** The most guests the Guests screen's headline numbers are computed over (a safety stop). */
export const GUEST_LIST_PAGE_SIZE = 25;
