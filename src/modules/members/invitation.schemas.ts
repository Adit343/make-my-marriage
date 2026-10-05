import { z } from "zod";
import { INVITATION_ROLES, INVITATION_STATUSES, MEMBER_RELATIONSHIPS } from "@/lib/constants/enums";
import { numberedPageQuery } from "@/lib/http/pagination";
import { email, objectId } from "@/lib/validation/primitives";

/** base64url, as produced by generateToken(); the length cap just bounds the input. */
export const invitationToken = z
  .string()
  .min(20)
  .max(200)
  .regex(/^[A-Za-z0-9_-]+$/, "Invalid token");

export const invitationParams = z.object({ weddingId: objectId, invitationId: objectId });
export const tokenParams = z.object({ token: invitationToken });

export const createInvitationBody = z.strictObject({
  email,
  role: z.enum(INVITATION_ROLES),
  relationship: z.enum(MEMBER_RELATIONSHIPS).optional(),
  message: z.string().trim().max(500).optional(),
});
export type CreateInvitationInput = z.infer<typeof createInvitationBody>;

export const listInvitationsQuery = z.strictObject({
  ...numberedPageQuery,
  status: z.enum(INVITATION_STATUSES).optional(),
});

export const acceptInvitationBody = z.strictObject({ token: invitationToken });
