import "server-only";
import { withTransaction } from "@/infrastructure/database/transaction";
import { AppError, isDuplicateKeyError } from "@/lib/errors";
import type { NumberedPageMeta } from "@/lib/http/pagination";
import { findUserSummaries } from "@/modules/users/user.repository";
import type { WeddingAuth } from "@/modules/members/guards";
import { toMemberDto, type MemberDto } from "@/modules/members/member.dto";
import {
  demoteOwnerToAdmin,
  findMember,
  findMembersByIds,
  listMembersPage,
  promoteToOwner,
  softDeleteMember,
  updateMember as updateMemberRow,
} from "@/modules/members/member.repository";
import type { UpdateMemberInput } from "@/modules/members/member.schemas";
import { can } from "@/modules/members/permissions";
import { removeAssigneeFromTasks } from "@/modules/tasks/task.repository";

// Team management (API Design §6.5–§6.8). Routes are guarded by role (members/guards.ts); the
// rules that depend on WHICH member is the target live here.

type MemberRows = Awaited<ReturnType<typeof listMembersPage>>["rows"];

/** One user lookup for the whole page — never one per row (DB Design §12.4 rule 4). */
async function toDtos(rows: MemberRows, viewerUserId: string): Promise<MemberDto[]> {
  const users = await findUserSummaries(rows.map((row) => row.userId));
  const byId = new Map(users.map((user) => [user._id.toString(), user]));
  return rows.map((row) => toMemberDto(row, byId.get(row.userId.toString()), viewerUserId));
}

export async function listTeam(
  auth: WeddingAuth,
  page: { page: number; pageSize: number },
): Promise<{ items: MemberDto[]; meta: NumberedPageMeta }> {
  const { rows, totalCount } = await listMembersPage(auth.weddingId, {
    skip: (page.page - 1) * page.pageSize,
    limit: page.pageSize,
  });
  return {
    items: await toDtos(rows, auth.userId),
    meta: { page: page.page, pageSize: page.pageSize, totalCount },
  };
}

const OWNER_IS_FIXED = "The owner can't be changed here. Transfer ownership first.";

export async function changeMember(auth: WeddingAuth, memberId: string, input: UpdateMemberInput) {
  const target = await findMember(auth.weddingId, memberId);
  if (!target) throw new AppError("NOT_FOUND");
  if (target.role === "owner") {
    throw new AppError("BUSINESS_RULE_VIOLATION", { message: OWNER_IS_FIXED });
  }
  // Without this an admin could quietly promote themselves; role changes go through someone else.
  if (input.role !== undefined && target._id.toString() === auth.membership.id) {
    throw new AppError("BUSINESS_RULE_VIOLATION", { message: "You can't change your own role." });
  }

  const updated = await updateMemberRow(auth.weddingId, memberId, input);
  if (!updated) throw new AppError("NOT_FOUND");
  const [dto] = await toDtos([updated], auth.userId);
  return dto!;
}

/** Remove a member, or leave the wedding yourself (any role except the owner). */
export async function removeMember(auth: WeddingAuth, memberId: string) {
  const target = await findMember(auth.weddingId, memberId);
  if (!target) throw new AppError("NOT_FOUND");

  if (target.role === "owner") {
    throw new AppError("BUSINESS_RULE_VIOLATION", { message: "Transfer ownership first." });
  }
  const isSelf = target._id.toString() === auth.membership.id;
  if (!isSelf && !can(auth.membership.role, "members:manage")) {
    throw new AppError("INSUFFICIENT_ROLE");
  }

  const deletedAt = new Date();
  // Leaving ends the membership AND takes the person off every task they were assigned to
  // (DB Design §6.5 rule 4), together, so no task is left pointing at a member who is gone.
  const tasksUnassigned = await withTransaction(async (session) => {
    const removed = await softDeleteMember(
      auth.weddingId,
      memberId,
      { by: auth.userId, reason: isSelf ? "left" : "removed" },
      session,
    );
    if (!removed) throw new AppError("NOT_FOUND");
    return removeAssigneeFromTasks(auth.weddingId, memberId, session);
  });
  return { id: memberId, deletedAt: deletedAt.toISOString(), tasksUnassigned };
}

/**
 * Demote the old owner, then promote the new one, in one transaction (DB Design §6.5 rule 2):
 * never zero or two owners.
 */
export async function transferOwnership(auth: WeddingAuth, memberId: string) {
  const target = await findMember(auth.weddingId, memberId);
  if (!target) throw new AppError("NOT_FOUND");
  if (target._id.toString() === auth.membership.id) {
    throw new AppError("BUSINESS_RULE_VIOLATION", { message: "You already own this wedding." });
  }
  if (target.status !== "active") {
    throw new AppError("BUSINESS_RULE_VIOLATION", {
      message: "Ownership can only be transferred to an active member.",
    });
  }

  try {
    await withTransaction(async (session) => {
      if (!(await demoteOwnerToAdmin(auth.weddingId, auth.membership.id, session))) {
        throw new AppError("CONFLICT");
      }
      if (!(await promoteToOwner(auth.weddingId, memberId, session))) {
        throw new AppError("CONFLICT");
      }
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) throw new AppError("CONFLICT");
    throw error;
  }

  const rows = await findMembersByIds(auth.weddingId, [auth.membership.id, memberId]);
  const dtos = await toDtos(rows, auth.userId);
  return {
    previousOwner: dtos.find((dto) => dto.id === auth.membership.id)!,
    newOwner: dtos.find((dto) => dto.id === memberId)!,
  };
}
