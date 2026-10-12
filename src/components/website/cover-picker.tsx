"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { fetchAssets } from "@/components/gallery/gallery-api";
import { Icon } from "@/components/ui/icon";
import { useDialogFocus } from "@/components/ui/use-dialog-focus";
import { errorMessage } from "@/lib/client/api-client";
import type { AssetDto } from "@/modules/gallery/gallery.dto";

export interface CoverChoice {
  assetId: string;
  fileName: string;
  url: string;
}

/**
 * Stitch "Website Cover Image Picker from Gallery": only photos marked Public can be the cover (a
 * private photo must never reach the public site), so only those are offered.
 */
export function CoverPicker({
  weddingId,
  currentId,
  onClose,
  onChoose,
}: {
  weddingId: string;
  currentId: string | null;
  onClose: () => void;
  onChoose: (choice: CoverChoice) => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef);
  const [photos, setPhotos] = useState<AssetDto[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(currentId);
  const [problem, setProblem] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetchAssets(weddingId, { visibility: "public", status: "active", limit: 30 }, controller.signal)
      .then((page) => {
        setPhotos(page.items);
        setCursor(page.nextCursor);
        setProblem(null);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setProblem(errorMessage(error));
        setPhotos((current) => current ?? []);
      });
    return () => controller.abort();
  }, [weddingId, attempt]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function more() {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const page = await fetchAssets(weddingId, {
        visibility: "public",
        status: "active",
        limit: 30,
        cursor,
      });
      setPhotos((current) => [...(current ?? []), ...page.items]);
      setCursor(page.nextCursor);
    } catch (error) {
      setProblem(errorMessage(error));
    } finally {
      setLoadingMore(false);
    }
  }

  const chosen = photos?.find((photo) => photo.id === selected) ?? null;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cover-picker-title"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[#2A2622]/40 p-4 backdrop-blur-xs"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[90dvh] w-full max-w-[760px] flex-col overflow-hidden rounded-2xl bg-[#FAF6F0] shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-[#2A2622]/[0.08] px-7 py-6">
          <div>
            <h2 id="cover-picker-title" className="font-headline-md text-headline-md font-normal">
              Choose a cover photo
            </h2>
            <p className="mt-1 font-body-sm text-body-sm text-[#686F6A]">
              Only photos marked Public can be used here.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="-mt-1 -mr-2 rounded-lg p-2 text-[#686F6A] hover:bg-[#F2ECE3]"
          >
            <Icon name="close" />
          </button>
        </header>

        <div className="custom-scrollbar flex-1 overflow-y-auto px-7 py-6">
          {photos === null ? (
            <p className="py-12 text-center font-body-md text-body-md text-[#686F6A]" role="status">
              Loading photos…
            </p>
          ) : photos.length === 0 ? (
            <div className="mx-auto flex max-w-sm flex-col items-center gap-3 py-10 text-center">
              <Icon name="photo_library" className="text-[32px] text-outline" />
              <h3 className="font-headline-sm text-headline-sm font-normal">
                {problem ? "Couldn't load your photos" : "No public photos yet"}
              </h3>
              <p className="font-body-md text-body-md text-[#686F6A]">
                {problem ??
                  "Mark photos as Public in your gallery to use them as your website cover."}
              </p>
              {problem ? (
                <button
                  type="button"
                  onClick={() => setAttempt((value) => value + 1)}
                  className="rounded-lg border border-[#D5CCC0] px-4 py-2 font-label-md text-label-md font-medium hover:bg-[#F2ECE3]"
                >
                  Try again
                </button>
              ) : (
                <Link
                  href="/dashboard/gallery"
                  className="flex items-center gap-1.5 font-label-md text-label-md font-semibold text-[#1F4D3D] hover:underline"
                >
                  Go to gallery
                  <Icon name="arrow_forward" className="text-[16px]" />
                </Link>
              )}
            </div>
          ) : (
            <>
              <div
                role="radiogroup"
                aria-label="Public photos"
                className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4"
              >
                {photos.map((photo) => {
                  const on = selected === photo.id;
                  return (
                    <div key={photo.id}>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={on}
                        aria-label={photo.caption ?? photo.fileName}
                        onClick={() => setSelected(photo.id)}
                        className={`relative block aspect-[4/3] w-full overflow-hidden rounded-xl bg-[#EFE7DB] ring-offset-2 ring-offset-[#FAF6F0] transition-shadow focus:ring-2 focus:ring-[#B5714A] focus:outline-none ${
                          on ? "ring-2 ring-[#1F4D3D]" : "hover:shadow-md"
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo.url}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                        <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 font-label-sm text-[11px] font-semibold text-[#2A2622]">
                          <Icon name="public" className="text-[13px]" />
                          Public
                        </span>
                        {on ? (
                          <span className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#1F4D3D] text-white">
                            <Icon name="check" className="text-[16px]" />
                          </span>
                        ) : null}
                      </button>
                    </div>
                  );
                })}
              </div>
              {cursor ? (
                <div className="mt-5 text-center">
                  <button
                    type="button"
                    onClick={() => void more()}
                    disabled={loadingMore}
                    className="rounded-lg border border-[#D5CCC0] px-5 py-2 font-label-md text-label-md font-medium hover:bg-[#F2ECE3] disabled:opacity-60"
                  >
                    {loadingMore ? "Loading…" : "Show more"}
                  </button>
                </div>
              ) : null}
              <div className="mt-6 flex flex-wrap items-center justify-between gap-2 font-body-sm text-body-sm text-[#686F6A]">
                <span className="flex items-center gap-2">
                  <Icon name="help_outline" className="text-[16px]" />
                  Not seeing a photo? Set its visibility to Public in the{" "}
                  <Link
                    href="/dashboard/gallery"
                    className="font-semibold text-[#1F4D3D] hover:underline"
                  >
                    gallery
                  </Link>
                  .
                </span>
                <span aria-live="polite">
                  {photos.length}
                  {cursor ? "+" : ""} public {photos.length === 1 ? "photo" : "photos"} found
                </span>
              </div>
            </>
          )}
        </div>

        <footer className="flex items-center justify-end gap-3 border-t border-[#2A2622]/[0.08] bg-[#F4EEE5] px-7 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#D5CCC0] bg-white px-5 py-2.5 font-label-md text-label-md font-medium hover:bg-[#F2ECE3]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!chosen}
            onClick={() =>
              chosen && onChoose({ assetId: chosen.id, fileName: chosen.fileName, url: chosen.url })
            }
            className="flex items-center gap-2 rounded-lg bg-[#1F4D3D] px-5 py-2.5 font-label-md text-label-md font-medium text-[#FAF6F0] hover:bg-[#16382c] disabled:opacity-50"
          >
            <Icon name="check" className="text-[18px]" />
            Use this photo
          </button>
        </footer>
      </div>
    </div>
  );
}
