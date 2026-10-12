import { z } from "zod";
import { WEBSITE_SECTION_TYPES, WEBSITE_TEMPLATES } from "@/lib/constants/enums";
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
import { objectId } from "@/lib/validation/primitives";

// API Design §10. The strict objects reject any key that is not editable here (a guest-visible
// document: nothing else may be smuggled in).

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .min(MIN_SLUG, `Use at least ${MIN_SLUG} characters`)
  .max(MAX_SLUG, `Use at most ${MAX_SLUG} characters`)
  .regex(SLUG_PATTERN, "Use letters, numbers and single hyphens only");

const section = z
  .strictObject({
    /** Sent back for a section that already exists, so it keeps its id. */
    id: objectId.optional(),
    type: z.enum(WEBSITE_SECTION_TYPES),
    title: z.string().trim().min(1, "Give the section a title").max(MAX_SECTION_TITLE),
    body: z.string().trim().max(MAX_SECTION_BODY),
    isVisible: z.boolean(),
  })
  .refine((value) => value.type !== "schedule" || value.body === "", {
    message: "The schedule is built from your events, so it has no text of its own",
    path: ["body"],
  });

const sections = z
  .array(section)
  .max(MAX_SECTIONS, `A website has at most ${MAX_SECTIONS} sections`)
  .refine(
    (list) => {
      // Each standard section appears once; only custom sections can repeat.
      const standard = list.filter((item) => item.type !== "custom").map((item) => item.type);
      return new Set(standard).size === standard.length;
    },
    { message: "Each kind of section can only be added once" },
  );

export const websiteParams = z.object({ weddingId: objectId });

export const updateWebsiteBody = z
  .strictObject({
    version: z.number().int().min(0),
    slug,
    title: z.string().trim().min(1, "Give the site a title").max(MAX_WEBSITE_TITLE),
    tagline: z.string().trim().max(MAX_WEBSITE_TAGLINE),
    welcomeMessage: z.string().trim().max(MAX_WEBSITE_WELCOME),
    heroAssetId: objectId.nullable(),
    sections,
    publicEventIds: z
      .array(objectId)
      .max(MAX_PUBLIC_EVENTS, `A website shows at most ${MAX_PUBLIC_EVENTS} events`)
      .refine((ids) => new Set(ids.map((id) => id.toLowerCase())).size === ids.length, {
        message: "An event can only be listed once",
      }),
    display: z.strictObject({ showVenueAddresses: z.boolean(), showCountdown: z.boolean() }),
    theme: z.strictObject({
      templateKey: z.enum(WEBSITE_TEMPLATES),
      accentColor: z.string().regex(ACCENT_PATTERN, "Use a colour like #1F4D3D"),
    }),
    seo: z.strictObject({
      title: z.string().trim().max(MAX_SEO_TITLE),
      description: z.string().trim().max(MAX_SEO_DESCRIPTION),
    }),
  })
  .partial()
  .required({ version: true })
  .refine((body) => Object.keys(body).length > 1, { message: "Nothing to update" });
export type UpdateWebsiteInput = z.infer<typeof updateWebsiteBody>;

export const slugCheckQuery = z.strictObject({ slug: z.string().trim().max(100) });
export type SlugCheckQuery = z.infer<typeof slugCheckQuery>;

/** Loose on purpose: ANY address that doesn't resolve to a public site is the same 404. */
export const publicSlugParams = z.object({ slug: z.string().min(1).max(100) });
