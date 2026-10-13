import "server-only";
import { ANALYTICS_EVENTS, type AnalyticsEvent } from "@/lib/constants/analytics";
import { logger } from "@/lib/logger";
import { findCounts, incrementEvent } from "@/modules/analytics/analytics.repository";

const dayOf = (date: Date) => date.toISOString().slice(0, 10);

/**
 * Counts that `event` happened (`by` times). Fire-and-forget by design: analytics must never slow
 * down, fail or change a real request, so errors are logged and swallowed. Records only the event
 * name and the day, nothing about who or which wedding.
 */
export async function track(event: AnalyticsEvent, by = 1, now = new Date()): Promise<void> {
  if (by < 1) return;
  try {
    await incrementEvent(event, dayOf(now), Math.floor(by));
  } catch (error) {
    logger.warn("analytics.track_failed", { event, error });
  }
}

export interface AnalyticsSummary {
  fromDay: string;
  days: number;
  totals: Record<AnalyticsEvent, number>;
  /** Share of signups that went on to create a wedding in the window, or null with no signups. */
  signupToWedding: number | null;
}

/** Totals per event over the last `days` days (including today). */
export async function summarize(days = 30, now = new Date()): Promise<AnalyticsSummary> {
  const from = new Date(now.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  const rows = await findCounts(dayOf(from));
  const totals = Object.fromEntries(ANALYTICS_EVENTS.map((event) => [event, 0])) as Record<
    AnalyticsEvent,
    number
  >;
  for (const row of rows) totals[row.event as AnalyticsEvent] += row.count;
  return {
    fromDay: dayOf(from),
    days,
    totals,
    signupToWedding: totals.signup > 0 ? totals.wedding_created / totals.signup : null,
  };
}
