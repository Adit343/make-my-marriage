"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { fetchGuestGallery } from "@/components/gallery/gallery-api";
import { Lightbox } from "@/components/gallery/lightbox";
import { Icon } from "@/components/ui/icon";
import { errorMessage } from "@/lib/client/api-client";
import type { PublicGallery, PublicPhoto } from "@/modules/gallery/public-gallery.service";

// What a guest sees at /gallery/<token> (Stitch "Guest Gallery Page & Mobile Viewer"): the couple's
// names, a grid of the photos the link allows, a full-screen viewer, and a way to add their own.
// No account, no menu, nothing from the team's side of the app.

export function GuestHeader({ names, label }: { names: string; label?: string }) {
  return (
    <header className="bg-[#1F4D3D] px-5 py-4 text-center text-[#FAF6F0]">
      <p className="font-headline-sm text-headline-sm font-normal tracking-wide">{names}</p>
      {label ? (
        <p className="font-label-sm text-label-sm tracking-widest text-[#FAF6F0]/85 uppercase">
          {label}
        </p>
      ) : null}
    </header>
  );
}

export function GuestGallery({
  token,
  initial,
  initialCursor,
}: {
  token: string;
  initial: PublicGallery;
  initialCursor: string | null;
}) {
  const [photos, setPhotos] = useState<PublicPhoto[]>(initial.photos);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [viewer, setViewer] = useState<number | null>(null);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    setProblem(null);
    try {
      const next = await fetchGuestGallery(token, cursor);
      setPhotos((current) => [...current, ...next.gallery.photos]);
      setCursor(next.nextCursor);
    } catch (error) {
      setProblem(errorMessage(error));
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, loadingMore, token]);

  function move(next: number) {
    setViewer(next);
    if (next >= photos.length - 3) void loadMore();
  }

  const current = viewer !== null ? photos[viewer] : undefined;

  return (
    <div className="flex min-h-dvh flex-col bg-background text-body-md text-on-surface">
      <GuestHeader names={initial.coupleNames} />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-8 pb-32 md:px-8">
        <div className="mb-6 space-y-1.5">
          <h1 className="font-headline-lg text-headline-lg font-normal tracking-tight text-[#2A2622]">
            {initial.albumTitle ?? "Wedding photos"}
          </h1>
          <p className="font-body-md text-body-md text-[#686F6A]">
            Shared with you by {initial.coupleNames}.
          </p>
          {initial.canView && photos.length > 0 ? (
            <p className="flex items-center gap-2 font-label-sm text-label-sm text-[#1F4D3D]">
              <Icon name="cloud_done" className="text-[16px]" />
              {cursor
                ? `${photos.length}+ photos`
                : `${photos.length} ${photos.length === 1 ? "photo" : "photos"}`}
            </p>
          ) : null}
        </div>

        {!initial.canView ? (
          <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-2xl border border-dashed border-[#2A2622]/15 bg-surface-container-lowest px-6 py-12 text-center">
            <Icon name="add_photo_alternate" className="text-[32px] text-[#A0623C]" />
            <h2 className="font-headline-sm text-headline-sm font-normal">
              This link is for adding photos
            </h2>
            <p className="font-body-md text-body-md text-[#686F6A]">
              You can share your photos with {initial.coupleNames}, but this link doesn&apos;t show
              the gallery.
            </p>
          </div>
        ) : photos.length === 0 ? (
          <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-2xl border border-dashed border-[#2A2622]/15 bg-surface-container-lowest px-6 py-12 text-center">
            <Icon name="photo_library" className="text-[32px] text-outline" />
            <h2 className="font-headline-sm text-headline-sm font-normal">No photos yet</h2>
            <p className="font-body-md text-body-md text-[#686F6A]">
              {initial.canUpload
                ? "Be the first to share one."
                : "Photos will appear here as they are added."}
            </p>
          </div>
        ) : (
          <>
            <ul className="columns-2 gap-3 md:columns-3 md:gap-4 lg:columns-4">
              {photos.map((photo, index) => (
                <li
                  key={photo.id}
                  className="mb-3 break-inside-avoid overflow-hidden rounded-xl bg-[#EFE7DB] md:mb-4"
                >
                  <button
                    type="button"
                    onClick={() => setViewer(index)}
                    aria-label={`Open photo ${index + 1}${photo.caption ? `: ${photo.caption}` : ""}`}
                    className="block w-full focus:ring-2 focus:ring-[#B5714A] focus:outline-none"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.url}
                      alt={photo.caption ?? `Wedding photo ${index + 1}`}
                      loading="lazy"
                      decoding="async"
                      width={photo.width ?? undefined}
                      height={photo.height ?? undefined}
                      style={{
                        aspectRatio:
                          photo.width && photo.height
                            ? `${photo.width} / ${photo.height}`
                            : "4 / 5",
                      }}
                      className="w-full object-cover"
                    />
                  </button>
                </li>
              ))}
            </ul>
            {problem ? (
              <p role="alert" className="mt-4 text-center font-body-sm text-body-sm text-[#B3261E]">
                {problem}
              </p>
            ) : null}
            {cursor ? (
              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={() => void loadMore()}
                  disabled={loadingMore}
                  className="min-h-12 rounded-xl border border-[#D5CCC0] px-7 font-label-md text-label-md font-medium hover:bg-[#F2ECE3] disabled:opacity-60"
                >
                  {loadingMore ? "Loading…" : "Show more photos"}
                </button>
              </div>
            ) : null}
          </>
        )}

        <p className="mt-12 text-center font-label-sm text-label-sm text-[#686F6A]">
          Made with Make My Marriage
        </p>
      </main>

      {initial.canUpload ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#2A2622]/10 bg-[#FAF6F0]/95 px-4 py-3 backdrop-blur-md">
          <div className="mx-auto flex max-w-5xl items-center justify-center gap-3">
            <Link
              href={`/gallery/${encodeURIComponent(token)}/add`}
              className="flex min-h-12 items-center gap-2 rounded-xl bg-[#1F4D3D] px-7 font-label-md text-label-md font-semibold text-[#FAF6F0] shadow-sm hover:bg-[#16382c] focus:ring-2 focus:ring-[#B5714A] focus:ring-offset-2 focus:outline-none"
            >
              <Icon name="photo_camera" className="text-[22px]" />
              Add your photos
            </Link>
          </div>
        </div>
      ) : null}

      {viewer !== null && current ? (
        <Lightbox
          title={initial.albumTitle ?? "Wedding photos"}
          position={viewer + 1}
          total={photos.length}
          url={current.url}
          alt={current.caption ?? `Wedding photo ${viewer + 1}`}
          hasPrev={viewer > 0}
          hasNext={viewer < photos.length - 1}
          onPrev={() => move(viewer - 1)}
          onNext={() => move(viewer + 1)}
          onClose={() => setViewer(null)}
          downloadUrl={current.downloadUrl}
          caption={current.caption}
        />
      ) : null}
    </div>
  );
}

