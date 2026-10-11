import "server-only";
import { withTransaction } from "@/infrastructure/database/transaction";
import { AppError } from "@/lib/errors";
import { toGuestGroupDto, type GuestGroupDto } from "@/modules/guest-groups/guest-group.dto";
import {
  countGuestsByGroup,
  findGroup,
  insertGroup,
  isDuplicateKey,
  listGroups as listGroupRows,
  softDeleteGroup,
  updateGroup as updateGroupRow,
  type GroupChanges,
} from "@/modules/guest-groups/guest-group.repository";
import type {
  CreateGroupInput,
  DeleteGroupInput,
  UpdateGroupInput,
} from "@/modules/guest-groups/guest-group.schemas";
import { reassignGuestsOfGroup } from "@/modules/guests/guest.repository";
import type { WeddingAuth } from "@/modules/members/guards";

// Guest groups (API Design §8.1). Every role may manage them (permission guests:edit). A group is
// a label, so deleting one never deletes guests: the caller says where its guests go.

function duplicateName(): AppError {
  return new AppError("CONFLICT", { message: "You already have a group with that name." });
}

export async function listGroups(auth: WeddingAuth): Promise<GuestGroupDto[]> {
  const [rows, counts] = await Promise.all([
    listGroupRows(auth.weddingId),
    countGuestsByGroup(auth.weddingId),
  ]);
  return rows.map((row) => toGuestGroupDto(row, counts.get(row._id.toString()) ?? 0));
}

async function toDto(auth: WeddingAuth, group: NonNullable<Awaited<ReturnType<typeof findGroup>>>) {
  const counts = await countGuestsByGroup(auth.weddingId);
  return toGuestGroupDto(group, counts.get(group._id.toString()) ?? 0);
}

export async function createGroup(
  auth: WeddingAuth,
  input: CreateGroupInput,
): Promise<GuestGroupDto> {
  try {
    const group = await insertGroup(auth.weddingId, { ...input, createdBy: auth.userId });
    return toGuestGroupDto(group, 0);
  } catch (error) {
    if (isDuplicateKey(error)) throw duplicateName();
    throw error;
  }
}

export async function updateGroup(
  auth: WeddingAuth,
  groupId: string,
  input: UpdateGroupInput,
): Promise<GuestGroupDto> {
  if (!(await findGroup(auth.weddingId, groupId))) throw new AppError("NOT_FOUND");

  const { version, ...changes } = input;
  let result;
  try {
    result = await updateGroupRow(auth.weddingId, groupId, version, changes as GroupChanges);
  } catch (error) {
    if (isDuplicateKey(error)) throw duplicateName();
    throw error;
  }
  if (result === "conflict") throw new AppError("VERSION_CONFLICT");
  if (result === "not_found") throw new AppError("NOT_FOUND");
  return toDto(auth, result);
}

/**
 * Soft delete. In one transaction the group's guests are moved to `reassignTo` (another group of
 * this wedding) or left ungrouped (`null`), then the group is deleted. The response says how many
 * guests moved.
 */
export async function deleteGroup(auth: WeddingAuth, groupId: string, input: DeleteGroupInput) {
  if (!(await findGroup(auth.weddingId, groupId))) throw new AppError("NOT_FOUND");
  if (input.reassignTo) {
    if (input.reassignTo.toLowerCase() === groupId.toLowerCase()) {
      throw new AppError("BUSINESS_RULE_VIOLATION", {
        message: "Choose a different group to move the guests to.",
      });
    }
    if (!(await findGroup(auth.weddingId, input.reassignTo))) {
      throw new AppError("NOT_FOUND", { message: "That group isn't part of this wedding." });
    }
  }

  const at = new Date();
  const guestsMoved = await withTransaction(async (session) => {
    const moved = await reassignGuestsOfGroup(auth.weddingId, groupId, input.reassignTo, session);
    if (!(await softDeleteGroup(auth.weddingId, groupId, { by: auth.userId, at }, session))) {
      throw new AppError("NOT_FOUND");
    }
    return moved;
  });
  return { id: groupId, deletedAt: at.toISOString(), guestsMoved };
}
