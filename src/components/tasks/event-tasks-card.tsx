"use client";

import Link from "next/link";
import { useTaskActions } from "@/components/tasks/use-task-actions";
import { Icon } from "@/components/ui/icon";
import type { TaskEventInfo, TaskMember, TaskView } from "@/lib/tasks/view";

// The "Tasks for this event" card on the Event Detail screen: checkbox rows with the due date
// and who it's assigned to, an "Add task" that starts with this event chosen, and a link to the
// full Tasks screen filtered to this event.

const CARD =
  "flex flex-col justify-between rounded-xl border border-[#2A2622]/[0.04] bg-[#FFFDF9] p-6 shadow-[0_2px_12px_-2px_rgba(42,38,34,0.04),0_1px_3px_0_rgba(42,38,34,0.02)] md:col-span-7";

export function EventTasksCard({
  weddingId,
  eventId,
  tasks,
  events,
  members,
  today,
}: {
  weddingId: string;
  eventId: string;
  tasks: TaskView[];
  events: TaskEventInfo[];
  members: TaskMember[];
  today: string;
}) {
  const actions = useTaskActions({ weddingId, events, members, today, tasks });
  const current = tasks.map(actions.effective);
  const open = current.filter((task) => task.status !== "done");
  const done = current.length - open.length;

  return (
    <div className={CARD}>
      <div>
        <div className="flex items-center justify-between border-b border-[#2A2622]/[0.05] pb-3">
          <div className="flex items-center gap-2">
            <h2 className="font-headline-sm text-headline-sm font-normal text-[#2A2622]">
              Tasks for this event
            </h2>
            {current.length > 0 ? (
              <span className="rounded bg-[#1F4D3D]/10 px-2 py-0.5 text-[11px] font-medium text-[#1F4D3D]">
                {open.length} {open.length === 1 ? "task" : "tasks"} active
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => actions.openDrawer({ kind: "create", eventId })}
            className="flex items-center gap-1 text-body-sm font-semibold text-[#1F4D3D] hover:underline"
          >
            <Icon name="add" className="text-[16px]" />
            <span>Add task</span>
          </button>
        </div>

        {current.length === 0 ? (
          <div className="mt-4 flex flex-col items-center gap-2 rounded-lg border border-dashed border-[#2A2622]/15 bg-surface-container-low px-6 py-8 text-center">
            <Icon name="checklist" className="text-outline" />
            <p className="font-title text-body-sm text-on-surface">No tasks for this event yet</p>
            <p className="max-w-xs font-body-sm text-[12px] text-on-surface-variant">
              Tasks you link to this event show up here, with who is doing what by when.
            </p>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {current.map((task) => {
              const isDone = task.status === "done";
              const first = task.assignees[0];
              return (
                <li
                  key={task.id}
                  className={`flex items-start gap-3 rounded-lg border p-3.5 transition-colors ${
                    isDone
                      ? "border-[#2A2622]/[0.04] bg-[#FAF6F0]/60 hover:bg-[#FAF6F0]"
                      : "border-[#2A2622]/[0.08] bg-[#FFFDF9] hover:border-[#1F4D3D]/40"
                  }`}
                >
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={isDone}
                    aria-label={isDone ? `Reopen "${task.title}"` : `Mark "${task.title}" done`}
                    onClick={() => void actions.setStatus(task, isDone ? "todo" : "done")}
                    className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded border transition-colors ${
                      isDone
                        ? "border-[#1F4D3D] bg-[#1F4D3D] text-[#FAF6F0]"
                        : "border-[#2A2622]/30 hover:border-[#1F4D3D]"
                    }`}
                  >
                    {isDone ? <Icon name="check" className="text-[13px]" /> : null}
                  </button>
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => actions.openDrawer({ kind: "edit", task })}
                      className={`text-left text-body-sm ${
                        isDone
                          ? "text-[#2A2622]/60 line-through"
                          : "font-medium text-[#2A2622] hover:text-primary"
                      }`}
                    >
                      {task.title}
                    </button>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-on-surface-variant">
                      {isDone ? (
                        <span className="inline-flex items-center gap-1 text-emerald-800">
                          <Icon name="check" className="text-[13px]" />
                          {task.doneLabel ?? "Done"}
                        </span>
                      ) : task.overdueLabel ? (
                        <span className="inline-flex items-center gap-1 font-medium text-[#B5714A]">
                          <Icon name="event" className="text-[13px]" />
                          {task.overdueLabel}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <Icon name="event" className="text-[13px]" />
                          {task.dueLabel ? `Due ${task.dueLabel}` : "No due date"}
                        </span>
                      )}
                    </div>
                  </div>
                  {first ? (
                    <div
                      className="flex shrink-0 items-center gap-1.5"
                      title={task.assignees.map((person) => person.name).join(", ")}
                    >
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1F4D3D]/15 text-[10px] font-bold text-[#1F4D3D]">
                        {first.initials}
                      </span>
                      <span className="hidden text-[11px] text-on-surface-variant sm:inline">
                        {first.name.split(" ")[0]}
                        {task.assignees.length > 1 ? ` +${task.assignees.length - 1}` : ""}
                      </span>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between border-t border-[#2A2622]/[0.05] pt-5 text-body-sm">
        <span className="text-[12px] text-on-surface-variant">
          {done} completed • {open.length} pending
        </span>
        <Link
          href={`/dashboard/tasks?event=${eventId}`}
          className="flex items-center gap-1 font-semibold text-[#1F4D3D] hover:underline"
        >
          <span>View all tasks</span>
          <Icon name="chevron_right" className="text-[16px]" />
        </Link>
      </div>
      {actions.overlays}
    </div>
  );
}
