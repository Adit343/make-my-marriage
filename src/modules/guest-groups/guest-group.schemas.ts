import { z } from "zod";
import { GUEST_SIDES } from "@/lib/constants/enums";
import { MAX_GROUP_NAME, MAX_GROUP_NOTES } from "@/lib/constants/guests";
import { objectId } from "@/lib/validation/primitives";

// API Design §8.1. A group is a plain name plus which side of the family it sits on.

export const groupParams = z.object({ weddingId: objectId, groupId: objectId });

const name = z
  .string()
  .trim()
  .min(1)
  .max(MAX_GROUP_NAME)
  .transform((value) => value.replace(/\s+/g, " "));
const notes = z.string().trim().max(MAX_GROUP_NOTES);

export const createGroupBody = z.strictObject({
  name,
  side: z.enum(GUEST_SIDES),
  notes: notes.optional(),
});

export type CreateGroupInput = z.infer<typeof createGroupBody>;

export const updateGroupBody = z
  .strictObject({
    version: z.number().int().min(0),
    name,
    side: z.enum(GUEST_SIDES),
    notes: notes.nullable(),
  })
  .partial()
  .required({ version: true })
  .refine((body) => Object.keys(body).length > 1, { message: "Nothing to update" });

export type UpdateGroupInput = z.infer<typeof updateGroupBody>;

// A group is never deleted with its guests silently: the caller says where they go. `null`
// leaves them ungrouped; an id moves them to that (other) group.
export const deleteGroupBody = z.strictObject({ reassignTo: objectId.nullable() });

export type DeleteGroupInput = z.infer<typeof deleteGroupBody>;
