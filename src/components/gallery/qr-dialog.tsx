"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { useDialogFocus } from "@/components/ui/use-dialog-focus";
import { drawQr, fileSlug, printQrCard, qrToPng, saveFile } from "@/lib/gallery/qr";
import { guestsCanLine } from "@/lib/gallery/view";
import type { AccessTokenDto } from "@/modules/gallery/gallery.dto";

/**
 * Stitch "QR Dialog & Printable Wedding Card". The code is the shared link and nothing more, so
 * scanning it gives exactly what the link gives (and stops working the moment the link is revoked).
 */
export function QrDialog({
  link,
  coupleNames,
  dateLabel,
  onClose,
}: {
  link: AccessTokenDto;
  coupleNames: string;
  dateLabel: string | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef);
  const [busy, setBusy] = useState<"png" | "svg" | null>(null);
  const url = link.shareUrl;
  const drawing = useMemo(() => (url ? drawQr(url) : null), [url]);
  const label = link.label?.trim() || "Gallery link";

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast({
        type: "success",
        title: "Link copied",
        message: "Paste it into a message or a note.",
      });
    } catch {
      toast({
        type: "error",
        title: "Couldn't copy",
        message: "Select the link and copy it by hand.",
      });
    }
  }

  async function downloadPng() {
    if (!drawing) return;
    setBusy("png");
    try {
      saveFile(`${fileSlug(label)}-qr.png`, await qrToPng(drawing.svg));
    } catch {
      toast({
        type: "error",
        title: "Couldn't make the PNG",
        message: "Try the SVG download instead.",
      });
    } finally {
      setBusy(null);
    }
  }

  function downloadSvg() {
    if (!drawing) return;
    saveFile(`${fileSlug(label)}-qr.svg`, drawing.svg, "image/svg+xml");
  }

  function print() {
    if (!drawing) return;
    const opened = printQrCard({ svg: drawing.svg, names: coupleNames, dateLabel });
    if (!opened) {
      toast({
        type: "warning",
        title: "Your browser blocked the print window",
        message: "Allow pop-ups for this site, then try again.",
      });
    }
  }

  const button =
    "flex items-center gap-2 rounded-lg border border-[#D5CCC0] bg-white px-4 py-2.5 font-label-md text-label-md font-medium text-[#2A2622] transition-colors hover:bg-[#F2ECE3] focus:ring-2 focus:ring-[#B5714A] focus:outline-none disabled:opacity-60";

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-title"
      className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-[#2A2622]/40 p-4 backdrop-blur-xs"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex w-full max-w-[1000px] flex-col items-center justify-center gap-6 lg:flex-row lg:items-center">
        <div className="w-full max-w-[520px] overflow-hidden rounded-2xl bg-[#FAF6F0] shadow-2xl">
          <div className="p-8 pb-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2
                  id="qr-title"
                  className="truncate font-headline-md text-headline-md font-normal"
                >
                  {label}
                </h2>
                <p className="mt-1 font-body-sm text-body-sm text-[#2A2622]/70">
                  Scope: {link.albumTitle ?? "Whole gallery"} · {guestsCanLine(link.permissions)}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="-mt-1 -mr-2 rounded-lg p-2 text-on-surface-variant hover:bg-[#F2ECE3]"
              >
                <Icon name="close" />
              </button>
            </div>

            {drawing ? (
              <div className="mt-6 flex flex-col items-center gap-3">
                <div
                  className="w-64 max-w-full rounded-2xl border border-[#E5DDD2] bg-white p-3 shadow-sm"
                  dangerouslySetInnerHTML={{ __html: drawing.svg }}
                />
                <span className="flex items-center gap-2 rounded-full border border-[#2A2622]/10 bg-white px-3 py-1 font-label-sm text-label-sm text-[#7A4527]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#B5714A]" />
                  {link.permissions.canUpload ? "Instant camera & web upload" : "View only"}
                </span>
              </div>
            ) : (
              <p className="mt-6 rounded-lg bg-[#F8EDE4] p-4 font-body-sm text-body-sm text-[#7A4527]">
                This link can&apos;t be shown any more. Make a new link to get a QR code.
              </p>
            )}

            {url ? (
              <div className="mt-6 space-y-1.5">
                <label
                  htmlFor="qr-url"
                  className="font-label-sm text-label-sm tracking-widest text-[#2A2622]/70 uppercase"
                >
                  Direct access URL
                </label>
                <div className="flex items-center gap-2 rounded-lg border border-[#2A2622]/10 bg-white p-1.5 pl-3">
                  <Icon name="link" className="shrink-0 text-[18px] text-[#2A2622]/75" />
                  <input
                    id="qr-url"
                    readOnly
                    value={url}
                    onFocus={(event) => event.currentTarget.select()}
                    className="min-w-0 flex-1 bg-transparent font-mono text-[13px] text-[#2A2622] outline-none"
                  />
                  <button
                    type="button"
                    onClick={copy}
                    className="shrink-0 rounded-md bg-[#1F4D3D] px-3.5 py-2 font-label-md text-label-md font-medium text-[#FAF6F0] hover:bg-[#16382c] focus:ring-2 focus:ring-[#B5714A] focus:ring-offset-1 focus:outline-none"
                  >
                    Copy link
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-[#E8E1D7] bg-[#F4EEE5] px-8 py-4">
            <button
              type="button"
              onClick={downloadPng}
              disabled={!drawing || busy === "png"}
              className={button}
            >
              <Icon name="download" className="text-[18px]" />
              Download PNG
            </button>
            <button type="button" onClick={downloadSvg} disabled={!drawing} className={button}>
              <Icon name="file_download" className="text-[18px]" />
              Download SVG
            </button>
            <button
              type="button"
              onClick={print}
              disabled={!drawing}
              className="ml-auto flex items-center gap-2 rounded-lg bg-[#1F4D3D] px-4 py-2.5 font-label-md text-label-md font-medium text-[#FAF6F0] transition-colors hover:bg-[#16382c] focus:ring-2 focus:ring-[#B5714A] focus:ring-offset-2 focus:outline-none disabled:opacity-60"
            >
              <Icon name="print" className="text-[18px]" />
              Print card
            </button>
          </div>
        </div>

        {drawing ? (
          <div className="hidden w-[330px] shrink-0 lg:block" aria-hidden="true">
            <p className="mx-auto mb-2 w-fit rounded-full bg-[#2A2622]/85 px-3 py-1 text-center font-label-sm text-label-sm tracking-widest text-[#FAF6F0] uppercase">
              Table stand &amp; print preview (A5)
            </p>
            <div className="aspect-[1/1.414] rounded-lg bg-[#FFFDF9] p-3 shadow-2xl">
              <div className="flex h-full flex-col items-center justify-between border border-[#E5DDD2] px-5 py-7 text-center">
                <div>
                  <p className="font-headline-sm text-[22px] leading-tight">
                    Scan to share your photos
                  </p>
                  <p className="mt-2 font-body-sm text-body-sm text-[#2A2622]/75">
                    Capture and upload your favourite moments from today.
                  </p>
                </div>
                <div
                  className="w-40 rounded-xl border border-[#E5DDD2] bg-white p-1.5"
                  dangerouslySetInnerHTML={{ __html: drawing.svg }}
                />
                <div>
                  <p className="font-label-sm text-[10px] tracking-widest text-[#2A2622]/75 uppercase">
                    Point phone camera to begin
                  </p>
                  <p className="mt-2 font-headline-sm text-[18px]">
                    {coupleNames}
                    {dateLabel ? ` · ${dateLabel}` : ""}
                  </p>
                  <p className="mt-1 font-mono text-[10px] text-[#2A2622]/75">makemymarriage.com</p>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
