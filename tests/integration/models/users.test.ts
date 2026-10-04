import { Types } from "mongoose";
import { beforeEach, describe, expect, it } from "vitest";
import { User } from "@/models/user.model";
import { clearCollections, setupTestDatabase } from "../../setup/database";

setupTestDatabase();
beforeEach(clearCollections);

const passwordAuth = () => ({
  algorithm: "scrypt" as const,
  version: 1,
  params: { N: 32768, r: 8, p: 1, keyLen: 64 },
  salt: "c2FsdA",
  hash: "aGFzaA",
  updatedAt: new Date(),
});

const google = (sub: string) => ({
  provider: "google" as const,
  providerUserId: sub,
  linkedAt: new Date(),
});

describe("users", () => {
  it("applies the documented defaults", async () => {
    const user = await User.create({ email: "meena@example.com", name: "Meena" });
    expect(user.toObject()).toMatchObject({
      status: "active",
      authProviders: [],
      lastLoginAt: null,
      deletedAt: null,
      passwordAuth: null,
    });
  });

  it("keeps the email as typed, normalizes it, and allows one account per address in any case", async () => {
    await User.create({ email: "Priya@Gmail.com", name: "Priya", passwordAuth: passwordAuth() });
    const raw = await User.collection.findOne({});
    expect(raw).toMatchObject({ email: "Priya@Gmail.com", emailNormalized: "priya@gmail.com" });

    await expect(
      User.create({ email: " PRIYA@gmail.com ", name: "Imposter" }),
    ).rejects.toMatchObject({
      code: 11000,
    });
  });

  it("never returns passwordAuth unless it is selected explicitly", async () => {
    const { _id } = await User.create({
      email: "p@example.com",
      name: "P",
      passwordAuth: passwordAuth(),
    });

    const plain = await User.findOne({ _id }).lean();
    expect(plain).not.toHaveProperty("passwordAuth");

    const withSecret = await User.findOne({ _id }).select("+passwordAuth").lean();
    expect(withSecret?.passwordAuth).toMatchObject({ algorithm: "scrypt", version: 1 });
  });

  it("allows many users without Google but links each Google account to one user", async () => {
    await User.create({ email: "a@example.com", name: "A" });
    await User.create({ email: "b@example.com", name: "B" });
    await User.create({ email: "c@example.com", name: "C", authProviders: [google("sub-1")] });

    await expect(
      User.create({ email: "d@example.com", name: "D", authProviders: [google("sub-1")] }),
    ).rejects.toMatchObject({ code: 11000 });
  });

  it("caps linked identities at five", async () => {
    const providers = ["1", "2", "3", "4", "5", "6"].map((n) => google(`sub-${n}`));
    await expect(
      User.create({ email: "many@example.com", name: "Many", authProviders: providers }),
    ).rejects.toThrow(/at most 5/);
  });

  it("keeps a soft-deleted user's email reserved until anonymization", async () => {
    const { _id } = await User.create({ email: "gone@example.com", name: "Gone" });
    await User.updateOne(
      { _id },
      { $set: { deletedAt: new Date(), deletedBy: new Types.ObjectId() } },
    );

    expect(await User.findOne({ _id })).toBeNull();
    await expect(User.create({ email: "gone@example.com", name: "New" })).rejects.toMatchObject({
      code: 11000,
    });
  });
});
