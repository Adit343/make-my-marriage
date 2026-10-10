import { Schema, type InferSchemaType } from "mongoose";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/constants/enums";
import { MAX_TASK_ASSIGNEES, MAX_TASK_DESCRIPTION, MAX_TASK_TITLE } from "@/lib/constants/tasks";
import { softDeleteFields, softDeletePlugin } from "@/models/plugins/softDelete";
import { defineModel } from "@/models/shared/define-model";
import { ISO_DATE_PATTERN } from "@/models/shared/validators";

// DB Design §6.8. A to-do for the wedding team, optionally linked to an event and assigned to
// members. NOT a schedule line: a task is something a person does by a date; a schedule line is a
// timed entry in an event's run-of-show.

const taskSchema = new Schema(
  {
    weddingId: { type: Schema.Types.ObjectId, ref: "Wedding", required: true },
    /** null = a wedding-level ("General") task. */
    eventId: { type: Schema.Types.ObjectId, ref: "Event", default: null },
    title: { type: String, required: true, trim: true, minlength: 1, maxlength: MAX_TASK_TITLE },
    description: { type: String, trim: true, maxlength: MAX_TASK_DESCRIPTION },
    status: { type: String, enum: TASK_STATUSES, required: true, default: "todo" },
    priority: { type: String, enum: TASK_PRIORITIES, required: true, default: "medium" },
    /** A calendar day ("YYYY-MM-DD"), not an instant: "due 10 Feb" is 10 Feb for everyone. */
    dueDate: { type: String, default: null, match: ISO_DATE_PATTERN },
    /** weddingMembers ids (a role in THIS wedding), not user ids. The service checks they are active. */
    assigneeMemberIds: {
      type: [Schema.Types.ObjectId],
      default: [],
      validate: {
        validator: (ids: unknown[]) => ids.length <= MAX_TASK_ASSIGNEES,
        message: `A task has at most ${MAX_TASK_ASSIGNEES} assignees`,
      },
    },
    /** Set by the server when status becomes done, cleared otherwise. */
    completedAt: { type: Date, default: null },
    completedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    ...softDeleteFields,
  },
  // Members edit the same task at the same time; stale saves are rejected (DB Design §3.7).
  { collection: "tasks", timestamps: true, optimisticConcurrency: true },
);

taskSchema.plugin(softDeletePlugin);

// "Tasks due soon that aren't done" (DB Design §8.3).
taskSchema.index({ weddingId: 1, status: 1, dueDate: 1 });
// Tasks for one event.
taskSchema.index({ weddingId: 1, eventId: 1 });
// "My tasks" (multikey).
taskSchema.index({ weddingId: 1, assigneeMemberIds: 1 });

export type TaskRecord = InferSchemaType<typeof taskSchema>;
export const Task = defineModel("Task", taskSchema);
