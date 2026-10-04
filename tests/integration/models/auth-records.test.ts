import { createHash, randomBytes } from "node:crypto";
import { Types } from "mongoose";
import { beforeEach, describe, expect, it } from "vitest";
import type { EmailType } from "@/lib/constants/enums";
import { EmailLog } from "@/models/emailLog.model";
import { PasswordResetToken } from "@/models/passwordResetToken.model";
import { RateLimitCounter } from "@/models/rateLimitCounter.model";
import { Session } from "@/models/session.model";
import { clearCollections, setupTestDatabase } from "../../setup/database";

setupTestDatabase();
beforeEach(clearCollections);

const hash = () => randomBytes(32).toString("hex");
const inMinutes = (minutes: number) => new Date(Date.now() + minutes * 60_000);

describe("sessions", () => {
  it("stores only createdAt, hides the token hash and keeps it unique", async () => {
    const tokenHash = hash();
    const { _id } = await Session.create({
      userId: new Types.ObjectId(),
      tokenHash,
      expiresAt: inMinutes(60),
      lastUsedAt: new Date(),
    });

    const plain = await Session.findOne({ _id }).lean();
    expect(plain).not.toHaveProperty("tokenHash");
    expect(plain).not.toHaveProperty("updatedAt");
    expect(plain).toMatchObject({ revokedAt: null });
    expect(plain?.createdAt).toBeInstanceOf(Date);

    await expect(
      Session.create({
        userId: new Types.ObjectId(),
        tokenHash,
        expiresAt: inMinutes(60),
        lastUsedAt: new Date(),
      }),
    ).rejects.toMatchObject({ code: 11000 });
  });
});

describe("passwordResetTokens", () => {
  it("can be claimed exactly once, and never after expiry", async () => {
    const tokenHash = hash();
    const expiredHash = hash();
    const userId = new Types.ObjectId();
    await PasswordResetToken.create({ userId, tokenHash, expiresAt: inMinutes(30) });
    await PasswordResetToken.create({ userId, tokenHash: expiredHash, expiresAt: inMinutes(-1) });

    const claim = (value: string) =>
      PasswordResetToken.findOneAndUpdate(
        { tokenHash: value, usedAt: null, expiresAt: { $gt: new Date() } },
        { $set: { usedAt: new Date() } },
      );

    expect(await claim(tokenHash)).not.toBeNull();
    expect(await claim(tokenHash)).toBeNull();
    expect(await claim(expiredHash)).toBeNull();
  });
});

describe("rateLimitCounters", () => {
  it("counts within a window via upsert and starts fresh in the next window", async () => {
    const keyHash = createHash("sha256").update("login:203.0.113.4:priya@gmail.com").digest("hex");
    const windowStart = new Date("2026-10-04T10:00:00Z");
    const nextWindow = new Date("2026-10-04T10:15:00Z");

    const hit = (start: Date) =>
      RateLimitCounter.findOneAndUpdate(
        { keyHash, windowStart: start },
        {
          $inc: { count: 1 },
          $setOnInsert: { expiresAt: new Date(start.getTime() + 15 * 60_000) },
        },
        { upsert: true, returnDocument: "after" },
      );

    await hit(windowStart);
    const second = await hit(windowStart);
    expect(second?.count).toBe(2);

    const fresh = await hit(nextWindow);
    expect(fresh?.count).toBe(1);
    expect(await RateLimitCounter.countDocuments()).toBe(2);

    // Only the hash is stored, never the raw key.
    const raw = await RateLimitCounter.collection.findOne({});
    expect(JSON.stringify(raw)).not.toContain("priya@gmail.com");
  });
});

describe("emailLogs", () => {
  const log = (overrides: { type?: EmailType; idempotencyKey?: string } = {}) => ({
    type: "member_invitation" as EmailType,
    recipientEmail: "meena@example.com",
    status: "sent" as const,
    provider: "console",
    batchId: "batch-1",
    ...overrides,
  });

  it("defaults to one attempt, no error, and allows account-level rows without a wedding", async () => {
    const created = await EmailLog.create(log({ type: "password_reset" }));
    expect(created.toObject()).toMatchObject({
      weddingId: null,
      attempts: 1,
      error: null,
      idempotencyKey: null,
    });
  });

  it("blocks a second send with the same idempotency key; rows without a key are unrestricted", async () => {
    await EmailLog.create(log());
    await EmailLog.create(log());
    await EmailLog.create(log({ idempotencyKey: "member_invitation:i1:batch-1" }));

    await expect(
      EmailLog.create(log({ idempotencyKey: "member_invitation:i1:batch-1" })),
    ).rejects.toMatchObject({
      code: 11000,
    });
  });
});
