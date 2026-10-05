import { Types } from "mongoose";
import { POST as createWedding } from "@/app/api/v1/weddings/route";
import type { MemberRole } from "@/lib/constants/enums";
import { WeddingMember } from "@/models/weddingMember.model";
import { signUpUser } from "./auth";
import { call } from "./http";

export interface TestMember {
  cookie: string;
  user: { id: string; email: string; name: string };
  memberId: string;
}

/** A signed-up user who has created a wedding (so they are its owner). */
export async function setupWedding(title = "Aarav & Diya's Wedding") {
  const { cookie, user } = await signUpUser();
  const result = await call(createWedding, { cookie, body: { title, relationship: "couple" } });
  if (result.status !== 201) {
    throw new Error(`create wedding failed: ${JSON.stringify(result.json)}`);
  }
  const weddingId: string = result.json.data.wedding.id;
  const owner: TestMember = { cookie, user, memberId: result.json.data.membership.id };
  return { weddingId, owner, title };
}

/**
 * Adds someone to a wedding with the given role. Member invitations arrive in step 1.7, so this
 * writes the membership directly — the same row the accept-invitation flow will create.
 */
export async function addMember(weddingId: string, role: Exclude<MemberRole, "owner"> = "member") {
  const { cookie, user } = await signUpUser();
  const membership = await WeddingMember.create({
    weddingId: new Types.ObjectId(weddingId),
    userId: new Types.ObjectId(user.id),
    role,
    relationship: "relative",
    joinedAt: new Date(),
  });
  return { cookie, user, memberId: membership._id.toString() } satisfies TestMember;
}
