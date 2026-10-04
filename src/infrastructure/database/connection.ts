import "server-only";
import mongoose from "mongoose";
import { getEnv } from "@/lib/env";

// Filters on paths that aren't in the schema throw instead of being silently dropped. A dropped
// filter is a security bug here: a typo such as `weddingID` would otherwise match every wedding.
mongoose.set("strictQuery", "throw");

interface ConnectionCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

// Serverless functions (Vercel) reuse warm instances; cache the connection on globalThis so each
// instance opens one small pool instead of one per request (DB Design §12.4.6).
const globalWithCache = globalThis as typeof globalThis & { __mmmMongoose?: ConnectionCache };
const cache = (globalWithCache.__mmmMongoose ??= { conn: null, promise: null });

/**
 * Commands are not buffered (`bufferCommands: false`), so repositories must await this before
 * touching a model. It is cheap after the first call.
 */
export async function connectDb(): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn;
  if (!cache.promise) {
    const env = getEnv();
    cache.promise = mongoose
      .connect(env.MONGODB_URI, {
        maxPoolSize: 5,
        bufferCommands: false,
        // Production indexes are applied deliberately with `npm run db:sync-indexes`.
        autoIndex: env.NODE_ENV !== "production",
      })
      .catch((error: unknown) => {
        cache.promise = null;
        throw error;
      });
  }
  cache.conn = await cache.promise;
  return cache.conn;
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
  cache.conn = null;
  cache.promise = null;
}
