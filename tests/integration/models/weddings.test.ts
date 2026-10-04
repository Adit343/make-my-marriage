import { Types } from "mongoose";
import { beforeEach, describe, expect, it } from "vitest";
import type { MemberRelationship, MemberRole } from "@/lib/constants/enums";
import { Wedding } from "@/models/wedding.model";
import { WeddingMember } from "@/models/weddingMember.model";
import { clearCollections, setupTestDatabase } from "../../setup/database";

setupTestDatabase();
beforeEach(clearCollections);

const createdBy = new Types.ObjectId();

describe("weddings", () => {
  it("applies India-first defaults and stores deletedAt as an explicit null", async () => {
    const wedding = await Wedding.create({ title: "Aarav & Diya's Wedding", createdBy });
    expect(wedding.toObject()).toMatchObject({
      timezone: "Asia/Kolkata",
      currency: "INR",
      status: "planning",
      partners: [],
      weddingDate: null,
      budgetTotalMinor: null,
      purgeAfter: null,
      deletedAt: null,
    });
  });

  it.each([
    ["a date-time instead of a calendar day", { weddingDate: "2027-02-14T10:00:00Z" }],
    ["a day-first date", { weddingDate: "14-02-2027" }],
    ["fractional paise", { budgetTotalMinor: 499.5 }],
    ["a negative budget", { budgetTotalMinor: -1 }],
    ["a lowercase currency", { currency: "inr" }],
    ["three partners", { partners: [{ name: "A" }, { name: "B" }, { name: "C" }] }],
    ["an empty title", { title: " " }],
  ])("rejects %s", async (_label, override) => {
    await expect(Wedding.create({ title: "Test", createdBy, ...override })).rejects.toThrow();
  });

  it("refuses a stale save after someone else edited (optimistic concurrency)", async () => {
    const { _id } = await Wedding.create({ title: "Original", createdBy });
    const planner = await Wedding.findOne({ _id });
    const parent = await Wedding.findOne({ _id });

    parent!.title = "Renamed by parent";
    await parent!.save();

    planner!.title = "Overwritten by planner";
    await expect(planner!.save()).rejects.toThrow(/version/i);
  });
});

describe("weddingMembers", () => {
  type MemberFixture = {
    weddingId?: Types.ObjectId;
    userId?: Types.ObjectId;
    role?: MemberRole;
    relationship?: MemberRelationship;
  };
  const member = (overrides: MemberFixture = {}) => ({
    weddingId: new Types.ObjectId(),
    userId: new Types.ObjectId(),
    role: "member" as MemberRole,
    joinedAt: new Date(),
    ...overrides,
  });

  async function softDelete(id: Types.ObjectId) {
    await WeddingMember.updateOne({ _id: id }, { $set: { deletedAt: new Date() } });
  }

  it("allows one active wedding per user; leaving frees the slot", async () => {
    const userId = new Types.ObjectId();
    const first = await WeddingMember.create(member({ userId }));

    await expect(WeddingMember.create(member({ userId }))).rejects.toMatchObject({ code: 11000 });

    await softDelete(first._id);
    await expect(WeddingMember.create(member({ userId }))).resolves.toBeDefined();
  });

  it("allows exactly one active owner per wedding, but many admins and members", async () => {
    const weddingId = new Types.ObjectId();
    const owner = await WeddingMember.create(member({ weddingId, role: "owner" }));
    await WeddingMember.create(member({ weddingId, role: "admin" }));
    await WeddingMember.create(member({ weddingId, role: "admin" }));
    await WeddingMember.create(member({ weddingId, role: "member" }));

    await expect(WeddingMember.create(member({ weddingId, role: "owner" }))).rejects.toMatchObject({
      code: 11000,
    });

    // Another wedding's owner is unaffected.
    await expect(WeddingMember.create(member({ role: "owner" }))).resolves.toBeDefined();

    await softDelete(owner._id);
    await expect(WeddingMember.create(member({ weddingId, role: "owner" }))).resolves.toBeDefined();
  });

  it("rejects roles and relationships outside the enums", async () => {
    // Deliberately invalid values, cast past the types to reach the schema's own validation.
    await expect(WeddingMember.create(member({ role: "guest" as MemberRole }))).rejects.toThrow();
    await expect(
      WeddingMember.create(member({ relationship: "boss" as MemberRelationship })),
    ).rejects.toThrow();
  });

  it("defaults to an active member with no inviter", async () => {
    const created = new WeddingMember(member({ relationship: "parent" }));
    await created.save();
    expect(created.toObject()).toMatchObject({
      status: "active",
      invitedBy: null,
      deletedAt: null,
    });
  });
});
