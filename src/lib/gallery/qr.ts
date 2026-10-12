import qrcode from "qrcode-generator";

// A shared link drawn as a QR code (PRD §36 Phase 6: "a convenient entry point that must never
// bypass access controls": the code holds exactly the link and nothing else). Built here as plain
// SVG text, so there is no image processing, and the same drawing serves the screen, the PNG and
// SVG downloads and the printed card.

const QUIET_ZONE = 4;

export interface QrDrawing {
  /** A complete, standalone SVG document. */
  svg: string;
  /** Squares along one side, quiet zone included. */
  modules: number;
}

/** Draws `text` as a QR code in dark ink on white. `ink` must be a plain colour such as "#2A2622". */
export function drawQr(text: string, ink = "#2A2622"): QrDrawing {
  const code = qrcode(0, "M");
  code.addData(text);
  code.make();
  const count = code.getModuleCount();
  const total = count + QUIET_ZONE * 2;

  // One path of unit squares, merged into horizontal runs, keeps the file small.
  let path = "";
  for (let row = 0; row < count; row += 1) {
    let col = 0;
    while (col < count) {
      if (!code.isDark(row, col)) {
        col += 1;
        continue;
      }
      let end = col;
      while (end < count && code.isDark(row, end)) end += 1;
      path += `M${col + QUIET_ZONE} ${row + QUIET_ZONE}h${end - col}v1h-${end - col}z`;
      col = end;
    }
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" ` +
    `shape-rendering="crispEdges" role="img" aria-label="QR code for the shared gallery link">` +
    `<rect width="${total}" height="${total}" fill="#ffffff"/>` +
    `<path d="${path}" fill="${ink}"/></svg>`;
  return { svg, modules: total };
}

/** The drawing as a PNG, `pixels` wide. Browser only. */
export function qrToPng(svg: string, pixels = 1024): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = pixels;
      canvas.height = pixels;
      const context = canvas.getContext("2d");
      if (!context) {
        URL.revokeObjectURL(url);
        reject(new Error("Canvas is not available"));
        return;
      }
      // Sharp edges: a QR code must not be smoothed.
      context.imageSmoothingEnabled = false;
      context.drawImage(image, 0, 0, pixels, pixels);
      URL.revokeObjectURL(url);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Could not make the PNG"))),
        "image/png",
      );
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not draw the QR code"));
    };
    image.src = url;
  });
}

/** Saves a blob or text as a file through a temporary link. Browser only. */
export function saveFile(name: string, content: Blob | string, type = "text/plain") {
  const blob = typeof content === "string" ? new Blob([content], { type }) : content;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** A file-name-safe version of a label ("Reception QR" -> "reception-qr"). */
export function fileSlug(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "gallery-link"
  );
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * Opens the printable table card (Stitch "QR Dialog & Printable Wedding Card", A5 portrait) in its
 * own window and prints it. Everything put in the page is escaped.
 */
export function printQrCard(args: { svg: string; names: string; dateLabel: string | null }) {
  const win = window.open("", "_blank", "width=720,height=900");
  if (!win) return false;
  const footer = args.dateLabel ? `${args.names} · ${args.dateLabel}` : args.names;
  win.document.write(`<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Scan to share your photos</title>
<style>
  @page { size: A5 portrait; margin: 0 }
  * { box-sizing: border-box }
  html, body { margin: 0; height: 100%; background: #fff }
  body { display: flex; align-items: center; justify-content: center; font-family: Georgia, "Times New Roman", serif; color: #2A2622 }
  .card { width: 148mm; height: 210mm; padding: 10mm; background: #FFFDF9 }
  .frame { height: 100%; border: 0.4mm solid #E5DDD2; display: flex; flex-direction: column; align-items: center; justify-content: space-between; padding: 14mm 10mm; text-align: center }
  h1 { font-size: 26pt; font-weight: 400; margin: 0 0 4mm }
  p.sub { font-family: Arial, sans-serif; font-size: 11pt; color: #5b5750; margin: 0; max-width: 80mm }
  .qr { width: 78mm; height: 78mm; border: 0.3mm solid #E5DDD2; border-radius: 3mm; overflow: hidden }
  .qr svg { width: 100%; height: 100% }
  .hint { font-family: Arial, sans-serif; font-size: 8pt; letter-spacing: 0.14em; text-transform: uppercase; color: #5b5750 }
  .names { font-size: 18pt; margin: 3mm 0 2mm }
  .brand { font-family: "Courier New", monospace; font-size: 8pt; color: #8a857c }
</style></head><body>
<div class="card"><div class="frame">
  <div><h1>Scan to share your photos</h1><p class="sub">Capture and upload your favourite moments from today.</p></div>
  <div class="qr">${args.svg}</div>
  <div><div class="hint">Point phone camera to begin</div><div class="names">${escapeHtml(footer)}</div><div class="brand">makemymarriage.com</div></div>
</div></div>
</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
  return true;
}
