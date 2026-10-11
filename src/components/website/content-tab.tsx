"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Icon, type IconName } from "@/components/ui/icon";
import type { WebsiteSectionType } from "@/lib/constants/enums";
import {
  MAX_SECTION_BODY,
  MAX_SECTION_TITLE,
  MAX_SECTIONS,
  MAX_WEBSITE_TAGLINE,
  MAX_WEBSITE_TITLE,
  MAX_WEBSITE_WELCOME,
} from "@/lib/constants/website";
import {
  addableTypes,
  moveSection,
  newSection,
  patchSection,
  removeSection,
  type EditorDraft,
} from "@/lib/website/editor-state";
import { SECTION_TYPE_LABEL } from "@/lib/website/site";

// The Content tab (Stitch "Wedding Website Editor"): a list of the page's sections on the left,
// the form for the chosen one in the middle. The live preview sits in the editor's third column.

const SECTION_ICON: Record<WebsiteSectionType, IconName> = {
  story: "auto_stories",
  schedule: "event_note",
  travel: "flight_takeoff",
  faq: "help_outline",
  contact: "alternate_email",
  custom: "edit",
};

const SECTION_BLURB: Record<WebsiteSectionType, string> = {
  story: "Your personal story, shown prominently below the welcome.",
  schedule: "The events guests can attend, with times and venues.",
  travel: "Airports, hotels and how to get around.",
  faq: "Answers to the questions guests always ask.",
  contact: "Who guests should call for help.",
  custom: "Anything else you want guests to know.",
};

const BODY_HELP: Partial<Record<WebsiteSectionType, string>> = {
  faq: "Write each question on its own line with the answer beneath it, and leave a blank line between questions.",
};

const FIELD =
  "w-full rounded-lg border border-transparent bg-surface-container-lowest px-4 py-2.5 font-body-md text-body-md text-on-surface ring-1 ring-primary-container/15 transition-all focus:ring-2 focus:ring-primary-container/30 focus:outline-none";

function Counter({ value, max }: { value: number; max: number }) {
  return (
    <span
      className={`font-body-sm text-body-sm font-medium ${value > max ? "text-error" : "text-outline"}`}
    >
      {value} / {max}
    </span>
  );
}

function Field({
  label,
  count,
  hint,
  children,
}: {
  label: string;
  count?: ReactNode;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="flex items-center justify-between">
        <span className="block font-label-md text-label-md font-semibold tracking-wide text-on-surface">
          {label}
        </span>
        {count}
      </span>
      {children}
      {hint ? <span className="block font-body-sm text-body-sm text-outline">{hint}</span> : null}
    </label>
  );
}

type Selection = "basics" | string;

