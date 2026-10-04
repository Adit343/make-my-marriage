import mongoose, { Schema, Types } from "mongoose";
import { beforeEach, describe, expect, it } from "vitest";
import { softDeleteFields, softDeletePlugin } from "@/models/plugins/softDelete";
import { clearCollections, setupTestDatabase } from "../../setup/database";

// Shaped like weddingMembers: the partial unique index is what enforces "one user = one wedding".
const membershipSchema = new Schema(
  {
    weddingId: { type: Schema.Types.ObjectId, required: true },
    userId: { type: Schema.Types.ObjectId, required: true },
    note: { type: String },
    ...softDeleteFields,
  },
  { timestamps: true },
);
membershipSchema.plugin(softDeletePlugin);
membershipSchema.index(
  { userId: 1 },
  { unique: true, partialFilterExpression: { deletedAt: { $type: "null" } } },
);
const Membership = mongoose.model("SoftDeleteTestMembership", membershipSchema);

setupTestDatabase();
beforeEach(clearCollections);

const weddingId = new Types.ObjectId();

async function createMembership(userId = new Types.ObjectId()) {
  return Membership.create({ weddingId, userId });
}

async function softDelete(id: Types.ObjectId) {
  await Membership.updateOne({ _id: id }, { $set: { deletedAt: new Date() } });
}

describe("softDeletePlugin", () => {
  it("stores deletedAt as an explicit null, not a missing field", async () => {
    const membership = await createMembership();
    const raw = await Membership.collection.findOne({ _id: membership._id });
    expect(raw).toHaveProperty("deletedAt", null);
  });

  it("hides soft-deleted documents from find, findOne and countDocuments", async () => {
    const deleted = await createMembership();
    const active = await createMembership();
    await softDelete(deleted._id);

    const found = await Membership.find({ weddingId });
    expect(found.map((doc) => doc._id.toString())).toEqual([active._id.toString()]);
    expect(await Membership.findOne({ _id: deleted._id })).toBeNull();
    expect(await Membership.countDocuments({ weddingId })).toBe(1);
  });

  it("includes deleted documents only when asked with withDeleted", async () => {
    const deleted = await createMembership();
    await createMembership();
    await softDelete(deleted._id);

    expect(await Membership.find({ weddingId }, null, { withDeleted: true })).toHaveLength(2);
    expect(await Membership.countDocuments({ weddingId }).setOptions({ withDeleted: true })).toBe(
      2,
    );
  });

  it("respects an explicit deletedAt filter (e.g. restore flows)", async () => {
    const deleted = await createMembership();
    await createMembership();
    await softDelete(deleted._id);

    const found = await Membership.find({ weddingId, deletedAt: { $ne: null } });
    expect(found.map((doc) => doc._id.toString())).toEqual([deleted._id.toString()]);
  });

  it("does not let updates touch soft-deleted documents", async () => {
    const deleted = await createMembership();
    await createMembership();
    await softDelete(deleted._id);

    const result = await Membership.updateMany({ weddingId }, { $set: { note: "edited" } });
    expect(result.modifiedCount).toBe(1);
    const raw = await Membership.collection.findOne({ _id: deleted._id });
    expect(raw?.note).toBeUndefined();
  });

  it("allows one active row per user, freed again by soft delete", async () => {
    const userId = new Types.ObjectId();
    const first = await createMembership(userId);

    await expect(createMembership(userId)).rejects.toMatchObject({ code: 11000 });

    await softDelete(first._id);
    await expect(createMembership(userId)).resolves.toBeDefined();
  });

  it("lets MongoDB use the partial unique index for the per-request membership lookup (C6)", async () => {
    const userId = new Types.ObjectId();
    await createMembership(userId);

    // The plugin's { deletedAt: { $type: "null" } } matches the index's partial filter.
    const pluginPlan = JSON.stringify(await Membership.findOne({ userId }).explain("queryPlanner"));
    expect(pluginPlan).toContain('"indexName":"userId_1"');
    expect(pluginPlan).not.toContain("COLLSCAN");

    // The DB doc's original { deletedAt: null } cannot use it and scans the collection instead.
    const nullPlan = JSON.stringify(
      await Membership.collection.find({ userId, deletedAt: null }).explain("queryPlanner"),
    );
    expect(nullPlan).toContain("COLLSCAN");
  });
});
