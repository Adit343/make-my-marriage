import { z } from "zod";
import { INVITATION_ROLES, MEMBER_RELATIONSHIPS } from "@/lib/constants/enums";
import { numberedPageQuery } from "@/lib/http/pagination";
import { objectId } from "@/lib/validation/primitives";

export const memberParams = z.object({ weddingId: objectId, memberId: objectId });

export const listMembersQuery = z.strictObject({ ...numberedPageQuery });

// API Design §6.6. "owner" is not an option: ownership only moves by transfer-ownership.
export const updateMemberBody = z
  .strictObject({
    role: z.enum(INVITATION_ROLES),
    relationship: z.enum(MEMBER_RELATIONSHIPS),
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, { message: "Nothing to update" });

export type UpdateMemberInput = z.infer<typeof updateMemberBody>;
