import "server-only";
import type { ClientSession } from "mongoose";
import { connectDb } from "@/infrastructure/database/connection";

/**
 * Runs `work` in a MongoDB transaction (DB Design §9.3 — use only where several writes must be
 * atomic: create wedding + owner, accept invitation, transfer ownership, cascading soft deletes).
 *
 * Every read and write inside must pass `{ session }`. The driver may retry `work` on transient
 * errors, so it must not have side effects outside the database (no emails, no external calls).
 */
export async function withTransaction<T>(work: (session: ClientSession) => Promise<T>): Promise<T> {
  const mongoose = await connectDb();
  return mongoose.connection.transaction(work);
}
