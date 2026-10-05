import type { Types } from "mongoose";
import type { InvitationRole, InvitationStatus, MemberRelationship } from "@/lib/constants/enums";

// "Expired" is computed, never stored (DB Design §6.6): a pending invitation past its expiry.
export type InvitationState = InvitationStatus | "expired";

export interface InvitationDto {
  id: string;
  email: string;
  role: InvitationRole;
  relationship: MemberRelationship | null;
  message: string | null;
  status: InvitationState;
  expiresAt: string;
  createdAt: string;
}

interface InvitationLike {
  _id: Types.ObjectId;
  email: string;
  role: InvitationRole;
  relationship?: MemberRelationship | null;
  message?: string | null;
  status: InvitationStatus;
  expiresAt: Date;
  createdAt?: Date;
}

export function invitationState(invitation: Pick<InvitationLike, "status" | "expiresAt">) {
  const expired = invitation.status === "pending" && invitation.expiresAt.getTime() <= Date.now();
  return (expired ? "expired" : invitation.status) satisfies InvitationState;
}

/** Never includes the token hash, which is select:false and must not leave the server. */
export function toInvitationDto(invitation: InvitationLike): InvitationDto {
  return {
    id: invitation._id.toString(),
    email: invitation.email,
    role: invitation.role,
    relationship: invitation.relationship ?? null,
    message: invitation.message ?? null,
    status: invitationState(invitation),
    expiresAt: invitation.expiresAt.toISOString(),
    createdAt: (invitation.createdAt ?? new Date(0)).toISOString(),
  };
}
