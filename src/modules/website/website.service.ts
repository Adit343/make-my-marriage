import "server-only";
import { Types } from "mongoose";
import { MAX_SEO_DESCRIPTION, MAX_SEO_TITLE } from "@/lib/constants/website";
import { formatShortDate } from "@/lib/dates";
import { DOWNLOAD_URL_TTL_SECONDS } from "@/lib/constants/gallery";
import { AppError } from "@/lib/errors";
import {
  calendarDayIn,
  formatClock,
  formatScheduleTime,
  fullAddress,
  mapsUrl,
  timeZoneAbbreviation,
  venueLine,
} from "@/lib/events/format";
import { slugProblem, suggestSlug, withSuffix } from "@/lib/website/slug";
import {
  buildSiteView,
  defaultSectionTitle,
  initialsOf,
  type PublicSiteView,
  type SiteContext,
  type SiteDraft,
  type SiteEventSource,
} from "@/lib/website/site";
import { wallClockToInstant } from "@/lib/zoned-time";
import { getStorage } from "@/infrastructure/storage";
import { listEvents as listEventRows } from "@/modules/events/event.repository";
import { findAsset } from "@/modules/gallery/gallery.repository";
import type { WeddingAuth } from "@/modules/members/guards";
import { toWebsiteDto, type WebsiteDto } from "@/modules/website/website.dto";
import {
  findWebsite,
  findWebsiteBySlug,
  insertWebsite,
  setWebsiteStatus,
  slugUsedByAnother,
  updateWebsite as updateWebsiteRow,
  type WebsiteChanges,
  type WebsiteSectionRow,
} from "@/modules/website/website.repository";
import type { UpdateWebsiteInput } from "@/modules/website/website.schemas";
import { findWedding } from "@/modules/weddings/wedding.repository";

import { track } from "@/modules/analytics/analytics.service";
// The wedding website (API Design §10). Everything a member does needs `website:manage` except
// reading. The public page is a separate, hand-built whitelist (lib/website/site.ts): the stored
// document is never returned to a guest, and a site is public only while it is published AND its
// wedding is live (DB Design §10.3).

type WeddingRow = NonNullable<Awaited<ReturnType<typeof findWedding>>>;
type EventRow = Awaited<ReturnType<typeof listEventRows>>[number];

const DEFAULT_SECTIONS: { type: WebsiteSectionRowType; isVisible: boolean }[] = [
  { type: "story", isVisible: true },
  { type: "schedule", isVisible: true },
  // Travel starts hidden: most couples haven't written it yet (Stitch editor shows it struck out).
  { type: "travel", isVisible: false },
  { type: "faq", isVisible: true },
  { type: "contact", isVisible: true },
];
type WebsiteSectionRowType = WebsiteSectionRow["type"];

// ---------------------------------------------------------------------------------------------
// Turning events and the wedding into what the site shows
// ---------------------------------------------------------------------------------------------

function partnerNames(wedding: WeddingRow): string[] {
  return (wedding.partners ?? []).map((partner) => partner.name.trim()).filter(Boolean);
}

export function coupleNamesOf(wedding: WeddingRow): string {
  const names = partnerNames(wedding);
  return names.length > 0 ? names.join(" & ") : wedding.title;
}

