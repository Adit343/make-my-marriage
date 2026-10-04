import "server-only";
import type { ClientSession, Types } from "mongoose";
import { connectDb } from "@/infrastructure/database/connection";
import { Wedding } from "@/models/wedding.model";
import type { CreateWeddingInput } from "@/modules/weddings/wedding.schemas";

type Id = Types.ObjectId | string;

export async function insertWedding(
  input: Omit<CreateWeddingInput, "relationship"> & { createdBy: Id },
  session: ClientSession,
) {
  const [wedding] = await Wedding.create([input], { session });
  return wedding!.toObject();
}

export async function findWedding(weddingId: Id) {
  await connectDb();
  return Wedding.findOne({ _id: weddingId }).lean();
}
