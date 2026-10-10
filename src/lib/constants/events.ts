// Limits and formats for events and their embedded schedule (DB Design §6.7). Shared by the Zod
// request schemas and the Mongoose model so the two can never drift apart.

export const MAX_SCHEDULE_ITEMS = 50;

/** Wall-clock time in the EVENT's timezone ("07:00", "18:30"), not an instant. */
export const SCHEDULE_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
