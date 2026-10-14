"use client";

import { DateField } from "@/components/ui/date-field";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DrawerShell } from "@/components/finance/drawer-shell";
import { FIELD, LABEL, SelectField } from "@/components/finance/ui";
import { createLink, revokeLink, updateGallery } from "@/components/gallery/gallery-api";
import { QrDialog } from "@/components/gallery/qr-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Icon, type IconName } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/client/api-client";
import { MAX_TOKEN_LABEL } from "@/lib/constants/gallery";
import { endOfDayIso, expiryLabel } from "@/lib/gallery/view";
import { todayIn } from "@/lib/dates";
import type { AccessTokenDto, AlbumDto, GalleryDto } from "@/modules/gallery/gallery.dto";

// Stitch "Gallery Sharing & Settings": whether guests may add photos, whether those wait for
// approval, and every shared link (each one a QR code too) with its scope, what it allows, when it
// ends and a way to stop it at once.

function Switch({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (value: boolean) => void;
}) {
  return (
    <label
      className={`relative inline-flex shrink-0 ${disabled ? "opacity-50" : "cursor-pointer"}`}
    >
      <input
        type="checkbox"
        role="switch"
        aria-label={label}
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className="relative h-6 w-11 rounded-full bg-[#2A2622]/20 transition-colors peer-checked:bg-[#1F4D3D] peer-checked:[&>span]:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-[#B5714A] peer-focus-visible:ring-offset-2"
      >
        <span className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform" />
      </span>
    </label>
  );
}

function Perm({ icon, text }: { icon: IconName; text: string }) {
  return (
    <span title={text} className="inline-flex">
      <Icon name={icon} className="text-[18px]" />
      <span className="sr-only">{text}</span>
    </span>
  );
}

const STATUS_STYLE: Record<AccessTokenDto["status"], string> = {
  active: "bg-[#EBF2EE] text-[#1F4D3D]",
  expired: "bg-[#F4EFEA] text-[#2A2622]/75",
  revoked: "bg-[#FCEDEC] text-[#B3261E]",
};

