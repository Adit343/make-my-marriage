import type { Types } from "mongoose";
import type { TaskPriority, TaskStatus } from "@/lib/constants/enums";

// Member-facing task shape (API Design §7.2). `version` is the optimistic-concurrency token sent
// back on PATCH; `canDelete` tells the UI whether THIS viewer may delete the task, so the screen
// never re-implements the permission rule. Everyone in the wedding may edit any task.
export interface TaskDto {
  id: string;
  title: string;
  description: string | null;
  eventId: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  /** "YYYY-MM-DD" or null. */
  dueDate: string | null;
  assigneeMemberIds: string[];
  completedAt: string | null;
  createdBy: string;
  canDelete: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface TaskLike {
  _id: Types.ObjectId;
  title: string;
  description?: string | null;
  eventId?: Types.ObjectId | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string | null;
  assigneeMemberIds?: Types.ObjectId[] | null;
  completedAt?: Date | null;
  createdBy: Types.ObjectId;
  __v?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export function toTaskDto(task: TaskLike, viewer: { canDelete: boolean }): TaskDto {
  return {
    id: task._id.toString(),
    title: task.title,
    description: task.description ?? null,
    eventId: task.eventId ? task.eventId.toString() : null,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate ?? null,
    assigneeMemberIds: (task.assigneeMemberIds ?? []).map((id) => id.toString()),
    completedAt: task.completedAt ? task.completedAt.toISOString() : null,
    createdBy: task.createdBy.toString(),
    canDelete: viewer.canDelete,
    version: task.__v ?? 0,
    createdAt: (task.createdAt ?? new Date(0)).toISOString(),
    updatedAt: (task.updatedAt ?? new Date(0)).toISOString(),
  };
}
