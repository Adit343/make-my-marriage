import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { afterAll, beforeAll, inject, vi } from "vitest";
import { connectDb, disconnectDb } from "@/infrastructure/database/connection";
import { resetEnvCacheForTests } from "@/lib/env";

/**
 * Connects the real connectDb() to a fresh database for this test file, builds the declared
 * indexes (the same syncIndexes() path the deploy script uses) and drops the database afterwards.
 * Call at the top level of an integration test file, after defining any test models.
 */
export function setupTestDatabase() {
  beforeAll(async () => {
    const dbName = `test_${randomUUID().replaceAll("-", "")}`;
    const baseUri = inject("mongoUri");
    if (!baseUri.includes("/?")) throw new Error(`Unexpected test Mongo URI: ${baseUri}`);

    vi.stubEnv("MONGODB_URI", baseUri.replace("/?", `/${dbName}?`));
    vi.stubEnv("APP_URL", "http://localhost:3000");
    vi.stubEnv("SESSION_SECRET", "test-session-secret-".padEnd(43, "x"));
    resetEnvCacheForTests();

    await connectDb();
    for (const name of mongoose.modelNames()) {
      await mongoose.model(name).syncIndexes();
    }
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await disconnectDb();
    vi.unstubAllEnvs();
    resetEnvCacheForTests();
  });
}

/** Empties every collection while keeping indexes. Use in beforeEach when tests share a file. */
export async function clearCollections() {
  const db = mongoose.connection.db;
  if (!db) throw new Error("clearCollections() called before setupTestDatabase() connected");
  for (const collection of await db.collections()) {
    await collection.deleteMany({});
  }
}
