"use client";

import Link from "next/link";
import { EventMenu, type EventMenuItem } from "@/components/events/event-menu";
import { useEventActions } from "@/components/events/use-event-actions";
import { Icon } from "@/components/ui/icon";
import type { EventType } from "@/lib/constants/enums";
import type { EventView } from "@/lib/events/view";

// Stitch screen: "Events Timeline (Owner View)". A vertical timeline of every function of the
// wedding. Guests and RSVPs arrive in Phase 3, so the RSVP column says so instead of inventing
// numbers.

// Chip and timeline-dot colours per event type, as in the design.
const TYPE_STYLE: Record<EventType, { chip: string; dot: string; hover: string }> = {
  mehendi: {
    chip: "bg-[#1F4D3D]/10 text-[#1F4D3D]",
    dot: "bg-[#1F4D3D]",
    hover: "hover:border-l-[#1F4D3D]/40",
  },
  haldi: {
    chip: "bg-[#B5714A]/10 text-[#9A5A36]",
    dot: "bg-[#B5714A]",
    hover: "hover:border-l-[#B5714A]/40",
  },
  sangeet: {
    chip: "bg-[#8b4f2b]/10 text-secondary",
    dot: "bg-[#8b4f2b]",
    hover: "hover:border-l-[#8b4f2b]/40",
  },
  engagement: {
    chip: "bg-[#B5714A]/10 text-[#9A5A36]",
    dot: "bg-[#B5714A]",
    hover: "hover:border-l-[#B5714A]/40",
  },
  ceremony: {
    chip: "bg-[#1F4D3D]/10 text-primary",
    dot: "bg-[#1F4D3D]",
    hover: "hover:border-l-[#1F4D3D]/40",
  },
  reception: {
    chip: "bg-surface-container-high text-on-surface",
    dot: "bg-outline",
    hover: "hover:border-l-primary/30",
  },
  other: {
    chip: "bg-surface-container-high text-on-surface",
    dot: "bg-outline",
    hover: "hover:border-l-primary/30",
  },
};

const PILL =
  "inline-flex items-center gap-2.5 rounded-xl bg-[#FFFDF9] px-4 py-2 font-body-sm text-body-sm text-[#2A2622] elevation-1";

export function EventsManager({
  weddingId,
  weddingTimezone,
  events,
  summary,
  canCreate,
}: {
  weddingId: string;
  weddingTimezone: string;
  events: EventView[];
  summary: { count: number; next: { text: string; strong: string } };
  canCreate: boolean;
}) {
  const actions = useEventActions({ weddingId, weddingTimezone });

  return (
    <div className="mx-auto max-w-[1040px]">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-headline-md text-headline-md tracking-tight text-[#2A2622]">
            Events
          </h1>
          <p className="mt-1 font-body-md text-body-md text-on-surface-variant">
            Every function of your wedding, in one timeline.
          </p>
        </div>
        {canCreate ? (
          <button
            type="button"
            onClick={() => actions.openDrawer({ kind: "create" })}
            className="flex items-center gap-1.5 self-start rounded-xl bg-[#1F4D3D] px-5 py-2.5 font-title text-body-sm font-medium text-[#FAF6F0] shadow-sm transition-all duration-150 hover:bg-[#16382c] active:scale-[0.99]"
          >
            <Icon name="add" className="text-[18px]" />
            <span>Add event</span>
          </button>
        ) : null}
      </div>

      <div className="mb-9 flex flex-wrap items-center gap-3">
        <div className={PILL}>
          <span className="h-2 w-2 rounded-full bg-primary" />
          <span className="font-medium">
            {summary.count} {summary.count === 1 ? "event" : "events"}
          </span>
        </div>
        <div className={PILL}>
          <span className="h-2 w-2 rounded-full bg-[#B5714A]" />
          <span>
            {summary.next.text}
            <strong className={summary.next.text ? "font-semibold text-primary" : "font-medium"}>
              {summary.next.strong}
            </strong>
          </span>
        </div>
        <div className={PILL}>
          <Icon name="group" className="text-[16px] text-outline" />
          <span>
            <strong>0</strong> guests invited across events
          </span>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[#2A2622]/15 bg-[#FFFDF9] px-6 py-16 text-center">
          <Icon name="calendar_month" className="text-[28px] text-outline" />
          <h2 className="font-headline-sm text-headline-sm font-medium text-[#2A2622]">
            No events yet
          </h2>
          <p className="max-w-sm font-body-md text-body-md text-on-surface-variant">
            Add Mehendi, Haldi, Sangeet, the ceremony and more, and they line up here in order.
          </p>
          {canCreate ? (
            <button
              type="button"
              onClick={() => actions.openDrawer({ kind: "create" })}
              className="mt-2 flex items-center gap-1.5 rounded-xl bg-[#1F4D3D] px-5 py-2.5 font-title text-body-sm font-medium text-[#FAF6F0] shadow-sm transition-all hover:bg-[#16382c] active:scale-[0.99]"
            >
              <Icon name="add" className="text-[18px]" />
              Add your first event
            </button>
          ) : null}
        </div>
      ) : (
        <div className="relative pl-7">
          <div
            aria-hidden="true"
            className="absolute top-6 bottom-10 left-2.5 w-[1.5px] bg-[#E2DBD2]"
          />
          <ol className="space-y-6">
            {events.map((event) => (
              <EventCard key={event.id} event={event} menu={actions.menuItems(event)} />
            ))}
          </ol>
        </div>
      )}

      {actions.overlays}
    </div>
  );
}

