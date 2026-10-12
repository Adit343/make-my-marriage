import { describe, expect, it } from "vitest";
import {
  buildObjectKey,
  declaredMatchesSniffed,
  extensionFor,
  formatBytes,
  isAllowedPhotoType,
  OBJECT_KEY_PATTERN,
  sanitizeFileName,
  sniffPhotoType,
} from "@/lib/gallery/files";

const bytes = (...values: (number | string)[]) =>
  new Uint8Array(
    values.flatMap((v) => (typeof v === "string" ? [...v].map((c) => c.charCodeAt(0)) : [v])),
  );

describe("sniffPhotoType", () => {
  it("recognises each accepted photo by its first bytes", () => {
    expect(sniffPhotoType(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 16, "JFIF"))).toBe("image/jpeg");
    expect(sniffPhotoType(bytes(0xff, 0xd8, 0xff, 0xdb))).toBe("image/jpeg");
    expect(sniffPhotoType(bytes(0x89, "PNG", 0x0d, 0x0a, 0x1a, 0x0a, 0, 0))).toBe("image/png");
    expect(sniffPhotoType(bytes("RIFF", 1, 2, 3, 4, "WEBP", "VP8 "))).toBe("image/webp");
    expect(sniffPhotoType(bytes(0, 0, 0, 24, "ftyp", "heic", 0, 0))).toBe("image/heic");
    for (const brand of ["heix", "mif1", "msf1", "hevc"]) {
      expect(sniffPhotoType(bytes(0, 0, 0, 24, "ftyp", brand, 0, 0)), brand).toBe("image/heic");
    }
  });

  it("refuses everything else, including look-alikes and tiny files", () => {
    const refused: [string, Uint8Array][] = [
      ["a GIF", bytes("GIF89a", 1, 0, 1, 0)],
      ["a PDF", bytes("%PDF-1.7", 10, 10)],
      ["HTML", bytes("<html><script>alert(1)</script></html>")],
      ["SVG", bytes('<svg xmlns="http://www.w3.org/2000/svg"></svg>')],
      ["a ZIP", bytes("PK", 3, 4, 0, 0, 0, 0, 0, 0, 0, 0)],
      ["an MP4 video", bytes(0, 0, 0, 24, "ftyp", "isom", 0, 0)],
      ["a RIFF that is not WebP", bytes("RIFF", 0, 0, 0, 0, "WAVE")],
      ["a truncated PNG", bytes(0x89, "PNG")],
      ["a PNG missing its newline bytes", bytes(0x89, "PNG", 0x0d, 0x0a, 0x00, 0x0a)],
      ["two JPEG bytes only", bytes(0xff, 0xd8)],
      ["nothing", new Uint8Array()],
    ];
    for (const [label, data] of refused) expect(sniffPhotoType(data), label).toBeNull();
  });
});

describe("declaredMatchesSniffed", () => {
  it("accepts a match, and treats HEIC and HEIF as one family", () => {
    expect(declaredMatchesSniffed("image/jpeg", "image/jpeg")).toBe(true);
    expect(declaredMatchesSniffed("image/heif", "image/heic")).toBe(true);
    expect(declaredMatchesSniffed("image/heic", "image/heic")).toBe(true);
  });

  it("refuses a photo that is not what was declared", () => {
    expect(declaredMatchesSniffed("image/jpeg", "image/png")).toBe(false);
    expect(declaredMatchesSniffed("image/png", "image/webp")).toBe(false);
    expect(declaredMatchesSniffed("image/jpeg", "image/heic")).toBe(false);
  });
});

describe("accepted types and extensions", () => {
  it("accepts exactly the five photo types", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]) {
      expect(isAllowedPhotoType(type), type).toBe(true);
    }
    for (const type of [
      "image/gif",
      "image/svg+xml",
      "video/mp4",
      "text/html",
      "",
      "toString",
      "__proto__",
    ]) {
      expect(isAllowedPhotoType(type), type).toBe(false);
    }
    expect(extensionFor("image/jpeg")).toBe("jpg");
    expect(extensionFor("image/heif")).toBe("heif");
  });
});

describe("object keys", () => {
  const wedding = "6acbcd6533ba8a64f91799bb";
  const asset = "6acbcd6533ba8a64f91799c4";

  it("are built only from ids and a random part, and match the pattern", () => {
    const key = buildObjectKey(wedding, asset, "nGhWgxnp9AVBqDThTAJRfj3F", "image/webp");
    expect(key).toBe(`weddings/${wedding}/gallery/${asset}/nGhWgxnp9AVBqDThTAJRfj3F.webp`);
    expect(OBJECT_KEY_PATTERN.test(key)).toBe(true);
  });

  it("are refused when they could reach anywhere else", () => {
    const random = "nGhWgxnp9AVBqDThTAJRfj3F";
    for (const key of [
      `weddings/${wedding}/gallery/${asset}/../../x.jpg`,
      `../weddings/${wedding}/gallery/${asset}/${random}.jpg`,
      `/weddings/${wedding}/gallery/${asset}/${random}.jpg`,
      `weddings/${wedding}/gallery/${asset}/${random}.php`,
      `weddings/${wedding}/gallery/${asset}/${random}.jpg/extra`,
      `weddings/${wedding}/gallery/${asset}/${random}.jpg\0.png`,
      `weddings/NOT_AN_ID/gallery/${asset}/${random}.jpg`,
      `weddings\\${wedding}\\gallery\\${asset}\\${random}.jpg`,
      `weddings/${wedding}/gallery/${asset}/short.jpg`,
      "",
    ]) {
      expect(OBJECT_KEY_PATTERN.test(key), JSON.stringify(key)).toBe(false);
    }
  });
});

describe("sanitizeFileName", () => {
  it("keeps a normal name", () => {
    expect(sanitizeFileName("IMG_2041.jpg")).toBe("IMG_2041.jpg");
    expect(sanitizeFileName("Haldi — Mama & Papa.png")).toBe("Haldi — Mama & Papa.png");
  });

  it("drops paths, markup and control characters, and never returns nothing", () => {
    expect(sanitizeFileName("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFileName("C:\\Users\\me\\photo.jpg")).toBe("photo.jpg");
    expect(sanitizeFileName("<b>bold</b>.jpg")).toBe("b.jpg"); // the "/" ends the path part
    expect(sanitizeFileName("a<b>c.jpg")).toBe("abc.jpg");
    expect(sanitizeFileName("a\u0000b\u0007c.jpg")).toBe("abc.jpg");
    expect(sanitizeFileName("  .hidden.jpg ")).toBe("hidden.jpg");
    expect(sanitizeFileName("   ")).toBe("photo");
    expect(sanitizeFileName("/")).toBe("photo");
    expect(sanitizeFileName("x".repeat(400))).toHaveLength(255);
  });
});

describe("formatBytes", () => {
  it("reads like the storage meter", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(900)).toBe("900 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(3.2 * 1024 * 1024)).toBe("3.2 MB");
    expect(formatBytes(15 * 1024 * 1024)).toBe("15 MB");
    expect(formatBytes(2 * 1024 * 1024 * 1024)).toBe("2 GB");
    expect(formatBytes(1.4 * 1024 * 1024 * 1024)).toBe("1.4 GB");
  });
});
