import { route } from "@/lib/http/route";
import { requireWeddingAccess } from "@/modules/members/guards";
import { taskParams, updateTaskBody } from "@/modules/tasks/task.schemas";
import { deleteTask, updateTask } from "@/modules/tasks/task.service";

// API Design §7.2. Every role may edit any task; the service lets a member DELETE only tasks they
// created (admin and owner: any task).

export const PATCH = route(
  { params: taskParams, body: updateTaskBody, auth: requireWeddingAccess("tasks:edit") },
  async ({ auth, params, body }) => ({ data: await updateTask(auth, params.taskId, body) }),
);

export const DELETE = route(
  { params: taskParams, auth: requireWeddingAccess("tasks:edit") },
  async ({ auth, params }) => ({ data: await deleteTask(auth, params.taskId) }),
);
