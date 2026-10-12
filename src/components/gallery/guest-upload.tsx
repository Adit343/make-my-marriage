"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { GuestHeader } from "@/components/gallery/guest-gallery";
import { checkPhotoFile, guestUploadRoute, uploadPhoto } from "@/components/gallery/gallery-api";
import { Icon } from "@/components/ui/icon";
import { errorMessage } from "@/lib/client/api-client";
import { MAX_DISPLAY_NAME, MAX_PHOTO_BYTES } from "@/lib/constants/gallery";
import { formatBytes } from "@/lib/gallery/files";

// What a guest sees at /gallery/<token>/add (Stitch "Guest Upload Four-State Flow"): A the form,
// B the photos going up, C "thank you, the couple will approve them" or D "added to the gallery".
// Mobile first, 48px targets, no account. The guest only has to type a name.

const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif";
const AT_ONCE = 3;

interface Row {
  id: number;
  file: File;
  preview: string | null;
  status: "ready" | "uploading" | "done" | "failed";
  progress: number;
  error: string | null;
  /** What the server did with it once confirmed. */
  outcome: string | null;
}

let nextId = 1;

export function GuestUpload({
  token,
  coupleNames,
  albumTitle,
  canView,
}: {
  token: string;
  coupleNames: string;
  albumTitle: string | null;
  canView: boolean;
}) {
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [stage, setStage] = useState<"form" | "progress" | "done">("form");
  const library = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);

  const patch = (id: number, changes: Partial<Row>) =>
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...changes } : row)));

  function addFiles(list: FileList | null) {
    if (!list) return;
    const incoming: Row[] = Array.from(list).map((file) => {
      const problem = checkPhotoFile(file);
      return {
        id: nextId++,
        file,
        preview: !problem && !/hei[cf]$/i.test(file.name) ? URL.createObjectURL(file) : null,
        status: problem ? "failed" : "ready",
        progress: 0,
        error: problem,
        outcome: null,
      };
    });
    setRows((current) => [...current, ...incoming]);
  }

  function removeRow(id: number) {
    setRows((current) => {
      const row = current.find((candidate) => candidate.id === id);
      if (row?.preview) URL.revokeObjectURL(row.preview);
      return current.filter((candidate) => candidate.id !== id);
    });
  }

  /** Sends every row that is ready, a few at a time, then moves on when none is left. */
  async function send(ids: number[], files: Map<number, File>) {
    const route = guestUploadRoute(token, name.trim());
    const queue = [...ids];
    const worker = async () => {
      while (queue.length > 0) {
        const id = queue.shift()!;
        const file = files.get(id)!;
        patch(id, { status: "uploading", progress: 0, error: null });
        try {
          const result = await uploadPhoto(route, file, (fraction) =>
            patch(id, { progress: fraction }),
          );
          patch(id, { status: "done", progress: 1, outcome: result.status });
        } catch (error) {
          const reason =
            error instanceof Error && !("code" in error) ? error.message : errorMessage(error);
          patch(id, { status: "failed", error: reason });
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(AT_ONCE, ids.length) }, worker));
  }

  async function start() {
    if (!name.trim()) {
      setNameError(true);
      return;
    }
    const ready = rows.filter((row) => row.status === "ready");
    if (ready.length === 0) return;
    setStage("progress");
    await send(
      ready.map((row) => row.id),
      new Map(ready.map((row) => [row.id, row.file])),
    );
  }

  async function retryFailed() {
    const failed = rows.filter((row) => row.status === "failed" && !checkPhotoFile(row.file));
    await send(
      failed.map((row) => row.id),
      new Map(failed.map((row) => [row.id, row.file])),
    );
  }

  const done = rows.filter((row) => row.status === "done");
  const active = rows.some((row) => row.status === "uploading");
  const waiting = done.some((row) => row.outcome === "pending_review");
  const ready = rows.filter((row) => row.status === "ready");
  const readyBytes = ready.reduce((sum, row) => sum + row.file.size, 0);
  const first = name.trim().split(/\s+/)[0] ?? "";

  function again() {
    for (const row of rows) if (row.preview) URL.revokeObjectURL(row.preview);
    setRows([]);
    setStage("form");
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-background text-body-md text-on-surface shadow-[0_0_60px_-20px_rgba(42,38,34,0.18)]">
      <GuestHeader
        names={coupleNames}
        label={
          stage === "done"
            ? waiting
              ? "Received"
              : "Live now"
            : stage === "progress"
              ? "Syncing"
              : "Live gallery"
        }
      />

      {stage === "form" ? (
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void start();
          }}
          className="flex flex-1 flex-col"
        >
          <div className="flex-1 space-y-6 px-5 pt-8 pb-6">
            <div className="space-y-2">
              <h1 className="font-headline-lg text-headline-lg font-normal text-[#2A2622]">
                Add your photos
              </h1>
              <p className="font-body-md text-body-md text-[#686F6A]">
                Share your favourite moments with {coupleNames}
                {albumTitle ? ` in ${albumTitle}` : ""}.
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="guest-name" className="font-label-md text-label-md font-semibold">
                Your name <span aria-hidden="true">*</span>
              </label>
              <input
                id="guest-name"
                type="text"
                value={name}
                maxLength={MAX_DISPLAY_NAME}
                autoComplete="name"
                aria-required="true"
                aria-invalid={nameError}
                aria-describedby="guest-name-hint"
                onChange={(event) => {
                  setName(event.target.value);
                  setNameError(false);
                }}
                className={`min-h-12 w-full rounded-xl border bg-white px-4 font-body-md text-body-md outline-none focus:border-[#1F4D3D] focus:shadow-[0_0_0_3px_rgba(31,77,61,0.1)] ${
                  nameError ? "border-[#B3261E]" : "border-[#2A2622]/15"
                }`}
              />
              <p
                id="guest-name-hint"
                className={`font-body-sm text-body-sm ${nameError ? "text-[#B3261E]" : "text-[#686F6A]"}`}
              >
                {nameError ? "Please tell us your name" : "So the couple knows who sent them"}
              </p>
            </div>

            <div className="space-y-3">
              <p className="font-label-md text-label-md font-semibold">Select photos</p>
              <button
                type="button"
                onClick={() => library.current?.click()}
                className="flex min-h-28 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#2A2622]/25 bg-white px-4 py-6 text-center transition-colors hover:border-[#1F4D3D] hover:bg-[#EBF2EE]/50 focus:ring-2 focus:ring-[#B5714A] focus:outline-none"
              >
                <Icon name="add_photo_alternate" className="text-[30px] text-[#1F4D3D]" />
                <span className="font-label-md text-label-md font-semibold">
                  Pick from your phone
                </span>
                <span className="font-body-sm text-body-sm text-[#686F6A]">
                  JPEG, PNG, WebP or HEIC. Up to {MAX_PHOTO_BYTES / (1024 * 1024)} MB each.
                </span>
              </button>
              <button
                type="button"
                onClick={() => camera.current?.click()}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#D5CCC0] bg-white font-label-md text-label-md font-medium hover:bg-[#F2ECE3] focus:ring-2 focus:ring-[#B5714A] focus:outline-none"
              >
                <Icon name="photo_camera" className="text-[20px]" />
                Take a photo
              </button>
              <input
                ref={library}
                type="file"
                multiple
                accept={ACCEPT}
                aria-label="Choose photos from your phone"
                className="sr-only"
                onChange={(event) => {
                  addFiles(event.target.files);
                  event.target.value = "";
                }}
              />
              <input
                ref={camera}
                type="file"
                accept="image/*"
                capture="environment"
                aria-label="Take a photo"
                className="sr-only"
                onChange={(event) => {
                  addFiles(event.target.files);
                  event.target.value = "";
                }}
              />
            </div>

            {rows.length > 0 ? (
              <ul className="space-y-2" aria-label="Photos you picked">
                {rows.map((row) => (
                  <li
                    key={row.id}
                    className="flex items-center gap-3 rounded-xl bg-white p-2.5 shadow-[0_1px_2px_rgba(42,38,34,0.08)]"
                  >
                    <Thumb row={row} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-body-sm text-body-sm">{row.file.name}</p>
                      <p
                        className={`font-label-sm text-label-sm ${row.error ? "text-[#A0623C]" : "text-[#686F6A]"}`}
                      >
                        {row.error ? `Can't add: ${row.error}` : formatBytes(row.file.size)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeRow(row.id)}
                      aria-label={`Remove ${row.file.name}`}
                      className="flex h-11 w-11 items-center justify-center rounded-full text-[#686F6A] hover:bg-[#F2ECE3]"
                    >
                      <Icon name="close" className="text-[20px]" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            <p className="flex items-start gap-2 font-body-sm text-body-sm text-[#686F6A]">
              <Icon name="lock" className="mt-0.5 shrink-0 text-[16px]" />
              Your photos go to {coupleNames} only, through a private link.
            </p>
          </div>

          <div className="sticky bottom-0 border-t border-[#2A2622]/10 bg-[#FAF6F0]/95 px-5 py-3 backdrop-blur-md">
            <button
              type="submit"
              disabled={ready.length === 0}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1F4D3D] font-label-md text-label-md font-semibold text-[#FAF6F0] shadow-sm hover:bg-[#16382c] focus:ring-2 focus:ring-[#B5714A] focus:ring-offset-2 focus:outline-none disabled:opacity-50"
            >
              {ready.length === 0
                ? "Choose photos to upload"
                : `Upload ${ready.length} ${ready.length === 1 ? "photo" : "photos"} (${formatBytes(readyBytes)})`}
              {ready.length > 0 ? <Icon name="arrow_forward" className="text-[20px]" /> : null}
            </button>
          </div>
        </form>
      ) : stage === "progress" ? (
        <div className="flex flex-1 flex-col">
          <div className="flex-1 space-y-5 px-5 pt-8 pb-6">
            <div className="space-y-2">
              <h1 className="font-headline-lg text-headline-lg font-normal">
                {active ? "Uploading photos…" : "Almost done"}
              </h1>
              <p className="flex items-center gap-2 font-body-sm text-body-sm text-[#686F6A]">
                <Icon name="info" className="text-[16px]" />
                Keep this page open until it finishes.
              </p>
            </div>
            <ul className="space-y-2.5" aria-live="polite">
              {rows
                .filter((row) => row.status !== "ready")
                .map((row) => (
                  <li
                    key={row.id}
                    className="rounded-xl bg-white p-3 shadow-[0_1px_2px_rgba(42,38,34,0.08)]"
                  >
                    <div className="flex items-center gap-3">
                      <Thumb row={row} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-body-sm text-body-sm">{row.file.name}</p>
                        <p
                          className={`font-label-sm text-label-sm ${row.status === "failed" ? "text-[#A0623C]" : "text-[#686F6A]"}`}
                        >
                          {row.status === "failed"
                            ? `Failed: ${row.error}`
                            : row.status === "uploading"
                              ? `Uploading ${Math.round(row.progress * 100)}%`
                              : `${formatBytes(row.file.size)} · Ready`}
                        </p>
                      </div>
                      {row.status === "done" ? (
                        <span className="flex items-center gap-1 font-label-sm text-label-sm text-[#1F4D3D]">
                          <Icon name="check_circle" className="text-[20px]" />
                          Done
                        </span>
                      ) : row.status === "failed" ? (
                        <button
                          type="button"
                          onClick={() => removeRow(row.id)}
                          className="flex min-h-11 items-center gap-1 px-2 font-label-sm text-label-sm text-[#686F6A] underline"
                        >
                          Remove
                        </button>
                      ) : null}
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
            <p className="flex items-center gap-2 font-body-sm text-body-sm text-[#686F6A]">
              <Icon name="cloud_done" className="text-[18px]" />
              {done.length} of {rows.filter((row) => row.status !== "ready").length} saved
            </p>
          </div>
          <div className="space-y-2 border-t border-[#2A2622]/10 bg-[#FAF6F0]/95 px-5 py-3">
            {!active && rows.some((row) => row.status === "failed" && !checkPhotoFile(row.file)) ? (
              <button
                type="button"
                onClick={() => void retryFailed()}
                className="flex min-h-12 w-full items-center justify-center rounded-xl border border-[#D5CCC0] bg-white font-label-md text-label-md font-medium hover:bg-[#F2ECE3]"
              >
                Try the failed ones again
              </button>
            ) : null}
            <button
              type="button"
              disabled={active || done.length === 0}
              onClick={() => setStage("done")}
              className="flex min-h-12 w-full items-center justify-center rounded-xl bg-[#1F4D3D] font-label-md text-label-md font-semibold text-[#FAF6F0] hover:bg-[#16382c] disabled:opacity-50"
            >
              {active ? "Processing…" : "Continue"}
            </button>
            {!active && done.length === 0 ? (
              <button
                type="button"
                onClick={again}
                className="mx-auto block min-h-11 px-3 font-label-md text-label-md text-[#686F6A] underline"
              >
                Start again
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 py-12 text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-[#1F4D3D] text-[#FAF6F0] ring-8 ring-[#1F4D3D]/10">
            <Icon name="check" className="text-[40px]" />
          </span>
          <h1 className="font-headline-lg text-headline-lg font-normal">Thank you, {first}!</h1>
          {waiting ? (
            <>
              <p className="font-body-md text-body-md text-[#686F6A]">
                Your {done.length === 1 ? "photo" : "photos"} will appear once the couple approves{" "}
                {done.length === 1 ? "it" : "them"}.
              </p>
              <div className="flex w-full gap-3 rounded-xl border border-[#2A2622]/10 bg-surface-container-lowest p-4 text-left">
                <Icon name="verified_user" className="mt-0.5 shrink-0 text-[20px] text-[#A0623C]" />
                <div className="font-body-sm text-body-sm text-[#686F6A]">
                  <p className="font-semibold text-[#2A2622]">Privacy &amp; moderation</p>
                  <p>{coupleNames} review photos before they are shown in the gallery.</p>
                </div>
              </div>
            </>
          ) : (
            <p className="font-body-md text-body-md text-[#686F6A]">
              Your {done.length === 1 ? "photo has" : "photos have"} been added to the gallery.
            </p>
          )}
          <div className="flex w-full flex-col gap-3 pt-2">
            {!waiting && canView ? (
              <Link
                href={`/gallery/${encodeURIComponent(token)}`}
                className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#1F4D3D] font-label-md text-label-md font-semibold text-[#FAF6F0] hover:bg-[#16382c]"
              >
                <Icon name="photo_library" className="text-[20px]" />
                See the gallery
              </Link>
            ) : null}
            <button
              type="button"
              onClick={again}
              className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#D5CCC0] bg-white font-label-md text-label-md font-medium hover:bg-[#F2ECE3]"
            >
              <Icon name="add_photo_alternate" className="text-[20px]" />
              Add more photos
            </button>
          </div>
          <p className="pt-6 font-label-sm text-label-sm text-[#686F6A]">
            Make My Marriage · Guest collective
          </p>
        </div>
      )}
    </div>
  );
}

function Thumb({ row }: { row: Row }) {
  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#F2ECE3] text-[#A0623C]">
      {row.preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={row.preview} alt="" className="h-full w-full object-cover" />
      ) : (
        <Icon name={row.status === "failed" ? "warning" : "image"} className="text-[20px]" />
      )}
    </span>
  );
}

/** The upload page's "uploads are closed" state (the link works but doesn't allow adding photos). */
export function UploadsClosed({
  coupleNames,
  token,
  canView,
}: {
  coupleNames: string;
  token: string;
  canView: boolean;
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-background text-body-md text-on-surface">
      <GuestHeader names={coupleNames} />
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#F5EAE0] text-[#A0623C]">
          <Icon name="lock" className="text-[30px]" />
        </span>
        <h1 className="font-headline-md text-headline-md font-normal">Adding photos is closed</h1>
        <p className="font-body-md text-body-md text-[#686F6A]">
          {coupleNames} aren&apos;t taking new photos through this link right now.
        </p>
        {canView ? (
          <Link
            href={`/gallery/${encodeURIComponent(token)}`}
            className="flex min-h-12 items-center rounded-xl bg-[#1F4D3D] px-7 font-label-md text-label-md font-semibold text-[#FAF6F0]"
          >
            See the gallery
          </Link>
        ) : null}
      </main>
    </div>
  );
}
