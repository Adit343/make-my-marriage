// Last-line checks in the schema (DB Design §9.6). Zod at the API boundary gives the friendly
// errors; these stop bad data written by scripts or future code paths.

/** Calendar day with no time component (DB Design §3.5). */
export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Money and counts are whole numbers (paise, never floats). Allows null/undefined. */
export const wholeNumber = {
  validator: (value: unknown) => value == null || Number.isInteger(value),
  message: "{PATH} must be a whole number",
};
