import "server-only";
import { connectDb } from "@/infrastructure/database/connection";
import { isDuplicateKeyError } from "@/lib/errors";
import { RateLimitCounter } from "@/models/rateLimitCounter.model";

/** Increments the counter for one window and returns the new count. */
export async function incrementCounter(
  keyHash: string,
  windowStart: Date,
  expiresAt: Date,
): Promise<number> {
  await connectDb();
  const increment = () =>
    RateLimitCounter.findOneAndUpdate(
      { keyHash, windowStart },
      { $inc: { count: 1 }, $setOnInsert: { expiresAt } },
      { upsert: true, returnDocument: "after" },
    ).lean();

  try {
    return (await increment())?.count ?? 1;
  } catch (error) {
    // Two first-hits in the same window can race on the upsert; the loser simply retries.
    if (!isDuplicateKeyError(error)) throw error;
    return (await increment())?.count ?? 1;
  }
}
