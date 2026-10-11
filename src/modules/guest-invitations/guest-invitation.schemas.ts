import { z } from "zod";
import { EMAIL_STATUSES, EMAIL_TYPES, INVITE_CHANNELS } from "@/lib/constants/enums";
import { MAX_BATCH_GUESTS } from "@/lib/constants/invitations";
import { cursorPageQuery } from "@/lib/http/pagination";
import { objectId } from "@/lib/validation/primitives";

// API Design §8.6 to §8.8 and §13.

const kind = z.enum(["invitation", "reminder"]);
const batchId = z.uuid();

export const inviteGuestBody = z.strictObject({
  channel: z.enum(INVITE_CHANNELS),
  /** "reminder" is the RSVP nudge to someone already invited. Defaults to the first invitation. */
  kind: kind.default("invitation"),
});
export type InviteGuestInput = z.infer<typeof inviteGuestBody>;

const guestIds = z
  .array(objectId)
  .min(1)
  .max(MAX_BATCH_GUESTS)
  .refine((ids) => new Set(ids.map((id) => id.toLowerCase())).size === ids.length, {
    message: "A guest can only be listed once",
  });

export const inviteBatchBody = z.strictObject({
  guestIds,
  channel: z.enum(INVITE_CHANNELS),
  kind: kind.default("invitation"),
  /**
   * Repeating a request with the SAME batchId never emails a guest twice: those already delivered
   * are skipped and only the failures are tried again (API Design §8.7).
   */
  batchId: batchId.optional(),
});
export type InviteBatchInput = z.infer<typeof inviteBatchBody>;

export const emailLogsQuery = z.strictObject({
  ...cursorPageQuery,
  status: z.enum(EMAIL_STATUSES).optional(),
  type: z.enum(EMAIL_TYPES).optional(),
  batchId: batchId.optional(),
});
export type EmailLogsQuery = z.infer<typeof emailLogsQuery>;

export const emailLogParams = z.object({ weddingId: objectId, logId: objectId });

export const repliesQuery = z.strictObject({ eventId: objectId });
