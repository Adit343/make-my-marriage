"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  checkPhotoFile,
  createAlbum,
  memberUploadRoute,
  uploadPhoto,
} from "@/components/gallery/gallery-api";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/client/api-client";
import { MAX_PHOTO_BYTES } from "@/lib/constants/gallery";
import { formatBytes } from "@/lib/gallery/files";
import { useDialogFocus } from "@/components/ui/use-dialog-focus";
import type { AlbumDto } from "@/modules/gallery/gallery.dto";

// Stitch "Gallery Upload Slide-over": a drop zone, which album to add to, and one row per photo
// with its own progress, "Done" or the reason it failed (Remove, or Retry when it may work again).
// Photos go straight to the photo store; this panel only asks for the signed address and confirms.

const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif";
const AT_ONCE = 3;
const NEW_ALBUM = "__new";

interface Row {
  id: number;
  file: File;
  preview: string | null;
  status: "queued" | "uploading" | "done" | "failed";
  progress: number;
  error: string | null;
  /** A failure that might work on another try (a dropped connection), unlike a bad file. */
  retry: boolean;
}

let nextId = 1;

export function UploadDrawer({
  weddingId,
  albums,
  defaultAlbumId,
  remainingBytes,
  onClose,
}: {
  weddingId: string;
  albums: AlbumDto[];
  defaultAlbumId: string | null;
  remainingBytes: number;
  /** Called when the panel closes; `added` says whether any photo was saved. */
  onClose: (added: boolean) => void;
}) {
  const toast = useToast();
  const dialogRef = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  useDialogFocus(dialogRef);

  const [rows, setRows] = useState<Row[]>([]);
  const [albumChoice, setAlbumChoice] = useState(defaultAlbumId ?? "");
  const [newAlbumName, setNewAlbumName] = useState("");
  const [dragging, setDragging] = useState(false);
  const albumPromise = useRef<Promise<string | null> | null>(null);
  const running = useRef(0);
  const queue = useRef<number[]>([]);
  const filesById = useRef(new Map<number, File>());
  const abort = useRef(new AbortController());
  const choiceRef = useRef({ albumChoice, newAlbumName });
  useEffect(() => {
    choiceRef.current = { albumChoice, newAlbumName };
  }, [albumChoice, newAlbumName]);

  const patch = useCallback((id: number, changes: Partial<Row>) => {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...changes } : row)));
  }, []);

  const uploading = rows.some((row) => row.status === "uploading" || row.status === "queued");
  const done = rows.filter((row) => row.status === "done").length;
  const queuedBytes = rows
    .filter((row) => row.status !== "done" && row.status !== "failed")
    .reduce((sum, row) => sum + row.file.size, 0);
  const notEnoughSpace = queuedBytes > remainingBytes;

  const close = useCallback(() => {
    if (uploading) return;
    onClose(done > 0);
  }, [uploading, onClose, done]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [close]);

  // Leaving with uploads still running (the page was closed) stops them.
  useEffect(() => {
    const controller = abort.current;
    const previews = filesById;
    return () => {
      controller.abort();
      previews.current.clear();
    };
  }, []);

  /** The album to add to; a new one is made once, when the first photo starts. */
  function resolveAlbum(): Promise<string | null> {
    const { albumChoice: choice, newAlbumName: name } = choiceRef.current;
    if (choice !== NEW_ALBUM) return Promise.resolve(choice || null);
    albumPromise.current ??= createAlbum(weddingId, {
      title: name.trim() || "New album",
      description: null,
      eventId: null,
      defaultVisibility: "guests",
    }).then((album) => album.id);
    return albumPromise.current;
  }

  const pump = useCallback(() => {
    while (running.current < AT_ONCE && queue.current.length > 0) {
      const id = queue.current.shift()!;
      const file = filesById.current.get(id);
      if (!file) continue;
      running.current += 1;
      patch(id, { status: "uploading", progress: 0, error: null });
      void (async () => {
        try {
          const albumId = await resolveAlbum();
          await uploadPhoto(
            memberUploadRoute(weddingId, albumId),
            file,
            (fraction) => patch(id, { progress: fraction }),
            abort.current.signal,
          );
          patch(id, { status: "done", progress: 1 });
        } catch (error) {
          if (abort.current.signal.aborted) return;
          const message = errorMessage(error);
          const reason = error instanceof Error && !("code" in error) ? error.message : message;
          patch(id, { status: "failed", error: reason, retry: true });
          if (choiceRef.current.albumChoice === NEW_ALBUM) albumPromise.current = null;
        } finally {
          running.current -= 1;
          pump();
        }
      })();
    }
    // `resolveAlbum` only reads refs; `patch` and `weddingId` are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patch, weddingId]);

  function addFiles(list: FileList | File[]) {
    const incoming: Row[] = [];
    for (const file of Array.from(list)) {
      const problem = checkPhotoFile(file);
      const id = nextId++;
      incoming.push({
        id,
        file,
        preview:
          !problem && file.type.startsWith("image/") && !/hei[cf]$/i.test(file.name)
            ? URL.createObjectURL(file)
            : null,
        status: problem ? "failed" : "queued",
        progress: 0,
        error: problem,
        retry: false,
      });
      if (!problem) {
        filesById.current.set(id, file);
        queue.current.push(id);
      }
    }
    if (incoming.length === 0) return;
    setRows((current) => [...current, ...incoming]);
    // Start after the rows exist, so a fast failure finds its row.
    queueMicrotask(pump);
  }

  function retry(id: number) {
    patch(id, { status: "queued", error: null });
    queue.current.push(id);
    pump();
  }

  function remove(id: number) {
    setRows((current) => {
      const row = current.find((candidate) => candidate.id === id);
      if (row?.preview) URL.revokeObjectURL(row.preview);
      return current.filter((candidate) => candidate.id !== id);
    });
    filesById.current.delete(id);
    queue.current = queue.current.filter((queued) => queued !== id);
  }

  const albumNote =
    albumChoice === NEW_ALBUM
      ? "The new album starts with guests able to see its photos."
      : albums.find((album) => album.id === albumChoice)
        ? "New photos take this album's usual visibility."
        : "Photos with no album are private to your team until you change them.";

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-[#2A2622]/25 backdrop-blur-[2px]" onMouseDown={close} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-title"
        className="fixed inset-y-0 right-0 flex w-[480px] max-w-full flex-col border-l border-[#E5DDD2] bg-[#FAF6F0] shadow-2xl"
      >
        <header className="flex-shrink-0 border-b border-[#2A2622]/[0.06] px-8 pt-8 pb-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-label-sm text-label-sm tracking-widest text-[#A0623C] uppercase">
                Add to the gallery
              </p>
              <h2
                id="upload-title"
                className="mt-1 font-headline-md text-headline-md font-normal text-[#2A2622]"
              >
                Upload photos
              </h2>
            </div>
            <button
              type="button"
              aria-label="Close panel"
              onClick={close}
              disabled={uploading}
              className="-mt-1 -mr-2 rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-[#F2ECE3] disabled:opacity-40"
            >
              <Icon name="close" />
            </button>
          </div>
        </header>

        <div className="custom-scrollbar flex-1 space-y-6 overflow-y-auto px-8 py-6">
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              addFiles(event.dataTransfer.files);
            }}
            className={`flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
              dragging ? "border-[#1F4D3D] bg-[#EBF2EE]" : "border-[#2A2622]/20 bg-[#FFFDF9]"
            }`}
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F5EAE0] text-[#A0623C]">
              <Icon name="cloud_upload" className="text-[26px]" />
            </span>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="font-body-md text-body-md font-medium text-[#2A2622] hover:underline focus:underline focus:outline-none"
            >
              Drag photos here, or choose from your device
            </button>
            <p className="font-body-sm text-body-sm text-[#2A2622]/75">
              JPEG, PNG, WebP or HEIC. Up to {MAX_PHOTO_BYTES / (1024 * 1024)} MB each.
            </p>
            <input
              ref={fileInput}
              type="file"
              multiple
              accept={ACCEPT}
              aria-label="Choose photos"
              className="sr-only"
              onChange={(event) => {
                if (event.target.files) addFiles(event.target.files);
                event.target.value = "";
              }}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="upload-album" className="font-label-md text-label-md font-semibold">
              Add to album
            </label>
            <div className="relative">
              <select
                id="upload-album"
                value={albumChoice}
                // Switching mid-way would split one batch across albums.
                disabled={rows.some((row) => row.status !== "failed")}
                onChange={(event) => setAlbumChoice(event.target.value)}
                className="w-full appearance-none rounded-lg border border-[#2A2622]/15 bg-white px-3.5 py-2.5 pr-10 font-body-md text-body-md outline-none focus:border-[#1F4D3D] disabled:opacity-60"
              >
                <option value="">No album</option>
                {albums.map((album) => (
                  <option key={album.id} value={album.id}>
                    {album.title}
                  </option>
                ))}
                <option value={NEW_ALBUM}>+ New album</option>
              </select>
              <Icon
                name="expand_more"
                className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[20px] text-[#2A2622]/75"
              />
            </div>
            {albumChoice === NEW_ALBUM ? (
              <input
                type="text"
                aria-label="New album name"
                placeholder="Album name"
                maxLength={100}
                value={newAlbumName}
                onChange={(event) => setNewAlbumName(event.target.value)}
                disabled={rows.some((row) => row.status !== "failed")}
                className="w-full rounded-lg border border-[#2A2622]/15 bg-white px-3.5 py-2.5 font-body-md text-body-md outline-none focus:border-[#1F4D3D]"
              />
            ) : null}
            <p className="font-body-sm text-body-sm text-[#2A2622]/75">{albumNote}</p>
          </div>

          {rows.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-label-sm text-label-sm tracking-widest text-[#2A2622]/70 uppercase">
                  Files in queue
                </h3>
                <span className="font-label-sm text-label-sm text-[#2A2622]/75">
                  {rows.length} {rows.length === 1 ? "item" : "items"}
                </span>
              </div>
              <ul className="space-y-2.5">
                {rows.map((row) => (
                  <li
                    key={row.id}
                    className="rounded-xl bg-white p-3 shadow-[0_1px_2px_rgba(42,38,34,0.08)]"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-[#F2ECE3] text-[#A0623C]">
                        {row.preview ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={row.preview} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <Icon
                            name={row.file.type.startsWith("video/") ? "movie" : "image"}
                            className="text-[20px]"
                          />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-body-md text-body-md">{row.file.name}</p>
                        <p className="font-label-sm text-label-sm text-[#2A2622]/75">
                          {formatBytes(row.file.size)}
                          {row.status === "failed" ? (
                            <span className="text-[#A0623C]"> · Failed: {row.error}</span>
                          ) : null}
                        </p>
                      </div>
                      <div className="shrink-0 text-right font-label-sm text-label-sm">
                        {row.status === "uploading" ? (
                          <span>Uploading {Math.round(row.progress * 100)}%</span>
                        ) : row.status === "queued" ? (
                          <span className="text-[#2A2622]/75">Waiting</span>
                        ) : row.status === "done" ? (
                          <span className="flex items-center gap-1 text-[#2A2622]/80">
                            <Icon name="check_circle" className="text-[18px] text-[#1F4D3D]" />
                            Done
                          </span>
                        ) : (
                          <span className="flex flex-col items-end gap-1">
                            {row.retry ? (
                              <button
                                type="button"
                                onClick={() => retry(row.id)}
                                className="underline underline-offset-2 hover:text-[#1F4D3D]"
                              >
                                Retry
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => remove(row.id)}
                              className="underline underline-offset-2 hover:text-[#B3261E]"
                            >
                              Remove
                            </button>
                          </span>
                        )}
                      </div>
                    </div>
                    {row.status === "uploading" ? (
                      <div
                        role="progressbar"
                        aria-label={`Uploading ${row.file.name}`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(row.progress * 100)}
                        className="mt-2.5 h-1 overflow-hidden rounded-full bg-[#2A2622]/10"
                      >
                        <div
                          className="h-full rounded-full bg-[#1F4D3D] transition-[width]"
                          style={{ width: `${row.progress * 100}%` }}
                        />
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {notEnoughSpace ? (
            <div
              role="alert"
              className="flex gap-3 rounded-xl border border-[#B5714A]/30 bg-[#F8EDE4] p-4 font-body-sm text-body-sm text-[#7A4527]"
            >
              <Icon name="warning" className="shrink-0 text-[20px] text-[#A0623C]" />
              <div>
                <p className="font-semibold">Not enough space for these photos.</p>
                <p>
                  Your gallery has {formatBytes(remainingBytes)} left. Delete some photos to make
                  room.
                </p>
              </div>
            </div>
          ) : null}
        </div>

        <footer className="flex flex-shrink-0 items-center justify-between gap-3 border-t border-[#E8E1D7] bg-[#FAF6F0]/95 px-8 py-4">
          <p
            className="flex items-center gap-2 font-body-sm text-body-sm text-[#2A2622]/80"
            aria-live="polite"
          >
            <span className="h-2 w-2 rounded-full bg-[#B5714A]" />
            {uploading
              ? "Keep this open until it finishes"
              : rows.length > 0
                ? `${done} of ${rows.length} uploaded`
                : "Nothing added yet"}
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={close}
              disabled={uploading}
              className="rounded-lg border border-[#D5CCC0] px-5 py-2.5 font-label-md text-label-md font-medium text-[#2A2622] transition-colors hover:bg-[#F2ECE3] focus:ring-2 focus:ring-[#B5714A] focus:outline-none disabled:opacity-50"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => {
                if (done === 0 && rows.length === 0) {
                  toast({
                    type: "info",
                    title: "Choose some photos first",
                    message: "Drop them in the box, or tap it to browse.",
                  });
                  return;
                }
                close();
              }}
              disabled={uploading}
              className="rounded-xl bg-[#1F4D3D] px-6 py-2.5 font-label-md text-label-md font-medium text-[#FAF6F0] shadow-sm transition-all hover:bg-[#16382c] focus:ring-2 focus:ring-[#B5714A] focus:ring-offset-2 focus:outline-none disabled:opacity-50"
            >
              Done
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
