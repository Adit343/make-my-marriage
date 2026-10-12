import { describe, expect, it } from "vitest";
import { drawQr, fileSlug } from "@/lib/gallery/qr";

describe("drawQr", () => {
  const link = "https://makemymarriage.com/gallery/0123456789abcdef0123456789abcdef0123456789a";

  it("draws a standalone square SVG with a quiet zone", () => {
    const { svg, modules } = drawQr(link);
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg).toContain(`viewBox="0 0 ${modules} ${modules}"`);
    // Version 1 is 21 modules; a link this long needs a bigger code, plus 4 modules of quiet zone each side.
    expect(modules).toBeGreaterThan(21 + 8);
    expect((modules - 8 - 21) % 4).toBe(0);
  });

  it("is deterministic, and different links give different drawings", () => {
    expect(drawQr(link).svg).toBe(drawQr(link).svg);
    expect(drawQr(`${link}x`).svg).not.toBe(drawQr(link).svg);
  });

  it("holds nothing but the shapes: no link text, no script", () => {
    const { svg } = drawQr(link);
    expect(svg).not.toContain("makemymarriage");
    expect(svg).not.toMatch(/<script|onload|href=/i);
  });

  it("uses the ink colour it is given", () => {
    expect(drawQr(link, "#1F4D3D").svg).toContain('fill="#1F4D3D"');
  });
});

describe("fileSlug", () => {
  it("makes a safe file name from a label", () => {
    expect(fileSlug("Reception QR")).toBe("reception-qr");
    expect(fileSlug("  Family / WhatsApp group!! ")).toBe("family-whatsapp-group");
    expect(fileSlug("")).toBe("gallery-link");
    expect(fileSlug("ä".repeat(100))).toBe("gallery-link");
  });
});
