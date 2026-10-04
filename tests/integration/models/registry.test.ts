import mongoose from "mongoose";
import { describe, expect, it } from "vitest";
import "@/models";
import { setupTestDatabase } from "../../setup/database";

// The index catalog from DB Design §8.2 for the Phase 1 collections, written out independently
// of the schemas so an accidentally dropped or altered index fails a test.
const EXPECTED_INDEXES: Record<string, string[]> = {
  users: [
    "emailNormalized_1 unique",
    "authProviders.provider_1_authProviders.providerUserId_1 unique partial",
  ],
  sessions: ["tokenHash_1 unique", "userId_1", "expiresAt_1 ttl=0"],
  passwordResetTokens: ["tokenHash_1 unique", "userId_1", "expiresAt_1 ttl=0"],
  weddings: ["purgeAfter_1 partial"],
  weddingMembers: ["userId_1 unique partial", "weddingId_1", "weddingId_1_role_1 unique partial"],
  weddingInvitations: [
    "tokenHash_1 unique",
    "weddingId_1_status_1_createdAt_-1",
    "weddingId_1_emailNormalized_1 unique partial",
    "purgeAt_1 ttl=0",
  ],
  emailLogs: [
    "weddingId_1_createdAt_-1",
    "batchId_1",
    "idempotencyKey_1 unique partial",
    "invitationId_1 sparse",
    "createdAt_1 ttl=15552000",
  ],
  rateLimitCounters: ["keyHash_1_windowStart_1 unique", "expiresAt_1 ttl=0"],
};

setupTestDatabase();

function describeIndex(index: Record<string, unknown>): string {
  const flags = [
    index.unique ? "unique" : null,
    index.partialFilterExpression ? "partial" : null,
    index.sparse ? "sparse" : null,
    typeof index.expireAfterSeconds === "number" ? `ttl=${index.expireAfterSeconds}` : null,
  ].filter(Boolean);
  return [index.name, ...flags].join(" ");
}

describe("model registry", () => {
  it("registers every Phase 1 model under its DB Design collection name", () => {
    const collections = mongoose
      .modelNames()
      .map((name) => mongoose.model(name).collection.collectionName);
    expect(collections.sort()).toEqual(Object.keys(EXPECTED_INDEXES).sort());
  });

  it.each(Object.entries(EXPECTED_INDEXES))(
    "builds exactly the documented indexes on %s",
    async (collection, expected) => {
      const indexes = await mongoose.connection.db!.collection(collection).indexes();
      const actual = indexes
        .filter((index) => index.name !== "_id_")
        .map((index) => describeIndex(index));
      expect(actual.sort()).toEqual([...expected].sort());
    },
  );

  it("leaves nothing for db:sync-indexes to change after a sync", async () => {
    for (const name of mongoose.modelNames()) {
      const { toCreate, toDrop } = await mongoose.model(name).diffIndexes();
      expect({ name, toCreate, toDrop }).toEqual({ name, toCreate: [], toDrop: [] });
    }
  });
});
