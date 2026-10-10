import "server-only";
import { Error as MongooseError, Types, type ClientSession } from "mongoose";
import { connectDb } from "@/infrastructure/database/connection";
import type { TaskPriority, TaskStatus } from "@/lib/constants/enums";
import { Task } from "@/models/task.model";

type Id = Types.ObjectId | string;

// Every function takes weddingId (DB Design §9.2): there is no way to read or change a task
// without naming the wedding it must belong to. Soft-deleted tasks are hidden by the plugin.

export interface NewTask {
  title: string;
  description?: string;
  eventId?: Id | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string | null;
  assigneeMemberIds?: string[];
  completedAt?: Date | null;
  completedBy?: Id | null;
  createdBy: Id;
}

export interface TaskChanges {
  title?: string;
  description?: string | null;
  eventId?: Id | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string | null;
  assigneeMemberIds?: string[];
  completedAt?: Date | null;
  completedBy?: Id | null;
}

export interface TaskFilters {
  status?: TaskStatus;
  priority?: TaskPriority;
  eventId?: string;
  assigneeMemberId?: string;
  dueBefore?: string;
}

export async function insertTask(weddingId: Id, input: NewTask) {
  await connectDb();
  const task = await Task.create({ ...input, weddingId });
  return task.toObject();
}

export async function findTask(weddingId: Id, taskId: Id) {
  await connectDb();
  return Task.findOne({ _id: taskId, weddingId }).lean();
}

function filterFor(weddingId: Id, filters: TaskFilters): Record<string, unknown> {
  return {
    weddingId,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.priority ? { priority: filters.priority } : {}),
    ...(filters.eventId ? { eventId: filters.eventId } : {}),
    ...(filters.assigneeMemberId ? { assigneeMemberIds: filters.assigneeMemberId } : {}),
    ...(filters.dueBefore ? { dueDate: { $lt: filters.dueBefore } } : {}),
  };
}

/** Newest first, `limit + 1` rows so the caller can tell whether there is another page. */
export async function listTasksPage(
  weddingId: Id,
  filters: TaskFilters,
  page: { limit: number; afterId?: string },
) {
  await connectDb();
  const filter = filterFor(weddingId, filters);
  if (page.afterId) filter._id = { $lt: new Types.ObjectId(page.afterId) };
  return Task.find(filter)
    .sort({ _id: -1 })
    .limit(page.limit + 1)
    .lean();
}

/**
 * Every task of the wedding for the Tasks screen, which groups, filters and counts them in one
 * view. A wedding has dozens to a few hundred tasks, so one capped read is simpler and cheaper
 * than paging; `limit` is a safety stop, not a feature.
 */
export async function listAllTasks(weddingId: Id, limit = 1000) {
  await connectDb();
  return Task.find({ weddingId }).sort({ _id: 1 }).limit(limit).lean();
}

export async function listTasksForEvent(weddingId: Id, eventId: Id) {
  await connectDb();
  return Task.find({ weddingId, eventId }).sort({ _id: 1 }).lean();
}

/** Tasks that are not done yet: the sidebar badge and the dashboard count. */
export async function countOpenTasks(weddingId: Id): Promise<number> {
  await connectDb();
  return Task.countDocuments({ weddingId, status: { $ne: "done" } });
}

/** The next few open tasks for the dashboard: dated ones soonest first, then undated. */
export async function listUpcomingOpenTasks(weddingId: Id, limit: number) {
  await connectDb();
  const dated = await Task.find({
    weddingId,
    status: { $ne: "done" },
    dueDate: { $type: "string" },
  })
    .sort({ dueDate: 1, _id: 1 })
    .limit(limit)
    .lean();
  if (dated.length >= limit) return dated;
  const undated = await Task.find({
    weddingId,
    status: { $ne: "done" },
    dueDate: { $not: { $type: "string" } },
  })
    .sort({ _id: 1 })
    .limit(limit - dated.length)
    .lean();
  return [...dated, ...undated];
}

/**
 * Optimistic concurrency (decision C5, DB Design §3.7): the write only lands if the task is still
 * at the version the client last read. save() adds the same guard against a write that sneaks in
 * between our read and our save.
 */
export async function updateTask(
  weddingId: Id,
  taskId: Id,
  version: number,
  changes: TaskChanges,
): Promise<"conflict" | "not_found" | NonNullable<Awaited<ReturnType<typeof findTask>>>> {
  await connectDb();
  const task = await Task.findOne({ _id: taskId, weddingId });
  if (!task) return "not_found";
  if (task.__v !== version) return "conflict";

  task.set(changes);
  try {
    await task.save();
  } catch (error) {
    if (error instanceof MongooseError.VersionError) return "conflict";
    throw error;
  }
  return task.toObject();
}

/** False if the task does not exist in this wedding or is already deleted. */
export async function softDeleteTask(
  weddingId: Id,
  taskId: Id,
  deletion: { by: Id; at: Date },
): Promise<boolean> {
  await connectDb();
  const result = await Task.updateOne(
    { _id: taskId, weddingId },
    { $set: { deletedAt: deletion.at, deletedBy: deletion.by } },
  );
  return result.modifiedCount === 1;
}

/**
 * Deleting an event does not delete its tasks: they become wedding-level (DB Design §6.7 rule 1).
 * Returns how many were affected, for the delete response.
 */
export async function unlinkTasksFromEvent(
  weddingId: Id,
  eventId: Id,
  session: ClientSession,
): Promise<number> {
  await connectDb();
  const result = await Task.updateMany(
    { weddingId, eventId },
    { $set: { eventId: null } },
    { session },
  );
  return result.modifiedCount;
}

/** A member who leaves or is removed stops being an assignee (DB Design §6.5 rule 4). */
export async function removeAssigneeFromTasks(
  weddingId: Id,
  memberId: Id,
  session?: ClientSession,
): Promise<number> {
  await connectDb();
  const result = await Task.updateMany(
    { weddingId, assigneeMemberIds: memberId },
    { $pull: { assigneeMemberIds: memberId } },
    { session },
  );
  return result.modifiedCount;
}
