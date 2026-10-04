// Client-side format check for instant feedback only. The API's Zod schema is authoritative.
const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isEmailFormat(value: string): boolean {
  return EMAIL_FORMAT.test(value.trim());
}
