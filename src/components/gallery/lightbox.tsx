"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { useDialogFocus } from "@/components/ui/use-dialog-focus";

// The full-screen photo viewer from the Stitch "Photo Viewer Lightbox" (team, with an inspector on
// the right) and "Guest Gallery Page & Mobile Viewer" (guest, no inspector). Left and right arrow
// keys move between photos, Escape closes, a swipe moves on a phone. Focus stays inside it.

const SWIPE_PX = 50;

export function Lightbox({
  title,
  position,
  total,
  url,
  alt,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  onClose,
  inspector,
  downloadUrl,
  caption,
  footer,
  keysPaused = false,
}: {
  title: string;
  /** 1-based place in the list. */
  position: number;
  /** How many photos there are, when known; else the number loaded. */
  total: number;
  url: string;
  alt: string;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  /** The team's side panel (caption, visibility, delete). Left out for guests. */
  inspector?: ReactNode;
  /** A guest's download button in the top bar (only when the link allows downloads). */
  downloadUrl?: string | null;
  /** A caption shown under the photo (guests). */
  caption?: string | null;
  /** The line at the bottom of the stage (the team's access note). */
  footer?: ReactNode;
  /** True while a dialog on top of the viewer (delete confirmation) owns the keyboard. */
  keysPaused?: boolean;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const touchStart = useRef<number | null>(null);
  const [zoomed, setZoomed] = useState(false);
  useDialogFocus(dialogRef);

  // Moving to another photo starts unzoomed.
  const [lastUrl, setLastUrl] = useState(url);
  if (url !== lastUrl) {
    setLastUrl(url);
    setZoomed(false);
  }

  useEffect(() => {
    if (keysPaused) return;
    const onKey = (event: KeyboardEvent) => {
      // Arrow keys inside the caption box move the cursor; they must not change the photo.
      const target = event.target as HTMLElement | null;
      const typing = target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT");
      if (event.key === "Escape") {
        if (document.fullscreenElement) return; // the browser leaves full screen first
        onClose();
      } else if (!typing && event.key === "ArrowLeft" && hasPrev) onPrev();
      else if (!typing && event.key === "ArrowRight" && hasNext) onNext();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [hasPrev, hasNext, onPrev, onNext, onClose, keysPaused]);

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void stageRef.current?.requestFullscreen?.();
  }

  const circle =
    "flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-[#FAF6F0] transition-colors hover:bg-white/20 focus:ring-2 focus:ring-[#B5714A] focus:outline-none disabled:opacity-30";

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Photo ${position} of ${total}`}
      className="fixed inset-0 z-[55] flex flex-col bg-[#1A1714]/[0.97] text-[#FAF6F0] lg:flex-row"
    >
      <div
        ref={stageRef}
        className="relative flex min-w-0 flex-1 flex-col bg-[#1A1714]"
        onTouchStart={(event) => {
          touchStart.current = event.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(event) => {
          const start = touchStart.current;
          touchStart.current = null;
          const end = event.changedTouches[0]?.clientX;
          if (start === null || end === undefined || zoomed) return;
          if (end - start > SWIPE_PX && hasPrev) onPrev();
          else if (start - end > SWIPE_PX && hasNext) onNext();
        }}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-4 md:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex min-w-0 items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 font-body-sm text-body-sm">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#7fd6ad]" />
              <span className="truncate">{title}</span>
            </span>
            <span className="font-body-sm text-body-sm whitespace-nowrap text-[#FAF6F0]/75">
              {position} of {total}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {downloadUrl ? (
              <a href={downloadUrl} aria-label="Download this photo" className={circle}>
                <Icon name="download" className="text-[20px]" />
              </a>
            ) : null}
            <button
              type="button"
              aria-label={zoomed ? "Zoom out" : "Zoom in"}
              aria-pressed={zoomed}
              onClick={() => setZoomed((value) => !value)}
              className={circle}
            >
              <Icon name="zoom_in" className="text-[20px]" />
            </button>
            <button
              type="button"
              aria-label="Full screen"
              onClick={toggleFullscreen}
              className={circle}
            >
              <Icon name="fullscreen" className="text-[20px]" />
            </button>
            <button type="button" aria-label="Close viewer" onClick={onClose} className={circle}>
              <Icon name="close" className="text-[20px]" />
            </button>
          </div>
        </div>

        <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 md:px-20">
          <button
            type="button"
            aria-label="Previous photo"
            disabled={!hasPrev}
            onClick={onPrev}
            className={`${circle} absolute left-3 z-10 md:left-6`}
          >
            <Icon name="arrow_back" className="text-[20px]" />
          </button>
          <div
            className={`flex h-full w-full items-center justify-center ${zoomed ? "overflow-auto" : "overflow-hidden"}`}
          >
            {/* A signed, short-lived address from the photo store: Next's image optimiser can't (and shouldn't) fetch it. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={alt}
              draggable={false}
              className={`rounded-lg object-contain shadow-2xl transition-transform duration-200 ${
                zoomed ? "max-h-none max-w-none scale-150 cursor-zoom-out" : "max-h-full max-w-full"
              }`}
              onClick={() => setZoomed((value) => !value)}
            />
          </div>
          <button
            type="button"
            aria-label="Next photo"
            disabled={!hasNext}
            onClick={onNext}
            className={`${circle} absolute right-3 z-10 md:right-6`}
          >
            <Icon name="arrow_forward" className="text-[20px]" />
          </button>
        </div>

        <div className="flex min-h-14 items-center justify-between gap-4 px-4 py-3 md:px-8">
          <div className="min-w-0 font-body-sm text-body-sm text-[#FAF6F0]/75">
            {caption ? (
              <p className="truncate font-body-md text-body-md text-[#FAF6F0]">{caption}</p>
            ) : null}
            {footer}
          </div>
          <p className="hidden shrink-0 items-center gap-2 font-label-sm text-label-sm text-[#FAF6F0]/60 md:flex">
            <kbd className="rounded border border-white/20 px-1.5 py-0.5">←</kbd>
            <kbd className="rounded border border-white/20 px-1.5 py-0.5">→</kbd>
            to navigate
          </p>
        </div>
      </div>

      {inspector ? (
        <aside className="flex max-h-[45dvh] w-full shrink-0 flex-col overflow-y-auto border-t border-[#E5DDD2] bg-[#FAF6F0] text-[#2A2622] lg:max-h-none lg:w-[360px] lg:border-t-0 lg:border-l">
          {inspector}
        </aside>
      ) : null}
    </div>
  );
}
