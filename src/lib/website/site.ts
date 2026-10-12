import type { WebsiteSectionType, WebsiteTemplate } from "@/lib/constants/enums";

// How the public wedding website is assembled (DB Design §11.2). ONE pure function builds the
// whitelisted view from the stored draft, the events marked public and the couple's details. The
// public page, the member preview and the live preview in the editor all call it, so what the
// editor shows is exactly what guests will see, and nothing outside this shape can reach a guest.

/** One event, already formatted for the site (in the event's own timezone). */
export interface SiteEventSource {
  /** The event's id: only used to choose which events appear, never returned to the public. */
  id: string;
  name: string;
  startsAt: string;
  dateLabel: string;
  timeLabel: string;
  /** The venue's name only ("Riverfront Pavilion"). */
  venueName: string | null;
  /** The venue and street address, shown only when the couple allow addresses. */
  venueAddress: string | null;
  mapsUrl: string | null;
  dressCode: string | null;
  description: string | null;
  /** Public run-of-show lines: "5:00 PM Baraat arrives". */
  timings: { time: string; title: string }[];
}

export interface SiteDraft {
  slug: string;
  title: string;
  tagline: string;
  welcomeMessage: string;
  /** The chosen cover photo, or null. */
  heroAssetId: string | null;
  /** In display order. */
  sections: {
    id: string;
    type: WebsiteSectionType;
    title: string;
    body: string;
    isVisible: boolean;
  }[];
  publicEventIds: string[];
  display: { showVenueAddresses: boolean; showCountdown: boolean };
  theme: { templateKey: WebsiteTemplate; accentColor: string };
  seo: { title: string; description: string };
}

export interface SiteContext {
  /** "Aarav & Diya" */
  coupleNames: string;
  /** "A & D" */
  initials: string;
  /** "14 February 2027", or null if the wedding has no date yet. */
  dateLabel: string | null;
  city: string | null;
  /** The start of the wedding day when no public event gives a better moment. */
  weddingDayStart: string | null;
}

export interface SiteEvent {
  name: string;
  dateLabel: string;
  timeLabel: string;
  venue: string | null;
  mapsUrl: string | null;
  dressCode: string | null;
  description: string | null;
  timings: { time: string; title: string }[];
}

export interface SiteSection {
  key: string;
  type: WebsiteSectionType;
  title: string;
  /** Plain text; empty for the schedule, which is the events list. */
  body: string;
}

export interface PublicSiteView {
  slug: string;
  title: string;
  coupleNames: string;
  initials: string;
  tagline: string | null;
  welcomeMessage: string | null;
  /** A short-lived address of the cover photo, or null for the typographic cover. */
  heroImageUrl: string | null;
  dateLabel: string | null;
  city: string | null;
  /** The moment the countdown runs to, or null when it is off or has passed. */
  countdownTarget: string | null;
  sections: SiteSection[];
  events: SiteEvent[];
  theme: { templateKey: WebsiteTemplate; accentColor: string };
  seo: { title: string; description: string };
}

export const SECTION_TYPE_LABEL: Record<WebsiteSectionType, string> = {
  story: "Our story",
  schedule: "Schedule",
  travel: "Travel & stay",
  faq: "FAQ",
  contact: "Contact",
  custom: "Custom section",
};

export function defaultSectionTitle(type: WebsiteSectionType): string {
  return SECTION_TYPE_LABEL[type];
}

/** The small caps line above a section's heading on the public site. */
export const SECTION_EYEBROW: Record<WebsiteSectionType, string> = {
  story: "Narrative",
  schedule: "Program",
  travel: "Logistics",
  faq: "Inquiries",
  contact: "Coordination",
  custom: "More",
};

export function buildSiteView(
  draft: SiteDraft,
  pool: SiteEventSource[],
  context: SiteContext,
  now: Date = new Date(),
  heroImageUrl: string | null = null,
): PublicSiteView {
  const chosen = new Set(draft.publicEventIds);
  const sources = pool
    .filter((event) => chosen.has(event.id))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  const events: SiteEvent[] = sources.map((event) => ({
    name: event.name,
    dateLabel: event.dateLabel,
    timeLabel: event.timeLabel,
    venue: draft.display.showVenueAddresses
      ? (event.venueAddress ?? event.venueName)
      : event.venueName,
    // A map pin names the street, so it follows the address switch.
    mapsUrl: draft.display.showVenueAddresses ? event.mapsUrl : null,
    dressCode: event.dressCode,
    description: event.description,
    timings: event.timings,
  }));

  const sections: SiteSection[] = [];
  for (const section of draft.sections) {
    if (!section.isVisible) continue;
    const body = section.body.trim();
    if (section.type === "schedule") {
      // The schedule IS the events: without any, there is nothing to show.
      if (events.length === 0) continue;
    } else if (!body) {
      continue;
    }
    sections.push({
      key: section.id,
      type: section.type,
      title: section.title.trim() || defaultSectionTitle(section.type),
      body: section.type === "schedule" ? "" : body,
    });
  }

  const upcoming = sources.find((event) => new Date(event.startsAt).getTime() > now.getTime());
  const fallback =
    context.weddingDayStart && new Date(context.weddingDayStart).getTime() > now.getTime()
      ? context.weddingDayStart
      : null;
  const target = draft.display.showCountdown ? (upcoming?.startsAt ?? fallback) : null;

  return {
    slug: draft.slug,
    title: draft.title,
    coupleNames: context.coupleNames,
    initials: context.initials,
    tagline: draft.tagline.trim() || null,
    welcomeMessage: draft.welcomeMessage.trim() || null,
    heroImageUrl,
    dateLabel: context.dateLabel,
    city: context.city,
    countdownTarget: target,
    sections,
    events,
    theme: draft.theme,
    seo: draft.seo,
  };
}

/** The word in the top navigation. */
export function navLabel(section: SiteSection): string {
  switch (section.type) {
    case "story":
      return "Story";
    case "schedule":
      return "Schedule";
    case "travel":
      return "Travel";
    case "faq":
      return "FAQ";
    case "contact":
      return "Contact";
    default:
      return section.title.length > 14 ? `${section.title.slice(0, 13)}…` : section.title;
  }
}

/** Paragraphs separated by a blank line. */
export function paragraphs(body: string): string[] {
  return body
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * The FAQ body is plain text: each question on its own line, the answer beneath it, a blank line
 * between questions. A block with only one line is a question without an answer yet.
 */
export function parseFaq(body: string): { question: string; answer: string }[] {
  return paragraphs(body).map((block) => {
    const [question = "", ...rest] = block.split("\n");
    return { question: question.trim(), answer: rest.join("\n").trim() };
  });
}

/** "A & D" from the couple's names. */
export function initialsOf(names: string[], fallback: string): string {
  const letters = names
    .map((name) => name.trim().charAt(0).toUpperCase())
    .filter((letter) => /\p{L}/u.test(letter));
  return letters.length > 0 ? letters.join(" & ") : fallback.trim().charAt(0).toUpperCase() || "♥";
}
