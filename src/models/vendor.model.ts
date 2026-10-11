import { Schema, type InferSchemaType } from "mongoose";
import { VENDOR_CATEGORIES, VENDOR_SOURCES, VENDOR_STATUSES } from "@/lib/constants/enums";
import { MAX_VENDOR_NAME, MAX_VENDOR_NOTES, MAX_VENDOR_PERSON } from "@/lib/constants/finance";
import { normalizeName } from "@/lib/text/normalize";
import { normalizedFieldsPlugin } from "@/models/plugins/normalize";
import { softDeleteFields, softDeletePlugin } from "@/models/plugins/softDelete";
import { defineModel } from "@/models/shared/define-model";
import { locationSchema } from "@/models/shared/location";
import { E164_PATTERN } from "@/models/shared/phone";

// DB Design §6.13. A vendor the wedding is considering or has hired, NOT a marketplace listing.
// There are deliberately no bank, UPI or card fields: payments are recorded as vendorPayments and
// free text in `notes`, never account details (DB Design §6.13).

const contactSchema = new Schema(
  {
    personName: { type: String, trim: true, maxlength: MAX_VENDOR_PERSON },
    phone: { type: String, trim: true, match: E164_PATTERN },
    email: { type: String, trim: true, lowercase: true, maxlength: 254 },
    website: { type: String, trim: true, maxlength: 500, match: /^https:\/\//i },
  },
  { _id: false },
);

const vendorSchema = new Schema(
  {
    weddingId: { type: Schema.Types.ObjectId, ref: "Wedding", required: true },
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: MAX_VENDOR_NAME },
    nameNormalized: { type: String, required: true },
    category: { type: String, enum: VENDOR_CATEGORIES, required: true },
    status: { type: String, enum: VENDOR_STATUSES, required: true, default: "shortlisted" },
    contact: { type: contactSchema },
    /** Address, coordinates and the Google place id when it came from Places (Architecture §27). */
    location: { type: locationSchema },
    source: { type: String, enum: VENDOR_SOURCES, required: true, default: "manual" },
    /** Private to the team. */
    notes: { type: String, trim: true, maxlength: MAX_VENDOR_NOTES },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    ...softDeleteFields,
  },
  { collection: "vendors", timestamps: true, optimisticConcurrency: true },
);

vendorSchema.plugin(softDeletePlugin);
vendorSchema.plugin(normalizedFieldsPlugin, {
  fields: [{ source: "name", target: "nameNormalized", normalize: normalizeName }],
});

vendorSchema.index({ weddingId: 1, category: 1 });
vendorSchema.index({ weddingId: 1, nameNormalized: 1 });

export type VendorRecord = InferSchemaType<typeof vendorSchema>;
export const Vendor = defineModel("Vendor", vendorSchema);
