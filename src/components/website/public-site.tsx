"use client";

import { useState, type ReactNode } from "react";
import { Countdown } from "@/components/website/countdown";
import { Icon } from "@/components/ui/icon";
import {
  navLabel,
  paragraphs,
  parseFaq,
  SECTION_EYEBROW,
  type PublicSiteView,
  type SiteSection,
} from "@/lib/website/site";

// The public wedding website (Stitch "Public Wedding Website (Desktop & Mobile)"). One component
// renders the site on the real /w/<slug> page, in the member's preview and inside the editor's
// live preview, so what the editor shows is exactly what guests see. It lays out by its OWN width
// (container queries), so it works the same in a 340px phone frame and in a full browser window.
// It only ever receives the whitelisted PublicSiteView: nothing private can reach it.

const TEMPLATE_STYLE = {
  modern_minimal: { align: "text-center", ornament: false },
  editorial: { align: "text-left @3xl:text-center", ornament: false },
  soft_classic: { align: "text-center", ornament: true },
} as const;

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="mb-2 block font-label-sm text-label-sm font-semibold tracking-widest text-secondary uppercase">
      {children}
    </span>
  );
}

function Heading({ children }: { children: ReactNode }) {
  return (
    <h2 className="font-headline-sm text-[26px] leading-tight font-normal text-(--site-accent) @3xl:font-headline-md @3xl:text-headline-md">
      {children}
    </h2>
  );
}

function Prose({ body, className = "" }: { body: string; className?: string }) {
  return (
    <div className={`space-y-4 ${className}`}>
      {paragraphs(body).map((paragraph, index) => (
        <p key={index} className="whitespace-pre-line">
          {paragraph}
        </p>
      ))}
    </div>
  );
}

function StorySection({ section, align }: { section: SiteSection; align: string }) {
  return (
    <section id={`site-${section.key}`} className="px-6 py-14 @3xl:px-8 @3xl:py-24">
      <div className={`mx-auto max-w-xl ${align}`}>
        <Eyebrow>{SECTION_EYEBROW[section.type]}</Eyebrow>
        <Heading>{section.title}</Heading>
        <span className="mx-auto my-6 block h-px w-8 bg-secondary/40 @3xl:my-8" />
        <Prose
          body={section.body}
          className="text-left font-body-md text-body-md leading-relaxed font-light text-[#2A2622] @3xl:font-body-lg @3xl:text-body-lg"
        />
      </div>
    </section>
  );
}

