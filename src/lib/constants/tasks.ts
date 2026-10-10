// Limits for tasks (DB Design §6.8). Shared by the Zod request schemas, the Mongoose model and
// the task form so they can never drift apart.

export const MAX_TASK_ASSIGNEES = 10;
export const MAX_TASK_TITLE = 200;
/** The Stitch task form's counter reads "/ 500", so the form stops there. */
export const TASK_FORM_DESCRIPTION_LIMIT = 500;
/** The API and database allow up to 2,000 characters (DB Design §6.8). */
export const MAX_TASK_DESCRIPTION = 2000;
