import { z } from "zod";
import { MEMBER_RELATIONSHIPS } from "@/lib/constants/enums";
import { locationInput } from "@/lib/validation/location";
import { currency, isoDate, minorAmount, timezone } from "@/lib/validation/primitives";

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
