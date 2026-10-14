"use client";

import { Select } from "@/components/ui/select";
import { useMemo, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { apiRequest, ApiError } from "@/lib/client/api-client";
import type { DietaryPreference, RsvpStatus } from "@/lib/constants/enums";
import { MAX_RSVP_NOTE } from "@/lib/constants/guests";
import {
  answerLabel,
  toRsvpPageView,
  type PublicRsvpData,
  type RsvpPageView,
} from "@/lib/invitations/rsvp-view";
import { DIETARY_LABEL, DIETARY_ORDER } from "@/lib/guests/view";

// The guest's own RSVP page (Stitch "Guest-Facing RSVP Page", states A and B). Mobile first: 48px
// tap targets, one card per event, a sticky send button. No account: the link is the credential.

type Choice = "attending" | "maybe" | "declined" | null;

interface Answer {
  choice: Choice;
  count: number;
}

const CHOICES: { value: Exclude<Choice, null>; label: string }[] = [
  { value: "attending", label: "Yes" },
  { value: "maybe", label: "Maybe" },
  { value: "declined", label: "No" },
];

const CHOICE_ACTIVE: Record<Exclude<Choice, null>, string> = {
  attending: "bg-primary-container text-on-primary shadow-sm",
  maybe: "bg-[#A0623C] text-white shadow-sm",
  declined: "bg-secondary text-on-secondary shadow-sm",
};

const ANSWER_DOT: Record<RsvpStatus, string> = {
  attending: "bg-primary text-primary",
  maybe: "bg-[#A0623C] text-[#A0623C]",
  declined: "bg-secondary text-secondary",
  pending: "bg-outline text-on-surface-variant",
};

function initialAnswers(view: RsvpPageView): Record<string, Answer> {
  return Object.fromEntries(
    view.events.map((event) => [
      event.eventId,
      {
        choice: event.status === "pending" ? null : (event.status as Exclude<Choice, null>),
        count: Math.max(1, event.attendingCount || 1),
      },
    ]),
  );
}

function Banner({ coupleNames, subtitle }: { coupleNames: string; subtitle: string }) {
  return (
    <div className="relative bg-primary-container px-6 pt-5 pb-5 text-center text-on-primary shadow-sm">
      <div className="mx-auto mb-2.5 h-0.5 w-10 rounded-full bg-secondary-fixed/50" />
      <h2 className="font-headline-sm text-headline-sm font-normal tracking-tight text-[#FAF6F0]">
        {coupleNames}
      </h2>
      <p className="mt-0.5 font-body-sm text-body-sm font-light text-primary-fixed">{subtitle}</p>
    </div>
  );
}

export function RsvpForm({ token, initial }: { token: string; initial: RsvpPageView }) {
  const [view, setView] = useState(initial);
  const [answers, setAnswers] = useState(() => initialAnswers(initial));
  const [diet, setDiet] = useState<DietaryPreference | "">(initial.dietaryPreference ?? "");
  const [message, setMessage] = useState(
    () => initial.events.find((event) => event.note)?.note ?? "",
  );
  const [step, setStep] = useState<"form" | "done">("form");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unanswered = useMemo(
    () => view.events.filter((event) => !answers[event.eventId]?.choice).length,
    [view.events, answers],
  );

  function setChoice(eventId: string, choice: Exclude<Choice, null>) {
    setError(null);
    setAnswers((current) => ({
      ...current,
      [eventId]: { count: 1, ...current[eventId], choice },
    }));
  }

  function setCount(eventId: string, delta: number) {
    const max = 1 + view.plusOnesAllowed;
    setAnswers((current) => {
      const answer = current[eventId] ?? { choice: null, count: 1 };
      return {
        ...current,
        [eventId]: { ...answer, count: Math.min(max, Math.max(1, answer.count + delta)) },
      };
    });
  }

  async function submit() {
    const responses = view.events.flatMap((event) => {
      const answer = answers[event.eventId];
      if (!answer?.choice) return [];
      return [
        {
          eventId: event.eventId,
          status: answer.choice,
          ...(answer.choice === "declined" ? {} : { attendingCount: answer.count }),
          note: message.trim() === "" ? null : message.trim(),
        },
      ];
    });
    if (responses.length === 0) {
      setError("Please choose Yes, Maybe or No for at least one event.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const saved = await apiRequest<PublicRsvpData>(
        `/api/v1/public/rsvp/${encodeURIComponent(token)}`,
        {
          method: "PATCH",
          body: { responses, ...(diet ? { dietaryPreference: diet } : {}) },
        },
      );
      setView(toRsvpPageView(saved));
      setStep("done");
      window.scrollTo({ top: 0 });
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.status === 403
            ? "This link isn't working any more. Please ask the couple for a new one."
            : caught.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (step === "done") {
    const answered = view.events.filter((event) => event.status !== "pending");
    return (
      <>
        <Banner coupleNames={view.coupleNames} subtitle="We'd love to have you with us." />
        <div className="flex flex-1 flex-col gap-6 bg-background p-5 pb-10">
          <div className="space-y-6 pt-4 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary-fixed text-primary-container shadow-inner">
              <Icon name="check_circle" className="text-4xl" />
            </div>
            <div className="space-y-1.5" role="status">
              <h1 className="font-headline-md text-headline-md font-normal tracking-tight text-on-surface">
                Thank you, {view.firstName}
              </h1>
              <p className="mx-auto max-w-[280px] font-body-md text-body-md text-on-surface-variant">
                Your response has been shared with {view.coupleNames}.
              </p>
            </div>

            <div className="space-y-4 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-5 text-left shadow-[0_2px_12px_-2px_rgba(42,38,34,0.04)]">
              <div className="flex items-center justify-between border-b border-outline-variant/20 pb-2.5">
                <h2 className="font-label-md text-label-md font-semibold tracking-wider text-on-surface-variant uppercase">
                  Your RSVP summary
                </h2>
                <span className="rounded-full bg-primary-fixed px-2 py-0.5 text-xs font-medium text-primary">
                  Received
                </span>
              </div>
              <ul className="space-y-3 font-body-sm text-body-sm">
                {answered.map((event, index) => (
                  <li key={event.eventId}>
                    {index > 0 ? <div className="mb-3 h-px bg-outline-variant/20" /> : null}
                    <div className="flex items-center justify-between gap-3 py-1">
                      <div>
                        <p className="font-medium text-on-surface">{event.name}</p>
                        <p className="text-xs text-on-surface-variant">{event.dayPart}</p>
                      </div>
                      <span
                        className={`inline-flex shrink-0 items-center gap-1 font-title font-semibold ${ANSWER_DOT[event.status].split(" ")[1]}`}
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${ANSWER_DOT[event.status].split(" ")[0]}`}
                        />
                        {answerLabel(event.status, event.attendingCount)}
                      </span>
                    </div>
                  </li>
                ))}
                {view.dietaryPreference ? (
                  <li>
                    <div className="mb-3 h-px bg-outline-variant/20" />
                    <div className="flex items-center justify-between py-1">
                      <span className="font-medium text-on-surface">Dietary preference</span>
                      <span className="rounded bg-surface-container px-2 py-0.5 text-xs font-semibold text-on-surface-variant">
                        {DIETARY_LABEL[view.dietaryPreference]}
                      </span>
                    </div>
                  </li>
                ) : null}
              </ul>
            </div>
          </div>

          <div className="space-y-3 text-center">
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Need to alter your plans? You can reopen this same invitation anytime to adjust your
              response.
            </p>
            <button
              type="button"
              onClick={() => {
                setStep("form");
                window.scrollTo({ top: 0 });
              }}
              className="mx-auto flex h-12 items-center justify-center gap-2 rounded-lg border border-outline-variant/60 bg-surface-container-lowest px-6 font-title text-[15px] font-semibold text-primary transition-colors hover:bg-surface-container-low focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:outline-hidden"
            >
              <Icon name="edit" className="text-[18px]" />
              Change my response
            </button>
          </div>
        </div>
      </>
    );
  }

  const maxCount = 1 + view.plusOnesAllowed;
  return (
    <>
      <Banner coupleNames={view.coupleNames} subtitle="We'd love to have you with us." />
      <div className="flex-1 space-y-4 bg-background p-4 pb-32">
        <div className="px-1 pt-1">
          <h1 className="font-headline-md text-headline-md font-normal tracking-tight text-on-surface">
            Hello, {view.firstName}
          </h1>
          <p className="mt-0.5 font-body-sm text-body-sm text-on-surface-variant">
            {view.hasResponded
              ? "You've replied before. You can change your answers any time."
              : "Please let us know which events you can join."}
          </p>
        </div>

        {view.events.length === 0 ? (
          <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-5 text-center font-body-sm text-body-sm text-on-surface-variant">
            There are no events on your invitation yet. Please check back soon.
          </div>
        ) : null}

        {view.events.map((event) => {
          const answer = answers[event.eventId] ?? { choice: null, count: 1 };
          const groupId = `rsvp-${event.eventId}`;
          return (
            <section
              key={event.eventId}
              aria-labelledby={`${groupId}-title`}
              className="space-y-3.5 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-[0_2px_12px_-2px_rgba(42,38,34,0.04)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="inline-block rounded bg-secondary-fixed/30 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-secondary uppercase">
                    {event.typeLabel}
                  </span>
                  <h2
                    id={`${groupId}-title`}
                    className="mt-1 font-headline-sm text-headline-sm font-normal text-on-surface"
                  >
                    {event.name}
                  </h2>
                </div>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary-fixed/40 text-secondary">
                  <Icon name={event.icon} className="text-lg" />
                </div>
              </div>

              <div className="space-y-1.5 pt-0.5 font-body-sm text-body-sm text-on-surface-variant">
                <div className="flex items-center gap-2">
                  <Icon name="calendar_today" className="text-base text-secondary" />
                  <span>{event.when}</span>
                </div>
                {event.venue ? (
                  <div className="flex items-center gap-2">
                    <Icon name="location_on" className="text-base text-secondary" />
                    {event.mapsUrl ? (
                      <a
                        href={event.mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline decoration-secondary/40 underline-offset-2 hover:text-primary"
                      >
                        {event.venue}
                      </a>
                    ) : (
                      <span>{event.venue}</span>
                    )}
                  </div>
                ) : null}
                {event.dressCode ? (
                  <div className="flex items-center gap-2">
                    <Icon name="palette" className="text-base text-secondary" />
                    <span>
                      Dress code:{" "}
                      <strong className="font-medium text-on-surface">{event.dressCode}</strong>
                    </span>
                  </div>
                ) : null}
              </div>

              <div className="pt-1">
                <div
                  role="radiogroup"
                  aria-label={`RSVP for ${event.name}`}
                  className="grid grid-cols-3 gap-1.5 rounded-lg border border-outline-variant/30 bg-surface-container p-1"
                >
                  {CHOICES.map((choice) => {
                    const selected = answer.choice === choice.value;
                    return (
                      <button
                        key={choice.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setChoice(event.eventId, choice.value)}
                        className={`flex h-12 items-center justify-center rounded font-title text-[15px] transition-all focus:ring-2 focus:ring-secondary focus:outline-hidden ${
                          selected
                            ? `font-semibold ${CHOICE_ACTIVE[choice.value]}`
                            : "font-medium text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
                        }`}
                      >
                        {choice.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {answer.choice === "attending" && maxCount > 1 ? (
                <div className="border-t border-outline-variant/20 pt-2">
                  <div className="space-y-2 rounded-lg bg-surface-container-low p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-body-sm text-body-sm font-medium text-on-surface">
                        How many people are coming?
                      </span>
                      <div className="flex items-center rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-0.5">
                        <button
                          type="button"
                          aria-label={`Fewer people for ${event.name}`}
                          disabled={answer.count <= 1}
                          onClick={() => setCount(event.eventId, -1)}
                          className="flex h-10 w-10 items-center justify-center rounded text-on-surface transition-colors hover:bg-surface-container disabled:opacity-40"
                        >
                          <Icon name="remove" className="text-lg" />
                        </button>
                        <span
                          aria-live="polite"
                          className="w-9 text-center font-title text-base font-bold text-primary"
                        >
                          {answer.count}
                        </span>
                        <button
                          type="button"
                          aria-label={`More people for ${event.name}`}
                          disabled={answer.count >= maxCount}
                          onClick={() => setCount(event.eventId, 1)}
                          className="flex h-10 w-10 items-center justify-center rounded text-on-surface transition-colors hover:bg-surface-container disabled:opacity-40"
                        >
                          <Icon name="add" className="text-lg" />
                        </button>
                      </div>
                    </div>
                    <p className="font-body-sm text-[12px] leading-tight text-on-surface-variant">
                      Including you. You can bring up to {view.plusOnesAllowed}{" "}
                      {view.plusOnesAllowed === 1 ? "guest" : "guests"}.
                    </p>
                  </div>
                </div>
              ) : null}
            </section>
          );
        })}

        <div className="space-y-2 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-[0_2px_12px_-2px_rgba(42,38,34,0.04)]">
          <label
            htmlFor="dietary-select"
            className="block font-title text-[15px] font-semibold text-on-surface"
          >
            Food &amp; dietary preferences
          </label>
          <p className="font-body-sm text-[12px] text-on-surface-variant">
            Helps us curate your meal options with the chefs.
          </p>
          <div className="pt-1">
            <Select
              id="dietary-select"
              value={diet}
              onChange={(value) => setDiet(value as DietaryPreference | "")}
              fieldClass="h-12 w-full rounded-lg border border-outline-variant/50 bg-surface-container-low px-3.5 font-body-md text-body-md text-on-surface transition-all focus:border-primary focus:ring-2 focus:ring-primary/10 focus:outline-hidden"
            >
              <option value="">Choose one (optional)</option>
              {DIETARY_ORDER.map((value) => (
                <option key={value} value={value}>
                  {DIETARY_LABEL[value]}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="space-y-2 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-[0_2px_12px_-2px_rgba(42,38,34,0.04)]">
          <label
            htmlFor="couple-message"
            className="block font-title text-[15px] font-semibold text-on-surface"
          >
            Message for the couple{" "}
            <span className="text-xs font-normal text-on-surface-variant">(optional)</span>
          </label>
          <textarea
            id="couple-message"
            rows={3}
            maxLength={MAX_RSVP_NOTE}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Write warm wishes or special notes..."
            className="w-full resize-none rounded-lg border border-outline-variant/50 bg-surface-container-low p-3 font-body-md text-body-md text-on-surface transition-all placeholder:text-on-surface-variant/40 focus:border-primary focus:ring-2 focus:ring-primary/10 focus:outline-hidden"
          />
        </div>

        <div className="space-y-2 px-4 pt-2 pb-6 text-center">
          <p className="font-body-sm text-[12px] leading-relaxed text-on-surface-variant">
            You can come back to this link and change your answers any time.
          </p>
          <div className="inline-flex items-center gap-1.5 font-label-sm text-[11px] font-medium tracking-wide text-on-surface-variant">
            <Icon name="lock" className="text-[14px]" />
            <span>Private link, just for you</span>
          </div>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[480px] border-t border-outline-variant/20 bg-surface/95 p-4 pt-2 shadow-[0_-8px_20px_rgba(42,38,34,0.06)] backdrop-blur-md">
        {error ? (
          <p role="alert" className="mb-2 text-center font-body-sm text-body-sm text-error">
            {error}
          </p>
        ) : unanswered > 0 && view.events.length > 0 ? (
          <p className="mb-2 text-center font-body-sm text-[12px] text-on-surface-variant">
            {unanswered} of {view.events.length} {unanswered === 1 ? "event" : "events"} not
            answered yet
          </p>
        ) : null}
        <button
          type="button"
          onClick={submit}
          disabled={busy || view.events.length === 0}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-primary-container font-title text-base font-semibold text-[#FAF6F0] shadow-sm transition-all hover:bg-[#163A2E] focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:outline-hidden active:scale-[0.99] disabled:opacity-60"
        >
          {busy ? (
            <span>Sending…</span>
          ) : (
            <>
              <span>{view.hasResponded ? "Update my response" : "Send my response"}</span>
              <Icon name="arrow_forward" className="text-lg" />
            </>
          )}
        </button>
      </div>
    </>
  );
}
