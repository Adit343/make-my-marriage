// Auth rules shared by the UI and (from step 1.5) the API's Zod schemas.

/** API Design §4.1: length over composition rules. */
export const PASSWORD_MIN_LENGTH = 10;

/** DB Design §6.3 allows 30–60 minutes for password-reset links. */
export const PASSWORD_RESET_TTL_MINUTES = 30;
