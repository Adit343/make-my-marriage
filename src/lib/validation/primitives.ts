import { z } from "zod";

// Shared Zod building blocks for request schemas (DB Design §3.5, §5.1).

export const objectId = z.string().regex(/^[a-f0-9]{24}$/i, "Invalid id");

/** As typed (trimmed). Store a separate emailNormalized for lookups. */
export const email = z.string().trim().max(254).pipe(z.email());

/** Calendar day with no time component, e.g. a wedding date: "YYYY-MM-DD". */
export const isoDate = z.iso.date();

export const timezone = z.string().refine((value) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}, "Invalid IANA timezone");

const SUPPORTED_CURRENCIES = new Set(Intl.supportedValuesOf("currency"));
export const currency = z
  .string()
  .regex(/^[A-Z]{3}$/, "Use an ISO 4217 code such as INR")
  .refine((value) => SUPPORTED_CURRENCIES.has(value), "Unknown currency");

export const countryCode = z.string().regex(/^[A-Z]{2}$/, "Use an ISO 3166-1 alpha-2 code");

/** Money in minor units (paise): integers only, never floats. */
export const minorAmount = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
