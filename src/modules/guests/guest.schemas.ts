import { z } from "zod";
import {
  AGE_CATEGORIES,
  DIETARY_PREFERENCES,
  GUEST_INVITE_STATUSES,
  GUEST_SIDES,
  RSVP_STATUSES,
} from "@/lib/constants/enums";
import {
  MAX_BULK_GUESTS,
  MAX_GUEST_NAME,
  MAX_GUEST_NOTES,
  MAX_GUEST_RELATION,
  MAX_PLUS_ONES,
  MAX_RSVP_NOTE,
} from "@/lib/constants/guests";
import { cursorPageQuery } from "@/lib/http/pagination";
import { addressInput } from "@/lib/validation/location";
import { email, objectId } from "@/lib/validation/primitives";
import { E164_PATTERN } from "@/models/shared/phone";

// API Design §8. Ids that point at other wedding-owned documents (groupId, eventIds, guestIds) are
// checked against the wedding in the service, not here.

export const guestParams = z.object({ weddingId: objectId, guestId: objectId });
export const guestEventParams = guestParams.extend({ eventId: objectId });

/** Trimmed, with repeated inner spaces collapsed, so "Rahul   Sharma" is saved as "Rahul Sharma". */
const name = z
  .string()
  .trim()
  .min(1)
  .max(MAX_GUEST_NAME)
  .transform((value) => value.replace(/\s+/g, " "));
/** E.164 only: the browser turns what a person types ("98765 43210") into "+919876543210". */
const phone = z.string().trim().regex(E164_PATTERN, "Use international format, e.g. +919876543210");
const uniqueIds = (ids: string[]) => new Set(ids.map((id) => id.toLowerCase())).size === ids.length;

const eventIds = z
  .array(objectId)
  .max(100)
  .refine(uniqueIds, { message: "An event can only be listed once" });

const guestFields = {
  name,
  groupId: objectId.nullable(),
  email: email.nullable(),
  phone: phone.nullable(),
  address: addressInput.nullable(),
  side: z.enum(GUEST_SIDES),
  relationLabel: z.string().trim().max(MAX_GUEST_RELATION).nullable(),
  ageCategory: z.enum(AGE_CATEGORIES),
  plusOnesAllowed: z.number().int().min(0).max(MAX_PLUS_ONES),
  dietaryPreference: z.enum(DIETARY_PREFERENCES).nullable(),
  notes: z.string().trim().max(MAX_GUEST_NOTES).nullable(),
  /** The events this guest is invited to (one RSVP row each). */
  eventIds,
};

export const createGuestBody = z.strictObject({
  name: guestFields.name,
  side: guestFields.side,
  groupId: guestFields.groupId.optional(),
  email: guestFields.email.optional(),
  phone: guestFields.phone.optional(),
  address: guestFields.address.optional(),
  relationLabel: guestFields.relationLabel.optional(),
  ageCategory: guestFields.ageCategory.optional(),
  plusOnesAllowed: guestFields.plusOnesAllowed.optional(),
  dietaryPreference: guestFields.dietaryPreference.optional(),
  notes: guestFields.notes.optional(),
  eventIds: guestFields.eventIds.optional(),
});

export type CreateGuestInput = z.infer<typeof createGuestBody>;

// Any subset of the editable fields plus the `version` the client last read (decision C5).
// `eventIds`, when sent, is the WHOLE set of events the guest should be invited to: events added
// get a pending RSVP row, events left out lose theirs.
export const updateGuestBody = z
  .strictObject({ version: z.number().int().min(0), ...guestFields })
  .partial()
  .required({ version: true })
  .refine((body) => Object.keys(body).length > 1, { message: "Nothing to update" });

export type UpdateGuestInput = z.infer<typeof updateGuestBody>;

// Allow-listed filters, each served by an index in DB Design §8.2 (API Design §2.7).
// `eventId` and `rsvpStatus` look at the guests' RSVP rows: with both, "pending for Haldi"; with
// only `eventId`, "invited to Haldi"; with only `rsvpStatus`, "has at least one reply in that state".
export const listGuestsQuery = z.strictObject({
  ...cursorPageQuery,
  /** Anchored prefix on the name ("sha" finds "Sharma"), never "contains" (DB Design §3.5). */
  search: z.string().trim().max(100).optional(),
  groupId: z.union([objectId, z.literal("none")]).optional(),
  side: z.enum(GUEST_SIDES).optional(),
  inviteStatus: z.enum(GUEST_INVITE_STATUSES).optional(),
  dietaryPreference: z.enum(DIETARY_PREFERENCES).optional(),
  eventId: objectId.optional(),
  rsvpStatus: z.enum(RSVP_STATUSES).optional(),
});

export type ListGuestsQuery = z.infer<typeof listGuestsQuery>;

const guestIds = z
  .array(objectId)
  .min(1)
  .max(MAX_BULK_GUESTS)
  .refine(uniqueIds, { message: "A guest can only be listed once" });

/** Bulk actions from the selection bar of the guest list. */
export const bulkGuestsBody = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("delete"), guestIds }),
  z.strictObject({ action: z.literal("set-group"), guestIds, groupId: objectId.nullable() }),
]);

export type BulkGuestsInput = z.infer<typeof bulkGuestsBody>;

export const assignEventBody = z.strictObject({ eventId: objectId });

// A member recording a reply by hand (for example after a phone call): the guest's own link
// arrives with the invitations step. `attendingCount` counts everyone coming, the guest included.
export const recordRsvpBody = z
  .strictObject({
    status: z.enum(RSVP_STATUSES),
    attendingCount: z
      .number()
      .int()
      .min(0)
      .max(MAX_PLUS_ONES + 1),
    note: z.string().trim().max(MAX_RSVP_NOTE).nullable(),
  })
  .partial()
  .required({ status: true });

export type RecordRsvpInput = z.infer<typeof recordRsvpBody>;

export const headcountQuery = z.strictObject({ eventId: objectId });
export const summaryQuery = z.strictObject({ eventId: objectId.optional() });
