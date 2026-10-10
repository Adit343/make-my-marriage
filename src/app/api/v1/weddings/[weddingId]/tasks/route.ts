import { route } from "@/lib/http/route";
import { requireWeddingAccess } from "@/modules/members/guards";
import { createTaskBody, listTasksQuery } from "@/modules/tasks/task.schemas";
import { createTask, listTasks } from "@/modules/tasks/task.service";
import { weddingParams } from "@/modules/weddings/wedding.schemas";

// API Design §7.2. Cursor-paginated, newest first; filters are an allow-list.

export const GET = route(
  { params: weddingParams, query: listTasksQuery, auth: requireWeddingAccess("wedding:view") },
  async ({ auth, query }) => {
    const { items, meta } = await listTasks(auth, query);
    return { data: items, meta };
  },
);

export const POST = route(
  { params: weddingParams, body: createTaskBody, auth: requireWeddingAccess("tasks:edit") },
  async ({ auth, body }) => ({ status: 201, data: await createTask(auth, body) }),
);