export function SharingSettings({
  weddingId,
  gallery,
  albums,
  links,
  timezone,
  coupleNames,
  dateLabel,
}: {
  weddingId: string;
  gallery: GalleryDto;
  albums: AlbumDto[];
  links: AccessTokenDto[];
  timezone: string;
  coupleNames: string;
  dateLabel: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [qrFor, setQrFor] = useState<AccessTokenDto | null>(null);
  const [revoking, setRevoking] = useState<AccessTokenDto | null>(null);
  const [revokeBusy, setRevokeBusy] = useState(false);

  async function setting(changes: {
    allowGuestUploads?: boolean;
    requireUploadApproval?: boolean;
  }) {
    setSaving(true);
    try {
      await updateGallery(weddingId, gallery.version, changes);
      router.refresh();
    } catch (error) {
      toast({ type: "error", title: "Couldn't save that", message: errorMessage(error) });
    } finally {
      setSaving(false);
    }
  }

  async function copy(link: AccessTokenDto) {
    if (!link.shareUrl) {
      toast({
        type: "warning",
        title: "This link can't be shown any more",
        message: "Make a new link instead.",
      });
      return;
    }
    try {
      await navigator.clipboard.writeText(link.shareUrl);
      toast({
        type: "success",
        title: "Link copied",
        message: "Paste it into a message or a note.",
      });
    } catch {
      toast({
        type: "error",
        title: "Couldn't copy",
        message: "Open Show QR and copy the link from there.",
      });
    }
  }

  async function revoke() {
    if (!revoking) return;
    setRevokeBusy(true);
    try {
      await revokeLink(weddingId, revoking.id);
      toast({
        type: "success",
        title: "Link revoked",
        message: "It stopped working straight away.",
      });
      setRevoking(null);
      router.refresh();
    } catch (error) {
      toast({ type: "error", title: "Couldn't revoke the link", message: errorMessage(error) });
    } finally {
      setRevokeBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-headline-md text-headline-md font-normal text-primary">
          Sharing and settings
        </h2>
        <p className="mt-1 font-body-md text-body-md text-on-surface-variant">
          Choose how guests add their photos, and manage the links that open your gallery.
        </p>
      </div>

      <section className="rounded-2xl border border-[#2A2622]/[0.08] bg-surface-container-lowest p-6 shadow-sm md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-headline-sm text-headline-sm font-normal text-primary">
              Guest uploads
            </h3>
            <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
              Let guests share the photos they take, from their phone, with no account.
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 font-label-sm text-label-sm font-semibold ${
              gallery.allowGuestUploads
                ? "bg-[#EBF2EE] text-[#1F4D3D]"
                : "bg-[#F4EFEA] text-[#2A2622]/75"
            }`}
          >
            {gallery.allowGuestUploads ? "Enabled" : "Off"}
          </span>
        </div>

        <div className="mt-6 divide-y divide-[#2A2622]/[0.06]">
          <div className="flex items-center justify-between gap-6 py-4">
            <div>
              <p className="font-label-md text-label-md font-semibold text-[#2A2622]">
                Let guests add photos
              </p>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                A guest opens a link or scans a QR code and adds photos from their phone. They
                don&apos;t need an account.
              </p>
            </div>
            <Switch
              label="Let guests add photos"
              checked={gallery.allowGuestUploads}
              disabled={saving}
              onChange={(value) => void setting({ allowGuestUploads: value })}
            />
          </div>
          <div className="flex items-center justify-between gap-6 py-4 pl-4 md:pl-8">
            <div className="flex items-start gap-3">
              <Icon name="verified_user" className="mt-0.5 text-[20px] text-[#A0623C]" />
              <div>
                <p className="font-label-md text-label-md font-semibold text-[#2A2622]">
                  Check photos before they appear
                </p>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Guest photos wait in &ldquo;Needs approval&rdquo; until you approve them.
                </p>
              </div>
            </div>
            <Switch
              label="Check photos before they appear"
              checked={gallery.requireUploadApproval}
              disabled={saving || !gallery.allowGuestUploads}
              onChange={(value) => void setting({ requireUploadApproval: value })}
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[#2A2622]/[0.08] bg-surface-container-lowest shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4 p-6 md:p-8 md:pb-5">
          <div>
            <h3 className="font-headline-sm text-headline-sm font-normal text-primary">
              Shared links
            </h3>
            <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
              Each link opens your gallery, or one album, with no sign-in. Use one for a printed QR
              code, another for the family group.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-body-sm text-body-sm font-medium text-on-primary shadow-sm transition-all hover:bg-tertiary active:scale-[0.99]"
          >
            <Icon name="add" className="text-[18px]" />
            Create link
          </button>
        </div>

        {links.length === 0 ? (
          <div className="mx-6 mb-6 flex flex-col items-center gap-2 rounded-xl border border-dashed border-[#2A2622]/15 px-6 py-10 text-center md:mx-8 md:mb-8">
            <Icon name="link" className="text-[28px] text-outline" />
            <p className="font-label-md text-label-md font-semibold">No links yet</p>
            <p className="max-w-sm font-body-sm text-body-sm text-on-surface-variant">
              Create a link to share your gallery by message, or print its QR code for the
              reception.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="stack-table w-full text-left md:min-w-[720px]">
              <thead>
                <tr className="border-y border-[#2A2622]/[0.06] bg-[#F4EFEA]/60 font-label-sm text-label-sm tracking-wider text-[#2A2622]/75 uppercase">
                  <th className="px-6 py-3 font-semibold md:pl-8">Label</th>
                  <th className="px-3 py-3 font-semibold">Scope</th>
                  <th className="px-3 py-3 font-semibold">Guests can</th>
                  <th className="px-3 py-3 font-semibold">Expires</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-6 py-3 text-right font-semibold md:pr-8">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A2622]/[0.06]">
                {links.map((link) => {
                  const live = link.status === "active";
                  return (
                    <tr key={link.id} className={live ? "" : "bg-[#F4EFEA]/50"}>
                      <td data-slot="main" className="px-6 py-4 md:pl-8">
                        <span className="flex items-center gap-3 font-label-md text-label-md font-semibold text-[#2A2622]">
                          <Icon
                            name={
                              live
                                ? link.permissions.canUpload
                                  ? "qr_code_2"
                                  : "link"
                                : "link_off"
                            }
                            className="text-[20px] text-[#1F4D3D]"
                          />
                          {link.label?.trim() || "Untitled link"}
                        </span>
                      </td>
                      <td data-label="Album" className="px-3 py-4 font-body-sm text-body-sm">
                        {link.albumTitle ?? "Whole gallery"}
                      </td>
                      <td data-label="Guests can" className="px-3 py-4">
                        <span className="flex items-center gap-2 text-[#2A2622]/75">
                          {link.permissions.canView ? (
                            <Perm icon="visibility" text="View photos" />
                          ) : null}
                          {link.permissions.canUpload ? (
                            <Perm icon="add_photo_alternate" text="Add photos" />
                          ) : null}
                          {link.permissions.canDownload ? (
                            <Perm icon="download" text="Download photos" />
                          ) : null}
                        </span>
                      </td>
                      <td data-label="Expires" className="px-3 py-4 font-body-sm text-body-sm">
                        {expiryLabel(link.expiresAt, timezone)}
                      </td>
                      <td data-label="Status" className="px-3 py-4">
                        <span
                          className={`rounded-full px-2.5 py-1 font-label-sm text-label-sm font-semibold capitalize ${STATUS_STYLE[link.status]}`}
                        >
                          {link.status}
                        </span>
                      </td>
                      <td data-label="Actions" className="px-6 py-4 md:pr-8">
                        <span className="flex items-center justify-end gap-4 font-label-md text-label-md font-medium">
                          {live ? (
                            <>
                              <button
                                type="button"
                                onClick={() => void copy(link)}
                                className="text-[#1F4D3D] hover:underline"
                              >
                                Copy
                              </button>
                              <button
                                type="button"
                                onClick={() => setQrFor(link)}
                                className="text-[#1F4D3D] hover:underline"
                              >
                                Show QR
                              </button>
                              <button
                                type="button"
                                onClick={() => setRevoking(link)}
                                className="text-[#B3261E] hover:underline"
                              >
                                Revoke
                              </button>
                            </>
                          ) : (
                            <span className="text-[#2A2622]/75 capitalize">{link.status}</span>
                          )}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="flex items-start gap-2 border-t border-[#2A2622]/[0.06] px-6 py-4 font-body-sm text-body-sm text-on-surface-variant md:px-8">
          <Icon name="info" className="mt-0.5 shrink-0 text-[16px]" />
          Anyone with a link can see the photos it covers. Revoke a link to stop it working
          immediately.
        </p>
      </section>

      {creating ? (
        <CreateLinkDrawer
          weddingId={weddingId}
          albums={albums}
          timezone={timezone}
          uploadsOn={gallery.allowGuestUploads}
          onClose={() => setCreating(false)}
          onCreated={(link) => {
            setCreating(false);
            setQrFor(link);
            router.refresh();
          }}
        />
      ) : null}

      {qrFor ? (
        <QrDialog
          link={qrFor}
          coupleNames={coupleNames}
          dateLabel={dateLabel}
          onClose={() => setQrFor(null)}
        />
      ) : null}

      {revoking ? (
        <ConfirmDialog
          title={`Revoke “${revoking.label?.trim() || "this link"}”?`}
          confirmLabel="Revoke link"
          danger
          busy={revokeBusy}
          onCancel={() => setRevoking(null)}
          onConfirm={revoke}
        >
          Anyone using this link will lose access straight away, including printed QR codes.
        </ConfirmDialog>
      ) : null}
    </div>
  );
}

function CreateLinkDrawer({
  weddingId,
  albums,
  timezone,
  uploadsOn,
  onClose,
  onCreated,
}: {
  weddingId: string;
  albums: AlbumDto[];
  timezone: string;
  uploadsOn: boolean;
  onClose: () => void;
  onCreated: (link: AccessTokenDto) => void;
}) {
  const [label, setLabel] = useState("");
  const [scope, setScope] = useState<"all" | "album">("all");
  const [albumId, setAlbumId] = useState(albums[0]?.id ?? "");
  // The server refuses an upload link while guest uploads are off, so the box starts off then.
  const [canUpload, setCanUpload] = useState(uploadsOn);
  const [canDownload, setCanDownload] = useState(false);
  const [expiry, setExpiry] = useState<"never" | "date">("never");
  const [date, setDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const tomorrow = (() => {
    const [y, m, d] = todayIn(timezone).split("-").map(Number);
    return new Date(Date.UTC(y!, m! - 1, d! + 1)).toISOString().slice(0, 10);
  })();

  async function save() {
    if (scope === "album" && !albumId) {
      setError("Choose which album this link opens");
      return;
    }
    if (expiry === "date" && (!date || date < tomorrow)) {
      setError("Choose a date after today");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const link = await createLink(weddingId, {
        albumId: scope === "album" ? albumId : null,
        label: label.trim(),
        permissions: { canView: true, canUpload: canUpload && uploadsOn, canDownload },
        expiresAt: expiry === "date" ? endOfDayIso(date, timezone) : null,
      });
      onCreated(link);
    } catch (failure) {
      setError(errorMessage(failure));
      setSaving(false);
    }
  }

  const radio = (active: boolean) =>
    `flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors ${
      active ? "border-[#1F4D3D] bg-[#EBF2EE]" : "border-[#2A2622]/15 hover:bg-[#F2ECE3]/60"
    }`;

  return (
    <DrawerShell
      id="link-drawer"
      title="Create link"
      subtitle="Make a link for a particular group of guests"
      widthClass="w-[480px]"
      saveLabel="Create link"
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
        <label htmlFor="link-label" className={LABEL}>
          Label
        </label>
        <input
          id="link-label"
          type="text"
          value={label}
          maxLength={MAX_TOKEN_LABEL}
          placeholder="e.g. Reception table QR"
          autoFocus
          onChange={(event) => setLabel(event.target.value)}
          className={FIELD}
        />
        <p className="font-body-sm text-body-sm text-[#2A2622]/75">Only you see the label.</p>
      </div>

      <fieldset className="space-y-2">
        <legend className={LABEL}>Who can open it</legend>
        <label className={radio(scope === "all")}>
          <input
            type="radio"
            name="scope"
            checked={scope === "all"}
            onChange={() => setScope("all")}
            className="mt-1 accent-[#1F4D3D]"
          />
          <span>
            <span className="block font-label-md text-label-md font-semibold">Whole gallery</span>
            <span className="block font-body-sm text-body-sm text-[#2A2622]/70">
              Every photo guests are allowed to see.
            </span>
          </span>
        </label>
        <label className={radio(scope === "album")}>
          <input
            type="radio"
            name="scope"
            checked={scope === "album"}
            disabled={albums.length === 0}
            onChange={() => setScope("album")}
            className="mt-1 accent-[#1F4D3D]"
          />
          <span>
            <span className="block font-label-md text-label-md font-semibold">One album</span>
            <span className="block font-body-sm text-body-sm text-[#2A2622]/70">
              {albums.length === 0
                ? "Make an album first."
                : "Limit it to a single ceremony or collection."}
            </span>
          </span>
        </label>
        {scope === "album" ? (
          <SelectField id="link-album" ariaLabel="Album" value={albumId} onChange={setAlbumId}>
            {albums.map((album) => (
              <option key={album.id} value={album.id}>
                {album.title} ({album.photoCount} {album.photoCount === 1 ? "photo" : "photos"})
              </option>
            ))}
          </SelectField>
        ) : null}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className={LABEL}>What can they do</legend>
        <label className="flex items-center gap-3 rounded-lg px-1 py-1.5 opacity-70">
          <input type="checkbox" checked disabled className="accent-[#1F4D3D]" />
          <span className="font-body-md text-body-md">View photos</span>
          <span className="ml-auto font-label-sm text-label-sm text-[#2A2622]/75">Required</span>
        </label>
        <label className="flex cursor-pointer items-center gap-3 rounded-lg px-1 py-1.5">
          <input
            type="checkbox"
            checked={canUpload && uploadsOn}
            disabled={!uploadsOn}
            onChange={(event) => setCanUpload(event.target.checked)}
            className="accent-[#1F4D3D]"
          />
          <span className="font-body-md text-body-md">Add photos</span>
        </label>
        {!uploadsOn ? (
          <p className="ml-8 font-body-sm text-body-sm text-[#7A4527]">
            Guest uploads are off. Turn on &ldquo;Let guests add photos&rdquo; above to make a link
            that lets guests add photos.
          </p>
        ) : null}
        <label className="flex cursor-pointer items-center gap-3 rounded-lg px-1 py-1.5">
          <input
            type="checkbox"
            checked={canDownload}
            onChange={(event) => setCanDownload(event.target.checked)}
            className="accent-[#1F4D3D]"
          />
          <span className="font-body-md text-body-md">Download photos</span>
        </label>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className={LABEL}>Expiry</legend>
        <div role="radiogroup" className="grid grid-cols-2 gap-1 rounded-xl bg-[#EFE7DB]/70 p-1">
          {(
            [
              ["never", "Never"],
              ["date", "Set a date"],
            ] as const
          ).map(([value, text]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={expiry === value}
              onClick={() => setExpiry(value)}
              className={`rounded-lg px-3 py-2.5 font-label-md text-label-md transition-all ${
                expiry === value
                  ? "bg-white font-semibold text-[#1F4D3D] shadow-sm ring-1 ring-[#1F4D3D]/25"
                  : "text-[#2A2622]/70 hover:bg-white/60"
              }`}
            >
              {text}
            </button>
          ))}
        </div>
        {expiry === "date" ? (
          <div className="space-y-1">
            <label htmlFor="link-expiry" className="sr-only">
              Expiry date
            </label>
            <DateField
              id="link-expiry"
              min={tomorrow}
              value={date}
              onChange={setDate}
              clearable={false}
              title="Link expiry date"
            />
            <p className="font-body-sm text-body-sm text-[#2A2622]/75">
              The link works until the end of that day.
            </p>
          </div>
        ) : null}
      </fieldset>
    </DrawerShell>
  );
}
