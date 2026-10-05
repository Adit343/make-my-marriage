import type { Types } from "mongoose";
import type { MemberRelationship, MemberRole, MemberStatus } from "@/lib/constants/enums";

// API Design §6.5: a member row joined with the user's display fields.
export interface MemberDto {
  id: string;
  userId: string;
  user: { name: string; email: string };
  role: MemberRole;
  relationship: MemberRelationship | null;
  status: MemberStatus;
  joinedAt: string;
  isYou: boolean;
}

interface MemberLike {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  role: MemberRole;
  relationship?: MemberRelationship | null;
  status: MemberStatus;
  joinedAt: Date;
}

export function toMemberDto(
  member: MemberLike,
  user: { name: string; email: string } | undefined,
  viewerUserId: string,
): MemberDto {
  return {
    id: member._id.toString(),
    userId: member.userId.toString(),
    user: { name: user?.name ?? "Unknown", email: user?.email ?? "" },
    role: member.role,
    relationship: member.relationship ?? null,
    status: member.status,
    joinedAt: member.joinedAt.toISOString(),
    isYou: member.userId.toString() === viewerUserId,
  };
}
