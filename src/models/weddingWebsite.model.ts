import { Schema, type InferSchemaType } from "mongoose";
import { WEBSITE_SECTION_TYPES, WEBSITE_STATUSES, WEBSITE_TEMPLATES } from "@/lib/constants/enums";
import {
  ACCENT_PATTERN,
  MAX_PUBLIC_EVENTS,
  MAX_SECTION_BODY,
  MAX_SECTION_TITLE,
  MAX_SECTIONS,
  MAX_SEO_DESCRIPTION,
  MAX_SEO_TITLE,
  MAX_SLUG,
  MAX_WEBSITE_TAGLINE,
  MAX_WEBSITE_TITLE,
  MAX_WEBSITE_WELCOME,
  MIN_SLUG,
  SLUG_PATTERN,
} from "@/lib/constants/website";
import { softDeleteFields, softDeletePlugin } from "@/models/plugins/softDelete";
import { defineModel } from "@/models/shared/define-model";
import { wholeNumber } from "@/models/shared/validators";

// DB Design §6.15. The content of the public wedding site. EVERYTHING stored here is public once
// the site is published: nothing private (budget, members, guests, notes) is ever placed in it,
// and the public page is built from an explicit whitelist, never by returning this document.
// There is no heroAssetId yet: the cover image waits for the Phase 6 gallery (the Stitch screen
// shows it locked).

const sectionSchema = new Schema({
  type: { type: String, enum: WEBSITE_SECTION_TYPES, required: true },
  title: { type: String, required: true, trim: true, minlength: 1, maxlength: MAX_SECTION_TITLE },
  /** Plain text. A "schedule" section has no body: it is built from the public events. */
  body: { type: String, trim: true, maxlength: MAX_SECTION_BODY, default: "" },
  isVisible: { type: Boolean, required: true, default: true },
  sortOrder: { type: Number, required: true, default: 0, validate: wholeNumber },
});

const weddingWebsiteSchema = new Schema(
  {
    weddingId: { type: Schema.Types.ObjectId, ref: "Wedding", required: true },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      minlength: MIN_SLUG,
      maxlength: MAX_SLUG,
      match: SLUG_PATTERN,
    },
    status: { type: String, enum: WEBSITE_STATUSES, required: true, default: "draft" },
    publishedAt: { type: Date, default: null },
    title: { type: String, required: true, trim: true, minlength: 1, maxlength: MAX_WEBSITE_TITLE },
    tagline: { type: String, trim: true, maxlength: MAX_WEBSITE_TAGLINE },
    welcomeMessage: { type: String, trim: true, maxlength: MAX_WEBSITE_WELCOME },
    sections: {
      type: [sectionSchema],
      default: [],
      validate: {
        validator: (items: unknown[]) => items.length <= MAX_SECTIONS,
        message: `A website has at most ${MAX_SECTIONS} sections`,
      },
    },
    /** Events shown on the site. Each must ALSO be marked public on the event itself. */
    publicEventIds: {
      type: [Schema.Types.ObjectId],
      default: [],
      validate: {
        validator: (ids: unknown[]) => ids.length <= MAX_PUBLIC_EVENTS,
        message: `A website shows at most ${MAX_PUBLIC_EVENTS} events`,
      },
    },
    display: {
      showVenueAddresses: { type: Boolean, required: true, default: false },
      showCountdown: { type: Boolean, required: true, default: true },
    },
    theme: {
      templateKey: {
        type: String,
        enum: WEBSITE_TEMPLATES,
        required: true,
        default: "modern_minimal",
      },
      accentColor: { type: String, required: true, default: "#1F4D3D", match: ACCENT_PATTERN },
    },
    seo: {
      title: { type: String, trim: true, maxlength: MAX_SEO_TITLE },
      description: { type: String, trim: true, maxlength: MAX_SEO_DESCRIPTION },
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    ...softDeleteFields,
  },
  // Two admins can edit the site at once: a stale save is rejected (DB Design §3.7).
  { collection: "weddingWebsites", timestamps: true, optimisticConcurrency: true },
);

weddingWebsiteSchema.plugin(softDeletePlugin);

// One site per wedding, and a public address that is unique among live sites (DB Design §6.15).
weddingWebsiteSchema.index(
  { weddingId: 1 },
  { unique: true, partialFilterExpression: { deletedAt: { $type: "null" } } },
);
weddingWebsiteSchema.index(
  { slug: 1 },
  { unique: true, partialFilterExpression: { deletedAt: { $type: "null" } } },
);

export type WeddingWebsiteRecord = InferSchemaType<typeof weddingWebsiteSchema>;
export const WeddingWebsite = defineModel("WeddingWebsite", weddingWebsiteSchema);
