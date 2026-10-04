import { randomBytes } from "node:crypto";
import { Types } from "mongoose";
import { beforeEach, describe, expect, it } from "vitest";
import type { InvitationRole } from "@/lib/constants/enums";
import { WeddingInvitation } from "@/models/weddingInvitation.model";
import { clearCollections, setupTestDatabase } from "../../setup/database";

setupTestDatabase();
beforeEach(clearCollections);

const DAY = 24 * 60 * 60 * 1000;

type InvitationFixture = {
  weddingId?: Types.ObjectId;
  email?: string;
  role?: InvitationRole;
  tokenHash?: string;
};

function invitation(overrides: InvitationFixture = {}) {
  const expiresAt = new Date(Date.now() + 7 * DAY);
  return {
    weddingId: new Types.ObjectId(),
    invitedBy: new Types.ObjectId(),
    email: "Meena@Example.com",
    role: "member" as InvitationRole,
    tokenHash: randomBytes(32).toString("hex"),
    expiresAt,
    purgeAt: new Date(expiresAt.getTime() + 30 * DAY),
    ...overrides,
  };
}

describe("weddingInvitations", () => {
  it("normalizes the invitee email and starts pending", async () => {
    const created = await WeddingInvitation.create(invitation());
    expect(created.toObject()).toMatchObject({
      email: "Meena@Example.com",
      emailNormalized: "meena@example.com",
      status: "pending",
      acceptedAt: null,
      revokedAt: null,
    });
  });

  it("never grants ownership through an invitation", async () => {
    // Deliberately invalid, cast past the types to reach the schema's own enum check.
    await expect(
      WeddingInvitation.create(invitation({ role: "owner" as InvitationRole })),
    ).rejects.toThrow();
  });

  it("allows one pending invitation per email per wedding", async () => {
    const weddingId = new Types.ObjectId();
    const first = await WeddingInvitation.create(invitation({ weddingId }));

    await expect(
      WeddingInvitation.create(invitation({ weddingId, email: "meena@example.com" })),
    ).rejects.toMatchObject({ code: 11000 });

    // A different wedding may invite the same person.
    await expect(WeddingInvitation.create(invitation())).resolves.toBeDefined();

    // Once the first is no longer pending, the same wedding may invite again.
    await WeddingInvitation.updateOne(
      { _id: first._id },
      { $set: { status: "revoked", revokedAt: new Date() } },
    );
    await expect(WeddingInvitation.create(invitation({ weddingId }))).resolves.toBeDefined();
  });

  it("keeps token hashes unique and out of query results by default", async () => {
    const tokenHash = randomBytes(32).toString("hex");
    const { _id } = await WeddingInvitation.create(invitation({ tokenHash }));

    await expect(WeddingInvitation.create(invitation({ tokenHash }))).rejects.toMatchObject({
      code: 11000,
    });

    const plain = await WeddingInvitation.findOne({ _id }).lean();
    expect(plain).not.toHaveProperty("tokenHash");
    // Lookups by hash still work: filtering doesn't need the field selected.
    expect(await WeddingInvitation.findOne({ tokenHash })).not.toBeNull();
  });

  it("supports the atomic accept claim: only one of two concurrent claims wins", async () => {
    const tokenHash = randomBytes(32).toString("hex");
    await WeddingInvitation.create(invitation({ tokenHash }));

    const claim = () =>
      WeddingInvitation.findOneAndUpdate(
        { tokenHash, status: "pending", expiresAt: { $gt: new Date() } },
        { $set: { status: "accepted", acceptedAt: new Date(), acceptedBy: new Types.ObjectId() } },
        { returnDocument: "after" },
      );

    const results = await Promise.all([claim(), claim()]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });
});
