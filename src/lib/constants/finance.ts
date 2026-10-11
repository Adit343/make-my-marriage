// Limits for expenses, vendors and payments (DB Design §6.12 to §6.14). Shared by the Zod request
// schemas, the Mongoose models and the forms so they can never drift apart.

export const MAX_EXPENSE_TITLE = 200;
export const MAX_EXPENSE_NOTES = 2000;
export const MAX_VENDOR_NAME = 150;
export const MAX_VENDOR_NOTES = 2000;
export const MAX_VENDOR_PERSON = 100;
export const MAX_VENDOR_SEARCH = 200;
export const MAX_PAYMENT_REFERENCE = 100;
export const MAX_PAYMENT_NOTES = 500;
/** The Expenses screen reads up to this many expenses in one server-side call (a safety stop). */
export const EXPENSE_READ_CAP = 2000;
/** "Payments due" on the overview looks this many days ahead. */
export const PAYMENTS_DUE_WINDOW_DAYS = 30;
