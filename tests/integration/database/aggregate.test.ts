import mongoose, { Schema, Types } from "mongoose";
import { beforeEach, describe, expect, it } from "vitest";
import { aggregateScoped } from "@/infrastructure/database/aggregate";
import { softDeleteFields, softDeletePlugin } from "@/models/plugins/softDelete";
import { clearCollections, setupTestDatabase } from "../../setup/database";

const expenseSchema = new Schema({
  weddingId: { type: Schema.Types.ObjectId, required: true },
  amountMinor: { type: Number, required: true },
  ...softDeleteFields,
});
expenseSchema.plugin(softDeletePlugin);
const Expense = mongoose.model("AggregateTestExpense", expenseSchema);

// Hard-delete collection (like emailLogs): no deletedAt field at all.
const Log = mongoose.model(
  "AggregateTestLog",
  new Schema({ weddingId: { type: Schema.Types.ObjectId }, status: String }),
);

const User = mongoose.model("AggregateTestUser", new Schema({ name: String }));

setupTestDatabase();
beforeEach(clearCollections);

const weddingA = new Types.ObjectId();
const weddingB = new Types.ObjectId();

type Total = { total: number };
const sumAmounts = [{ $group: { _id: null, total: { $sum: "$amountMinor" } } }];

describe("aggregateScoped()", () => {
  it("only sees the given wedding's non-deleted documents", async () => {
    await Expense.create([
      { weddingId: weddingA, amountMinor: 100 },
      { weddingId: weddingA, amountMinor: 250 },
      { weddingId: weddingA, amountMinor: 9_999, deletedAt: new Date() },
      { weddingId: weddingB, amountMinor: 5_000 },
    ]);

    const [result] = await aggregateScoped<Total>(Expense, weddingA, sumAmounts);
    expect(result?.total).toBe(350);
  });

  it("accepts the wedding id as a string (aggregations don't cast)", async () => {
    await Expense.create({ weddingId: weddingA, amountMinor: 100 });
    const [result] = await aggregateScoped<Total>(Expense, weddingA.toString(), sumAmounts);
    expect(result?.total).toBe(100);
  });

  it("skips the deletedAt filter for collections without soft delete", async () => {
    await Log.create([
      { weddingId: weddingA, status: "sent" },
      { weddingId: weddingB, status: "sent" },
    ]);
    const rows = await aggregateScoped(Log, weddingA, []);
    expect(rows).toHaveLength(1);
  });

  it("refuses models that are not wedding-owned", async () => {
    await expect(aggregateScoped(User, weddingA, [])).rejects.toThrow(/not a wedding-owned model/);
  });
});