/** Stitch "Gallery Link Not Working State": one calm page for every kind of unusable link. */
export function InvalidGalleryLink() {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-body-md text-on-surface">
      <header className="bg-[#1F4D3D] px-5 py-4 text-center text-[#FAF6F0]">
        <p className="font-headline-sm text-headline-sm font-normal tracking-wide">
          Wedding celebration
        </p>
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-5 px-6 py-16 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#F5EAE0] text-[#A0623C]">
          <Icon name="link_off" className="text-[32px]" />
        </span>
        <h1 className="font-headline-md text-headline-md font-normal text-[#2A2622]">
          This link isn&apos;t working
        </h1>
        <p className="font-body-md text-body-md text-[#686F6A]">
          It may have been replaced by a newer one. Please ask the couple to share your link again.
        </p>
        <div className="flex w-full gap-3 rounded-xl border border-[#2A2622]/10 bg-surface-container-lowest p-4 text-left">
          <Icon name="info" className="mt-0.5 shrink-0 text-[20px] text-[#1F4D3D]" />
          <div className="font-body-sm text-body-sm text-[#686F6A]">
            <p className="font-semibold text-[#2A2622]">Need help right away?</p>
            <p>Check your WhatsApp or text messages for the most recent message from the couple.</p>
          </div>
        </div>
        <p className="pt-6 font-label-sm text-label-sm text-[#686F6A]">
          Made with Make My Marriage
        </p>
      </main>
    </div>
  );
}
