import { z } from "zod";
import { DIETARY_PREFERENCES } from "@/lib/constants/enums";
import { MAX_PLUS_ONES, MAX_RSVP_NOTE } from "@/lib/constants/guests";
import { objectId } from "@/lib/validation/primitives";

// API Design §8.10. Loose on the token's shape on purpose: ANY unusable link is the same
// `INVALID_TOKEN` answer, so a bad link never tells a visitor how it was wrong.
export const publicTokenParams = z.object({ token: z.string().min(1).max(200) });

/** What a guest may write: their status, headcount and note per event, and their own diet. Nothing else. */
export const submitRsvpBody = z.strictObject({
  responses: z
    .array(
      z.strictObject({
        eventId: objectId,
        // "pending" is not an answer a guest can give.
        status: z.enum(["attending", "declined", "maybe"]),
        attendingCount: z
          .number()
          .int()
          .min(0)
          .max(MAX_PLUS_ONES + 1)
          .optional(),
        note: z.string().trim().max(MAX_RSVP_NOTE).nullable().optional(),
      }),
    )
    .min(1)
    .max(100)
    .refine((rows) => new Set(rows.map((row) => row.eventId.toLowerCase())).size === rows.length, {
      message: "An event can only be answered once",
    }),
  dietaryPreference: z.enum(DIETARY_PREFERENCES).optional(),
});

export type SubmitRsvpInput = z.infer<typeof submitRsvpBody>;
