import { Schema, type InferSchemaType } from "mongoose";
import {
  AGE_CATEGORIES,
  DIETARY_PREFERENCES,
  GUEST_INVITE_STATUSES,
  GUEST_SIDES,
  INVITE_CHANNELS,
} from "@/lib/constants/enums";
import {
  MAX_GUEST_NAME,
  MAX_GUEST_NOTES,
  MAX_GUEST_RELATION,
  MAX_PLUS_ONES,
} from "@/lib/constants/guests";
import { normalizeName } from "@/lib/text/normalize";
import { normalizedFieldsPlugin } from "@/models/plugins/normalize";
import { softDeleteFields, softDeletePlugin } from "@/models/plugins/softDelete";
import { defineModel } from "@/models/shared/define-model";
import { addressSchema } from "@/models/shared/location";
import { E164_PATTERN } from "@/models/shared/phone";
import { secureLinkSchema } from "@/models/shared/secure-link";

// DB Design §6.10. A person being invited. NOT an app user: no password, no account. Whether and
// how they replied is NOT stored here: it is the rsvps rows (§6.11), so there is one place to
// keep right.
//
// The personal RSVP link (`link`, a SecureLink with tokenHash/tokenEnc, §5.3) lets the guest open
// /i/<token> without an account. One link per guest (decision 2026-10-11).

const invitationSchema = new Schema(
  {
    /** What the sender did, not what the guest saw: for WhatsApp it means "the member tapped share". */
    status: { type: String, enum: GUEST_INVITE_STATUSES, required: true, default: "not_invited" },
    lastSentAt: { type: Date, default: null },
    lastChannel: { type: String, enum: [...INVITE_CHANNELS, null], default: null },
    sendCount: { type: Number, required: true, default: 0, min: 0 },
  },
  { _id: false },
);

const guestSchema = new Schema(
  {
    weddingId: { type: Schema.Types.ObjectId, ref: "Wedding", required: true },
    /** null = ungrouped. The service checks the group belongs to this wedding. */
    groupId: { type: Schema.Types.ObjectId, ref: "GuestGroup", default: null },
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: MAX_GUEST_NAME },
    nameNormalized: { type: String, required: true },
    email: { type: String, trim: true, lowercase: true, maxlength: 254, default: null },
    /** E.164, e.g. +919876543210. */
    phone: { type: String, trim: true, match: E164_PATTERN, default: null },
    /** For printed invitations. */
    address: { type: addressSchema },
    side: { type: String, enum: GUEST_SIDES, required: true },
    relationLabel: { type: String, trim: true, maxlength: MAX_GUEST_RELATION },
    ageCategory: { type: String, enum: AGE_CATEGORIES, required: true, default: "adult" },
    plusOnesAllowed: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      max: MAX_PLUS_ONES,
      validate: Number.isInteger,
    },
    dietaryPreference: { type: String, enum: DIETARY_PREFERENCES },
    /** Private to the team: never sent to guests. */
    notes: { type: String, trim: true, maxlength: MAX_GUEST_NOTES },
    invitation: { type: invitationSchema, required: true, default: () => ({}) },
    /** The guest's personal RSVP link; absent until the first invitation or "copy link". */
    link: { type: secureLinkSchema },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    ...softDeleteFields,
  },
  // A parent and the planner edit the same guest list; stale saves are rejected (DB Design §3.7).
  { collection: "guests", timestamps: true, optimisticConcurrency: true },
);

guestSchema.plugin(softDeletePlugin);
guestSchema.plugin(normalizedFieldsPlugin, {
  fields: [{ source: "name", target: "nameNormalized", normalize: normalizeName }],
});

// Guest list A to Z, cursor pagination, and anchored prefix search ("^sha") (DB Design §8.3).
guestSchema.index({ weddingId: 1, nameNormalized: 1, _id: 1 });
// Guests of a group.
guestSchema.index({ weddingId: 1, groupId: 1 });
// Duplicate detection when importing.
guestSchema.index({ weddingId: 1, phone: 1 }, { sparse: true });

// Open /i/<token>: the one lookup that is by token rather than by wedding (DB Design §8.3). The
// filter is $exists (as the DB doc says): the planner can use it for an equality lookup, which it
// cannot do for a $type filter (found with explain(): that one scanned every guest).
guestSchema.index(
  { "link.tokenHash": 1 },
  { unique: true, partialFilterExpression: { "link.tokenHash": { $exists: true } } },
);

export type GuestRecord = InferSchemaType<typeof guestSchema>;
export const Guest = defineModel("Guest", guestSchema);
