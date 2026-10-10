import { apiRequest } from "@/lib/client/api-client";
import type { TaskPriority, TaskStatus } from "@/lib/constants/enums";

// Browser calls to the tasks API (API Design §7.2).

const tasks = (weddingId: string) => `/api/v1/weddings/${weddingId}/tasks`;

export interface TaskInput {
  title: string;
  description: string | null;
  eventId: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  /** "YYYY-MM-DD" or null. */
  dueDate: string | null;
  assigneeMemberIds: string[];
}

export function createTask(weddingId: string, input: TaskInput) {
  // The create endpoint takes an absent description rather than null.
  const { description, ...rest } = input;
  return apiRequest<{ id: string }>(tasks(weddingId), {
    method: "POST",
    body: { ...rest, ...(description ? { description } : {}) },
  });
}

export function updateTask(
  weddingId: string,
  taskId: string,
  version: number,
  changes: Partial<TaskInput>,
) {
  return apiRequest<{ id: string }>(`${tasks(weddingId)}/${taskId}`, {
    method: "PATCH",
    body: { version, ...changes },
  });
}

export function deleteTask(weddingId: string, taskId: string) {
  return apiRequest<unknown>(`${tasks(weddingId)}/${taskId}`, { method: "DELETE" });
}
