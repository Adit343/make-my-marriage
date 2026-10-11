import { MAX_SLUG, MIN_SLUG, RESERVED_SLUGS, SLUG_PATTERN } from "@/lib/constants/website";

// The public address of a wedding site: makemymarriage.com/w/<slug> (decision D8).

/** Why an address can't be used, or null when its shape is fine (availability is checked separately). */
export function slugProblem(slug: string): "invalid" | "reserved" | null {
  if (slug.length < MIN_SLUG || slug.length > MAX_SLUG || !SLUG_PATTERN.test(slug))
    return "invalid";
  if (RESERVED_SLUGS.has(slug)) return "reserved";
  return null;
}

/** "Aarav & Diya" → "aarav-diya": lowercase letters and digits joined by single hyphens. */
export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG)
    .replace(/-+$/g, "");
}

/** A first guess for the address: the couple's first names, padded if too short or reserved. */
export function suggestSlug(names: string[], fallback: string): string {
  const firstNames = names.map((name) => name.trim().split(/\s+/)[0] ?? "").filter(Boolean);
  const base = slugify(firstNames.length > 0 ? firstNames.join(" ") : fallback);
  const candidate = base.length >= MIN_SLUG ? base : slugify(`${base} wedding`);
  return slugProblem(candidate) ? "our-wedding" : candidate;
}

/** `aarav-diya`, then `aarav-diya-2`, `aarav-diya-3`… (kept within the length limit). */
export function withSuffix(slug: string, attempt: number): string {
  if (attempt <= 1) return slug;
  const suffix = `-${attempt}`;
  return `${slug.slice(0, MAX_SLUG - suffix.length).replace(/-+$/g, "")}${suffix}`;
}
