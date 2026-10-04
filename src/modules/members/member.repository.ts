import "server-only";
import type { ClientSession, Types } from "mongoose";
import { connectDb } from "@/infrastructure/database/connection";
import type { MemberRelationship } from "@/lib/constants/enums";
import { WeddingMember } from "@/models/weddingMember.model";

type Id = Types.ObjectId | string;

/**
 * The one lookup that is by user rather than by wedding: it is how a request finds out WHICH
 * wedding the user belongs to (DB Design §8.3), served by the partial unique userId index.
 */
export async function findActiveMembershipByUser(userId: Id) {
  await connectDb();
  return WeddingMember.findOne({ userId }).lean();
}

export async function createOwnerMembership(
  input: { weddingId: Id; userId: Id; relationship?: MemberRelationship },
  session: ClientSession,
) {
  const [membership] = await WeddingMember.create(
    [
      {
        weddingId: input.weddingId,
        userId: input.userId,
        role: "owner",
        relationship: input.relationship,
        joinedAt: new Date(),
      },
    ],
    { session },
  );
  return membership!.toObject();
}
