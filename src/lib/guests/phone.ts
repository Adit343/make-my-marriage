// Phone numbers on the guest forms. The database stores E.164 ("+919876543210", DB Design §3.5);
// people type "98765 43210". These two functions are the bridge, shared by the form and its tests.

const E164 = /^\+[1-9]\d{7,14}$/;

/**
 * What a person typed to E.164, or null when it is not a usable number. Spaces, dashes, dots and
 * brackets are ignored. A bare 10-digit number (or one with a leading 0) is taken as Indian, since
 * the product is India-first; anything else must carry its country code with "+" or "00".
 */
export function toE164(typed: string): string | null {
  const compact = typed.replace(/[\s\-.()]/g, "");
  if (compact === "") return null;
  if (compact.startsWith("+") || compact.startsWith("00")) {
    const candidate = `+${compact.replace(/^\+|^00/, "")}`;
    return E164.test(candidate) ? candidate : null;
  }
  if (!/^\d+$/.test(compact)) return null;
  if (compact.length === 10) return `+91${compact}`;
  if (compact.length === 11 && compact.startsWith("0")) return `+91${compact.slice(1)}`;
  if (compact.length === 12 && compact.startsWith("91")) return `+${compact}`;
  return null;
}

/** "+919876543210" → "+91 98765 43210". Other countries are shown as stored. */
export function formatPhone(e164: string): string {
  const match = /^\+91(\d{5})(\d{5})$/.exec(e164);
  return match ? `+91 ${match[1]} ${match[2]}` : e164;
}

/** What goes in the form's phone box: the Indian number without "+91", otherwise the full number. */
export function phoneForInput(e164: string | null): string {
  if (!e164) return "";
  const match = /^\+91(\d{5})(\d{5})$/.exec(e164);
  return match ? `${match[1]} ${match[2]}` : e164;
}