function EventCard({ event, menu }: { event: EventView; menu: EventMenuItem[] }) {
  const style = TYPE_STYLE[event.type];
  const chipLabel = event.type === "ceremony" ? "Ceremony" : event.typeLabel;

  return (
    <li className="relative">
      <div className="absolute top-7 -left-7 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-[#FAF6F0]">
        {event.isUpNext ? (
          <div className="h-2.5 w-2.5 rounded-full bg-[#1F4D3D] ring-4 ring-[#1F4D3D]/15" />
        ) : (
          <div className={`h-2 w-2 rounded-full ${style.dot}`} />
        )}
      </div>

      <div
        className={`elevation-1 w-full rounded-2xl border-l-[3px] bg-[#FFFDF9] p-5 transition-all duration-200 md:p-6 ${
          event.isUpNext
            ? "border-l-[#1F4D3D] hover:shadow-md"
            : `border-l-transparent ${style.hover}`
        }`}
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4 md:gap-6">
            <div className="w-16 shrink-0 border-r border-[#2A2622]/[0.06] pr-4 text-center md:w-20 md:pr-5">
              <div
                className={`font-headline-lg text-[34px] leading-none font-medium ${event.isUpNext ? "text-primary" : "text-[#2A2622]"}`}
              >
                {event.dateBlock.day}
              </div>
              <div className="mt-1 font-label-sm text-[11px] font-semibold tracking-wider text-on-surface-variant uppercase">
                {event.dateBlock.monthYear}
              </div>
              <div className="mt-0.5 font-body-sm text-[12px] text-on-surface-variant">
                {event.dateBlock.weekday}
              </div>
            </div>

            <div className="min-w-0">
              <div className="mb-1.5 flex flex-wrap items-center gap-2.5">
                {event.isUpNext ? (
                  <span className="rounded bg-[#1F4D3D] px-2 py-0.5 font-label-sm text-[10px] font-medium text-[#FAF6F0]">
                    Up next
                  </span>
                ) : null}
                <span
                  className={`rounded-full px-2.5 py-0.5 font-label-sm text-[10px] font-medium ${style.chip}`}
                >
                  {chipLabel}
                </span>
                <span className="rounded-full bg-surface-container px-2 py-0.5 font-label-sm text-[10px] font-medium text-on-surface-variant">
                  {event.isPublic ? "Public" : "Private"}
                </span>
              </div>
              <h2 className="font-headline-sm text-headline-sm leading-snug font-medium text-[#2A2622]">
                <Link
                  href={`/dashboard/events/${event.id}`}
                  className="transition-colors hover:text-primary focus-visible:underline focus-visible:outline-none"
                >
                  {event.name}
                </Link>
              </h2>
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 font-body-sm text-[13px] text-on-surface-variant">
                <span className="flex items-center gap-1.5">
                  <Icon name="schedule" className="text-[16px] text-outline" />
                  {event.timeRange}
                </span>
                {event.venue ? (
                  <span className="flex items-center gap-1.5">
                    <Icon name="location_on" className="text-[16px] text-outline" />
                    {event.venue}
                  </span>
                ) : null}
                {event.dressCode ? (
                  <span className="flex items-center gap-1.5 text-secondary">
                    <Icon name="palette" className="text-[16px]" />
                    Dress Code: {event.dressCode}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-4 md:gap-6 md:pl-4">
            <div className="w-full md:w-44 md:text-right">
              <div className="mb-1.5 font-body-sm text-[12px] text-on-surface-variant">
                No guests invited yet
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#EAE1DA]" />
            </div>
            <EventMenu eventName={event.name} items={menu} />
          </div>
        </div>
      </div>
    </li>
  );
}
