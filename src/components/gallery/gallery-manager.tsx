"use client";

import { Select } from "@/components/ui/select";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlbumDrawer, DeleteAlbumDialog } from "@/components/gallery/album-drawer";
import { ApprovalQueue } from "@/components/gallery/approval-queue";
import { fetchAssets, updateAsset } from "@/components/gallery/gallery-api";
import { PhotoViewer } from "@/components/gallery/photo-viewer";
import { SharingSettings } from "@/components/gallery/sharing-settings";
import { UploadDrawer } from "@/components/gallery/upload-drawer";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/client/api-client";
import { VISIBILITY_LABEL, storageView } from "@/lib/gallery/view";
import type {
  AccessTokenDto,
  AlbumDto,
  AssetDto,
  GallerySettingsDto,
} from "@/modules/gallery/gallery.dto";

// The Gallery (Stitch "Gallery Home & Empty State", "Album Page & Edit/Delete Modals", "Photo
// Viewer Lightbox", "Gallery Approval Queue", "Gallery Sharing & Settings"). Albums and settings
// come from the server page; photos are fetched here a page at a time, so filters are quick.

export type GalleryTab = "photos" | "approval" | "sharing";
type Filter = "all" | "favorites" | "root";

const PAGE = 30;
const ALBUM_TINTS = ["#E9D8C4", "#DCE5DA", "#EBD3C6", "#E4DDD0"];

