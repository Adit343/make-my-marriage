import mongoose, { Schema, Types } from "mongoose";
import { beforeEach, describe, expect, it } from "vitest";
import { normalizedFieldsPlugin } from "@/models/plugins/normalize";
import { normalizeEmail, normalizeName } from "@/lib/text/normalize";
import { clearCollections, setupTestDatabase } from "../../setup/database";

const personSchema = new Schema({
  weddingId: { type: Schema.Types.ObjectId, required: true },
  name: { type: String, required: true },
  nameNormalized: { type: String, required: true },
  email: { type: String },
  emailNormalized: { type: String },
});
personSchema.plugin(normalizedFieldsPlugin, {
  fields: [
    { source: "name", target: "nameNormalized", normalize: normalizeName },
    { source: "email", target: "emailNormalized", normalize: normalizeEmail },
  ],
});
const Person = mongoose.model("NormalizeTestPerson", personSchema);

setupTestDatabase();
beforeEach(clearCollections);

const weddingId = new Types.ObjectId();

describe("normalizedFieldsPlugin", () => {
  it("fills normalized fields on create, before required-field validation", async () => {
    const person = await Person.create({
      weddingId,
      name: "  Rahul   SHARMA ",
      email: " Rahul@Example.COM",
    });
    expect(person.nameNormalized).toBe("rahul sharma");
    expect(person.emailNormalized).toBe("rahul@example.com");
  });

  it("keeps them in sync through update queries, with or without $set", async () => {
    const person = await Person.create({ weddingId, name: "Rahul" });

    const updated = await Person.findOneAndUpdate(
      { _id: person._id },
      { name: "Rahul  Sharma" },
      { returnDocument: "after" },
    );
    expect(updated?.nameNormalized).toBe("rahul sharma");

    await Person.updateOne({ _id: person._id }, { $set: { email: "R.Sharma@Example.com" } });
    await Person.updateMany({ weddingId }, { $set: { name: "VIKAS" } });
    const raw = await Person.collection.findOne({ _id: person._id });
    expect(raw).toMatchObject({ nameNormalized: "vikas", emailNormalized: "r.sharma@example.com" });
  });

  it("refuses pipeline updates, which could change the source unseen", async () => {
    const person = await Person.create({ weddingId, name: "Rahul" });
    await expect(
      Person.updateOne({ _id: person._id }, [{ $set: { name: "X" } }], { updatePipeline: true }),
    ).rejects.toThrow(/Pipeline updates are not supported/);
  });

  it("requires the target field to be declared in the schema", () => {
    const schema = new Schema({ name: String });
    expect(() =>
      schema.plugin(normalizedFieldsPlugin, {
        fields: [{ source: "name", target: "nameNormalized", normalize: normalizeName }],
      }),
    ).toThrow(/must declare both name and nameNormalized/);
  });
});
