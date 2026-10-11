"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ContentTab } from "@/components/website/content-tab";
import { DesignTab } from "@/components/website/design-tab";
import { SitePreview } from "@/components/website/site-preview";
import {
  checkSlug,
  createWebsite,
  getWebsite,
  publishWebsite,
  unpublishWebsite,
  updateWebsite,
} from "@/components/website/website-api";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { ApiError, errorMessage } from "@/lib/client/api-client";
import { slugProblem } from "@/lib/website/slug";
import { buildPatch, draftProblem, isDirty, type EditorDraft } from "@/lib/website/editor-state";
import { buildSiteView } from "@/lib/website/site";
import type { SlugAvailability, WebsiteEditorData } from "@/modules/website/website.service";
import type { WebsiteDto } from "@/modules/website/website.dto";

// The wedding website editor (Stitch "Wedding Website Editor" and "Website Design and Settings").
// Edits stay in a draft in the browser until "Save changes"; the preview on the right is the real
// public-site component fed with that draft, so it updates as you type. There is ONE stored site:
// when it is published, saving changes it for guests at once (the header says so).

export type SlugState = { slug: string; availability: SlugAvailability } | "checking" | null;

function toDraft(site: WebsiteDto): EditorDraft {
  return {
    slug: site.slug,
    title: site.title,
    tagline: site.tagline,
    welcomeMessage: site.welcomeMessage,
    sections: site.sections,
    publicEventIds: site.publicEventIds,
    display: site.display,
    theme: site.theme,
    seo: site.seo,
  };
}

