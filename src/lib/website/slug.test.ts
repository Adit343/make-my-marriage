import { describe, expect, it } from "vitest";
import { RESERVED_SLUGS } from "@/lib/constants/website";
import { slugify, slugProblem, suggestSlug, withSuffix } from "@/lib/website/slug";

describe("slugProblem", () => {
  it("accepts lower-case letters, numbers and single hyphens, 3 to 40 characters", () => {
    for (const slug of ["aarav-diya", "abc", "a1b2", "a".repeat(40), "aarav-diya-2027"]) {
      expect(slugProblem(slug), slug).toBeNull();
    }
  });

  it("rejects bad shapes", () => {
    for (const slug of [
      "",
      "ab",
      "a".repeat(41),
      "Aarav",
      "aarav diya",
      "-aarav",
      "aarav-",
      "aarav--diya",
      "aarav_diya",
      "aarav.diya",
      "आरव",
      "aarav/diya",
    ]) {
      expect(slugProblem(slug), slug).toBe("invalid");
    }
  });

  it("rejects every reserved word, including the app's own routes", () => {
    for (const slug of ["api", "dashboard", "login", "signup", "admin", "www", "live", "rsvp"]) {
      expect(slugProblem(slug), slug).toBe("reserved");
    }
    for (const slug of RESERVED_SLUGS) {
      // Reserved words shorter than 3 characters fail the shape check first; both stop the address.
      expect(slugProblem(slug), slug).not.toBeNull();
    }
  });
});

describe("slugify and suggestSlug", () => {
  it("turns names into an address", () => {
    expect(slugify("Aarav & Diya")).toBe("aarav-diya");
    expect(slugify("  Zoë   Müller  ")).toBe("zoe-muller");
    expect(slugify("A!!B??C")).toBe("a-b-c");
    expect(slugify("---")).toBe("");
    expect(slugify("x".repeat(60))).toHaveLength(40);
  });

  it("suggests the couple's first names", () => {
    expect(suggestSlug(["Aarav Shah", "Diya Mehta"], "Wedding")).toBe("aarav-diya");
    expect(suggestSlug([], "Aarav & Diya's Wedding")).toBe("aarav-diya-s-wedding");
  });

  it("never suggests something unusable", () => {
    expect(suggestSlug(["A"], "x")).toMatch(/^[a-z0-9-]{3,40}$/);
    expect(suggestSlug(["Admin"], "x")).not.toBe("admin");
    expect(slugProblem(suggestSlug(["Admin"], "x"))).toBeNull();
    expect(slugProblem(suggestSlug(["!!"], "??"))).toBeNull();
  });
});

describe("withSuffix", () => {
  it("adds a number from the second try and stays within the length limit", () => {
    expect(withSuffix("aarav-diya", 1)).toBe("aarav-diya");
    expect(withSuffix("aarav-diya", 2)).toBe("aarav-diya-2");
    const long = withSuffix("a".repeat(40), 12);
    expect(long).toHaveLength(40);
    expect(long.endsWith("-12")).toBe(true);
    expect(slugProblem(long)).toBeNull();
  });
});