/** "14 February 2027" from the wedding's calendar date. */
function longDate(isoDate: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${isoDate}T00:00:00Z`));
}

export function siteContextOf(wedding: WeddingRow): SiteContext {
  const names = partnerNames(wedding);
  const weddingDayStart = wedding.weddingDate
    ? (wallClockToInstant(`${wedding.weddingDate}T00:00`, wedding.timezone)?.toISOString() ?? null)
    : null;
  return {
    coupleNames: coupleNamesOf(wedding),
    initials: initialsOf(names, wedding.title),
    dateLabel: wedding.weddingDate ? longDate(wedding.weddingDate) : null,
    city: wedding.location?.address?.city?.trim() || null,
    weddingDayStart,
  };
}

/** One event as the site can show it, in the event's own timezone. Only public events are used. */
export function toSiteEventSource(event: EventRow): SiteEventSource {
  const place = (event.location ?? {}) as {
    label?: string | null;
    address?: { city?: string | null } | null;
  };
  const venueName = place.label?.trim() || place.address?.city?.trim() || null;
  const timings = [...(event.schedule ?? [])]
    .filter((line) => line.isPublic)
    .sort((a, b) => a.time.localeCompare(b.time))
    .map((line) => ({ time: formatScheduleTime(line.time), title: line.title }));
  return {
    id: event._id.toString(),
    name: event.name,
    startsAt: event.startsAt.toISOString(),
    dateLabel: formatShortDate(calendarDayIn(event.startsAt, event.timezone)),
    timeLabel: `${formatClock(event.startsAt, event.timezone, false)} ${timeZoneAbbreviation(event.timezone, event.startsAt)}`,
    venueName,
    venueAddress: venueLine(event.location) ?? fullAddress(event.location),
    mapsUrl: mapsUrl(event.location),
    dressCode: event.dressCode?.trim() || null,
    description: event.description?.trim() || null,
    timings,
  };
}

/** The events a member may put on the site: only those marked public on the event itself. */
export function publicEventPool(events: EventRow[]): SiteEventSource[] {
  return events.filter((event) => event.isPublic).map(toSiteEventSource);
}

export interface HeroPhoto {
  assetId: string;
  fileName: string;
  /** A short-lived address that shows the photo. */
  url: string;
}

/**
 * The cover photo as it may be shown right now: the photo must still be live AND still Public. A
 * photo made private (or deleted, or rejected) after it was chosen simply stops being the cover,
 * so nothing private can reach the public site through a stale choice.
 */
export async function heroPhotoFor(
  weddingId: string,
  assetId: string | null,
): Promise<HeroPhoto | null> {
  if (!assetId) return null;
  const asset = await findAsset(weddingId, assetId);
  if (!asset || asset.status !== "active" || asset.visibility !== "public") return null;
  return {
    assetId,
    fileName: asset.fileName,
    url: await getStorage().createDownloadUrl(asset.objectKey, {
      expiresInSeconds: DOWNLOAD_URL_TTL_SECONDS,
    }),
  };
}

function draftOf(site: WebsiteDto): SiteDraft {
  return {
    slug: site.slug,
    title: site.title,
    tagline: site.tagline,
    welcomeMessage: site.welcomeMessage,
    heroAssetId: site.heroAssetId,
    sections: site.sections,
    publicEventIds: site.publicEventIds,
    display: site.display,
    theme: site.theme,
    seo: site.seo,
  };
}

// ---------------------------------------------------------------------------------------------
// Member side
// ---------------------------------------------------------------------------------------------

/** The site, or null when the wedding hasn't set one up yet. Never writes (a GET must not). */
export async function getWebsite(auth: WeddingAuth): Promise<WebsiteDto | null> {
  const site = await findWebsite(auth.weddingId);
  return site ? toWebsiteDto(site) : null;
}

function defaultSeo(
  wedding: WeddingRow,
  context: SiteContext,
): { title: string; description: string } {
  const date = wedding.weddingDate ? ` | ${formatShortDate(wedding.weddingDate)}` : "";
  const place = context.city ? ` in ${context.city}` : "";
  return {
    title: `${context.coupleNames}'s Wedding${date}`.slice(0, MAX_SEO_TITLE),
    description:
      `Join us in celebrating the wedding of ${context.coupleNames}${place}. See the events, schedule and venue details.`.slice(
        0,
        MAX_SEO_DESCRIPTION,
      ),
  };
}

/**
 * Sets the wedding's site up as a draft: the couple's names as the title, their first names as the
 * address (a number is added if someone has it), the five standard sections, and every event
 * already marked public. Nothing is public until it is published.
 */
export async function createWebsite(auth: WeddingAuth): Promise<WebsiteDto> {
  if (await findWebsite(auth.weddingId)) {
    throw new AppError("CONFLICT", { message: "This wedding already has a website" });
  }
  const wedding = await findWedding(auth.weddingId);
  if (!wedding) throw new AppError("NOT_FOUND");
  const context = siteContextOf(wedding);
  const events = await listEventRows(auth.weddingId);

  const base = suggestSlug(partnerNames(wedding), wedding.title);
  const sections: WebsiteSectionRow[] = DEFAULT_SECTIONS.map((section, index) => ({
    type: section.type,
    title: defaultSectionTitle(section.type),
    body: "",
    isVisible: section.isVisible,
    sortOrder: index,
  }));

  // The address check and the insert are separate steps, so a clash at the last moment (the unique
  // index) simply tries the next number.
  for (let attempt = 1; attempt <= 25; attempt += 1) {
    const slug = withSuffix(base, attempt);
    if (slugProblem(slug) || (await slugUsedByAnother(slug, auth.weddingId))) continue;
    const result = await insertWebsite(auth.weddingId, {
      slug,
      title: context.coupleNames.slice(0, 120),
      sections,
      publicEventIds: events.filter((event) => event.isPublic).map((event) => event._id),
      seo: defaultSeo(wedding, context),
      createdBy: auth.userId,
    });
    if (result === "slug_taken") continue;
    if (result === "exists")
      throw new AppError("CONFLICT", { message: "This wedding already has a website" });
    return toWebsiteDto(result);
  }
  throw new AppError("SLUG_TAKEN", { message: "Couldn't find a free address. Pick one yourself." });
}