export function ContentTab({
  draft,
  update,
  events,
  onGoToDesign,
}: {
  draft: EditorDraft;
  update: (changes: Partial<EditorDraft>) => void;
  events: { id: string; name: string; isPublic: boolean }[];
  onGoToDesign: () => void;
}) {
  const [picked, setPicked] = useState<Selection>(draft.sections[0]?.id ?? "basics");
  const [addOpen, setAddOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const addRef = useRef<HTMLDivElement>(null);

  const sections = draft.sections;
  // A section that no longer exists (deleted, or its id replaced after a save) falls back sensibly.
  const selected: Selection =
    picked === "basics" || sections.some((section) => section.id === picked)
      ? picked
      : (sections[0]?.id ?? "basics");
  const setSelected = setPicked;
  const current = sections.find((section) => section.id === selected) ?? null;
  const currentIndex = current ? sections.indexOf(current) : -1;
  const addable = addableTypes(sections);

  useEffect(() => {
    if (!addOpen) return;
    const close = (event: MouseEvent) => {
      if (!addRef.current?.contains(event.target as Node)) setAddOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAddOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [addOpen]);

  function add(type: WebsiteSectionType) {
    const section = newSection(type);
    update({ sections: [...sections, section] });
    setSelected(section.id);
    setAddOpen(false);
  }

  function drop(targetId: string) {
    if (dragId && dragId !== targetId) {
      const to = sections.findIndex((section) => section.id === targetId);
      update({ sections: moveSection(sections, dragId, to) });
    }
    setDragId(null);
    setOverId(null);
  }

  const shownEvents = events.filter(
    (event) => event.isPublic && draft.publicEventIds.includes(event.id),
  );

  return (
    <>
      <section
        className="flex flex-col gap-3 xl:col-start-1 xl:row-start-1"
        aria-label="Page sections"
      >
        <button
          type="button"
          onClick={() => setSelected("basics")}
          aria-pressed={selected === "basics"}
          className={`rounded-xl p-3.5 text-left shadow-sm transition-all duration-150 ${
            selected === "basics"
              ? "bg-surface-container-high ring-1 ring-primary/20"
              : "bg-surface-container-lowest hover:bg-surface-container"
          }`}
        >
          <span className="flex items-center justify-between">
            <span className="flex items-center gap-2.5">
              <Icon name="web" className="text-outline" />
              <span className="font-title text-body-md font-semibold text-on-surface">
                Page basics
              </span>
            </span>
            <Icon name="expand_more" className="text-outline" />
          </span>
          <span className="mt-1.5 block pl-7 font-label-sm text-label-sm text-outline">
            Title, Tagline, Welcome message
          </span>
        </button>

        <div className="flex flex-col gap-1.5">
          <h2 className="px-1 font-label-sm text-label-sm font-semibold tracking-wider text-outline uppercase">
            Page sections
          </h2>
          <ul className="flex flex-col gap-1.5">
            {sections.map((section) => {
              const active = section.id === selected;
              return (
                <li
                  key={section.id}
                  draggable
                  onDragStart={(event) => {
                    setDragId(section.id);
                    event.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(event) => {
                    if (!dragId) return;
                    event.preventDefault();
                    setOverId(section.id);
                  }}
                  onDragEnd={() => {
                    setDragId(null);
                    setOverId(null);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    drop(section.id);
                  }}
                  className={`group relative flex items-center justify-between overflow-hidden rounded-xl shadow-sm transition-all duration-150 ${
                    active
                      ? "bg-surface-container-high text-primary"
                      : section.isVisible
                        ? "bg-surface-container-lowest text-on-surface hover:bg-surface-container"
                        : "bg-surface-container-lowest/60 text-outline hover:bg-surface-container"
                  } ${overId === section.id && dragId !== section.id ? "ring-2 ring-primary/40" : ""} ${
                    dragId === section.id ? "opacity-50" : ""
                  }`}
                >
                  {active ? <span className="absolute inset-y-0 left-0 w-1 bg-primary" /> : null}
                  <button
                    type="button"
                    onClick={() => setSelected(section.id)}
                    aria-pressed={active}
                    className="flex min-w-0 flex-1 items-center gap-2.5 py-2.5 pr-2 pl-3 text-left"
                  >
                    <Icon
                      name="drag_indicator"
                      className="cursor-grab text-outline-variant group-hover:text-outline"
                    />
                    <Icon
                      name={SECTION_ICON[section.type]}
                      className={active ? "text-primary" : "text-outline"}
                    />
                    <span
                      className={`truncate font-body-sm text-body-sm ${
                        active ? "font-semibold" : "font-medium"
                      } ${section.isVisible ? "" : "line-through opacity-75"}`}
                    >
                      {section.title || SECTION_TYPE_LABEL[section.type]}
                    </span>
                  </button>
                  <div className="flex shrink-0 items-center gap-2 pr-3">
                    {section.type === "schedule" ? (
                      <span className="rounded bg-surface-container px-1.5 py-0.5 text-[10px] leading-tight font-medium text-outline">
                        From Events
                      </span>
                    ) : null}
                    <button
                      type="button"
                      aria-label={
                        section.isVisible
                          ? `Hide ${section.title} from the website`
                          : `Show ${section.title} on the website`
                      }
                      title={section.isVisible ? "Visible: click to hide" : "Hidden: click to show"}
                      onClick={() =>
                        update({
                          sections: patchSection(sections, section.id, {
                            isVisible: !section.isVisible,
                          }),
                        })
                      }
                      className="rounded p-0.5 text-outline transition-colors hover:text-on-surface"
                    >
                      <Icon
                        name={section.isVisible ? "visibility" : "visibility_off"}
                        className={`text-[18px] ${active && section.isVisible ? "text-primary" : ""}`}
                      />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="relative mt-1" ref={addRef}>
          <button
            type="button"
            onClick={() => setAddOpen((open) => !open)}
            disabled={addable.length === 0}
            aria-haspopup="menu"
            aria-expanded={addOpen}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-surface-container-lowest px-3 py-2 font-body-sm text-body-sm font-semibold text-primary shadow-sm transition-all duration-150 hover:bg-surface-container disabled:opacity-50"
          >
            <Icon name="add" className="text-[18px]" />
            Add section
          </button>
          {addOpen ? (
            <div
              role="menu"
              className="absolute inset-x-0 top-full z-20 mt-2 rounded-xl border border-[#2A2622]/[0.08] bg-[#FFFDF9] py-1.5 shadow-lg"
            >
              {addable.map((type) => (
                <button
                  key={type}
                  type="button"
                  role="menuitem"
                  onClick={() => add(type)}
                  className="flex w-full items-center gap-2.5 px-4 py-2 text-left font-body-sm text-body-sm text-on-surface hover:bg-[#FAF6F0]"
                >
                  <Icon name={SECTION_ICON[type]} className="text-outline" />
                  {SECTION_TYPE_LABEL[type]}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <p className="px-1 text-center font-label-md text-label-md text-outline">
          {sections.length} of {MAX_SECTIONS} sections
        </p>
      </section>

      <section className="min-w-0 overflow-hidden rounded-2xl bg-surface-container-lowest shadow-sm xl:col-start-2 xl:row-start-1">
        {selected === "basics" || !current ? (
          <>
            <div className="px-8 pt-6 pb-2">
              <h2 className="font-headline-sm text-headline-sm text-on-surface">
                Edit: Page basics
              </h2>
              <p className="mt-0.5 font-body-sm text-body-sm text-outline">
                What guests meet first, at the top of your website.
              </p>
            </div>
            <div className="space-y-6 p-8">
              <Field
                label="Title"
                count={<Counter value={draft.title.length} max={MAX_WEBSITE_TITLE} />}
                hint="The big headline at the top, usually your names."
              >
                <input
                  value={draft.title}
                  onChange={(event) => update({ title: event.target.value })}
                  maxLength={MAX_WEBSITE_TITLE + 20}
                  className={FIELD}
                />
              </Field>
              <Field
                label="Tagline"
                count={<Counter value={draft.tagline.length} max={MAX_WEBSITE_TAGLINE} />}
                hint="Optional. A short line under the date."
              >
                <input
                  value={draft.tagline}
                  onChange={(event) => update({ tagline: event.target.value })}
                  maxLength={MAX_WEBSITE_TAGLINE + 20}
                  className={FIELD}
                />
              </Field>
              <Field
                label="Welcome message"
                count={<Counter value={draft.welcomeMessage.length} max={MAX_WEBSITE_WELCOME} />}
                hint="Optional. A warm note shown under the countdown."
              >
                <textarea
                  rows={5}
                  value={draft.welcomeMessage}
                  onChange={(event) => update({ welcomeMessage: event.target.value })}
                  className={`${FIELD} resize-none leading-relaxed`}
                />
              </Field>
              <PublicNotice />
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 px-8 pt-6 pb-2">
              <div>
                <h2 className="font-headline-sm text-headline-sm text-on-surface">
                  Edit: {current.title || SECTION_TYPE_LABEL[current.type]}
                </h2>
                <p className="mt-0.5 font-body-sm text-body-sm text-outline">
                  {SECTION_BLURB[current.type]}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Move section up"
                  disabled={currentIndex <= 0}
                  onClick={() =>
                    update({ sections: moveSection(sections, current.id, currentIndex - 1) })
                  }
                  className="rounded-lg p-1.5 text-outline transition-colors hover:bg-surface-container hover:text-on-surface disabled:opacity-40"
                >
                  <Icon name="keyboard_arrow_up" />
                </button>
                <button
                  type="button"
                  aria-label="Move section down"
                  disabled={currentIndex >= sections.length - 1}
                  onClick={() =>
                    update({ sections: moveSection(sections, current.id, currentIndex + 1) })
                  }
                  className="rounded-lg p-1.5 text-outline transition-colors hover:bg-surface-container hover:text-on-surface disabled:opacity-40"
                >
                  <Icon name="keyboard_arrow_down" />
                </button>
                <span className="rounded bg-surface-container px-2 py-1 font-label-sm text-label-sm font-medium text-on-surface-variant">
                  {current.type === "custom" ? "Custom Section" : "Standard Section"}
                </span>
              </div>
            </div>

            <div className="space-y-6 p-8">
              <Field label="Section title">
                <span className="relative block">
                  <input
                    value={current.title}
                    onChange={(event) =>
                      update({
                        sections: patchSection(sections, current.id, { title: event.target.value }),
                      })
                    }
                    maxLength={MAX_SECTION_TITLE}
                    className={`${FIELD} pr-28`}
                  />
                  <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 font-label-sm text-label-sm font-normal text-outline">
                    Visible title
                  </span>
                </span>
              </Field>

              {current.type === "schedule" ? (
                <div className="space-y-3 rounded-xl bg-surface-container p-4">
                  <p className="font-body-sm text-body-sm text-on-surface">
                    <span className="font-semibold">This section is built from your events.</span>{" "}
                    Guests see each event you show, with its date, time, venue, dress code and the
                    public lines of its schedule.
                  </p>
                  {shownEvents.length > 0 ? (
                    <ul className="flex flex-wrap gap-2">
                      {shownEvents.map((event) => (
                        <li
                          key={event.id}
                          className="rounded-full bg-surface-container-lowest px-3 py-1 font-body-sm text-body-sm text-on-surface"
                        >
                          {event.name}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="font-body-sm text-body-sm text-secondary">
                      No events are shown yet, so this section stays out of the website.
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={onGoToDesign}
                    className="font-body-sm text-body-sm font-semibold text-primary-container underline underline-offset-2"
                  >
                    Choose which events to show
                  </button>
                </div>
              ) : (
                <Field
                  label="Body"
                  count={<Counter value={current.body.length} max={MAX_SECTION_BODY} />}
                  hint={BODY_HELP[current.type] ?? "Plain text. Line breaks are kept."}
                >
                  <textarea
                    rows={10}
                    value={current.body}
                    onChange={(event) =>
                      update({
                        sections: patchSection(sections, current.id, { body: event.target.value }),
                      })
                    }
                    className={`${FIELD} resize-none leading-relaxed`}
                  />
                </Field>
              )}

              <PublicNotice />

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-2 font-body-sm text-body-sm font-medium text-error transition-colors hover:text-on-error-container"
                >
                  <Icon name="delete" className="text-[18px]" />
                  Delete section
                </button>
                <span className="font-label-sm text-label-sm text-outline">
                  Save changes to keep your edits
                </span>
              </div>
            </div>
          </>
        )}
      </section>

      {confirmDelete && current ? (
        <ConfirmDialog
          title="Delete this section?"
          confirmLabel="Delete section"
          danger
          onConfirm={() => {
            update({ sections: removeSection(sections, current.id) });
            setConfirmDelete(false);
          }}
          onCancel={() => setConfirmDelete(false)}
        >
          &ldquo;{current.title}&rdquo; and its text are removed from your website once you save. To
          keep the text but not show it, hide the section with the eye instead.
        </ConfirmDialog>
      ) : null}
    </>
  );
}

function PublicNotice() {
  return (
    <div className="flex items-start gap-3.5 rounded-xl bg-surface-container p-4 text-on-surface">
      <Icon name="lock" className="mt-0.5 shrink-0 text-secondary" />
      <div className="space-y-0.5 font-body-sm text-body-sm">
        <p className="font-semibold text-on-surface">Public visibility notice</p>
        <p className="text-on-surface-variant">
          Everything on this page is public to anyone with your web link. Never include private
          passcodes, hotel room assignments, or personal bank accounts.
        </p>
      </div>
    </div>
  );
}
