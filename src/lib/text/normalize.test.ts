import { describe, expect, it } from "vitest";
import { normalizeEmail, normalizeName } from "@/lib/text/normalize";

describe("normalizeEmail()", () => {
  it("trims and lowercases only", () => {
    expect(normalizeEmail("  Priya.Sharma+wedding@Gmail.COM ")).toBe(
      "priya.sharma+wedding@gmail.com",
    );
  });
});

describe("normalizeName()", () => {
  it("lowercases, trims and collapses whitespace", () => {
    expect(normalizeName("  Rahul   SHARMA ")).toBe("rahul sharma");
  });

  it("keeps diacritics and Indic scripts, unifying Unicode forms", () => {
    const decomposed = "José"; // "José" typed as e + combining accent
    expect(normalizeName(decomposed)).toBe("josé");
    expect(normalizeName("प्रिया शर्मा")).toBe("प्रिया शर्मा");
  });
});
