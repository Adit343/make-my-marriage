"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { EventMenuItem } from "@/components/events/event-menu";
import { TaskDrawer, type TaskDrawerMode } from "@/components/tasks/task-drawer";
import { deleteTask, updateTask } from "@/components/tasks/tasks-api";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/client/api-client";
import { TASK_STATUSES, type TaskStatus } from "@/lib/constants/enums";
import {
  STATUS_LABEL,
  withStatus,
  type TaskEventInfo,
  type TaskMember,
  type TaskView,
} from "@/lib/tasks/view";

/**
 * Everything you can do to a task from the list, the board or an event page: the add/edit
 * slide-over, changing status (shown at once, confirmed by the server), and deleting. Render
 * `overlays` once; `effective(task)` is the task with any pending status change applied.
 */
export function useTaskActions({
  weddingId,
  events,
  members,
  today,
  tasks,
}: {
  weddingId: string;
  events: TaskEventInfo[];
  members: TaskMember[];
  today: string;
  /** The tasks on screen: when they are refreshed from the server, pending changes are dropped. */
  tasks: TaskView[];
}): {
  openDrawer: (mode: TaskDrawerMode) => void;
  requestDelete: (task: TaskView) => void;
  setStatus: (task: TaskView, status: TaskStatus) => Promise<void>;
  effective: (task: TaskView) => TaskView;
  menuItems: (task: TaskView) => EventMenuItem[];
  overlays: ReactNode;
} {
  const router = useRouter();
  const toast = useToast();
  const [drawer, setDrawer] = useState<TaskDrawerMode | null>(null);
  const [pendingDelete, setPendingDelete] = useState<TaskView | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [pending, setPending] = useState<Record<string, TaskStatus>>({});

  // When fresh tasks arrive from the server, whatever we were showing optimistically is replaced
  // by the truth (adjusting state while rendering, not in an effect).
  const [seenTasks, setSeenTasks] = useState(tasks);
  if (seenTasks !== tasks) {
    setSeenTasks(tasks);
    setPending({});
  }

  const effective = (task: TaskView) => {
    const next = pending[task.id];
    return next && next !== task.status ? withStatus(task, next, today) : task;
  };

  async function setStatus(task: TaskView, status: TaskStatus) {
    if (status === task.status) return;
    setPending((current) => ({ ...current, [task.id]: status }));
    try {
      await updateTask(weddingId, task.id, task.version, { status });
      router.refresh();
    } catch (error) {
      setPending((current) =>
        Object.fromEntries(Object.entries(current).filter(([id]) => id !== task.id)),
      );
      toast({ type: "error", title: "Couldn't change the status", message: errorMessage(error) });
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteTask(weddingId, pendingDelete.id);
      toast({ type: "success", title: "Task deleted", message: pendingDelete.title });
      setPendingDelete(null);
      setDeleting(false);
      router.refresh();
    } catch (error) {
      setDeleting(false);
      setPendingDelete(null);
      toast({ type: "error", title: "Couldn't delete the task", message: errorMessage(error) });
    }
  }

  function menuItems(task: TaskView): EventMenuItem[] {
    return [
      {
        icon: "edit",
        label: "Edit task",
        onSelect: () => setDrawer({ kind: "edit", task }),
      },
      {
        icon: "swap_horiz",
        label: "Change status",
        submenu: TASK_STATUSES.map((status) => ({
          label: STATUS_LABEL[status],
          active: task.status === status,
          onSelect: () => void setStatus(task, status),
        })),
      },
      {
        icon: "person_add",
        label: "Assign to...",
        onSelect: () => setDrawer({ kind: "edit", task, focus: "assignees" }),
      },
      ...(task.canDelete
        ? [
            {
              icon: "delete" as const,
              label: "Delete task",
              danger: true,
              onSelect: () => setPendingDelete(task),
            },
          ]
        : []),
    ];
  }

  const overlays = (
    <>
      {drawer ? (
        <TaskDrawer
          weddingId={weddingId}
          events={events}
          members={members}
          mode={drawer}
          onClose={() => setDrawer(null)}
          onSaved={() => {
            setDrawer(null);
            router.refresh();
          }}
        />
      ) : null}
      {pendingDelete ? (
        <ConfirmDialog
          title="Delete this task?"
          confirmLabel="Delete task"
          danger
          busy={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        >
          <p>
            <strong className="font-semibold text-on-surface">{pendingDelete.title}</strong> will be
            removed for everyone on your team.
          </p>
        </ConfirmDialog>
      ) : null}
    </>
  );

  return {
    openDrawer: setDrawer,
    requestDelete: setPendingDelete,
    setStatus,
    effective,
    menuItems,
    overlays,
  };
}
