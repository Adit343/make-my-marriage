import { z } from "zod";
import { MEMBER_RELATIONSHIPS, WEDDING_STATUSES } from "@/lib/constants/enums";
import { locationInput } from "@/lib/validation/location";
import { currency, isoDate, minorAmount, objectId, timezone } from "@/lib/validation/primitives";

// API Design §6.1. Only `title` is required; the model supplies India-first defaults.
export const createWeddingBody = z.strictObject({
  title: z.string().trim().min(1).max(120),
  weddingDate: isoDate.nullable().optional(),
  partners: z
    .array(z.strictObject({ name: z.string().trim().min(1).max(80) }))
    .max(2)
    .optional(),
  timezone: timezone.optional(),
  currency: currency.optional(),
  location: locationInput.optional(),
  budgetTotalMinor: minorAmount.nullable().optional(),
  /** The creator's relationship label on their owner membership (e.g. "couple"). */
  relationship: z.enum(MEMBER_RELATIONSHIPS).optional(),
});

export type CreateWeddingInput = z.infer<typeof createWeddingBody>;

export const weddingParams = z.object({ weddingId: objectId });

// API Design §6.2: any subset of the editable fields, plus the `version` the client last read
// (decision C5) so a stale write is rejected with 409 VERSION_CONFLICT instead of overwriting.
export const updateWeddingBody = z
  .strictObject({
    version: z.number().int().min(0),
    title: z.string().trim().min(1).max(120),
    partners: z.array(z.strictObject({ name: z.string().trim().min(1).max(80) })).max(2),
    weddingDate: isoDate.nullable(),
    timezone,
    currency,
    location: locationInput,
    budgetTotalMinor: minorAmount.nullable(),
    status: z.enum(WEDDING_STATUSES),
  })
  .partial()
  .required({ version: true })
  .refine((body) => Object.keys(body).length > 1, { message: "Nothing to update" });

export type UpdateWeddingInput = z.infer<typeof updateWeddingBody>;

/** API Design §6.3: retype the wedding's title before deleting it. */
export const deleteWeddingBody = z.strictObject({ confirm: z.string().min(1).max(120) });
