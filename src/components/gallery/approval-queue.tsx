"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchAssets, moderateAsset } from "@/components/gallery/gallery-api";
import { PhotoViewer } from "@/components/gallery/photo-viewer";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/client/api-client";
import { timeAgo, uploaderName } from "@/lib/gallery/view";
import type { AlbumDto, AssetDto } from "@/modules/gallery/gallery.dto";

// Stitch "Gallery Approval Queue": guest photos wait here until an owner or admin approves them.
// Approving makes a photo visible to guests with a link; rejecting removes it for good (the guest
// is not told).

export function ApprovalQueue({
  weddingId,
  albums,
  timezone,
  nowIso,
}: {
  weddingId: string;
  albums: AlbumDto[];
  timezone: string;
  nowIso: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useState<AssetDto[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const now = new Date(nowIso);

  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetchAssets(weddingId, { status: "pending_review", limit: 60 }, controller.signal)
      .then((result) => {
        setItems(result.items);
        setCursor(result.nextCursor);
        setFailed(false);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setFailed(true);
        setItems((current) => current ?? []);
        toast({ type: "error", title: "Couldn't load the queue", message: errorMessage(error) });
      });
    return () => controller.abort();
  }, [weddingId, toast, attempt]);

  async function more() {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const page = await fetchAssets(weddingId, { status: "pending_review", limit: 60, cursor });
      setItems((current) => [...(current ?? []), ...page.items]);
      setCursor(page.nextCursor);
    } catch (error) {
      toast({ type: "error", title: "Couldn't load more", message: errorMessage(error) });
    } finally {
      setLoadingMore(false);
    }
  }

  async function decide(ids: string[], decision: "approve" | "reject") {
    setBusy(true);
    const results = await Promise.allSettled(
      ids.map((id) => moderateAsset(weddingId, id, decision)),
    );
    const done = new Set(ids.filter((_, index) => results[index]!.status === "fulfilled"));
    const problems = results.length - done.size;
    setItems((current) => (current ?? []).filter((item) => !done.has(item.id)));
    setSelected((current) => new Set([...current].filter((id) => !done.has(id))));
    if (done.size > 0) {
      toast({
        type: "success",
        title:
          decision === "approve"
            ? `${done.size} ${done.size === 1 ? "photo" : "photos"} approved`
            : `${done.size} ${done.size === 1 ? "photo" : "photos"} rejected`,
        message:
          decision === "approve"
            ? "Guests with a link can see them now."
            : "They were removed and won't be shown to anyone.",
      });
      router.refresh();
    }
    if (problems > 0) {
      const first = results.find((result) => result.status === "rejected") as PromiseRejectedResult;
      toast({
        type: "error",
        title: `${problems} couldn't be ${decision}d`,
        message: errorMessage(first.reason),
      });
    }
    setBusy(false);
  }

  const list = items ?? [];
  const allSelected = list.length > 0 && list.every((item) => selected.has(item.id));
  const albumTitle = (albumId: string | null) =>
    albumId ? (albums.find((album) => album.id === albumId)?.title ?? "Album") : "No album";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-headline-md text-headline-md font-normal text-primary">
          Needs approval
        </h2>
        <p className="mt-1 font-body-md text-body-md text-on-surface-variant">
          Photos added by guests appear in the gallery once you approve them.
        </p>
      </div>

      {items === null ? (
        <p
          className="py-16 text-center font-body-md text-body-md text-on-surface-variant"
          role="status"
        >
          Loading the queue…
        </p>
      ) : list.length === 0 ? (
        <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-2xl border border-dashed border-[#2A2622]/15 bg-surface-container-lowest px-8 py-16 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#EBF2EE] text-[#1F4D3D]">
            <Icon name="check_circle" className="text-[30px]" />
          </span>
          <h3 className="font-headline-sm text-headline-sm font-normal text-primary">
            {failed ? "Couldn't load the queue" : "Nothing waiting for approval"}
          </h3>
          <p className="font-body-md text-body-md text-on-surface-variant">
            {failed
              ? "Try again in a moment."
              : "You're all caught up. New guest photos will appear here."}
          </p>
          {failed ? (
            <button
              type="button"
              onClick={() => setAttempt((value) => value + 1)}
              className="rounded-lg border border-[#D5CCC0] px-4 py-2 font-label-md text-label-md font-medium hover:bg-[#F2ECE3]"
            >
              Try again
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-[#2A2622]/[0.08] bg-surface-container-lowest px-4 py-3">
            <label className="flex cursor-pointer items-center gap-2.5 font-label-md text-label-md font-medium">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(event) =>
                  setSelected(
                    event.target.checked ? new Set(list.map((item) => item.id)) : new Set(),
                  )
                }
                className="h-4 w-4 accent-[#1F4D3D]"
              />
              Select all
            </label>
            <span className="font-body-sm text-body-sm text-on-surface-variant" aria-live="polite">
              {list.length} in queue{cursor ? " (and more)" : ""}
            </span>
            {selected.size > 0 ? (
              <div className="ml-auto flex items-center gap-3">
                <span className="font-label-md text-label-md font-semibold">
                  {selected.size} selected
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void decide([...selected], "approve")}
                  className="flex items-center gap-1.5 rounded-lg bg-[#1F4D3D] px-4 py-2 font-label-md text-label-md font-medium text-[#FAF6F0] hover:bg-[#16382c] disabled:opacity-60"
                >
                  <Icon name="check" className="text-[18px]" />
                  Approve
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void decide([...selected], "reject")}
                  className="flex items-center gap-1.5 rounded-lg border border-[#B3261E]/30 px-4 py-2 font-label-md text-label-md font-medium text-[#B3261E] hover:bg-[#FCEDEC] disabled:opacity-60"
                >
                  <Icon name="close" className="text-[18px]" />
                  Reject
                </button>
              </div>
            ) : null}
          </div>

          <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((photo, index) => (
              <li
                key={photo.id}
                className="overflow-hidden rounded-xl border border-[#2A2622]/[0.08] bg-surface-container-lowest shadow-sm"
              >
                <div className="relative">
                  <button
                    type="button"
                    aria-label={`Preview the photo added by ${uploaderName(photo.uploadedBy)}`}
                    onClick={() => setPreview(index)}
                    className="block aspect-[4/3] w-full overflow-hidden bg-[#F2ECE3]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.url}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </button>
                  <label className="absolute top-3 left-3 flex h-7 w-7 cursor-pointer items-center justify-center rounded-md bg-white/90 shadow">
                    <input
                      type="checkbox"
                      aria-label={`Select the photo added by ${uploaderName(photo.uploadedBy)}`}
                      checked={selected.has(photo.id)}
                      onChange={(event) =>
                        setSelected((current) => {
                          const next = new Set(current);
                          if (event.target.checked) next.add(photo.id);
                          else next.delete(photo.id);
                          return next;
                        })
                      }
                      className="h-4 w-4 accent-[#1F4D3D]"
                    />
                  </label>
                </div>
                <div className="space-y-3 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-[#F5EAE0] px-2.5 py-0.5 font-label-sm text-label-sm font-semibold text-[#7A4527]">
                      {albumTitle(photo.albumId)}
                    </span>
                    <span className="font-label-sm text-label-sm text-on-surface-variant">
                      {timeAgo(photo.createdAt, now)}
                    </span>
                  </div>
                  <p className="font-body-md text-body-md">
                    Added by {uploaderName(photo.uploadedBy)}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void decide([photo.id], "approve")}
                      className="flex items-center justify-center gap-1.5 rounded-lg bg-[#1F4D3D] px-3 py-2 font-label-md text-label-md font-medium text-[#FAF6F0] hover:bg-[#16382c] disabled:opacity-60"
                    >
                      <Icon name="check" className="text-[18px]" />
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void decide([photo.id], "reject")}
                      className="flex items-center justify-center gap-1.5 rounded-lg border border-[#D5CCC0] px-3 py-2 font-label-md text-label-md font-medium hover:bg-[#FCEDEC] hover:text-[#B3261E] disabled:opacity-60"
                    >
                      <Icon name="close" className="text-[18px]" />
                      Reject
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {cursor ? (
            <div className="text-center">
              <button
                type="button"
                onClick={() => void more()}
                disabled={loadingMore}
                className="rounded-lg border border-[#D5CCC0] px-5 py-2 font-label-md text-label-md font-medium hover:bg-[#F2ECE3] disabled:opacity-60"
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            </div>
          ) : null}

          <p className="flex items-center gap-2 font-body-sm text-body-sm text-on-surface-variant">
            <Icon name="info" className="text-[16px]" />
            Rejected photos are not shown to anyone, and the guest isn&apos;t notified.
          </p>
        </>
      )}

      {preview !== null && list[preview] ? (
        <PhotoViewer
          weddingId={weddingId}
          photos={list}
          index={preview}
          total={list.length}
          title="Waiting for approval"
          albums={albums}
          timezone={timezone}
          mode="preview"
          onIndex={setPreview}
          onClose={() => setPreview(null)}
          onChanged={() => undefined}
          onDeleted={() => undefined}
        />
      ) : null}
    </div>
  );
}
