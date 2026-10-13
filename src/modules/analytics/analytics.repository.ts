import "server-only";
import { connectDb } from "@/infrastructure/database/connection";
import { isDuplicateKeyError } from "@/lib/errors";
import type { AnalyticsEvent } from "@/lib/constants/analytics";
import { AnalyticsCounter } from "@/models/analyticsCounter.model";

export async function incrementEvent(event: AnalyticsEvent, day: string, by: number) {
  await connectDb();
  const dayStart = new Date(`${day}T00:00:00.000Z`);
  const increment = () =>
    AnalyticsCounter.updateOne(
      { event, day },
      { $inc: { count: by }, $setOnInsert: { dayStart } },
      { upsert: true },
    );
  try {
    await increment();
  } catch (error) {
    // Two first-hits on the same day can race on the upsert; the loser simply retries.
    if (!isDuplicateKeyError(error)) throw error;
    await increment();
  }
}

/** Daily counts from `fromDay` (inclusive) on. */
export async function findCounts(fromDay: string) {
  await connectDb();
  return AnalyticsCounter.find({ day: { $gte: fromDay } })
    .select({ event: 1, day: 1, count: 1, _id: 0 })
    .sort({ day: 1 })
    .lean();
}