export function GalleryManager({
  weddingId,
  canManage,
  settings,
  albums,
  links,
  events,
  coupleNames,
  dateLabel,
  timezone,
  nowIso,
  initialTab,
  initialAlbumId,
}: {
  weddingId: string;
  canManage: boolean;
  settings: GallerySettingsDto;
  albums: AlbumDto[];
  links: AccessTokenDto[];
  events: { id: string; name: string }[];
  coupleNames: string;
  dateLabel: string | null;
  timezone: string;
  nowIso: string;
  initialTab: GalleryTab;
  initialAlbumId: string | null;
}) {
  const router = useRouter();
  const toast = useToast();

  const [tab, setTab] = useState<GalleryTab>(
    initialTab !== "photos" && !canManage ? "photos" : initialTab,
  );
  const [albumId, setAlbumId] = useState<string | null>(
    albums.some((album) => album.id === initialAlbumId) ? initialAlbumId : null,
  );
  const [filter, setFilter] = useState<Filter>("all");
  const [columns, setColumns] = useState<"grid" | "large">("grid");
  const [reload, setReload] = useState(0);
  const [page, setPage] = useState<{
    key: string;
    items: AssetDto[];
    cursor: string | null;
    failed: boolean;
  } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [viewer, setViewer] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [albumDrawer, setAlbumDrawer] = useState<{ album: AlbumDto | null } | null>(null);
  const [deletingAlbum, setDeletingAlbum] = useState<AlbumDto | null>(null);
  const track = useRef<HTMLDivElement>(null);

  const album = albums.find((candidate) => candidate.id === albumId) ?? null;
  const { usage, storage, gallery } = settings;
  const meter = storageView(usage.usedBytes, usage.quotaBytes);
  const key = `${reload}|${albumId ?? ""}|${filter}`;
  const items = page?.items ?? [];
  const loading = page?.key !== key;

  // Keep the address in step so a link to an album or tab can be shared and reloaded.
  const goTo = useCallback((nextTab: GalleryTab, nextAlbum: string | null) => {
    setTab(nextTab);
    setAlbumId(nextAlbum);
    setFilter("all");
    setViewer(null);
    const params = new URLSearchParams();
    if (nextTab !== "photos") params.set("tab", nextTab);
    if (nextAlbum) params.set("album", nextAlbum);
    const query = params.toString();
    window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
  }, []);

  useEffect(() => {
    if (tab !== "photos") return;
    const controller = new AbortController();
    fetchAssets(
      weddingId,
      {
        albumId: filter === "root" ? "root" : (albumId ?? undefined),
        favorite: filter === "favorites",
        limit: PAGE,
      },
      controller.signal,
    )
      .then((result) =>
        setPage({ key, items: result.items, cursor: result.nextCursor, failed: false }),
      )
      .catch((error) => {
        if (controller.signal.aborted) return;
        setPage({ key, items: [], cursor: null, failed: true });
        toast({ type: "error", title: "Couldn't load the photos", message: errorMessage(error) });
      });
    return () => controller.abort();
  }, [tab, key, weddingId, albumId, filter, toast]);

  async function loadMore() {
    if (!page?.cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const result = await fetchAssets(weddingId, {
        albumId: filter === "root" ? "root" : (albumId ?? undefined),
        favorite: filter === "favorites",
        cursor: page.cursor,
        limit: PAGE,
      });
      setPage((current) =>
        current
          ? { ...current, items: [...current.items, ...result.items], cursor: result.nextCursor }
          : current,
      );
    } catch (error) {
      toast({ type: "error", title: "Couldn't load more", message: errorMessage(error) });
    } finally {
      setLoadingMore(false);
    }
  }

  function refreshAll() {
    setReload((value) => value + 1);
    router.refresh();
  }

  function replaceItem(asset: AssetDto) {
    setPage((current) => {
      if (!current) return current;
      const leaves =
        (albumId && asset.albumId !== albumId) || (filter === "root" && asset.albumId !== null);
      return {
        ...current,
        items: leaves
          ? current.items.filter((item) => item.id !== asset.id)
          : current.items.map((item) => (item.id === asset.id ? asset : item)),
      };
    });
    router.refresh();
  }

  function removeItem(assetId: string) {
    setPage((current) =>
      current
        ? { ...current, items: current.items.filter((item) => item.id !== assetId) }
        : current,
    );
    router.refresh();
  }

  async function toggleFavorite(photo: AssetDto) {
    try {
      replaceItem(
        await updateAsset(weddingId, photo.id, photo.version, { isFavorite: !photo.isFavorite }),
      );
    } catch (error) {
      toast({
        type: "error",
        title: "Couldn't change the favourite",
        message: errorMessage(error),
      });
    }
  }

  function moveViewer(next: number) {
    setViewer(next);
    // Near the end of what is loaded: fetch the next page so the viewer never runs dry.
    if (next >= items.length - 3) void loadMore();
  }

  const totalKnown =
    filter === "all"
      ? album
        ? album.photoCount
        : usage.photoCount
      : page?.cursor
        ? items.length + 1
        : items.length;

  const tabs: { id: GalleryTab; label: string; note?: string; count?: number }[] = [
    { id: "photos", label: "Photos" },
    ...(canManage
      ? ([
          {
            id: "approval",
            label: "Needs approval",
            count: usage.pendingReviewCount,
            note: "(owners & admins)",
          },
          { id: "sharing", label: "Sharing and settings", note: "(owners & admins)" },
        ] as const)
      : []),
  ];

  const tile = (index: number) => ALBUM_TINTS[index % ALBUM_TINTS.length]!;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-headline-lg font-normal tracking-tight text-[#2A2622]">
            Gallery
          </h1>
          <p className="mt-1 font-body-md text-body-md text-[#686F6A]">
            Every photo from your wedding, shared the way you choose.
          </p>
        </div>
        <button
          type="button"
          disabled={!storage.configured}
          onClick={() => setUploading(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 font-body-sm text-body-sm font-medium text-on-primary shadow-sm transition-all hover:bg-tertiary active:scale-[0.99] disabled:opacity-50"
        >
          <Icon name="add_photo_alternate" className="text-[20px]" />
          Upload photos
        </button>
      </div>

      {!storage.configured ? (
        <div
          role="alert"
          className="flex gap-3 rounded-xl border border-[#B5714A]/30 bg-[#F8EDE4] p-4 font-body-sm text-body-sm text-[#7A4527]"
        >
          <Icon name="warning" className="shrink-0 text-[20px] text-[#A0623C]" />
          <p>
            Photo storage isn&apos;t set up on this server yet, so photos can&apos;t be added. Ask
            whoever runs the app to finish the setup.
          </p>
        </div>
      ) : null}

      <section
        aria-label="Storage"
        className={`rounded-2xl border p-5 shadow-sm ${
          meter.nearFull
            ? "border-[#B5714A]/40 bg-[#FBF1E9]"
            : "border-[#2A2622]/[0.08] bg-surface-container-lowest"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className={`flex h-10 w-10 items-center justify-center rounded-full ${
                meter.nearFull ? "bg-[#B5714A]/15 text-[#A0623C]" : "bg-[#EBF2EE] text-[#1F4D3D]"
              }`}
            >
              <Icon name={meter.nearFull ? "warning" : "cloud"} className="text-[22px]" />
            </span>
            <div>
              <p className="font-label-md text-label-md font-semibold text-[#2A2622]">
                {meter.label}
              </p>
              <p className="font-body-sm text-body-sm text-[#686F6A]">
                Includes photos guests have added.
              </p>
            </div>
          </div>
          <span
            className={`rounded-full px-3 py-1 font-label-sm text-label-sm font-semibold ${
              meter.nearFull ? "bg-[#B5714A]/15 text-[#7A4527]" : "bg-[#EBF2EE] text-[#1F4D3D]"
            }`}
          >
            {meter.nearFull ? `${meter.percent}% full` : `${meter.percent}% used`}
          </span>
        </div>
        <div
          role="progressbar"
          aria-label="Storage used"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={meter.percent}
          className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#2A2622]/10"
        >
          <div
            className={`h-full rounded-full ${meter.nearFull ? "bg-[#B5714A]" : "bg-[#1F4D3D]"}`}
            style={{ width: `${Math.max(meter.percent, usage.usedBytes > 0 ? 2 : 0)}%` }}
          />
        </div>
        {meter.nearFull ? (
          <p className="mt-3 flex items-center gap-2 font-body-sm text-body-sm text-[#7A4527]">
            <Icon name="info" className="text-[16px]" />
            Almost full. Delete some photos to make room for more.
          </p>
        ) : null}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2A2622]/[0.1]">
        <div role="tablist" aria-label="Gallery sections" className="flex flex-wrap gap-x-7">
          {tabs.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              id={`tab-${entry.id}`}
              aria-selected={tab === entry.id}
              aria-controls="gallery-panel"
              onClick={() => goTo(entry.id, null)}
              className={`-mb-px flex items-center gap-2 border-b-2 pb-3 font-label-md text-label-md transition-colors ${
                tab === entry.id
                  ? "border-[#1F4D3D] font-semibold text-[#1F4D3D]"
                  : "border-transparent text-[#686F6A] hover:text-[#2A2622]"
              }`}
            >
              {entry.label}
              {entry.count ? (
                <span className="rounded-full bg-[#B5714A] px-2 py-0.5 font-label-sm text-[11px] font-semibold text-white">
                  {entry.count}
                </span>
              ) : null}
              {entry.note ? (
                <span className="hidden font-label-sm text-label-sm font-normal text-[#686F6A] xl:inline">
                  {entry.note}
                </span>
              ) : null}
            </button>
          ))}
        </div>
        <span className="mb-3 flex items-center gap-1.5 font-label-sm text-label-sm text-[#686F6A]">
          <Icon name={gallery.allowGuestUploads ? "lock_open" : "lock"} className="text-[16px]" />
          {gallery.allowGuestUploads ? "Guest uploads permitted" : "Guest uploads are off"}
        </span>
      </div>

      <div id="gallery-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === "approval" && canManage ? (
          <ApprovalQueue
            weddingId={weddingId}
            albums={albums}
            timezone={timezone}
            nowIso={nowIso}
          />
        ) : tab === "sharing" && canManage ? (
          <SharingSettings
            weddingId={weddingId}
            gallery={gallery}
            albums={albums}
            links={links}
            timezone={timezone}
            coupleNames={coupleNames}
            dateLabel={dateLabel}
          />
        ) : (
          <div className="space-y-8">
            {albumId && !album ? (
              <div
                className="py-8 text-center font-body-md text-body-md text-[#686F6A]"
                role="status"
              >
                <p>Opening album…</p>
                <button
                  type="button"
                  onClick={() => goTo("photos", null)}
                  className="mt-2 font-label-md text-label-md font-semibold text-[#1F4D3D] hover:underline"
                >
                  Back to the gallery
                </button>
              </div>
            ) : album ? (
              <AlbumHeader
                album={album}
                onBack={() => goTo("photos", null)}
                onEdit={() => setAlbumDrawer({ album })}
                onUpload={() => setUploading(true)}
                uploadDisabled={!storage.configured}
              />
            ) : (
              <section aria-labelledby="albums-title" className="space-y-4">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <h2
                      id="albums-title"
                      className="font-headline-sm text-headline-sm font-normal text-primary"
                    >
                      Albums
                    </h2>
                    <p className="font-body-sm text-body-sm text-[#686F6A]">
                      {albums.length} {albums.length === 1 ? "collection" : "active collections"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {(["chevron_left", "chevron_right"] as const).map((icon) => (
                      <button
                        key={icon}
                        type="button"
                        aria-label={
                          icon === "chevron_left" ? "Scroll albums left" : "Scroll albums right"
                        }
                        onClick={() =>
                          track.current?.scrollBy({
                            left: icon === "chevron_left" ? -320 : 320,
                            behavior: "smooth",
                          })
                        }
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-[#2A2622]/15 text-[#2A2622] transition-colors hover:bg-[#F2ECE3]"
                      >
                        <Icon name={icon} className="text-[20px]" />
                      </button>
                    ))}
                  </div>
                </div>
                <div
                  ref={track}
                  className="custom-scrollbar -mx-1 flex gap-4 overflow-x-auto px-1 pb-3"
                >
                  {albums.map((entry, index) => (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => goTo("photos", entry.id)}
                      className="group w-48 shrink-0 overflow-hidden rounded-xl border border-[#2A2622]/[0.08] bg-surface-container-lowest text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus:ring-2 focus:ring-[#B5714A] focus:outline-none"
                    >
                      <span
                        className="relative block aspect-[4/3] overflow-hidden"
                        style={{ background: tile(index) }}
                      >
                        {entry.coverUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={entry.coverUrl}
                            alt=""
                            loading="lazy"
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <span className="flex h-full items-center justify-center font-headline-lg text-[44px] text-[#2A2622]/40">
                            {entry.title.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </span>
                      <span className="block space-y-1 p-3.5">
                        <span className="block truncate font-label-md text-label-md font-semibold text-[#2A2622]">
                          {entry.title}
                        </span>
                        <span className="flex items-center justify-between gap-2 font-label-sm text-label-sm text-[#686F6A]">
                          <span className="truncate">{entry.eventName ?? "No linked event"}</span>
                          <span className="shrink-0">
                            {entry.photoCount} {entry.photoCount === 1 ? "photo" : "photos"}
                          </span>
                        </span>
                      </span>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setAlbumDrawer({ album: null })}
                    className="flex w-48 shrink-0 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#2A2622]/20 p-4 text-center text-[#2A2622]/75 transition-colors hover:border-[#1F4D3D] hover:bg-[#EBF2EE]/50 hover:text-[#1F4D3D]"
                  >
                    <Icon name="add" className="text-[26px]" />
                    <span className="font-label-md text-label-md font-semibold">New album</span>
                    <span className="font-body-sm text-body-sm">
                      Organise by ceremony or guest list
                    </span>
                  </button>
                </div>
              </section>
            )}

            <section aria-label="Photos" className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div
                    role="radiogroup"
                    aria-label="Filter photos"
                    className="inline-flex rounded-full border border-[#2A2622]/10 bg-surface-container-lowest p-1"
                  >
                    {(
                      [
                        ["all", "All"],
                        ["favorites", "Favourites"],
                        ...(album ? [] : [["root", "No album"]]),
                      ] as [Filter, string][]
                    ).map(([value, text]) => (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={filter === value}
                        onClick={() => setFilter(value)}
                        className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 font-label-md text-label-md transition-colors ${
                          filter === value
                            ? "bg-[#1F4D3D] font-semibold text-[#FAF6F0]"
                            : "text-[#2A2622]/75 hover:bg-[#F2ECE3]"
                        }`}
                      >
                        {value === "favorites" ? (
                          <Icon name="star" className="text-[16px]" />
                        ) : null}
                        {text}
                      </button>
                    ))}
                  </div>
                  {!album && albums.length > 0 ? (
                    <Select
                      variant="pill"
                      prefix="Album:"
                      ariaLabel="Open an album"
                      value=""
                      onChange={(value) => value && goTo("photos", value)}
                      options={[
                        { value: "", label: "All" },
                        ...albums.map((entry) => ({ value: entry.id, label: entry.title })),
                      ]}
                    />
                  ) : null}
                </div>
                <div
                  role="radiogroup"
                  aria-label="Grid size"
                  className="inline-flex rounded-lg border border-[#2A2622]/10 bg-surface-container-lowest p-1"
                >
                  {(
                    [
                      ["grid", "grid_view", "Smaller photos"],
                      ["large", "splitscreen", "Larger photos"],
                    ] as const
                  ).map(([value, icon, text]) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={columns === value}
                      aria-label={text}
                      onClick={() => setColumns(value)}
                      className={`rounded-md p-1.5 transition-colors ${
                        columns === value
                          ? "bg-[#EBF2EE] text-[#1F4D3D]"
                          : "text-[#686F6A] hover:bg-[#F2ECE3]"
                      }`}
                    >
                      <Icon name={icon} className="text-[20px]" />
                    </button>
                  ))}
                </div>
              </div>

              {page === null ? (
                <p
                  className="py-16 text-center font-body-md text-body-md text-[#686F6A]"
                  role="status"
                >
                  Loading photos…
                </p>
              ) : items.length === 0 && !loading ? (
                <EmptyPhotos
                  filtered={filter !== "all" || album !== null}
                  failed={page.failed}
                  canUpload={storage.configured}
                  onUpload={() => setUploading(true)}
                  onNewAlbum={() => setAlbumDrawer({ album: null })}
                  hasAlbum={album !== null}
                />
              ) : (
                <>
                  <ul
                    aria-busy={loading}
                    className={`gap-4 transition-opacity ${loading ? "opacity-60" : ""} ${
                      columns === "grid"
                        ? "columns-2 md:columns-3 xl:columns-4"
                        : "columns-1 md:columns-2"
                    }`}
                  >
                    {items.map((photo, index) => (
                      <li
                        key={photo.id}
                        className="group relative mb-4 break-inside-avoid overflow-hidden rounded-xl bg-[#EFE7DB]"
                      >
                        <button
                          type="button"
                          onClick={() => setViewer(index)}
                          aria-label={`Open ${photo.caption ?? photo.fileName}`}
                          className="block w-full focus:ring-2 focus:ring-[#B5714A] focus:outline-none"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={photo.url}
                            alt={photo.caption ?? photo.fileName}
                            loading="lazy"
                            decoding="async"
                            width={photo.width ?? undefined}
                            height={photo.height ?? undefined}
                            style={{
                              aspectRatio:
                                photo.width && photo.height
                                  ? `${photo.width} / ${photo.height}`
                                  : "4 / 3",
                            }}
                            className="w-full object-cover"
                          />
                        </button>
                        <button
                          type="button"
                          aria-label={
                            photo.isFavorite ? "Remove from favourites" : "Add to favourites"
                          }
                          aria-pressed={photo.isFavorite}
                          onClick={() => void toggleFavorite(photo)}
                          className={`absolute top-2.5 left-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow transition-opacity focus:opacity-100 focus:ring-2 focus:ring-[#B5714A] focus:outline-none ${
                            photo.isFavorite
                              ? "text-[#A0623C] opacity-100"
                              : "text-[#2A2622]/75 opacity-0 group-hover:opacity-100"
                          }`}
                        >
                          <Icon
                            name={photo.isFavorite ? "star" : "star_border"}
                            className="text-[20px]"
                          />
                        </button>
                        <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-[#1A1714]/70 to-transparent px-3 pt-8 pb-2.5 font-label-sm text-label-sm text-white opacity-0 transition-opacity group-hover:opacity-100">
                          <span className="truncate">{photo.fileName}</span>
                          <span className="flex shrink-0 items-center gap-1.5">
                            <span>{VISIBILITY_LABEL[photo.visibility]}</span>
                            <Icon name="visibility" className="text-[18px]" />
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-col items-center gap-3 pt-2">
                    <p className="font-body-sm text-body-sm text-[#686F6A]" aria-live="polite">
                      Showing {items.length} of {Math.max(totalKnown, items.length)}
                      {page.cursor && filter !== "all" ? "+" : ""}
                    </p>
                    {page.cursor ? (
                      <button
                        type="button"
                        onClick={() => void loadMore()}
                        disabled={loadingMore}
                        className="rounded-lg border border-[#D5CCC0] px-6 py-2 font-label-md text-label-md font-medium hover:bg-[#F2ECE3] disabled:opacity-60"
                      >
                        {loadingMore ? "Loading…" : "Load more"}
                      </button>
                    ) : null}
                  </div>
                </>
              )}
            </section>
          </div>
        )}
      </div>

      {viewer !== null && items[viewer] ? (
        <PhotoViewer
          weddingId={weddingId}
          photos={items}
          index={viewer}
          total={totalKnown}
          title={album ? album.title : "Gallery"}
          albums={albums}
          timezone={timezone}
          onIndex={moveViewer}
          onClose={() => setViewer(null)}
          onChanged={replaceItem}
          onDeleted={removeItem}
        />
      ) : null}

      {uploading ? (
        <UploadDrawer
          weddingId={weddingId}
          albums={albums}
          defaultAlbumId={albumId}
          remainingBytes={meter.remainingBytes}
          onClose={(added) => {
            setUploading(false);
            if (added) refreshAll();
          }}
        />
      ) : null}

      {albumDrawer ? (
        <AlbumDrawer
          weddingId={weddingId}
          album={albumDrawer.album}
          events={events}
          onClose={() => setAlbumDrawer(null)}
          onSaved={(saved) => {
            setAlbumDrawer(null);
            // Move to the new album BEFORE refreshing: a refresh started first would be dropped
            // when the address changes under it.
            if (!albumDrawer.album) goTo("photos", saved.id);
            router.refresh();
          }}
          onDelete={
            albumDrawer.album?.canDelete
              ? () => {
                  setDeletingAlbum(albumDrawer.album);
                  setAlbumDrawer(null);
                }
              : undefined
          }
        />
      ) : null}

      {deletingAlbum ? (
        <DeleteAlbumDialog
          weddingId={weddingId}
          album={deletingAlbum}
          onCancel={() => setDeletingAlbum(null)}
          onDeleted={() => {
            setDeletingAlbum(null);
            goTo("photos", null);
            refreshAll();
          }}
        />
      ) : null}
    </div>
  );
}

