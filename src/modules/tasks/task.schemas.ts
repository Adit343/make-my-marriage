import { z } from "zod";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/constants/enums";
import { MAX_TASK_ASSIGNEES, MAX_TASK_DESCRIPTION, MAX_TASK_TITLE } from "@/lib/constants/tasks";
import { cursorPageQuery } from "@/lib/http/pagination";
import { isoDate, objectId } from "@/lib/validation/primitives";

// API Design §7.2. Calendar dates are "YYYY-MM-DD" (DB Design §3.5); ids that point at other
// wedding-owned documents (eventId, assigneeMemberIds) are checked against the wedding in the
// service, not here.

export const taskParams = z.object({ weddingId: objectId, taskId: objectId });

const title = z.string().trim().min(1).max(MAX_TASK_TITLE);
const description = z.string().trim().max(MAX_TASK_DESCRIPTION);
const assignees = z
  .array(objectId)
  .max(MAX_TASK_ASSIGNEES)
  .refine((ids) => new Set(ids.map((id) => id.toLowerCase())).size === ids.length, {
    message: "An assignee can only be listed once",
  });

export const createTaskBody = z.strictObject({
  title,
  description: description.optional(),
  /** null or absent = a wedding-level task. */
  eventId: objectId.nullable().optional(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  dueDate: isoDate.nullable().optional(),
  assigneeMemberIds: assignees.optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskBody>;

// Any subset of the editable fields plus the `version` the client last read (decision C5).
// `completedAt` / `completedBy` are never accepted: the server sets them when status becomes done.
export const updateTaskBody = z
  .strictObject({
    version: z.number().int().min(0),
    title,
    description: description.nullable(),
    eventId: objectId.nullable(),
    status: z.enum(TASK_STATUSES),
    priority: z.enum(TASK_PRIORITIES),
    dueDate: isoDate.nullable(),
    assigneeMemberIds: assignees,
  })
  .partial()
  .required({ version: true })
  .refine((body) => Object.keys(body).length > 1, { message: "Nothing to update" });

export type UpdateTaskInput = z.infer<typeof updateTaskBody>;

// Allow-listed filters, each served by an index in DB Design §8.2 (API Design §2.7, §7.2).
export const listTasksQuery = z.strictObject({
  ...cursorPageQuery,
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  eventId: objectId.optional(),
  assigneeMemberId: objectId.optional(),
  /** Only tasks due before this day. */
  dueBefore: isoDate.optional(),
});

export type ListTasksQuery = z.infer<typeof listTasksQuery>;
