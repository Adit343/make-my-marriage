import type { WebsiteSectionType } from "@/lib/constants/enums";
import { MAX_SECTIONS } from "@/lib/constants/website";
import { defaultSectionTitle, type SiteDraft } from "@/lib/website/site";

// The website editor's working copy (Stitch "Wedding Website Editor" and "Website Design and
// Settings"). Edits live in a draft in the browser until "Save changes"; these pure helpers keep
// that logic testable: what changed, adding, moving and removing sections.

export type DraftSection = SiteDraft["sections"][number];
export type EditorDraft = SiteDraft;

/** Sections added in the editor have no server id yet; they get a temporary one with this prefix. */
export const NEW_PREFIX = "new-";

export const isNewSection = (section: { id: string }) => section.id.startsWith(NEW_PREFIX);

const STANDARD_TYPES: WebsiteSectionType[] = ["story", "schedule", "travel", "faq", "contact"];

/** What the "Add section" menu offers: each standard kind once, custom sections without limit. */
export function addableTypes(sections: DraftSection[]): WebsiteSectionType[] {
  if (sections.length >= MAX_SECTIONS) return [];
  const used = new Set(sections.map((section) => section.type));
  return [...STANDARD_TYPES.filter((type) => !used.has(type)), "custom"];
}

let counter = 0;

export function newSection(type: WebsiteSectionType): DraftSection {
  counter += 1;
  return {
    id: `${NEW_PREFIX}${Date.now().toString(36)}-${counter}`,
    type,
    title: defaultSectionTitle(type),
    body: "",
    isVisible: true,
  };
}

/** Moves a section to a position in the list; out-of-range positions are clamped. */
export function moveSection(sections: DraftSection[], id: string, toIndex: number): DraftSection[] {
  const from = sections.findIndex((section) => section.id === id);
  if (from === -1) return sections;
  const target = Math.max(0, Math.min(sections.length - 1, toIndex));
  if (target === from) return sections;
  const next = [...sections];
  const [moved] = next.splice(from, 1);
  next.splice(target, 0, moved!);
  return next;
}

export function removeSection(sections: DraftSection[], id: string): DraftSection[] {
  return sections.filter((section) => section.id !== id);
}

export function patchSection(
  sections: DraftSection[],
  id: string,
  changes: Partial<Pick<DraftSection, "title" | "body" | "isVisible">>,
): DraftSection[] {
  return sections.map((section) => (section.id === id ? { ...section, ...changes } : section));
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function isDirty(saved: EditorDraft, draft: EditorDraft): boolean {
  return !same(saved, draft);
}

/** The PATCH body for what changed (the version is added by the caller), or null if nothing did. */
export function buildPatch(saved: EditorDraft, draft: EditorDraft): Record<string, unknown> | null {
  const patch: Record<string, unknown> = {};
  if (saved.slug !== draft.slug) patch.slug = draft.slug;
  if (saved.title !== draft.title) patch.title = draft.title;
  if (saved.tagline !== draft.tagline) patch.tagline = draft.tagline;
  if (saved.welcomeMessage !== draft.welcomeMessage) patch.welcomeMessage = draft.welcomeMessage;
  if (saved.heroAssetId !== draft.heroAssetId) patch.heroAssetId = draft.heroAssetId;
  if (!same(saved.sections, draft.sections)) {
    patch.sections = draft.sections.map((section) => ({
      ...(isNewSection(section) ? {} : { id: section.id }),
      type: section.type,
      title: section.title,
      body: section.type === "schedule" ? "" : section.body,
      isVisible: section.isVisible,
    }));
  }
  if (!same(saved.publicEventIds, draft.publicEventIds)) {
    patch.publicEventIds = draft.publicEventIds;
  }
  if (!same(saved.display, draft.display)) patch.display = draft.display;
  if (!same(saved.theme, draft.theme)) patch.theme = draft.theme;
  if (!same(saved.seo, draft.seo)) patch.seo = draft.seo;
  return Object.keys(patch).length > 0 ? patch : null;
}

/** Why the draft can't be saved yet, or null. Mirrors the server's rules so the button says so first. */
export function draftProblem(draft: EditorDraft): string | null {
  if (!draft.title.trim()) return "Give the site a title.";
  const empty = draft.sections.find((section) => !section.title.trim());
  if (empty) return "Every section needs a title.";
  return null;
}
