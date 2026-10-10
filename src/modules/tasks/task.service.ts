import "server-only";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { decodeCursor, paginateByCursor, type CursorMeta } from "@/lib/http/pagination";
import { objectId } from "@/lib/validation/primitives";
import { findEvent } from "@/modules/events/event.repository";
import type { WeddingAuth } from "@/modules/members/guards";
import { findMembersByIds } from "@/modules/members/member.repository";
import { can } from "@/modules/members/permissions";
import { toTaskDto, type TaskDto } from "@/modules/tasks/task.dto";
import {
  findTask,
  insertTask,
  listAllTasks,
  listTasksForEvent,
  listTasksPage,
  softDeleteTask,
  updateTask as updateTaskRow,
  type TaskChanges,
} from "@/modules/tasks/task.repository";
import type {
  CreateTaskInput,
  ListTasksQuery,
  UpdateTaskInput,
} from "@/modules/tasks/task.schemas";

// Tasks (API Design §7.2). Everyone in the wedding can see, create and EDIT any task: the person a
// task is assigned to has to be able to move it along even when someone else wrote it. Deleting is
// narrower (owner decision 2026-10-10): a member may delete only tasks they created; admin and
// owner may delete any. Routes check membership and tasks:edit; WHICH task is being touched is
// only known here, so the delete rule lives in this file.

type TaskRow = NonNullable<Awaited<ReturnType<typeof findTask>>>;

const cursorPosition = z.object({ id: objectId });

function canDelete(auth: WeddingAuth, task: { createdBy: { toString(): string } }): boolean {
  return task.createdBy.toString() === auth.userId || can(auth.membership.role, "tasks:manage-any");
}

function toDto(auth: WeddingAuth, task: TaskRow): TaskDto {
  return toTaskDto(task, { canDelete: canDelete(auth, task) });
}

/** A cross-wedding id looks exactly like a missing one (DB Design §9.2 rule 1). */
async function assertEventInWedding(auth: WeddingAuth, eventId: string) {
  if (!(await findEvent(auth.weddingId, eventId))) {
    throw new AppError("NOT_FOUND", { message: "That event isn't part of this wedding." });
  }
}

/** Assignees are memberships of THIS wedding that are active (DB Design §6.8). */
async function assertAssignees(auth: WeddingAuth, memberIds: string[]) {
  const unique = [...new Set(memberIds.map((id) => id.toLowerCase()))];
  if (unique.length === 0) return;
  const rows = await findMembersByIds(auth.weddingId, unique);
  if (rows.length !== unique.length || rows.some((row) => row.status !== "active")) {
    throw new AppError("NOT_FOUND", {
      message: "Tasks can only be assigned to active members of this wedding.",
    });
  }
}

export async function listTasks(
  auth: WeddingAuth,
  query: ListTasksQuery,
): Promise<{ items: TaskDto[]; meta: CursorMeta }> {
  const { limit, cursor, ...filters } = query;
  const afterId = cursor ? decodeCursor(cursor, cursorPosition).id : undefined;
  const rows = await listTasksPage(auth.weddingId, filters, { limit, afterId });
  const page = paginateByCursor(rows, limit, (row) => ({ id: row._id.toString() }));
  return { items: page.items.map((row) => toDto(auth, row)), meta: page.meta };
}

/** Every task, for the Tasks screen, which groups and filters them itself. */
export async function listEveryTask(auth: WeddingAuth): Promise<TaskDto[]> {
  const rows = await listAllTasks(auth.weddingId);
  return rows.map((row) => toDto(auth, row));
}

/** One event's tasks, for the "Tasks for this event" card. */
export async function listEventTasks(auth: WeddingAuth, eventId: string): Promise<TaskDto[]> {
  const rows = await listTasksForEvent(auth.weddingId, eventId);
  return rows.map((row) => toDto(auth, row));
}

export async function createTask(auth: WeddingAuth, input: CreateTaskInput): Promise<TaskDto> {
  if (input.eventId) await assertEventInWedding(auth, input.eventId);
  if (input.assigneeMemberIds) await assertAssignees(auth, input.assigneeMemberIds);

  const done = input.status === "done";
  const task = await insertTask(auth.weddingId, {
    ...input,
    // A task created already done still records who finished it and when.
    ...(done ? { completedAt: new Date(), completedBy: auth.userId } : {}),
    createdBy: auth.userId,
  });
  return toDto(auth, task);
}

export async function updateTask(
  auth: WeddingAuth,
  taskId: string,
  input: UpdateTaskInput,
): Promise<TaskDto> {
  const existing = await findTask(auth.weddingId, taskId);
  if (!existing) throw new AppError("NOT_FOUND");

  const { version, ...rest } = input;
  if (rest.eventId) await assertEventInWedding(auth, rest.eventId);
  if (rest.assigneeMemberIds) await assertAssignees(auth, rest.assigneeMemberIds);

  const changes: TaskChanges = { ...rest };
  // completedAt/completedBy are the server's: set when the task becomes done, cleared otherwise.
  if (rest.status && rest.status !== existing.status) {
    if (rest.status === "done") {
      changes.completedAt = new Date();
      changes.completedBy = auth.userId;
    } else {
      changes.completedAt = null;
      changes.completedBy = null;
    }
  }

  const result = await updateTaskRow(auth.weddingId, taskId, version, changes);
  if (result === "conflict") throw new AppError("VERSION_CONFLICT");
  if (result === "not_found") throw new AppError("NOT_FOUND");
  return toDto(auth, result);
}

export async function deleteTask(auth: WeddingAuth, taskId: string) {
  const existing = await findTask(auth.weddingId, taskId);
  if (!existing) throw new AppError("NOT_FOUND");
  if (!canDelete(auth, existing)) throw new AppError("INSUFFICIENT_ROLE");

  const at = new Date();
  if (!(await softDeleteTask(auth.weddingId, taskId, { by: auth.userId, at }))) {
    throw new AppError("NOT_FOUND");
  }
  return { id: taskId, deletedAt: at.toISOString() };
}