function ScheduleSection({ section, view }: { section: SiteSection; view: PublicSiteView }) {
  return (
    <section
      id={`site-${section.key}`}
      className="border-t border-[#2A2622]/5 bg-surface-container-low/60 px-5 py-14 @3xl:px-12 @3xl:py-24"
    >
      <div className="mx-auto max-w-3xl">
        <div className="mb-10 text-center @3xl:mb-16">
          <Eyebrow>{SECTION_EYEBROW[section.type]}</Eyebrow>
          <Heading>{section.title}</Heading>
        </div>
        <ul className="space-y-4 @3xl:space-y-8">
          {view.events.map((event, index) => (
            <li
              key={index}
              className="rounded-lg border border-[#2A2622]/5 bg-[#FFFDF9] p-5 shadow-sm @3xl:p-8"
            >
              <div className="mb-4 flex flex-col justify-between gap-1 border-b border-[#2A2622]/5 pb-4 @3xl:flex-row @3xl:items-baseline @3xl:gap-4">
                <div>
                  <span className="mb-1 block font-label-sm text-label-sm tracking-widest text-secondary uppercase">
                    {event.dateLabel}
                  </span>
                  <h3 className="font-headline-sm text-headline-sm font-normal text-(--site-accent)">
                    {event.name}
                  </h3>
                </div>
                <span className="font-label-md text-label-md font-medium text-[#686F6A]">
                  {event.timeLabel}
                </span>
              </div>
              <dl className="grid grid-cols-1 gap-3 @3xl:grid-cols-2 @3xl:gap-4">
                {event.venue ? (
                  <div>
                    <dt className="font-label-sm text-label-sm tracking-wider text-[#686F6A] uppercase">
                      Venue
                    </dt>
                    <dd className="mt-0.5 font-body-sm text-body-sm font-medium text-[#2A2622] @3xl:font-body-md @3xl:text-body-md">
                      {event.venue}
                      {event.mapsUrl ? (
                        <>
                          {" "}
                          <a
                            href={event.mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-normal text-secondary underline underline-offset-2"
                          >
                            Map
                          </a>
                        </>
                      ) : null}
                    </dd>
                  </div>
                ) : null}
                {event.dressCode ? (
                  <div>
                    <dt className="font-label-sm text-label-sm tracking-wider text-[#686F6A] uppercase">
                      Dress code
                    </dt>
                    <dd className="mt-0.5 font-body-sm text-body-sm text-[#2A2622] @3xl:font-body-md @3xl:text-body-md">
                      {event.dressCode}
                    </dd>
                  </div>
                ) : null}
              </dl>
              {event.description ? (
                <p className="mt-4 font-body-sm text-body-sm whitespace-pre-line text-on-surface-variant">
                  {event.description}
                </p>
              ) : null}
              {event.timings.length > 0 ? (
                <ul className="mt-5 flex flex-col gap-2 rounded bg-surface-container-low/40 p-3 @3xl:flex-row @3xl:flex-wrap @3xl:gap-x-6 @3xl:p-4">
                  {event.timings.map((timing, timingIndex) => (
                    <li key={timingIndex} className="flex items-center gap-2">
                      <span className="size-1.5 shrink-0 rounded-full bg-secondary" />
                      <span className="font-body-sm text-body-sm text-[#2A2622]">
                        <strong className="font-medium text-(--site-accent)">{timing.time}</strong>
                        <span aria-hidden="true"> — </span>
                        <span className="sr-only"> </span>
                        {timing.title}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function TravelBlock({ section }: { section: SiteSection }) {
  return (
    <div id={`site-${section.key}`}>
      <Eyebrow>{SECTION_EYEBROW[section.type]}</Eyebrow>
      <h3 className="mb-5 font-headline-sm text-[24px] font-normal text-(--site-accent) @3xl:mb-8 @3xl:font-headline-md @3xl:text-headline-md">
        {section.title}
      </h3>
      <Prose
        body={section.body}
        className="font-body-sm text-body-sm leading-relaxed text-on-surface-variant @3xl:font-body-md @3xl:text-body-md"
      />
    </div>
  );
}

function FaqBlock({ section }: { section: SiteSection }) {
  return (
    <div id={`site-${section.key}`}>
      <Eyebrow>{SECTION_EYEBROW[section.type]}</Eyebrow>
      <h3 className="mb-5 font-headline-sm text-[24px] font-normal text-(--site-accent) @3xl:mb-8 @3xl:font-headline-md @3xl:text-headline-md">
        {section.title}
      </h3>
      <dl className="space-y-5 @3xl:space-y-6">
        {parseFaq(section.body).map((item, index) => (
          <div key={index}>
            <dt className="font-title text-base font-semibold text-(--site-accent) @3xl:text-title">
              {item.question}
            </dt>
            {item.answer ? (
              <dd className="mt-0.5 font-body-sm text-body-sm leading-relaxed whitespace-pre-line text-on-surface-variant @3xl:font-body-md @3xl:text-body-md">
                {item.answer}
              </dd>
            ) : null}
          </div>
        ))}
      </dl>
    </div>
  );
}

function ContactSection({ section }: { section: SiteSection }) {
  return (
    <section
      id={`site-${section.key}`}
      className="border-t border-[#2A2622]/5 bg-[#FFFDF9] px-6 py-12 text-center @3xl:py-16"
    >
      <div className="mx-auto max-w-xl">
        <Eyebrow>{SECTION_EYEBROW[section.type]}</Eyebrow>
        <h3 className="mb-3 font-headline-sm text-headline-sm font-normal text-(--site-accent)">
          {section.title}
        </h3>
        <Prose
          body={section.body}
          className="font-body-sm text-body-sm leading-relaxed text-on-surface-variant @3xl:font-body-md @3xl:text-body-md"
        />
      </div>
    </section>
  );
}

/** Travel and FAQ sit side by side in the design; any other section stands alone. */
function renderSections(view: PublicSiteView, align: string) {
  const out: ReactNode[] = [];
  const list = view.sections;
  for (let index = 0; index < list.length; index += 1) {
    const section = list[index]!;
    const next = list[index + 1];
    if (
      (section.type === "travel" && next?.type === "faq") ||
      (section.type === "faq" && next?.type === "travel")
    ) {
      out.push(
        <section
          key={`${section.key}-${next.key}`}
          className="border-t border-[#2A2622]/5 px-6 py-14 @3xl:px-12 @3xl:py-24"
        >
          <div className="mx-auto grid max-w-4xl grid-cols-1 gap-12 @3xl:grid-cols-2 @3xl:gap-16">
            {[section, next].map((item) =>
              item.type === "travel" ? (
                <TravelBlock key={item.key} section={item} />
              ) : (
                <FaqBlock key={item.key} section={item} />
              ),
            )}
          </div>
        </section>,
      );
      index += 1;
      continue;
    }
    if (section.type === "schedule") {
      out.push(<ScheduleSection key={section.key} section={section} view={view} />);
    } else if (section.type === "contact") {
      out.push(<ContactSection key={section.key} section={section} />);
    } else if (section.type === "travel" || section.type === "faq") {
      out.push(
        <section
          key={section.key}
          className="border-t border-[#2A2622]/5 px-6 py-14 @3xl:px-12 @3xl:py-24"
        >
          <div className="mx-auto max-w-2xl">
            {section.type === "travel" ? (
              <TravelBlock section={section} />
            ) : (
              <FaqBlock section={section} />
            )}
          </div>
        </section>,
      );
    } else {
      out.push(<StorySection key={section.key} section={section} align={align} />);
    }
  }
  return out;
}

export function PublicSite({
  view,
  initialNow,
}: {
  view: PublicSiteView;
  /** ISO instant of the server's clock, so the countdown renders identically on both sides. */
  initialNow: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const style = TEMPLATE_STYLE[view.theme.templateKey];
  const heroAlign = style.align;

  function go(event: React.MouseEvent, key: string) {
    event.preventDefault();
    setMenuOpen(false);
    document.getElementById(`site-${key}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const dateLine = [view.dateLabel, view.city].filter(Boolean).join(" • ");
  // With a cover photo the text sits on a darkened picture, so it turns light.
  const photo = view.heroImageUrl;

  return (
    <div
      className="@container min-h-full bg-[#FAF6F0] font-body-md text-[#2A2622]"
      style={{ "--site-accent": view.theme.accentColor } as React.CSSProperties}
      data-template={view.theme.templateKey}
    >
      <nav
        aria-label="Wedding website"
        className="sticky top-0 z-30 border-b border-[#2A2622]/5 bg-[#FAF6F0]/90 backdrop-blur-md"
      >
        <div className="flex items-center justify-between px-6 py-4 @3xl:px-10 @3xl:py-5">
          <a
            href="#site-top"
            onClick={(event) => go(event, "top")}
            className="font-headline-sm text-headline-sm font-normal tracking-tight text-(--site-accent)"
          >
            {view.initials}
          </a>
          <div className="hidden items-center gap-8 font-label-md text-label-md @3xl:flex">
            {view.sections.map((section) => (
              <a
                key={section.key}
                href={`#site-${section.key}`}
                onClick={(event) => go(event, section.key)}
                className="tracking-wide text-on-surface-variant transition-colors hover:text-(--site-accent)"
              >
                {navLabel(section)}
              </a>
            ))}
          </div>
          {view.sections.length > 0 ? (
            <button
              type="button"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
              className="p-1 text-on-surface transition-colors hover:text-(--site-accent) @3xl:hidden"
            >
              <Icon name={menuOpen ? "close" : "menu"} />
            </button>
          ) : null}
        </div>
        {menuOpen ? (
          <div className="flex flex-col border-t border-[#2A2622]/5 px-6 py-2 @3xl:hidden">
            {view.sections.map((section) => (
              <a
                key={section.key}
                href={`#site-${section.key}`}
                onClick={(event) => go(event, section.key)}
                className="py-2.5 font-label-md text-label-md tracking-wide text-on-surface-variant"
              >
                {navLabel(section)}
              </a>
            ))}
          </div>
        ) : null}
      </nav>

      <header id="site-top" className="relative overflow-hidden px-6 py-14 @3xl:px-8 @3xl:py-28">
        {photo ? (
          <>
            {/* The cover is a Public gallery photo behind a short-lived signed address. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              fetchPriority="high"
            />
            <div aria-hidden="true" className="absolute inset-0 bg-[#1A1714]/55" />
          </>
        ) : null}
        <svg
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 h-full w-full opacity-[0.06] ${photo ? "hidden" : ""}`}
          fill="none"
          viewBox="0 0 1200 600"
          preserveAspectRatio="none"
        >
          <path
            d="M-50 480C180 430 360 520 620 440C880 360 1020 220 1250 260"
            stroke="currentColor"
            strokeDasharray="6 8"
            strokeWidth="2.5"
            className="text-(--site-accent)"
          />
          <path
            d="M-30 200C220 120 480 320 740 210C1000 100 1120 260 1280 180"
            stroke="currentColor"
            strokeWidth="2"
            className="text-(--site-accent)"
          />
          <path d="M120 590C380 490 620 620 920 480" stroke="#B5714A" strokeWidth="1.5" />
        </svg>
        <div className={`relative z-10 mx-auto flex max-w-3xl flex-col items-center ${heroAlign}`}>
          {style.ornament ? (
            <span aria-hidden="true" className="mb-3 font-headline-sm text-secondary">
              ✦
            </span>
          ) : null}
          <span
            className={`mb-4 font-label-sm text-label-sm font-semibold tracking-[0.25em] uppercase @3xl:mb-5 ${photo ? "text-white/85" : "text-[#686F6A]"}`}
          >
            We&apos;re getting married
          </span>
          <h1
            className={`mb-3 font-display-mobile text-display-mobile leading-none font-normal tracking-tight @3xl:mb-4 @3xl:font-display @3xl:text-display ${photo ? "text-white" : "text-(--site-accent)"} ${
              view.theme.templateKey === "editorial" ? "italic" : ""
            }`}
          >
            {view.title}
          </h1>
          {dateLine ? (
            <p
              className={`font-headline-sm text-headline-sm font-normal tracking-wide ${photo ? "text-white/90" : "text-secondary"}`}
            >
              {dateLine}
            </p>
          ) : null}
          {view.tagline ? (
            <p
              className={`mt-3 max-w-xl font-body-md text-body-md italic ${photo ? "text-white/90" : "text-on-surface-variant"}`}
            >
              {view.tagline}
            </p>
          ) : null}
          {view.countdownTarget ? (
            <div
              className={`mt-8 w-full max-w-md @3xl:mt-12 @3xl:w-auto @3xl:max-w-none ${photo ? "rounded-2xl bg-[#FAF6F0]/95 p-4 shadow-lg" : ""}`}
            >
              <Countdown target={view.countdownTarget} initialNow={initialNow} />
            </div>
          ) : null}
        </div>
      </header>

      {view.welcomeMessage ? (
        <section className="border-y border-[#2A2622]/5 bg-[#FFFDF9]/60 px-6 py-10 @3xl:py-16">
          <p className="mx-auto max-w-2xl text-center font-headline-sm text-headline-sm leading-snug font-normal text-[#2A2622] italic @3xl:leading-relaxed">
            &ldquo;{view.welcomeMessage}&rdquo;
          </p>
        </section>
      ) : null}

      {renderSections(view, style.align)}

      <footer className="border-t border-[#2A2622]/5 bg-[#FAF6F0] px-6 py-10 text-center @3xl:py-14">
        <div className="mb-2 font-headline-sm text-headline-sm font-normal tracking-wider text-(--site-accent)">
          {view.initials}
        </div>
        <p className="font-label-sm text-label-sm tracking-wider text-[#686F6A]">
          Made with Make My Marriage
        </p>
      </footer>
    </div>
  );
}
