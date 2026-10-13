"use client";

import { useEffect, useState } from "react";
import {
  createAlbum,
  deleteAlbum,
  fetchAssets,
  updateAlbum,
} from "@/components/gallery/gallery-api";
import { DrawerShell } from "@/components/finance/drawer-shell";
import { FIELD, LABEL, SelectField } from "@/components/finance/ui";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Icon, type IconName } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/client/api-client";
import { MEDIA_VISIBILITIES, type MediaVisibility } from "@/lib/constants/enums";
import { MAX_ALBUM_DESCRIPTION, MAX_ALBUM_TITLE } from "@/lib/constants/gallery";
import { VISIBILITY_LABEL } from "@/lib/gallery/view";
import type { AlbumDto, AssetDto } from "@/modules/gallery/gallery.dto";

const ICON: Record<MediaVisibility, IconName> = {
  private: "lock",
  guests: "group",
  public: "public",
};

/** Stitch "Album Page & Edit/Delete Modals": the 480px Edit album slide-over (also used to add one). */
export function AlbumDrawer({
  weddingId,
  album,
  events,
  onClose,
  onSaved,
  onDelete,
}: {
  weddingId: string;
  /** The album being edited, or null to make a new one. */
  album: AlbumDto | null;
  events: { id: string; name: string }[];
  onClose: () => void;
  onSaved: (album: AlbumDto) => void;
  /** Edit mode only: the person chose "Delete album". */
  onDelete?: () => void;
}) {
  const toast = useToast();
  const [title, setTitle] = useState(album?.title ?? "");
  const [description, setDescription] = useState(album?.description ?? "");
  const [eventId, setEventId] = useState(album?.eventId ?? "");
  const [visibility, setVisibility] = useState<MediaVisibility>(
    album?.defaultVisibility ?? "guests",
  );
  const [coverId, setCoverId] = useState<string | null>(album?.coverAssetId ?? null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [choosingCover, setChoosingCover] = useState(false);
  const [candidates, setCandidates] = useState<AssetDto[] | null>(null);

  // Only the album's own photos can be its cover; loaded when the strip is first opened.
  useEffect(() => {
    if (!choosingCover || candidates !== null || !album) return;
    let cancelled = false;
    fetchAssets(weddingId, { albumId: album.id, limit: 60 })
      .then((page) => {
        if (!cancelled) setCandidates(page.items);
      })
      .catch(() => {
        if (!cancelled) setCandidates([]);
      });
    return () => {
      cancelled = true;
    };
  }, [choosingCover, candidates, album, weddingId]);

  const coverUrl =
    candidates?.find((photo) => photo.id === coverId)?.url ??
    (coverId === (album?.coverAssetId ?? null) ? album?.coverUrl : null) ??
    null;

  async function save() {
    if (!title.trim()) {
      setError("Give the album a name");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const saved = album
        ? await updateAlbum(weddingId, album.id, album.version, {
            title: title.trim(),
            description: description.trim() || null,
            eventId: eventId || null,
            defaultVisibility: visibility,
            coverAssetId: coverId,
          })
        : await createAlbum(weddingId, {
            title: title.trim(),
            description: description.trim() || null,
            eventId: eventId || null,
            defaultVisibility: visibility,
          });
      toast({
        type: "success",
        title: album ? "Album saved" : "Album created",
        message: title.trim(),
      });
      onSaved(saved);
    } catch (failure) {
      setError(errorMessage(failure));
      setSaving(false);
    }
  }

  return (
    <DrawerShell
      id="album-drawer"
      title={album ? "Edit album" : "New album"}
      subtitle={
        album
          ? "Manage details, visibility and the cover photo."
          : "Organise photos by ceremony, or by who took them."
      }
      widthClass="w-[480px]"
      saveLabel={album ? "Save album" : "Create album"}
      saving={saving}
      onClose={onClose}
      onSubmit={save}
    >
      {error ? (
        <p
          role="alert"
          className="rounded-lg bg-[#FCEDEC] px-3.5 py-2.5 font-body-sm text-body-sm text-[#B3261E]"
        >
          {error}
        </p>
      ) : null}

      <div className="space-y-2">
        <label htmlFor="album-title" className={LABEL}>
          Album name
        </label>
        <input
          id="album-title"
          type="text"
          value={title}
          maxLength={MAX_ALBUM_TITLE}
          autoFocus
          onChange={(event) => setTitle(event.target.value)}
          className={FIELD}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="album-description" className={LABEL}>
          Description
        </label>
        <textarea
          id="album-description"
          value={description}
          maxLength={MAX_ALBUM_DESCRIPTION}
          rows={3}
          onChange={(event) => setDescription(event.target.value)}
          className={`${FIELD} resize-none`}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="album-event" className={LABEL}>
          Linked event
        </label>
        <SelectField id="album-event" value={eventId} onChange={setEventId} icon="event">
          <option value="">No linked event</option>
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.name}
            </option>
          ))}
        </SelectField>
      </div>

      <div className="space-y-2">
        <p id="album-visibility" className={LABEL}>
          Default visibility for new photos
        </p>
        <div
          role="radiogroup"
          aria-labelledby="album-visibility"
          className="grid grid-cols-3 gap-1 rounded-xl bg-[#EFE7DB]/70 p-1"
        >
          {MEDIA_VISIBILITIES.map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={visibility === value}
              onClick={() => setVisibility(value)}
              className={`flex items-center justify-center gap-2 rounded-lg px-2 py-2.5 font-label-md text-label-md transition-all ${
                visibility === value
                  ? "bg-white font-semibold text-[#1F4D3D] shadow-sm ring-1 ring-[#1F4D3D]/25"
                  : "text-[#2A2622]/70 hover:bg-white/60"
              }`}
            >
              <Icon name={ICON[value]} className="text-[18px]" />
              {VISIBILITY_LABEL[value]}
            </button>
          ))}
        </div>
        <p className="font-body-sm text-body-sm text-[#2A2622]/75">
          Only affects photos you add from now on. Existing photos keep their own setting.
        </p>
      </div>

      {album ? (
        <div className="space-y-3">
          <p className={LABEL}>Cover photo</p>
          <div className="flex items-center gap-4 rounded-xl border border-[#2A2622]/10 bg-white p-3">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#F2ECE3] text-[#A0623C]">
              {coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={coverUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <Icon name="image" className="text-[24px]" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-body-sm text-body-sm text-[#2A2622]/75">
                {coverId ? "A photo you chose" : "The newest photo, until you choose one"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setChoosingCover((value) => !value)}
              aria-expanded={choosingCover}
              className="flex shrink-0 items-center gap-1 font-label-md text-label-md font-medium text-[#1F4D3D] hover:underline"
            >
              Choose from this album
              <Icon name="arrow_forward" className="text-[16px]" />
            </button>
          </div>
          {choosingCover ? (
            candidates === null ? (
              <p className="font-body-sm text-body-sm text-[#2A2622]/75">Loading photos…</p>
            ) : candidates.length === 0 ? (
              <p className="font-body-sm text-body-sm text-[#2A2622]/75">
                This album has no photos yet.
              </p>
            ) : (
              <ul className="grid grid-cols-4 gap-2" aria-label="Photos in this album">
                {candidates.map((photo) => (
                  <li key={photo.id}>
                    <button
                      type="button"
                      aria-pressed={coverId === photo.id}
                      aria-label={`Use ${photo.fileName} as the cover`}
                      onClick={() => setCoverId(photo.id)}
                      className={`relative block aspect-square w-full overflow-hidden rounded-lg ring-offset-2 focus:ring-2 focus:ring-[#B5714A] focus:outline-none ${
                        coverId === photo.id ? "ring-2 ring-[#1F4D3D]" : ""
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.url}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                      {coverId === photo.id ? (
                        <span className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#1F4D3D] text-white">
                          <Icon name="check" className="text-[14px]" />
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : null}
        </div>
      ) : null}

      {album && onDelete ? (
        <div className="border-t border-[#2A2622]/[0.08] pt-5">
          <button
            type="button"
            onClick={onDelete}
            className="flex items-center gap-2 font-label-md text-label-md font-medium text-[#B3261E] hover:underline"
          >
            <Icon name="delete" className="text-[18px]" />
            Delete album
          </button>
        </div>
      ) : null}
    </DrawerShell>
  );
}

/** What happens to an album's photos when it is deleted: never decided silently (API Design §12.1). */
export function DeleteAlbumDialog({
  weddingId,
  album,
  onCancel,
  onDeleted,
}: {
  weddingId: string;
  album: AlbumDto;
  onCancel: () => void;
  onDeleted: () => void;
}) {
  const toast = useToast();
  const [choice, setChoice] = useState<"move_to_root" | "delete">("move_to_root");
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    try {
      await deleteAlbum(weddingId, album.id, choice);
      toast({
        type: "success",
        title: `${album.title} deleted`,
        message:
          choice === "delete"
            ? "Its photos were deleted too."
            : "Its photos are still in the gallery.",
      });
      onDeleted();
    } catch (error) {
      toast({ type: "error", title: "Couldn't delete the album", message: errorMessage(error) });
      setBusy(false);
    }
  }

  const options: { value: "move_to_root" | "delete"; title: string; note: string }[] = [
    {
      value: "move_to_root",
      title: "Move them to the main gallery",
      note: "Photos stay, just without an album",
    },
    {
      value: "delete",
      title: "Delete the photos too",
      note: "They'll be removed for everyone, for good",
    },
  ];

  return (
    <ConfirmDialog
      title={`Delete ${album.title}?`}
      confirmLabel="Delete album"
      danger
      busy={busy}
      onCancel={onCancel}
      onConfirm={confirm}
    >
      <p className="mb-4">
        {album.photoCount === 0
          ? "This album has no photos."
          : `This album has ${album.photoCount} ${album.photoCount === 1 ? "photo" : "photos"}. What should happen to them?`}
      </p>
      <fieldset className="space-y-2">
        <legend className="sr-only">What happens to the photos</legend>
        {options.map((option) => (
          <label
            key={option.value}
            className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors ${
              choice === option.value
                ? "border-[#1F4D3D] bg-[#EBF2EE]"
                : "border-[#2A2622]/15 hover:bg-[#F2ECE3]/60"
            }`}
          >
            <input
              type="radio"
              name="album-photos"
              value={option.value}
              checked={choice === option.value}
              onChange={() => setChoice(option.value)}
              className="mt-1 accent-[#1F4D3D]"
            />
            <span>
              <span className="block font-label-md text-label-md font-semibold text-[#2A2622]">
                {option.title}
              </span>
              <span className="block font-body-sm text-body-sm text-[#2A2622]/70">
                {option.note}
              </span>
            </span>
          </label>
        ))}
      </fieldset>
    </ConfirmDialog>
  );
}
