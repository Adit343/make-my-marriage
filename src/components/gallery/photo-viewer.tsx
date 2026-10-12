"use client";

import { useEffect, useState } from "react";
import { deleteAsset, updateAsset } from "@/components/gallery/gallery-api";
import { Lightbox } from "@/components/gallery/lightbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Icon, type IconName } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/client/api-client";
import { MEDIA_VISIBILITIES, type MediaVisibility } from "@/lib/constants/enums";
import { MAX_CAPTION } from "@/lib/constants/gallery";
import { formatBytes } from "@/lib/gallery/files";
import {
  addedLabel,
  uploaderName,
  VISIBILITY_ACCESS,
  VISIBILITY_LABEL,
  VISIBILITY_NOTE,
} from "@/lib/gallery/view";
import type { AlbumDto, AssetDto } from "@/modules/gallery/gallery.dto";

const VISIBILITY_ICON: Record<MediaVisibility, IconName> = {
  private: "lock",
  guests: "group",
  public: "public",
};

/**
 * The team's photo viewer: the lightbox with the "Metadata & rights" panel from the Stitch design
 * (caption, favourite, who can see it, which album, download, delete). `mode="preview"` is the
 * approval queue's look at a waiting photo: the picture alone.
 */
export function PhotoViewer({
  weddingId,
  photos,
  index,
  total,
  title,
  albums,
  timezone,
  mode = "manage",
  onIndex,
  onClose,
  onChanged,
  onDeleted,
}: {
  weddingId: string;
  photos: AssetDto[];
  index: number;
  /** How many photos the view holds in all, when known. */
  total: number;
  title: string;
  albums: AlbumDto[];
  timezone: string;
  mode?: "manage" | "preview";
  onIndex: (index: number) => void;
  onClose: () => void;
  onChanged: (asset: AssetDto) => void;
  onDeleted: (assetId: string) => void;
}) {
  const photo = photos[index];
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const toast = useToast();

  // The photo under the viewer was removed (deleted elsewhere): close rather than show nothing.
  useEffect(() => {
    if (!photo) onClose();
  }, [photo, onClose]);
  if (!photo) return null;

  async function remove() {
    setDeleting(true);
    try {
      await deleteAsset(weddingId, photo!.id);
      toast({ type: "success", title: "Photo deleted", message: "It was removed for everyone." });
      setConfirmingDelete(false);
      // Show the next photo, else the previous one, else leave.
      if (photos.length <= 1) onClose();
      else onIndex(Math.min(index, photos.length - 2));
      onDeleted(photo!.id);
    } catch (error) {
      toast({ type: "error", title: "Couldn't delete the photo", message: errorMessage(error) });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Lightbox
        title={title}
        position={index + 1}
        total={Math.max(total, photos.length)}
        url={photo.url}
        alt={photo.caption ?? photo.fileName}
        hasPrev={index > 0}
        hasNext={index < photos.length - 1}
        onPrev={() => onIndex(index - 1)}
        onNext={() => onIndex(index + 1)}
        onClose={onClose}
        keysPaused={confirmingDelete}
        footer={
          mode === "manage" ? (
            <span className="flex items-center gap-2">
              <Icon name="lock_open" className="text-[16px]" />
              {VISIBILITY_ACCESS[photo.visibility]}
            </span>
          ) : null
        }
        inspector={
          mode === "manage" ? (
            <Inspector
              key={photo.id}
              weddingId={weddingId}
              photo={photo}
              albums={albums}
              timezone={timezone}
              onChanged={onChanged}
              onDelete={() => setConfirmingDelete(true)}
            />
          ) : undefined
        }
      />
      {confirmingDelete ? (
        <ConfirmDialog
          title="Delete this photo?"
          confirmLabel="Delete photo"
          danger
          busy={deleting}
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={remove}
        >
          It will be removed for everyone, including anyone with a gallery link. This can&apos;t be
          undone.
        </ConfirmDialog>
      ) : null}
    </>
  );
}

function Inspector({
  weddingId,
  photo,
  albums,
  timezone,
  onChanged,
  onDelete,
}: {
  weddingId: string;
  photo: AssetDto;
  albums: AlbumDto[];
  timezone: string;
  onChanged: (asset: AssetDto) => void;
  onDelete: () => void;
}) {
  const toast = useToast();
  const [caption, setCaption] = useState(photo.caption ?? "");
  const [focused, setFocused] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save(changes: Parameters<typeof updateAsset>[3]) {
    setSaving(true);
    try {
      onChanged(await updateAsset(weddingId, photo.id, photo.version, changes));
    } catch (error) {
      toast({ type: "error", title: "Couldn't save the change", message: errorMessage(error) });
      setCaption(photo.caption ?? "");
    } finally {
      setSaving(false);
    }
  }

  function saveCaption() {
    setFocused(false);
    const next = caption.trim();
    if (next === (photo.caption ?? "")) return;
    void save({ caption: next === "" ? null : next });
  }

  return (
    <>
      <div className="space-y-6 p-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-label-sm text-label-sm tracking-widest text-[#2A2622]/75 uppercase">
              Metadata &amp; rights
            </p>
            <span className="flex items-center gap-1 font-label-sm text-label-sm font-medium text-[#A0623C]">
              <Icon name="verified_user" className="text-[14px]" />
              Original quality
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EFE7DB] font-label-md text-label-md font-semibold text-[#2A2622]"
            >
              {uploaderName(photo.uploadedBy).charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <h2 className="truncate font-headline-sm text-headline-sm font-normal">
                Added by {uploaderName(photo.uploadedBy)}
              </h2>
              <p className="flex items-center gap-1.5 font-body-sm text-body-sm text-[#2A2622]/70">
                <Icon name="calendar_today" className="text-[14px]" />
                {addedLabel(photo.createdAt, timezone)}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2 border-t border-[#2A2622]/[0.08] pt-5">
          <div className="flex items-center justify-between">
            <label htmlFor="photo-caption" className="font-label-md text-label-md font-semibold">
              Caption
            </label>
            {focused ? (
              <span className="flex items-center gap-1.5 font-label-sm text-label-sm text-[#1F4D3D]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#1F4D3D]" />
                Editing
              </span>
            ) : null}
          </div>
          <div
            className={`rounded-lg border bg-white p-3 transition-shadow ${
              focused
                ? "border-[#1F4D3D] shadow-[0_0_0_3px_rgba(31,77,61,0.1)]"
                : "border-[#2A2622]/15"
            }`}
          >
            <textarea
              id="photo-caption"
              value={caption}
              maxLength={MAX_CAPTION}
              rows={3}
              placeholder="Add a caption"
              onFocus={() => setFocused(true)}
              onBlur={saveCaption}
              onChange={(event) => setCaption(event.target.value)}
              className="w-full resize-none bg-transparent font-body-md text-body-md outline-none placeholder:text-[#2A2622]/35"
            />
            <p className="text-right font-label-sm text-label-sm text-[#2A2622]/75">
              {caption.length}/{MAX_CAPTION}
            </p>
          </div>
          <p className="font-body-sm text-body-sm text-[#2A2622]/75">
            Shown under the photo to anyone who can see it.
          </p>
        </div>

        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-white p-4 shadow-[0_1px_2px_rgba(42,38,34,0.06)]">
          <span className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F5EAE0] text-[#A0623C]">
              <Icon name={photo.isFavorite ? "star" : "star_border"} className="text-[20px]" />
            </span>
            <span>
              <span className="block font-label-md text-label-md font-semibold">Favourite</span>
              <span className="block font-body-sm text-body-sm text-[#2A2622]/75">
                Keep it in your favourites
              </span>
            </span>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={photo.isFavorite}
            disabled={saving}
            onChange={(event) => void save({ isFavorite: event.target.checked })}
            className="peer sr-only"
          />
          <span
            aria-hidden="true"
            className="relative h-6 w-11 shrink-0 rounded-full bg-[#2A2622]/20 transition-colors peer-checked:bg-[#1F4D3D] peer-checked:[&>span]:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-[#B5714A] peer-focus-visible:ring-offset-2"
          >
            <span className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform" />
          </span>
        </label>

        <div className="space-y-2">
          <p id="visibility-label" className="font-label-md text-label-md font-semibold">
            Who can see it
          </p>
          <div
            role="radiogroup"
            aria-labelledby="visibility-label"
            className="grid grid-cols-3 gap-1 rounded-xl bg-[#EFE7DB]/70 p-1"
          >
            {MEDIA_VISIBILITIES.map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={photo.visibility === value}
                disabled={saving}
                onClick={() => {
                  if (photo.visibility !== value) void save({ visibility: value });
                }}
                className={`flex flex-col items-center gap-1 rounded-lg px-2 py-2.5 font-label-sm text-label-sm transition-all ${
                  photo.visibility === value
                    ? "bg-white font-semibold text-[#1F4D3D] shadow-sm ring-1 ring-[#1F4D3D]/25"
                    : "text-[#2A2622]/70 hover:bg-white/60"
                }`}
              >
                <Icon name={VISIBILITY_ICON[value]} className="text-[18px]" />
                {VISIBILITY_LABEL[value]}
              </button>
            ))}
          </div>
          <div className="flex gap-2 rounded-lg border border-[#2A2622]/10 bg-white/60 p-3 font-body-sm text-body-sm text-[#2A2622]/75">
            <Icon name="info" className="mt-0.5 shrink-0 text-[16px]" />
            <p>{VISIBILITY_NOTE[photo.visibility]}</p>
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="photo-album" className="font-label-md text-label-md font-semibold">
            Album
          </label>
          <div className="relative">
            <select
              id="photo-album"
              value={photo.albumId ?? ""}
              disabled={saving}
              onChange={(event) => void save({ albumId: event.target.value || null })}
              className="w-full appearance-none rounded-lg border border-[#2A2622]/15 bg-white px-3.5 py-2.5 pr-10 font-body-md text-body-md outline-none focus:border-[#1F4D3D]"
            >
              <option value="">No album</option>
              {albums.map((album) => (
                <option key={album.id} value={album.id}>
                  {album.title}
                </option>
              ))}
            </select>
            <Icon
              name="expand_more"
              className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[20px] text-[#2A2622]/75"
            />
          </div>
        </div>
      </div>

      <div className="mt-auto space-y-3 border-t border-[#2A2622]/[0.08] p-6">
        <a
          href={photo.downloadUrl}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#D5CCC0] bg-white px-4 py-2.5 font-label-md text-label-md font-medium transition-colors hover:bg-[#F2ECE3]"
        >
          <Icon name="download" className="text-[18px]" />
          Download original ({formatBytes(photo.sizeBytes)})
        </a>
        {photo.canDelete ? (
          <button
            type="button"
            onClick={onDelete}
            className="mx-auto flex items-center gap-1.5 font-label-md text-label-md font-medium text-[#B3261E] hover:underline"
          >
            <Icon name="delete" className="text-[18px]" />
            Delete photo
          </button>
        ) : null}
      </div>
    </>
  );
}
