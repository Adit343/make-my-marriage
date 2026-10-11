"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import type { WebsiteTemplate } from "@/lib/constants/enums";
import {
  ACCENT_COLORS,
  MAX_PUBLIC_EVENTS,
  MAX_SEO_DESCRIPTION,
  MAX_SEO_TITLE,
  MAX_SLUG,
  MIN_SLUG,
} from "@/lib/constants/website";
import type { EditorDraft } from "@/lib/website/editor-state";
import type { SlugState } from "@/components/website/website-editor";
import type { WebsiteDto } from "@/modules/website/website.dto";

// The Design and settings tab (Stitch "Website Design and Settings"): six stacked cards.

const CARD =
  "rounded-xl border border-[#2A2622]/[0.04] bg-white p-8 shadow-[0_2px_12px_-2px_rgba(42,38,34,0.04),0_1px_3px_0_rgba(42,38,34,0.02)]";
const INPUT =
  "w-full rounded-lg border border-[#2A2622]/15 bg-[#FFFDF9] px-3.5 py-2 font-body-md text-body-md text-[#2A2622] transition-all focus:border-[#1F4D3D] focus:ring-2 focus:ring-[#1F4D3D]/10 focus:outline-none";

function Switch({
  checked,
  onChange,
  label,
  small = false,
  disabled = false,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  small?: boolean;
  disabled?: boolean;
}) {
  const track = small ? "h-5 w-9" : "h-6 w-11";
  const knob = small ? "size-4" : "size-5";
  const shift = small ? "translate-x-4" : "translate-x-5";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative shrink-0 rounded-full p-0.5 transition-colors focus-visible:ring-2 focus-visible:ring-[#1F4D3D]/40 focus-visible:outline-none ${track} ${
        disabled ? "cursor-not-allowed bg-[#C0C8C3]/50" : checked ? "bg-[#1F4D3D]" : "bg-[#C0C8C3]"
      }`}
    >
      <span
        className={`block rounded-full bg-white shadow transition-transform ${knob} ${checked ? shift : "translate-x-0"}`}
      />
    </button>
  );
}

const TEMPLATES: { key: WebsiteTemplate; name: string; note: string }[] = [
  { key: "modern_minimal", name: "Modern minimal", note: "Clean asymmetric grid" },
  { key: "editorial", name: "Editorial", note: "Serif-led column format" },
  { key: "soft_classic", name: "Soft classic", note: "Warm centered framing" },
];

function TemplateWireframe({ template, accent }: { template: WebsiteTemplate; accent: string }) {
  if (template === "modern_minimal") {
    return (
      <div className="space-y-2 pt-2">
        <div className="h-1.5 w-12 rounded-full" style={{ backgroundColor: accent }} />
        <div
          className="flex h-8 w-full items-center justify-center rounded border border-dashed"
          style={{ borderColor: `${accent}4D` }}
        >
          <span className="font-headline-sm text-[12px] italic" style={{ color: accent }}>
            A &amp; D
          </span>
        </div>
        <div className="space-y-1 pt-1">
          <div className="h-1 w-3/4 rounded bg-[#2A2622]/15" />
          <div className="h-1 w-1/2 rounded bg-[#2A2622]/15" />
        </div>
      </div>
    );
  }
  if (template === "editorial") {
    return (
      <div className="space-y-2 pt-2">
        <div className="w-full pb-1 text-center">
          <div className="mx-auto h-2 w-16 rounded bg-[#2A2622]/30" />
        </div>
        <div className="flex h-8 w-full flex-col items-center justify-center gap-1 rounded border border-[#2A2622]/10">
          <div className="h-0.5 w-10" style={{ backgroundColor: accent }} />
          <div className="h-1 w-14 bg-[#2A2622]/20" />
        </div>
        <div className="space-y-1 pt-1">
          <div className="h-1 w-full rounded bg-[#2A2622]/10" />
          <div className="h-1 w-2/3 rounded bg-[#2A2622]/10" />
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-2 pt-2">
      <div className="flex h-8 w-full items-center justify-center rounded border border-[#2A2622]/10">
        <div className="flex size-6 items-center justify-center rounded-full border border-dashed border-[#2A2622]/30 font-headline-sm text-[8px] text-[#2A2622]/40">
          ✦
        </div>
      </div>
      <div className="flex flex-col items-center space-y-1.5 pt-1 text-center">
        <div className="h-1 w-12 rounded bg-[#2A2622]/20" />
        <div className="h-1 w-16 rounded bg-[#2A2622]/10" />
      </div>
    </div>
  );
}

function SlugBadge({ state }: { state: SlugState }) {
  if (state === "checking" || state === null) {
    return (
      <span className="flex items-center gap-1 font-body-sm text-[11px] text-[#686F6A]">
        Checking...
      </span>
    );
  }
  if (state.availability === "available" || state.availability === "yours") {
    return (
      <span className="flex items-center gap-1 rounded-full bg-[#1F4D3D]/10 px-2 py-0.5 text-[11px] font-semibold text-[#1F4D3D]">
        <Icon name="check_circle" className="text-[14px]" />
        Available
      </span>
    );
  }
  return null;
}

function slugError(state: SlugState): { icon: "error" | "warning"; text: string } | null {
  if (!state || state === "checking") return null;
  switch (state.availability) {
    case "taken":
      return { icon: "error", text: "That address is taken" };
    case "reserved":
      return { icon: "warning", text: "That address is reserved" };
    case "invalid":
      return {
        icon: "error",
        text: `Use ${MIN_SLUG} to ${MAX_SLUG} letters, numbers and single hyphens`,
      };
    default:
      return null;
  }
}

export function DesignTab({
  draft,
  update,
  events,
  site,
  addressPrefix,
  publicUrl,
  slugState,
  busy,
  onUnpublish,
  onPublish,
}: {
  draft: EditorDraft;
  update: (changes: Partial<EditorDraft>) => void;
  events: { id: string; name: string; isPublic: boolean; dateLabel: string }[];
  site: WebsiteDto;
  addressPrefix: string;
  publicUrl: string;
  slugState: SlugState;
  busy: boolean;
  onUnpublish: () => void;
  onPublish: () => void;
}) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const error = slugError(slugState);
  const published = site.status === "published";
  const shown = events.filter((event) => event.isPublic && draft.publicEventIds.includes(event.id));
  const seoTitle = draft.seo.title || draft.title;
  const seoDescription = draft.seo.description;

  function toggleEvent(id: string, on: boolean) {
    const without = draft.publicEventIds.filter((existing) => existing !== id);
    if (on && without.length >= MAX_PUBLIC_EVENTS) {
      toast({ type: "warning", message: `A website shows at most ${MAX_PUBLIC_EVENTS} events.` });
      return;
    }
    update({ publicEventIds: on ? [...without, id] : without });
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        type: "warning",
        title: "Couldn't copy",
        message: "Select the address and copy it.",
      });
    }
  }

  return (
    <>
      <section className={CARD} aria-labelledby="web-address">
        <div className="mb-5">
          <h2 id="web-address" className="font-headline-sm text-headline-sm text-[#2A2622]">
            Web address
          </h2>
          <p className="mt-1 font-body-sm text-body-sm text-[#686F6A]">
            Your personalized wedding URL for invites, RSVPs, and guest inquiries.
          </p>
        </div>
        <div className="space-y-2">
          <div
            className={`flex items-center rounded-lg border bg-[#FFFDF9] px-3.5 py-2.5 transition-all focus-within:ring-2 ${
              error
                ? "border-[#C25443] focus-within:ring-[#C25443]/10"
                : "border-[#2A2622]/15 focus-within:border-[#1F4D3D] focus-within:ring-[#1F4D3D]/10"
            }`}
          >
            <span className="font-body-md text-body-md whitespace-nowrap text-[#686F6A] select-none">
              {addressPrefix}
            </span>
            <input
              aria-label="Website address"
              aria-invalid={Boolean(error)}
              value={draft.slug}
              onChange={(event) =>
                update({ slug: event.target.value.toLowerCase().replace(/\s+/g, "-") })
              }
              maxLength={MAX_SLUG + 10}
              spellCheck={false}
              autoCapitalize="none"
              className="min-w-0 flex-1 border-0 bg-transparent p-0 font-body-md text-body-md text-[#2A2622] focus:ring-0 focus:outline-none"
            />
            <SlugBadge state={slugState} />
          </div>
          {error ? (
            <p
              role="alert"
              className="flex items-center gap-1.5 font-body-sm text-body-sm text-[#B4412F]"
            >
              <Icon name={error.icon} className="text-[16px]" />
              {error.text}
            </p>
          ) : null}
          <p className="font-body-sm text-body-sm text-[#686F6A]">
            Letters, numbers and hyphens, 3 to 40 characters. Changing this later breaks links
            you&apos;ve already shared.
          </p>
        </div>
      </section>

      <section className={CARD} aria-labelledby="template">
        <div className="mb-5">
          <h2 id="template" className="font-headline-sm text-headline-sm text-[#2A2622]">
            Template and colour
          </h2>
          <p className="mt-1 font-body-sm text-body-sm text-[#686F6A]">
            Select an architectural foundation and editorial accent tone.
          </p>
        </div>
        <div role="radiogroup" aria-label="Template" className="mb-7 grid grid-cols-3 gap-4">
          {TEMPLATES.map((template) => {
            const selected = draft.theme.templateKey === template.key;
            return (
              <button
                key={template.key}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => update({ theme: { ...draft.theme, templateKey: template.key } })}
                className={`relative flex h-48 flex-col justify-between rounded-xl p-4 text-left transition-all ${
                  selected
                    ? "border-2 border-[#1F4D3D] bg-[#1F4D3D]/[0.03]"
                    : "border border-[#2A2622]/15 bg-[#FFFDF9] hover:border-[#2A2622]/30"
                }`}
              >
                {selected ? (
                  <span className="absolute top-3 right-3 text-[#1F4D3D]">
                    <Icon name="check_circle" className="text-[20px]" />
                  </span>
                ) : null}
                <TemplateWireframe template={template.key} accent={draft.theme.accentColor} />
                <div>
                  <p
                    className={`font-label-md text-label-md font-semibold ${selected ? "text-[#1F4D3D]" : "text-[#2A2622]"}`}
                  >
                    {template.name}
                  </p>
                  <p className="font-label-sm text-label-sm text-[#686F6A]">{template.note}</p>
                </div>
              </button>
            );
          })}
        </div>
        <div className="border-t border-[#2A2622]/[0.06] pt-5">
          <p
            id="accent-label"
            className="mb-3 font-label-md text-label-md font-semibold text-[#2A2622]"
          >
            Accent colour
          </p>
          <div role="radiogroup" aria-labelledby="accent-label" className="flex items-center gap-4">
            {ACCENT_COLORS.map((color) => {
              const selected = draft.theme.accentColor.toLowerCase() === color.value.toLowerCase();
              return (
                <button
                  key={color.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={`${color.label} ${color.value}`}
                  title={`${color.label} ${color.value}`}
                  onClick={() => update({ theme: { ...draft.theme, accentColor: color.value } })}
                  className={`flex size-9 items-center justify-center rounded-full transition-transform focus-visible:ring-2 focus-visible:ring-[#1F4D3D]/40 focus-visible:outline-none ${
                    selected ? "ring-2 ring-offset-2" : "hover:scale-105"
                  }`}
                  style={{
                    backgroundColor: color.value,
                    ...(selected ? { ["--tw-ring-color" as string]: color.value } : {}),
                  }}
                >
                  {selected ? <span className="size-2 rounded-full bg-white" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className={CARD} aria-labelledby="cover">
        <div className="mb-4">
          <h2 id="cover" className="font-headline-sm text-headline-sm text-[#2A2622]">
            Cover image
          </h2>
          <p className="mt-1 font-body-sm text-body-sm text-[#686F6A]">
            Main hero visual greeting guests upon website load.
          </p>
        </div>
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#686F6A]/30 bg-[#FAF6F0]/60 p-8 text-center">
          <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-[#2A2622]/[0.06] text-[#686F6A]">
            <Icon name="lock" className="text-[20px]" />
          </div>
          <h3 className="mb-1 font-headline-sm text-[18px] text-[#2A2622]">
            Available when Gallery launches
          </h3>
          <p className="max-w-sm font-body-sm text-body-sm text-[#686F6A]">
            Until then your site uses a clean typographic cover composed with the Newsreader
            headline suite.
          </p>
        </div>
      </section>

      <section className={CARD} aria-labelledby="visible-to-guests">
        <div className="mb-6">
          <h2 id="visible-to-guests" className="font-headline-sm text-headline-sm text-[#2A2622]">
            What guests can see
          </h2>
          <p className="mt-1 font-body-sm text-body-sm text-[#686F6A]">
            Fine-tune operational privacy, scheduling, and logistical visibility.
          </p>
        </div>
        <div className="mb-7 space-y-4">
          <div className="flex items-center justify-between gap-4 border-b border-[#2A2622]/[0.05] py-2">
            <div>
              <p className="font-body-md text-body-md font-medium text-[#2A2622]">Show countdown</p>
              <p className="font-body-sm text-body-sm text-[#686F6A]">
                Display real-time countdown to the first itinerary event
              </p>
            </div>
            <Switch
              label="Show countdown"
              checked={draft.display.showCountdown}
              onChange={(value) => update({ display: { ...draft.display, showCountdown: value } })}
            />
          </div>
          <div className="flex items-center justify-between gap-4 border-b border-[#2A2622]/[0.05] py-2">
            <div>
              <p className="font-body-md text-body-md font-medium text-[#2A2622]">
                Show venue addresses
              </p>
              <p className="font-body-sm text-body-sm text-[#686F6A]">
                When off, guests see venue names only
              </p>
            </div>
            <Switch
              label="Show venue addresses"
              checked={draft.display.showVenueAddresses}
              onChange={(value) =>
                update({ display: { ...draft.display, showVenueAddresses: value } })
              }
            />
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-label-md text-label-md font-semibold text-[#2A2622]">
              Events shown on the website
            </h3>
            <span className="font-body-sm text-body-sm text-[#686F6A]">
              {shown.length} of {events.length} shown
            </span>
          </div>
          {events.length === 0 ? (
            <p className="rounded-lg border border-dashed border-[#2A2622]/15 bg-[#FAF6F0]/60 p-4 font-body-sm text-body-sm text-[#686F6A]">
              You haven&apos;t added any events yet.{" "}
              <Link href="/dashboard/events" className="font-medium text-[#1F4D3D] underline">
                Add events
              </Link>{" "}
              and mark them public to list them here.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {events.map((event) => {
                if (!event.isPublic) {
                  return (
                    <li
                      key={event.id}
                      className="flex flex-col justify-between gap-2 rounded-lg border border-[#C25443]/20 bg-[#FAF6F0]/40 p-3 sm:flex-row sm:items-center"
                    >
                      <div className="flex flex-wrap items-center gap-3">
                        <Icon name="lock" className="text-[20px] text-[#686F6A]" />
                        <span className="font-body-md text-body-md font-medium text-[#686F6A]">
                          {event.name}
                        </span>
                        <span className="font-body-sm text-body-sm text-[#B4412F]">
                          Mark this event as public in Events first.
                        </span>
                      </div>
                      <div className="flex items-center gap-3 self-end sm:self-auto">
                        <Link
                          href="/dashboard/events"
                          className="flex items-center gap-0.5 font-body-sm text-body-sm font-medium text-[#1F4D3D] hover:underline"
                        >
                          Open Events ↗
                        </Link>
                        <Switch
                          label={`Show ${event.name}`}
                          checked={false}
                          onChange={() => {}}
                          small
                          disabled
                        />
                      </div>
                    </li>
                  );
                }
                const on = draft.publicEventIds.includes(event.id);
                return (
                  <li
                    key={event.id}
                    className="flex items-center justify-between rounded-lg border border-[#2A2622]/[0.05] bg-[#FAF6F0]/80 p-3"
                  >
                    <div className="flex items-center gap-3">
                      <Icon
                        name="check_circle"
                        className={`text-[20px] ${on ? "text-[#1F4D3D]" : "text-[#C0C8C3]"}`}
                      />
                      <span className="font-body-md text-body-md font-medium text-[#2A2622]">
                        {event.name}
                      </span>
                      <span className="hidden font-body-sm text-body-sm text-[#686F6A] sm:inline">
                        {event.dateLabel}
                      </span>
                    </div>
                    <Switch
                      label={`Show ${event.name} on the website`}
                      checked={on}
                      onChange={(value) => toggleEvent(event.id, value)}
                      small
                    />
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-3 font-body-sm text-body-sm text-[#686F6A]">
            Up to {MAX_PUBLIC_EVENTS} events.
          </p>
        </div>
      </section>

      <section className={CARD} aria-labelledby="search-appearance">
        <div className="mb-6">
          <h2 id="search-appearance" className="font-headline-sm text-headline-sm text-[#2A2622]">
            Search appearance
          </h2>
          <p className="mt-1 font-body-sm text-body-sm text-[#686F6A]">
            Customize how your wedding page appears across search engines and messaging links.
          </p>
        </div>
        <div className="space-y-5">
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label
                htmlFor="seo-title"
                className="font-label-md text-label-md font-semibold text-[#2A2622]"
              >
                Page title
              </label>
              <span
                className={`font-label-sm text-label-sm ${draft.seo.title.length > MAX_SEO_TITLE ? "text-error" : "text-[#686F6A]"}`}
              >
                {draft.seo.title.length}/{MAX_SEO_TITLE}
              </span>
            </div>
            <input
              id="seo-title"
              value={draft.seo.title}
              onChange={(event) => update({ seo: { ...draft.seo, title: event.target.value } })}
              maxLength={MAX_SEO_TITLE + 20}
              className={INPUT}
            />
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label
                htmlFor="seo-description"
                className="font-label-md text-label-md font-semibold text-[#2A2622]"
              >
                Description
              </label>
              <span
                className={`font-label-sm text-label-sm ${seoDescription.length > MAX_SEO_DESCRIPTION ? "text-error" : "text-[#686F6A]"}`}
              >
                {seoDescription.length}/{MAX_SEO_DESCRIPTION}
              </span>
            </div>
            <textarea
              id="seo-description"
              rows={3}
              value={draft.seo.description}
              onChange={(event) =>
                update({ seo: { ...draft.seo, description: event.target.value } })
              }
              maxLength={MAX_SEO_DESCRIPTION + 40}
              className={`${INPUT} resize-none`}
            />
          </div>
          <div className="border-t border-[#2A2622]/[0.06] pt-5">
            <p className="mb-2.5 font-label-sm text-label-sm font-semibold tracking-wider text-[#686F6A] uppercase">
              Search result preview
            </p>
            <div className="space-y-1 rounded-xl border border-[#2A2622]/[0.06] bg-[#FAF6F0] p-4">
              <p className="flex items-center gap-1 font-body-sm text-[12px] text-[#686F6A]">
                <span>https://{addressPrefix.split("/")[0]}</span>
                <span>› w › {draft.slug}</span>
              </p>
              <p className="font-body-lg text-[17px] leading-tight font-medium text-[#1F4D3D]">
                {seoTitle.slice(0, MAX_SEO_TITLE)}
              </p>
              <p className="pt-0.5 font-body-sm text-[13px] leading-snug text-[#2A2622]">
                {seoDescription.slice(0, MAX_SEO_DESCRIPTION) ||
                  "Add a description so people know what this page is."}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className={CARD} aria-labelledby="visibility">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <h2 id="visibility" className="font-headline-sm text-headline-sm text-[#2A2622]">
                Visibility
              </h2>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-label-sm text-label-sm font-semibold ${
                  published
                    ? "bg-[#1F4D3D]/10 text-[#1F4D3D]"
                    : "bg-[#2A2622]/[0.06] text-[#686F6A]"
                }`}
              >
                <span
                  className={`size-1.5 rounded-full ${published ? "bg-[#1F4D3D]" : "bg-[#686F6A]"}`}
                />
                {published ? "Published" : "Draft"}
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-[#686F6A]">
              Controls whether guests can view the live site via direct URL.
            </p>
          </div>
          {published ? (
            <button
              type="button"
              onClick={onUnpublish}
              disabled={busy}
              className="rounded-lg border border-[#2A2622]/20 px-3.5 py-1.5 font-label-md text-label-md font-semibold text-[#2A2622] transition-colors hover:bg-[#F4EFEA] disabled:opacity-60"
            >
              Unpublish
            </button>
          ) : (
            <button
              type="button"
              onClick={onPublish}
              disabled={busy}
              className="rounded-lg bg-[#1F4D3D] px-3.5 py-1.5 font-label-md text-label-md font-semibold text-[#FAF6F0] transition-colors hover:bg-[#163A2E] disabled:opacity-60"
            >
              Publish
            </button>
          )}
        </div>
        <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-[#2A2622]/[0.06] bg-[#FAF6F0] p-3.5">
          <span className="min-w-0 truncate font-body-sm text-body-sm font-medium text-[#2A2622] select-all">
            {publicUrl.replace(/^https?:\/\//, "")}
          </span>
          <button
            type="button"
            onClick={() => void copyLink()}
            className="flex shrink-0 items-center gap-1 font-body-sm text-body-sm font-semibold text-[#1F4D3D] hover:underline"
          >
            <Icon name={copied ? "check" : "content_copy"} className="text-[16px]" />
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
        <div className="flex items-center gap-2 font-body-sm text-body-sm text-[#686F6A]">
          <Icon name="shield" className="text-[16px] text-[#B5714A]" />
          <span>
            {published
              ? "Anyone with this link can view the website. Never put private details here."
              : "Not live yet: nobody can open this address until you publish."}
          </span>
        </div>
      </section>
    </>
  );
}
