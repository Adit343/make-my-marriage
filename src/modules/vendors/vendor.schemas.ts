import { z } from "zod";
import { VENDOR_CATEGORIES, VENDOR_SOURCES, VENDOR_STATUSES } from "@/lib/constants/enums";
import {
  MAX_VENDOR_NAME,
  MAX_VENDOR_NOTES,
  MAX_VENDOR_PERSON,
  MAX_VENDOR_SEARCH,
} from "@/lib/constants/finance";
import { cursorPageQuery } from "@/lib/http/pagination";
import { locationInput } from "@/lib/validation/location";
import { email, objectId } from "@/lib/validation/primitives";
import { E164_PATTERN } from "@/models/shared/phone";

// API Design §9.2. A vendor has contact details and notes, never bank, UPI or card fields (DB
// Design §6.13): the strict objects below reject any other key.

export const vendorParams = z.object({ weddingId: objectId, vendorId: objectId });

const name = z.string().trim().min(1).max(MAX_VENDOR_NAME);
const notes = z.string().trim().max(MAX_VENDOR_NOTES);

const contactInput = z.strictObject({
  personName: z.string().trim().max(MAX_VENDOR_PERSON).optional(),
  phone: z
    .string()
    .trim()
    .regex(E164_PATTERN, "Use international format, e.g. +919876543210")
    .optional(),
  email: email.optional(),
  /** DB Design §6.13: a vendor website must be https. */
  website: z
    .url({ protocol: /^https$/, error: "The website must start with https://" })
    .max(500)
    .optional(),
});

export const createVendorBody = z.strictObject({
  name,
  category: z.enum(VENDOR_CATEGORIES),
  status: z.enum(VENDOR_STATUSES).optional(),
  contact: contactInput.optional(),
  location: locationInput.optional(),
  source: z.enum(VENDOR_SOURCES).optional(),
  notes: notes.optional(),
});
export type CreateVendorInput = z.infer<typeof createVendorBody>;

// Any subset plus the `version` the client last read (decision C5). `contact` and `location` are
// replaced as a whole; null clears an optional field.
export const updateVendorBody = z
  .strictObject({
    version: z.number().int().min(0),
    name,
    category: z.enum(VENDOR_CATEGORIES),
    status: z.enum(VENDOR_STATUSES),
    contact: contactInput.nullable(),
    location: locationInput.nullable(),
    notes: notes.nullable(),
  })
  .partial()
  .required({ version: true })
  .refine((body) => Object.keys(body).length > 1, { message: "Nothing to update" });
export type UpdateVendorInput = z.infer<typeof updateVendorBody>;

export const listVendorsQuery = z.strictObject({
  ...cursorPageQuery,
  /** Anchored prefix on the name, like the guest list. */
  search: z.string().trim().min(1).max(MAX_VENDOR_NAME).optional(),
  category: z.enum(VENDOR_CATEGORIES).optional(),
  status: z.enum(VENDOR_STATUSES).optional(),
});
export type ListVendorsQuery = z.infer<typeof listVendorsQuery>;

export const searchPlacesQuery = z.strictObject({
  query: z.string().trim().min(2).max(MAX_VENDOR_SEARCH),
});
export type SearchPlacesQuery = z.infer<typeof searchPlacesQuery>;