/**
 * Each event shown on the site must belong to this wedding (a stranger's id is a plain 404, the
 * same as a missing one) AND be marked public on the event itself (422 with the event's name, so
 * the editor can say which one needs turning on first).
 */
async function checkPublicEvents(weddingId: string, ids: string[]): Promise<Types.ObjectId[]> {
  if (ids.length === 0) return [];
  const events = await listEventRows(weddingId);
  const byId = new Map(events.map((event) => [event._id.toString(), event]));
  const resolved: Types.ObjectId[] = [];
  for (const raw of ids) {
    const event = byId.get(raw.toLowerCase());
    if (!event) throw new AppError("NOT_FOUND");
    if (!event.isPublic) {
      throw new AppError("BUSINESS_RULE_VIOLATION", {
        message: `Mark "${event.name}" as public in Events first.`,
        details: { eventId: event._id.toString() },
      });
    }
    resolved.push(event._id);
  }
  return resolved;
}

async function checkSlug(weddingId: string, slug: string): Promise<void> {
  const problem = slugProblem(slug);
  if (problem === "reserved") {
    throw new AppError("BUSINESS_RULE_VIOLATION", { message: "That address is reserved" });
  }
  if (problem) throw new AppError("VALIDATION_ERROR", { message: "That address isn't valid" });
  if (await slugUsedByAnother(slug, weddingId)) throw new AppError("SLUG_TAKEN");
}

export async function updateWebsite(
  auth: WeddingAuth,
  input: UpdateWebsiteInput,
): Promise<WebsiteDto> {
  const { version, slug, sections, publicEventIds, heroAssetId, ...rest } = input;
  const changes: WebsiteChanges = { ...rest };

  if (slug !== undefined) {
    await checkSlug(auth.weddingId, slug);
    changes.slug = slug;
  }
  if (heroAssetId !== undefined) {
    if (heroAssetId !== null) {
      // Another wedding's photo, a deleted one or one still waiting for approval is "not found";
      // a photo of this wedding that is not marked Public is a rule the editor can explain.
      const photo = await findAsset(auth.weddingId, heroAssetId);
      if (!photo || photo.status !== "active") throw new AppError("NOT_FOUND");
      if (photo.visibility !== "public") {
        throw new AppError("BUSINESS_RULE_VIOLATION", {
          message:
            "Only photos marked Public can be the cover. Set its visibility to Public in the gallery.",
        });
      }
    }
    changes.heroAssetId = heroAssetId;
  }
  if (publicEventIds !== undefined) {
    changes.publicEventIds = await checkPublicEvents(auth.weddingId, publicEventIds);
  }
  if (sections !== undefined) {
    // A section that already exists keeps its id; anything else is new. The list order is the order.
    const current = await findWebsite(auth.weddingId);
    if (!current) throw new AppError("NOT_FOUND");
    const known = new Set((current.sections ?? []).map((item) => item._id.toString()));
    changes.sections = sections.map((item, index) => ({
      ...(item.id && known.has(item.id.toLowerCase()) ? { _id: new Types.ObjectId(item.id) } : {}),
      type: item.type,
      title: item.title,
      body: item.body,
      isVisible: item.isVisible,
      sortOrder: index,
    }));
  }

  const result = await updateWebsiteRow(auth.weddingId, version, changes);
  if (result === "conflict") throw new AppError("VERSION_CONFLICT");
  if (result === "not_found") throw new AppError("NOT_FOUND");
  if (result === "slug_taken") throw new AppError("SLUG_TAKEN");
  return toWebsiteDto(result);
}

/** Publishing needs an address that is still valid and free, and a title (the editor enforces both). */
export async function publishWebsite(auth: WeddingAuth): Promise<WebsiteDto> {
  const result = await setWebsiteStatus(auth.weddingId, "published", new Date());
  if (result === "not_found") throw new AppError("NOT_FOUND");
  await track("website_published");
  return toWebsiteDto(result);
}

