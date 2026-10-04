import mongoose, { Schema, Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { connectDb } from "@/infrastructure/database/connection";
import { setupTestDatabase } from "../../setup/database";

const Guest = mongoose.model(
  "ConnectionTestGuest",
  new Schema({ weddingId: { type: Schema.Types.ObjectId, required: true }, name: String }),
);

setupTestDatabase();

describe("connectDb()", () => {
  it("reuses one cached connection", async () => {
    expect(await connectDb()).toBe(await connectDb());
  });

  it("is connected to a replica set, so transactions are available", async () => {
    const hello = await mongoose.connection.db!.admin().command({ hello: 1 });
    expect(hello.setName).toBeTruthy();
  });

  it("throws on filters for unknown paths instead of silently dropping them", async () => {
    // A typo'd wedding filter must never degrade into "match every wedding".
    await expect(Guest.find({ weddingID: new Types.ObjectId() })).rejects.toThrow(/not in schema/);
  });
});
