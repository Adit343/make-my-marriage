import mongoose, { Schema, Types } from "mongoose";
import { beforeEach, describe, expect, it } from "vitest";
import { withTransaction } from "@/infrastructure/database/transaction";
import { clearCollections, setupTestDatabase } from "../../setup/database";

// Mirrors "create wedding + owner membership" (DB Design §9.3): never one without the other.
const Wedding = mongoose.model("TransactionTestWedding", new Schema({ title: String }));

const memberSchema = new Schema({
  weddingId: { type: Schema.Types.ObjectId, required: true },
  userId: { type: Schema.Types.ObjectId, required: true },
});
memberSchema.index({ userId: 1 }, { unique: true });
const Member = mongoose.model("TransactionTestMember", memberSchema);

setupTestDatabase();
beforeEach(clearCollections);

describe("withTransaction()", () => {
  it("commits every write and returns the callback's value", async () => {
    const userId = new Types.ObjectId();

    const weddingId = await withTransaction(async (session) => {
      const [wedding] = await Wedding.create([{ title: "Aarav & Diya" }], { session });
      await Member.create([{ weddingId: wedding!._id, userId }], { session });
      return wedding!._id;
    });

    expect(await Wedding.countDocuments({ _id: weddingId })).toBe(1);
    expect(await Member.countDocuments({ weddingId, userId })).toBe(1);
  });

  it("rolls everything back when the callback throws", async () => {
    await expect(
      withTransaction(async (session) => {
        await Wedding.create([{ title: "Never saved" }], { session });
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    expect(await Wedding.countDocuments()).toBe(0);
  });

  it("leaves no orphan wedding when the membership insert hits the unique index", async () => {
    const userId = new Types.ObjectId();
    await Member.create({ weddingId: new Types.ObjectId(), userId });

    await expect(
      withTransaction(async (session) => {
        const [wedding] = await Wedding.create([{ title: "Second wedding" }], { session });
        await Member.create([{ weddingId: wedding!._id, userId }], { session });
      }),
    ).rejects.toMatchObject({ code: 11000 });

    expect(await Wedding.countDocuments()).toBe(0);
  });
});
