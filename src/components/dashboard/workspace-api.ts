import { apiRequest } from "@/lib/client/api-client";
import type { InvitationRole, MemberRelationship } from "@/lib/constants/enums";

// Browser calls to the wedding, member, invitation and account APIs used by the Team and
// Settings pages (API Design §5–§6).

const wedding = (id: string) => `/api/v1/weddings/${id}`;

export interface InviteResult {
  invitation: { id: string; email: string };
  inviteLink: string;
  emailStatus: "sent" | "failed";
  /** Present when the send failed. `message` is omitted in production. */
  emailError?: { code: string; message?: string };
}

export function inviteMember(
  weddingId: string,
  input: {
    email: string;
    role: InvitationRole;
    relationship?: MemberRelationship;
    message?: string;
  },
) {
  return apiRequest<InviteResult>(`${wedding(weddingId)}/invitations`, {
    method: "POST",
    body: input,
  });
}

export function resendInvitation(weddingId: string, invitationId: string) {
  return apiRequest<InviteResult>(`${wedding(weddingId)}/invitations/${invitationId}/resend`, {
    method: "POST",
  });
}

export function revokeInvitation(weddingId: string, invitationId: string) {
  return apiRequest<unknown>(`${wedding(weddingId)}/invitations/${invitationId}`, {
    method: "DELETE",
  });
}

export function changeMember(
  weddingId: string,
  memberId: string,
  changes: { role?: InvitationRole; relationship?: MemberRelationship },
) {
  return apiRequest<unknown>(`${wedding(weddingId)}/members/${memberId}`, {
    method: "PATCH",
    body: changes,
  });
}

export function removeMember(weddingId: string, memberId: string) {
  return apiRequest<unknown>(`${wedding(weddingId)}/members/${memberId}`, { method: "DELETE" });
}

export function transferOwnership(weddingId: string, memberId: string) {
  return apiRequest<unknown>(`${wedding(weddingId)}/members/${memberId}/transfer-ownership`, {
    method: "POST",
  });
}

export function updateWedding(weddingId: string, changes: Record<string, unknown>) {
  return apiRequest<{ version: number }>(wedding(weddingId), { method: "PATCH", body: changes });
}

export function deleteWedding(weddingId: string, confirm: string) {
  return apiRequest<unknown>(wedding(weddingId), { method: "DELETE", body: { confirm } });
}

export function updateProfile(name: string) {
  return apiRequest<unknown>("/api/v1/users/me", { method: "PATCH", body: { name } });
}

export function changePassword(input: { currentPassword: string; newPassword: string }) {
  return apiRequest<unknown>("/api/v1/auth/password/change", { method: "POST", body: input });
}

export function deleteAccount(options: { deleteWedding: boolean }) {
  return apiRequest<unknown>(
    `/api/v1/users/me${options.deleteWedding ? "?deleteWedding=true" : ""}`,
    { method: "DELETE" },
  );
}

/** "Copy invite link": a fresh link for a pending invitation, without sending an email. */
export function newInvitationLink(weddingId: string, invitationId: string) {
  return apiRequest<{ inviteLink: string }>(
    `${wedding(weddingId)}/invitations/${invitationId}/link`,
    { method: "POST" },
  );
}

export function endSession(sessionId: string) {
  return apiRequest<unknown>(`/api/v1/auth/sessions/${sessionId}`, { method: "DELETE" });
}

export function endOtherSessions() {
  return apiRequest<unknown>("/api/v1/auth/sessions", { method: "DELETE" });
}
