import { describe, expect, it } from "vitest";
import {
  addableTypes,
  buildPatch,
  draftProblem,
  isDirty,
  isNewSection,
  moveSection,
  newSection,
  patchSection,
  removeSection,
  type EditorDraft,
} from "@/lib/website/editor-state";

const saved = (): EditorDraft => ({
  slug: "aarav-diya",
  title: "Aarav & Diya",
  tagline: "",
  welcomeMessage: "",
  sections: [
    { id: "a", type: "story", title: "Our story", body: "We met.", isVisible: true },
    { id: "b", type: "schedule", title: "Schedule", body: "", isVisible: true },
    { id: "c", type: "faq", title: "FAQ", body: "Q?\nA.", isVisible: false },
  ],
  publicEventIds: ["e1"],
  display: { showVenueAddresses: false, showCountdown: true },
  theme: { templateKey: "modern_minimal", accentColor: "#1F4D3D" },
  seo: { title: "T", description: "D" },
});

describe("dirty tracking and patches", () => {
  it("is clean for an untouched copy and for equal data", () => {
    expect(isDirty(saved(), saved())).toBe(false);
    expect(buildPatch(saved(), saved())).toBeNull();
  });

  it("sends only what changed", () => {
    const draft = { ...saved(), title: "New title", tagline: "Together" };
    expect(isDirty(saved(), draft)).toBe(true);
    expect(buildPatch(saved(), draft)).toEqual({ title: "New title", tagline: "Together" });
  });

  it("covers each editable field", () => {
    const base = saved();
    expect(buildPatch(base, { ...base, slug: "other" })).toEqual({ slug: "other" });
    expect(buildPatch(base, { ...base, welcomeMessage: "Hi" })).toEqual({ welcomeMessage: "Hi" });
    expect(buildPatch(base, { ...base, publicEventIds: [] })).toEqual({ publicEventIds: [] });
    expect(
      buildPatch(base, { ...base, display: { showVenueAddresses: true, showCountdown: true } }),
    ).toEqual({ display: { showVenueAddresses: true, showCountdown: true } });
    expect(
      buildPatch(base, { ...base, theme: { templateKey: "editorial", accentColor: "#5A3D4E" } }),
    ).toEqual({ theme: { templateKey: "editorial", accentColor: "#5A3D4E" } });
    expect(buildPatch(base, { ...base, seo: { title: "T2", description: "D" } })).toEqual({
      seo: { title: "T2", description: "D" },
    });
  });

  it("sends the whole section list, with ids only for sections that already exist", () => {
    const base = saved();
    const added = newSection("custom");
    const draft = {
      ...base,
      sections: [...base.sections, { ...added, title: "Gifts", body: "x" }],
    };
    const patch = buildPatch(base, draft) as { sections: Record<string, unknown>[] };
    expect(patch.sections).toHaveLength(4);
    expect(patch.sections[0]).toEqual({
      id: "a",
      type: "story",
      title: "Our story",
      body: "We met.",
      isVisible: true,
    });
    expect(patch.sections[3]).toEqual({
      type: "custom",
      title: "Gifts",
      body: "x",
      isVisible: true,
    });
    expect("id" in patch.sections[3]!).toBe(false);
  });

  it("never sends text for the schedule", () => {
    const base = saved();
    const draft = {
      ...base,
      sections: base.sections.map((s) => (s.type === "schedule" ? { ...s, body: "stray" } : s)),
    };
    const patch = buildPatch(base, draft) as { sections: { type: string; body: string }[] };
    expect(patch.sections.find((s) => s.type === "schedule")!.body).toBe("");
  });
});

describe("sections", () => {
  it("offers each standard kind once and custom sections without limit", () => {
    expect(addableTypes([])).toEqual(["story", "schedule", "travel", "faq", "contact", "custom"]);
    expect(addableTypes(saved().sections)).toEqual(["travel", "contact", "custom"]);
    const many = Array.from({ length: 20 }, (_, index) => ({
      id: `x${index}`,
      type: "custom" as const,
      title: "x",
      body: "",
      isVisible: true,
    }));
    expect(addableTypes(many)).toEqual([]);
  });

  it("makes new sections with a temporary id, the standard title and visible", () => {
    const one = newSection("travel");
    const two = newSection("travel");
    expect(one).toMatchObject({
      type: "travel",
      title: "Travel & stay",
      body: "",
      isVisible: true,
    });
    expect(isNewSection(one)).toBe(true);
    expect(isNewSection({ id: "507f1f77bcf86cd799439011" })).toBe(false);
    expect(one.id).not.toBe(two.id);
  });

  it("moves a section to a position, clamped to the list", () => {
    const ids = (list: { id: string }[]) => list.map((s) => s.id).join("");
    const list = saved().sections;
    expect(ids(moveSection(list, "a", 2))).toBe("bca");
    expect(ids(moveSection(list, "c", 0))).toBe("cab");
    expect(ids(moveSection(list, "b", 99))).toBe("acb");
    expect(ids(moveSection(list, "b", -5))).toBe("bac");
    expect(moveSection(list, "b", 1)).toBe(list);
    expect(moveSection(list, "ghost", 0)).toBe(list);
  });

  it("changes one section without touching the others, and removes one", () => {
    const list = saved().sections;
    const edited = patchSection(list, "a", { title: "Us", isVisible: false });
    expect(edited[0]).toMatchObject({ title: "Us", isVisible: false, body: "We met." });
    expect(edited.slice(1)).toEqual(list.slice(1));
    expect(list[0]!.title).toBe("Our story"); // not mutated
    expect(removeSection(list, "b").map((s) => s.id)).toEqual(["a", "c"]);
  });
});

describe("draftProblem", () => {
  it("asks for a title and for titled sections", () => {
    expect(draftProblem(saved())).toBeNull();
    expect(draftProblem({ ...saved(), title: "  " })).toBe("Give the site a title.");
    const untitled = saved();
    untitled.sections[0]!.title = " ";
    expect(draftProblem(untitled)).toBe("Every section needs a title.");
  });
});
