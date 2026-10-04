// Derived lookup keys (DB Design §3.5, §9.5). Used by the normalize plugin when saving and by
// services when querying, so both sides always agree.

/** Trimmed + lowercased. Provider-specific rules (Gmail dots, +tags) are deliberately not applied. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Lowercased, trimmed, inner whitespace collapsed, Unicode NFC (diacritics and Indic scripts
 * kept). Supports anchored prefix search such as /^sha/ on an ordinary index.
 */
export function normalizeName(name: string): string {
  return name.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();
}
