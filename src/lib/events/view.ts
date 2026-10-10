import type { EventType } from "@/lib/constants/enums";
import {
  formatDateBlock,
  formatScheduleTime,
  formatDuration,
  formatLongDate,
  formatTimeRange,
  fullAddress,
  mapsUrl,
  venueLine,
} from "@/lib/events/format";
import type { EventDto } from "@/modules/events/event.dto";

// An event plus every label a screen needs, computed once on the server so the browser never has
// to format dates (and so server and browser can't disagree about them).

/** Labels as in the Stitch "Add / Edit Event" type select. */
export const EVENT_TYPE_LABEL: Record<EventType, string> = {
  mehendi: "Mehendi",
  haldi: "Haldi",
  sangeet: "Sangeet",
  engagement: "Engagement",
  ceremony: "Wedding ceremony",
  reception: "Reception",
  other: "Other",
};

export interface EventView extends EventDto {
  typeLabel: string;
  dateBlock: { day: string; monthYear: string; weekday: string };
  timeRange: string;
  venue: string | null;
  /** The next event that hasn't finished: the timeline highlights it. */
  isUpNext: boolean;
}

export interface EventDetailView extends EventView {
  longDate: string;
  /** "10:00 AM – 1:00 PM IST" (no leading zero, as on the detail screen). */
  detailTimeRange: string;
  duration: string | null;
  venueName: string | null;
  address: string | null;
  mapsUrl: string | null;
  coordinates: { latitude: number; longitude: number } | null;
  /** The event's run-of-show with a printable time on each line, in time order. */
  scheduleLines: (EventDto["schedule"][number] & { timeLabel: string })[];
}

/** `events` must already be in timeline order, as the service returns them. */
export function toEventViews(events: EventDto[], now: Date = new Date()): EventView[] {
  let upNextFound = false;
  return events.map((event) => {
    const startsAt = new Date(event.startsAt);
    const endsAt = event.endsAt ? new Date(event.endsAt) : null;
    const notFinished = (endsAt ?? startsAt).getTime() >= now.getTime();
    const isUpNext = notFinished && !upNextFound;
    if (isUpNext) upNextFound = true;
    return {
      ...event,
      typeLabel: EVENT_TYPE_LABEL[event.type],
      dateBlock: formatDateBlock(startsAt, event.timezone),
      timeRange: formatTimeRange(startsAt, endsAt, event.timezone),
      venue: venueLine(event.location),
      isUpNext,
    };
  });
}

export function toEventDetailView(event: EventDto, now: Date = new Date()): EventDetailView {
  const [view] = toEventViews([event], now);
  const startsAt = new Date(event.startsAt);
  const endsAt = event.endsAt ? new Date(event.endsAt) : null;
  const location = (event.location ?? {}) as {
    label?: string | null;
    coordinates?: { latitude: number; longitude: number } | null;
  };
  return {
    ...view!,
    longDate: formatLongDate(startsAt, event.timezone),
    detailTimeRange: formatTimeRange(startsAt, endsAt, event.timezone, false),
    duration: formatDuration(startsAt, endsAt),
    venueName: location.label?.trim() || null,
    address: fullAddress(event.location),
    mapsUrl: mapsUrl(event.location),
    coordinates: location.coordinates ?? null,
    scheduleLines: event.schedule.map((line) => ({
      ...line,
      timeLabel: formatScheduleTime(line.time),
    })),
  };
}