export async function unpublishWebsite(auth: WeddingAuth): Promise<WebsiteDto> {
  const result = await setWebsiteStatus(auth.weddingId, "draft", new Date());
  if (result === "not_found") throw new AppError("NOT_FOUND");
  return toWebsiteDto(result);
}

export type SlugAvailability = "available" | "yours" | "taken" | "reserved" | "invalid";

/** The editor's "Available" badge while typing an address. */
export async function checkSlugAvailability(
  auth: WeddingAuth,
  rawSlug: string,
): Promise<{ slug: string; availability: SlugAvailability }> {
  const slug = rawSlug.trim().toLowerCase();
  const problem = slugProblem(slug);
  if (problem) return { slug, availability: problem };
  const own = await findWebsite(auth.weddingId);
  if (own?.slug === slug) return { slug, availability: "yours" };
  return {
    slug,
    availability: (await slugUsedByAnother(slug, auth.weddingId)) ? "taken" : "available",
  };
}

/** What the editor screen needs besides the site: the events, and the couple's details. */
export interface WebsiteEditorData {
  website: WebsiteDto | null;
  /** Every event, so the "Events shown on the website" list can show locked ones too. */
  events: { id: string; name: string; isPublic: boolean; dateLabel: string }[];
  /** The public events, formatted for the live preview. */
  pool: SiteEventSource[];
  /** The chosen cover photo while it is still usable, with an address to show it. */
  hero: HeroPhoto | null;
  context: SiteContext;
  /** Where the site lives, without the scheme: "makemymarriage.com/w/". */
  addressPrefix: string;
  origin: string;
}

export async function getEditorData(
  auth: WeddingAuth,
  origin: string,
): Promise<WebsiteEditorData | null> {
  const wedding = await findWedding(auth.weddingId);
  if (!wedding) return null;
  const [website, events] = await Promise.all([getWebsite(auth), listEventRows(auth.weddingId)]);
  return {
    website,
    events: events.map((event) => ({
      id: event._id.toString(),
      name: event.name,
      isPublic: event.isPublic,
      dateLabel: formatShortDate(calendarDayIn(event.startsAt, event.timezone)),
    })),
    pool: publicEventPool(events),
    hero: await heroPhotoFor(auth.weddingId, website?.heroAssetId ?? null),
    context: siteContextOf(wedding),
    addressPrefix: `${new URL(origin).host}/w/`,
    origin,
  };
}

/** The member's own preview: the site as guests would see it, even while it is still a draft. */
export async function getWebsitePreview(auth: WeddingAuth): Promise<PublicSiteView | null> {
  const [site, wedding, events] = await Promise.all([
    getWebsite(auth),
    findWedding(auth.weddingId),
    listEventRows(auth.weddingId),
  ]);
  if (!site || !wedding) return null;
  const hero = await heroPhotoFor(auth.weddingId, site.heroAssetId);
  return buildSiteView(
    draftOf(site),
    publicEventPool(events),
    siteContextOf(wedding),
    new Date(),
    hero?.url ?? null,
  );
}

// ---------------------------------------------------------------------------------------------
// Public side
// ---------------------------------------------------------------------------------------------

/**
 * The published site for an address (API Design §10.3). Every other case, an address nobody uses,
 * a reserved word, a draft, a deleted site, a deleted wedding, is the same `404`, so a visitor
 * can't tell what exists.
 */
export async function getPublicWebsite(slug: string): Promise<PublicSiteView> {
  const normalized = slug.trim().toLowerCase();
  if (slugProblem(normalized)) throw new AppError("NOT_FOUND");
  const site = await findWebsiteBySlug(normalized);
  if (!site || site.status !== "published") throw new AppError("NOT_FOUND");
  // A deleted wedding hides everything under it, public pages included (DB Design §10.3).
  const wedding = await findWedding(site.weddingId);
  if (!wedding) throw new AppError("NOT_FOUND");
  const events = await listEventRows(site.weddingId);
  const dto = toWebsiteDto(site);
  const hero = await heroPhotoFor(site.weddingId.toString(), dto.heroAssetId);
  await track("website_viewed");
  return buildSiteView(
    draftOf(dto),
    publicEventPool(events),
    siteContextOf(wedding),
    new Date(),
    hero?.url ?? null,
  );
}