function AlbumHeader({
  album,
  onBack,
  onEdit,
  onUpload,
  uploadDisabled,
}: {
  album: AlbumDto;
  onBack: () => void;
  onEdit: () => void;
  onUpload: () => void;
  uploadDisabled: boolean;
}) {
  return (
    <section aria-label={`${album.title} album`} className="space-y-4">
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-2 font-body-sm text-body-sm text-[#686F6A]"
      >
        <button type="button" onClick={onBack} className="hover:text-[#1F4D3D] hover:underline">
          Gallery
        </button>
        <span aria-hidden="true">/</span>
        <span aria-current="page" className="font-semibold text-[#2A2622]">
          {album.title}
        </span>
      </nav>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <h2 className="font-headline-lg text-headline-lg font-normal tracking-tight text-[#2A2622]">
            {album.title}
          </h2>
          <div className="flex flex-wrap items-center gap-2 font-label-sm text-label-sm">
            {album.eventName ? (
              <span className="flex items-center gap-1.5 rounded-full bg-[#F5EAE0] px-3 py-1 font-semibold text-[#7A4527]">
                <Icon name="event" className="text-[16px]" />
                {album.eventName}
              </span>
            ) : null}
            <span className="flex items-center gap-1.5 rounded-full bg-[#EBF2EE] px-3 py-1 font-semibold text-[#1F4D3D]">
              <Icon
                name={
                  album.defaultVisibility === "private"
                    ? "lock"
                    : album.defaultVisibility === "guests"
                      ? "group"
                      : "public"
                }
                className="text-[16px]"
              />
              {VISIBILITY_LABEL[album.defaultVisibility]}
            </span>
            <span className="text-[#686F6A]">
              {album.photoCount} {album.photoCount === 1 ? "photo" : "photos"}
            </span>
          </div>
          {album.description ? (
            <p className="max-w-2xl font-body-md text-body-md text-[#686F6A]">
              {album.description}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onEdit}
            className="flex items-center gap-2 rounded-lg border border-[#D5CCC0] px-4 py-2 font-label-md text-label-md font-medium hover:bg-[#F2ECE3]"
          >
            <Icon name="edit" className="text-[18px]" />
            Edit album
          </button>
          <button
            type="button"
            onClick={onUpload}
            disabled={uploadDisabled}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-label-md text-label-md font-medium text-on-primary hover:bg-tertiary disabled:opacity-50"
          >
            <Icon name="cloud_upload" className="text-[18px]" />
            Upload photos
          </button>
        </div>
      </div>
    </section>
  );
}

function EmptyPhotos({
  filtered,
  failed,
  canUpload,
  hasAlbum,
  onUpload,
  onNewAlbum,
}: {
  filtered: boolean;
  failed: boolean;
  canUpload: boolean;
  hasAlbum: boolean;
  onUpload: () => void;
  onNewAlbum: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-2xl border border-dashed border-[#2A2622]/15 bg-surface-container-lowest px-8 py-14 text-center">
      <div className="relative h-20 w-28" aria-hidden="true">
        <span className="absolute bottom-0 left-2 h-16 w-12 rounded-t-full bg-[#E9D8C4]" />
        <span className="absolute top-1 left-12 h-12 w-12 rounded-full bg-[#DCE5DA]" />
        <span className="absolute right-0 bottom-1 h-10 w-14 rounded-md bg-[#EBD3C6]" />
        <Icon
          name="photo_library"
          className="absolute top-6 left-10 text-[34px] text-[#2A2622]/75"
        />
      </div>
      <h3 className="font-headline-sm text-headline-sm font-normal text-primary">
        {failed ? "Couldn't load the photos" : filtered ? "No photos here" : "No photos yet"}
      </h3>
      <p className="font-body-md text-body-md text-on-surface-variant">
        {failed
          ? "Check your connection and try again."
          : filtered
            ? "Nothing matches this view. Try another filter, or add some photos."
            : "Upload your first photos, or create an album to organise them."}
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={onUpload}
          disabled={!canUpload}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-label-md text-label-md font-medium text-on-primary hover:bg-tertiary disabled:opacity-50"
        >
          <Icon name="add_photo_alternate" className="text-[18px]" />
          Upload photos
        </button>
        {!hasAlbum ? (
          <button
            type="button"
            onClick={onNewAlbum}
            className="rounded-lg border border-[#D5CCC0] px-4 py-2 font-label-md text-label-md font-medium hover:bg-[#F2ECE3]"
          >
            New album
          </button>
        ) : null}
      </div>
    </div>
  );
}