export function WebsiteEditor({
  weddingId,
  data,
  nowIso,
}: {
  weddingId: string;
  data: WebsiteEditorData;
  /** The server's clock when the page was built (so the preview's countdown starts in step). */
  nowIso: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const params = useSearchParams();
  const tab = params.get("tab") === "design" ? "design" : "content";

  const [site, setSite] = useState<WebsiteDto | null>(data.website);
  const [draft, setDraft] = useState<EditorDraft | null>(
    data.website ? toDraft(data.website) : null,
  );
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [stale, setStale] = useState(false);
  const [confirmUnpublish, setConfirmUnpublish] = useState(false);
  // What the server last said about an address the person typed (the last answer wins).
  const [remoteSlug, setRemoteSlug] = useState<{
    slug: string;
    availability: SlugAvailability;
  } | null>(null);

  const saved = useMemo(() => (site ? toDraft(site) : null), [site]);
  const dirty = saved && draft ? isDirty(saved, draft) : false;
  const problem = draft ? draftProblem(draft) : null;

  // The address badge is worked out from the draft, so it never lags behind what is typed.
  const typedSlug = draft?.slug;
  const savedSlug = saved?.slug;
  const localProblem = typedSlug === undefined ? null : slugProblem(typedSlug);
  let slugState: SlugState = null;
  if (typedSlug !== undefined && savedSlug !== undefined) {
    if (typedSlug === savedSlug) slugState = { slug: typedSlug, availability: "yours" };
    else if (localProblem) slugState = { slug: typedSlug, availability: localProblem };
    else if (remoteSlug?.slug === typedSlug) slugState = remoteSlug;
    else slugState = "checking";
  }
  const slugBlocks =
    draft && saved && draft.slug !== saved.slug
      ? slugState === "checking" ||
        slugState === null ||
        !["available", "yours"].includes(slugState.availability)
      : false;

  const setTab = useCallback(
    (next: "content" | "design") => {
      router.replace(next === "design" ? "?tab=design" : "?", { scroll: false });
    },
    [router],
  );

  // Ask the server while an address is typed (a short pause first; the last request wins).
  useEffect(() => {
    if (typedSlug === undefined || typedSlug === savedSlug || slugProblem(typedSlug)) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      checkSlug(weddingId, typedSlug, controller.signal)
        .then((result) => setRemoteSlug(result))
        .catch((error) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          // Can't tell right now: leave the final answer to the server when saving.
          setRemoteSlug({ slug: typedSlug, availability: "available" });
        });
    }, 400);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [typedSlug, savedSlug, weddingId]);

  // Leaving with unsaved edits asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const update = useCallback((changes: Partial<EditorDraft>) => {
    setDraft((current) => (current ? { ...current, ...changes } : current));
  }, []);

  async function setup() {
    setCreating(true);
    try {
      const created = await createWebsite(weddingId);
      setSite(created);
      setDraft(toDraft(created));
      toast({
        type: "success",
        title: "Your website is set up",
        message: "It's a draft: nobody can see it until you publish.",
      });
    } catch (error) {
      toast({ type: "error", title: "Couldn't set up the website", message: errorMessage(error) });
    } finally {
      setCreating(false);
    }
  }

  /** Saves the draft. Returns the saved site, or null if it did not save (the toast says why). */
  async function save(): Promise<WebsiteDto | null> {
    if (!site || !draft || !saved) return null;
    if (problem) {
      toast({ type: "warning", title: "Can't save yet", message: problem });
      return null;
    }
    const patch = buildPatch(saved, draft);
    if (!patch) return site;
    setSaving(true);
    try {
      const next = await updateWebsite(weddingId, site.version, patch);
      setSite(next);
      setDraft(toDraft(next));
      setStale(false);
      toast({
        type: "success",
        title: "Changes saved",
        message:
          next.status === "published"
            ? "They are live on your website."
            : "Your draft is up to date.",
      });
      return next;
    } catch (error) {
      if (error instanceof ApiError && error.code === "VERSION_CONFLICT") setStale(true);
      else if (error instanceof ApiError && error.code === "SLUG_TAKEN") {
        setRemoteSlug({ slug: draft.slug, availability: "taken" });
        toast({
          type: "error",
          title: "That address was just taken",
          message: "Pick another one.",
        });
      } else {
        toast({ type: "error", title: "Couldn't save your changes", message: errorMessage(error) });
      }
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    if (!site) return;
    if (slugBlocks) {
      toast({
        type: "warning",
        title: "Check the web address",
        message: "Pick an address that is available.",
      });
      return;
    }
    // Publishing saves what is on screen first, so what you see is what goes live.
    if (dirty && !(await save())) return;
    setSaving(true);
    try {
      const next = await publishWebsite(weddingId);
      setSite(next);
      setDraft(toDraft(next));
      toast({
        type: "success",
        title: "Your website is live",
        message: `${data.addressPrefix}${next.slug}`,
      });
    } catch (error) {
      toast({ type: "error", title: "Couldn't publish", message: errorMessage(error) });
    } finally {
      setSaving(false);
    }
  }

  async function unpublish() {
    setSaving(true);
    try {
      const next = await unpublishWebsite(weddingId);
      // Keep the unsaved edits, but take the new status and version.
      setSite((current) =>
        current
          ? { ...current, status: next.status, publishedAt: null, version: next.version }
          : next,
      );
      toast({ type: "success", title: "Website unpublished", message: "It's a draft again." });
    } catch (error) {
      toast({ type: "error", title: "Couldn't unpublish", message: errorMessage(error) });
    } finally {
      setSaving(false);
      setConfirmUnpublish(false);
    }
  }

  async function refreshLatest() {
    try {
      const latest = await getWebsite(weddingId);
      if (latest) {
        setSite(latest);
        setDraft(toDraft(latest));
      }
      setStale(false);
    } catch (error) {
      toast({ type: "error", title: "Couldn't refresh", message: errorMessage(error) });
    }
  }

  function discard() {
    if (saved) setDraft(saved);
  }

  const previewView = useMemo(
    () => (draft ? buildSiteView(draft, data.pool, data.context, new Date(nowIso)) : null),
    [draft, data.pool, data.context, nowIso],
  );

  // ----- Nothing set up yet -------------------------------------------------------------------
  if (!site || !draft || !saved) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-5 rounded-2xl border border-dashed border-[#2A2622]/15 bg-surface-container-lowest px-8 py-16 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-surface-container text-primary-container">
          <Icon name="laptop_chromebook" className="text-[28px]" />
        </span>
        <div className="space-y-2">
          <h1 className="font-headline-md text-headline-md font-normal text-primary">
            Create your wedding website
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            One simple, shareable page for your guests: your story, the schedule, venues and travel
            details. We&apos;ll start a draft from your wedding details and the events you&apos;ve
            marked public. Nobody sees it until you publish.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void setup()}
          disabled={creating}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-container px-6 py-2.5 font-body-sm text-body-sm font-medium text-on-primary shadow-sm transition-colors hover:bg-primary disabled:opacity-70"
        >
          <Icon name="add" className="text-[18px]" />
          {creating ? "Setting up..." : "Set up my website"}
        </button>
      </div>
    );
  }

  const published = site.status === "published";
  const publicUrl = `${data.origin.replace(/\/$/, "")}/w/${site.slug}`;

  return (
    <div className="space-y-6">
      {stale ? (
        <div
          role="status"
          className="-mx-6 -mt-8 mb-2 flex items-center justify-center gap-2 border-b border-[#2A2622]/[0.06] bg-surface-container px-8 py-2.5 text-center md:-mx-12"
        >
          <Icon name="sync" className="text-[18px] text-outline" />
          <span className="font-body-sm text-body-sm text-on-surface">
            This site was updated elsewhere.
          </span>
          <button
            type="button"
            onClick={() => void refreshLatest()}
            className="font-body-sm text-body-sm font-medium text-primary-container underline underline-offset-2"
          >
            Refresh
          </button>
          <span className="font-body-sm text-body-sm text-outline">
            to see the latest changes (your unsaved edits will be replaced).
          </span>
        </div>
      ) : null}

      <div>
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4">
          <div className="flex flex-wrap items-center gap-4">
            <h1 className="font-headline-md text-headline-md font-normal tracking-tight text-on-surface">
              Wedding website
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-label-md text-label-md ${
                published
                  ? "bg-primary-container/10 text-primary-container"
                  : "bg-surface-container text-on-surface-variant"
              }`}
            >
              <span
                className={`size-1.5 rounded-full ${published ? "bg-primary-container" : "bg-outline"}`}
              />
              {published ? "Published" : "Draft"}
            </span>
            {dirty ? (
              <span className="flex items-center gap-1.5 font-body-sm text-body-sm text-secondary">
                <span className="size-2 rounded-full bg-secondary" />
                <span className="font-medium">Unsaved changes</span>
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <a
              href="/dashboard/website/preview"
              target="_blank"
              rel="noopener"
              onClick={() => {
                if (dirty) {
                  toast({
                    type: "info",
                    title: "Preview shows your last saved version",
                    message: "The panel next to the editor shows everything, saved or not.",
                  });
                }
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-surface-container-lowest px-3.5 py-1.5 font-body-sm text-body-sm text-on-surface shadow-sm transition-colors hover:bg-surface-container"
            >
              <Icon name="visibility" className="text-outline" />
              Preview
            </a>
            {tab === "content" ? (
              <button
                type="button"
                onClick={() => void save()}
                disabled={!dirty || saving}
                className="inline-flex items-center gap-2 rounded-lg bg-surface-container-lowest px-3.5 py-1.5 font-body-sm text-body-sm text-on-surface shadow-sm transition-colors hover:bg-surface-container disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save changes"}
              </button>
            ) : null}
            {published ? (
              <a
                href={publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-primary-container px-5 py-1.5 font-body-sm text-body-sm font-medium text-on-primary shadow-sm transition-all hover:bg-primary"
              >
                <Icon name="open_in_new" />
                View site
              </a>
            ) : (
              <button
                type="button"
                onClick={() => void publish()}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-primary-container px-5 py-1.5 font-body-sm text-body-sm font-medium text-on-primary shadow-sm transition-all hover:bg-primary disabled:opacity-70"
              >
                <Icon name={tab === "design" ? "rocket_launch" : "publish"} />
                Publish
              </button>
            )}
          </div>
        </div>
        {published ? (
          <p className="pb-3 font-body-sm text-body-sm text-on-surface-variant">
            This site is live: changes you save go to your guests straight away.
          </p>
        ) : null}

        <div className="flex items-center gap-8 border-b border-[#2A2622]/[0.08]" role="tablist">
          {(
            [
              ["content", "Content"],
              ["design", "Design and settings"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`relative -mb-px pb-3 font-body-md text-body-md transition-colors ${
                tab === key
                  ? "border-b-2 border-primary font-semibold text-primary"
                  : "text-on-surface-variant hover:text-primary"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === "content" ? (
        <div className="grid items-start gap-6 xl:grid-cols-[260px_minmax(0,1fr)_350px]">
          <ContentTab
            draft={draft}
            update={update}
            events={data.events}
            onGoToDesign={() => setTab("design")}
          />
          <div className="order-last xl:sticky xl:top-2 xl:order-none xl:col-start-3 xl:row-start-1">
            {previewView ? <SitePreview view={previewView} initialNow={nowIso} /> : null}
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-[760px] space-y-8 pb-28">
          <DesignTab
            draft={draft}
            update={update}
            events={data.events}
            site={site}
            addressPrefix={data.addressPrefix}
            publicUrl={publicUrl}
            slugState={slugState}
            busy={saving}
            onUnpublish={() => setConfirmUnpublish(true)}
            onPublish={() => void publish()}
          />
          {dirty || saving ? (
            <div className="fixed inset-x-0 bottom-6 z-30 mx-auto w-full max-w-[728px] px-4">
              <div className="flex items-center justify-between rounded-2xl border border-[#2A2622]/[0.08] bg-white/95 p-4 shadow-[0_12px_32px_-4px_rgba(42,38,34,0.08)] backdrop-blur-md">
                <div className="flex items-center gap-2 pl-2 font-body-sm text-body-sm text-outline">
                  <span className="size-2 rounded-full bg-[#B5714A]" />
                  <span>{problem ?? "Unsaved changes"}</span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={discard}
                    disabled={saving}
                    className="rounded-lg border border-[#2A2622]/20 px-4 py-2 font-label-md text-label-md font-semibold text-on-surface transition-colors hover:bg-surface-container"
                  >
                    Discard changes
                  </button>
                  <button
                    type="button"
                    onClick={() => void save()}
                    disabled={saving || slugBlocks}
                    className="rounded-lg bg-primary-container px-6 py-2 font-label-md text-label-md font-semibold text-on-primary shadow-sm transition-all hover:bg-primary disabled:opacity-60"
                  >
                    {saving ? "Saving..." : "Save changes"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {confirmUnpublish ? (
        <ConfirmDialog
          title="Unpublish your website?"
          confirmLabel="Unpublish"
          busy={saving}
          onConfirm={() => void unpublish()}
          onCancel={() => setConfirmUnpublish(false)}
        >
          Guests with your link will see a &ldquo;page not found&rdquo; message until you publish
          again. Your content and address are kept.
        </ConfirmDialog>
      ) : null}
    </div>
  );
}
