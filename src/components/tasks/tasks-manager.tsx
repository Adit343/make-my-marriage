"use client";

import { useState } from "react";
import { EventMenu, type EventMenuItem } from "@/components/events/event-menu";
import { AssigneeAvatars } from "@/components/tasks/assignee-avatars";
import { useTaskActions } from "@/components/tasks/use-task-actions";
import { Icon } from "@/components/ui/icon";
import { TASK_STATUSES, type TaskStatus } from "@/lib/constants/enums";
import { EVENT_TYPE_LABEL } from "@/lib/events/view";
import {
  applyFilters,
  DUE_OPTIONS,
  hasActiveFilters,
  NO_FILTERS,
  type DueFilter,
  type TaskFilters,
} from "@/lib/tasks/filter";
import {
  compareForList,
  groupTasksByEvent,
  PRIORITY_LABEL,
  STATUS_LABEL,
  summarize,
  type TaskEventInfo,
  type TaskMember,
  type TaskView,
} from "@/lib/tasks/view";

// Stitch screens: "Tasks (List View Grouped by Event)" and "Tasks (Board View)". One page, two
// views of the same filtered tasks. Drag a board card to another column to change its status;
// every task also has a menu with "Change status" for keyboard and touch.

export type ViewMode = "list" | "board";

const PRIORITY_CHIP = {
  high: "bg-primary-fixed/30 text-primary",
  medium: "bg-surface-container text-on-surface-variant",
  low: "bg-surface-container-low text-outline",
} as const;
const PRIORITY_BAR = { high: "bg-[#1F4D3D]", medium: "bg-[#B5714A]", low: "bg-[#C0C8C3]" } as const;
const STATUS_PILL: Record<TaskStatus, string> = {
  todo: "bg-surface-container-high text-on-surface-variant",
  in_progress: "bg-secondary-container/20 text-secondary",
  done: "bg-primary-fixed/40 text-primary",
};
const COLUMN_BADGE: Record<TaskStatus, string> = {
  todo: "bg-[#2A2622]/[0.08] text-[#2A2622]",
  in_progress: "bg-[#1F4D3D]/10 text-[#1F4D3D]",
  done: "bg-[#2A2622]/[0.06] text-on-surface-variant",
};

const BUTTON_PRIMARY =
  "flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-body-sm text-body-sm font-medium text-on-primary shadow-sm transition-all duration-150 hover:bg-tertiary active:scale-[0.99]";

export function TasksManager({
  weddingId,
  tasks,
  events,
  members,
  today,
  initialEvent,
  initialView,
}: {
  weddingId: string;
  tasks: TaskView[];
  events: TaskEventInfo[];
  members: TaskMember[];
  today: string;
  /** From `?event=` (the event page's "View all tasks"). */
  initialEvent?: string;
  /** From `?view=`: the board or the list. */
  initialView: ViewMode;
}) {
  const actions = useTaskActions({ weddingId, events, members, today, tasks });
  const [view, setView] = useState<ViewMode>(initialView);
  const [filters, setFilters] = useState<TaskFilters>({
    ...NO_FILTERS,
    event: initialEvent && events.some((event) => event.id === initialEvent) ? initialEvent : "all",
  });
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // The chosen view lives in the address (?view=board) so it survives a reload and can be shared.
  function chooseView(next: ViewMode) {
    setView(next);
    const url = new URL(window.location.href);
    url.searchParams.set("view", next);
    window.history.replaceState(null, "", url);
  }

  const current = tasks.map(actions.effective);
  const visible = applyFilters(current, filters, today);
  const stats = summarize(current);
  const filtering = hasActiveFilters(filters);

  const addTask = (status?: TaskStatus) =>
    actions.openDrawer({
      kind: "create",
      status,
      eventId: filters.event !== "all" && filters.event !== "none" ? filters.event : null,
    });

  return (
    <div className="mx-auto max-w-[1240px] space-y-7 pb-10">
      <div className="space-y-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h1 className="font-headline-lg text-headline-lg font-normal tracking-tight text-primary">
              Tasks
            </h1>
            <p className="mt-1 font-body-md text-body-md text-on-surface-variant">
              Everything that needs doing, and who&apos;s on it.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div
              role="group"
              aria-label="View"
              className="flex items-center rounded-lg bg-surface-container-high p-1 shadow-inner"
            >
              {(
                [
                  ["board", "Board", "view_kanban"],
                  ["list", "List", "format_list_bulleted"],
                ] as const
              ).map(([value, label, icon]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={view === value}
                  onClick={() => chooseView(value)}
                  className={`flex items-center gap-1.5 rounded-md px-3.5 py-1.5 font-body-sm text-body-sm transition-colors ${
                    view === value
                      ? "bg-surface-container-lowest font-semibold text-primary shadow-[0_2px_8px_-2px_rgba(42,38,34,0.08)]"
                      : "text-on-surface-variant hover:text-primary"
                  }`}
                >
                  <Icon name={icon} className="text-[17px]" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
            <button type="button" onClick={() => addTask()} className={BUTTON_PRIMARY}>
              <Icon name="add" className="text-[18px]" />
              <span>Add task</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-on-background/[0.04] bg-surface-container-low px-5 py-3">
          <Stat value={stats.total} label="total tasks" />
          <Dot />
          <Stat value={stats.inProgress} label="in progress" />
          <Dot />
          <div className="flex items-center gap-2 text-secondary">
            <Icon name="schedule" className="text-[16px]" />
            <span className="font-title text-title font-semibold">{stats.overdue} overdue</span>
          </div>
          <Dot />
          <Stat value={stats.done} label="done" />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <FilterPill
              label="Event"
              value={filters.event}
              onChange={(event) => setFilters({ ...filters, event })}
              options={[
                { value: "all", label: "All events" },
                ...events.map((event) => ({ value: event.id, label: event.name })),
                { value: "none", label: "No event" },
              ]}
            />
            <FilterPill
              label="Assignee"
              value={filters.assignee}
              onChange={(assignee) => setFilters({ ...filters, assignee })}
              options={[
                { value: "all", label: "All" },
                ...members.map((member) => ({ value: member.id, label: member.name })),
                { value: "none", label: "Unassigned" },
              ]}
            />
            <FilterPill
              label="Priority"
              value={filters.priority}
              onChange={(priority) =>
                setFilters({ ...filters, priority: priority as TaskFilters["priority"] })
              }
              options={[
                { value: "all", label: "All" },
                { value: "high", label: PRIORITY_LABEL.high },
                { value: "medium", label: PRIORITY_LABEL.medium },
                { value: "low", label: PRIORITY_LABEL.low },
              ]}
            />
            <FilterPill
              label="Due date"
              value={filters.due}
              onChange={(due) => setFilters({ ...filters, due: due as DueFilter })}
              options={DUE_OPTIONS}
            />
          </div>
          <button
            type="button"
            onClick={() => setFilters(NO_FILTERS)}
            disabled={!filtering}
            className="px-2 py-1 font-body-sm text-body-sm font-medium text-secondary transition-colors hover:text-on-secondary-fixed disabled:cursor-default disabled:opacity-40 disabled:hover:text-secondary"
          >
            Clear filters
          </button>
        </div>
      </div>

      {current.length === 0 ? (
        <EmptyState
          title="No tasks yet"
          message="Add the to-dos for your wedding, link them to an event and give them to the people who'll do them."
          action={
            <button type="button" onClick={() => addTask()} className={BUTTON_PRIMARY}>
              <Icon name="add" className="text-[18px]" />
              Add your first task
            </button>
          }
        />
      ) : visible.length === 0 ? (
        <EmptyState
          title="No tasks match these filters"
          message="Try a different event, person, priority or due date."
          action={
            <button
              type="button"
              onClick={() => setFilters(NO_FILTERS)}
              className="rounded-lg border border-[#D5CCC0] px-4 py-2 font-body-sm text-body-sm font-medium text-[#2A2622] transition-colors hover:bg-[#F2ECE3]"
            >
              Clear filters
            </button>
          }
        />
      ) : view === "list" ? (
        <ListView
          tasks={visible}
          events={events}
          collapsed={collapsed}
          onToggle={(key) =>
            setCollapsed((set) => {
              const next = new Set(set);
              if (next.has(key)) next.delete(key);
              else next.add(key);
              return next;
            })
          }
          actions={actions}
        />
      ) : (
        <BoardView tasks={visible} actions={actions} onAdd={addTask} />
      )}

      {actions.overlays}
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-title text-title font-semibold text-primary">{value}</span>
      <span className="font-body-sm text-body-sm text-on-surface-variant">{label}</span>
    </div>
  );
}

function Dot() {
  return (
    <span aria-hidden="true" className="text-on-background/20">
      •
    </span>
  );
}

function FilterPill({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  const selected = options.find((option) => option.value === value);
  return (
    <label className="relative flex cursor-pointer items-center gap-2 rounded-full border border-on-background/10 bg-surface-container-lowest px-3.5 py-1.5 font-body-sm text-body-sm text-on-surface transition-all focus-within:border-primary/50 hover:border-on-background/20">
      <span className="text-on-surface-variant">{label}:</span>
      <span className="max-w-[160px] truncate font-medium text-primary">{selected?.label}</span>
      <Icon name="expand_more" className="text-[16px]" />
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[#2A2622]/15 bg-surface-container-lowest px-6 py-16 text-center">
      <Icon name="checklist" className="text-[28px] text-outline" />
      <h2 className="font-headline-sm text-headline-sm font-medium text-[#2A2622]">{title}</h2>
      <p className="max-w-sm font-body-md text-body-md text-on-surface-variant">{message}</p>
      <div className="mt-2">{action}</div>
    </div>
  );
}

type Actions = ReturnType<typeof useTaskActions>;

// ---------------------------------------------------------------------------------------------
// List view
// ---------------------------------------------------------------------------------------------

function ListView({
  tasks,
  events,
  collapsed,
  onToggle,
  actions,
}: {
  tasks: TaskView[];
  events: TaskEventInfo[];
  collapsed: Set<string>;
  onToggle: (key: string) => void;
  actions: Actions;
}) {
  const groups = groupTasksByEvent(tasks, events);
  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const isCollapsed = collapsed.has(group.key);
        const percent = Math.round((group.doneCount / group.tasks.length) * 100);
        return (
          <section
            key={group.key}
            className="rounded-xl border border-on-background/[0.06] bg-surface-container-lowest shadow-[0_2px_12px_-2px_rgba(42,38,34,0.04)]"
          >
            <div
              className={`flex items-center justify-between gap-4 bg-surface-container-low/40 p-5 ${
                isCollapsed ? "rounded-xl" : "rounded-t-xl border-b border-on-background/[0.05]"
              }`}
            >
              <button
                type="button"
                aria-expanded={!isCollapsed}
                onClick={() => onToggle(group.key)}
                className="flex min-w-0 items-center gap-3.5 text-left"
              >
                <Icon
                  name="expand_more"
                  className={`text-on-surface-variant transition-transform ${isCollapsed ? "-rotate-90" : ""}`}
                />
                <div className="min-w-0">
                  <h3 className="truncate font-headline-sm text-headline-sm font-medium text-primary">
                    {group.title}
                  </h3>
                  {group.subtitle ? (
                    <p className="truncate font-body-sm text-body-sm text-on-surface-variant">
                      {group.subtitle}
                    </p>
                  ) : null}
                </div>
              </button>
              <div className="shrink-0 text-right">
                <span className="font-label-md text-label-md font-semibold text-primary">
                  {group.doneCount} of {group.tasks.length} done
                </span>
                <div className="mt-1 h-1.5 w-28 overflow-hidden rounded-full bg-surface-container-highest">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            </div>
            {isCollapsed ? null : (
              <ul className="divide-y divide-on-background/[0.04]">
                {group.tasks.map((task) => (
                  <ListRow key={task.id} task={task} actions={actions} />
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

function ListRow({ task, actions }: { task: TaskView; actions: Actions }) {
  const done = task.status === "done";
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 p-4 transition-colors hover:bg-surface-container-low/20">
      <div className="flex min-w-0 flex-1 basis-64 items-center gap-3.5">
        <button
          type="button"
          role="checkbox"
          aria-checked={done}
          aria-label={done ? `Reopen "${task.title}"` : `Mark "${task.title}" done`}
          onClick={() => void actions.setStatus(task, done ? "todo" : "done")}
          className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border transition-colors ${
            done
              ? "border-primary bg-primary text-on-primary"
              : "border-on-background/25 hover:border-primary"
          }`}
        >
          {done ? <Icon name="check" className="text-[13px]" /> : null}
        </button>
        <button
          type="button"
          onClick={() => actions.openDrawer({ kind: "edit", task })}
          className={`min-w-0 truncate text-left font-body-md text-body-md transition-colors hover:text-primary ${
            done ? "text-on-surface-variant/60 line-through" : "text-on-background"
          }`}
        >
          {task.title}
        </button>
      </div>
      <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 pl-8 md:w-auto md:shrink-0 md:gap-x-5 md:pl-0">
        <span
          className={`rounded px-2 py-0.5 font-label-sm text-label-sm font-semibold uppercase ${PRIORITY_CHIP[task.priority]}`}
        >
          {PRIORITY_LABEL[task.priority]}
        </span>
        <DueCell task={task} />
        <div className="flex md:w-14">
          <AssigneeAvatars assignees={task.assignees} variant="soft" />
        </div>
        <span
          className={`rounded px-2.5 py-1 text-center font-label-sm text-label-sm font-medium uppercase md:w-24 ${STATUS_PILL[task.status]}`}
        >
          {STATUS_LABEL[task.status]}
        </span>
        <div className="ml-auto md:ml-0">
          <EventMenu eventName={task.title} items={actions.menuItems(task)} />
        </div>
      </div>
    </li>
  );
}

function DueCell({ task }: { task: TaskView }) {
  if (task.status === "done") {
    return (
      <span className="font-body-sm text-body-sm text-on-surface-variant/60 md:w-28 md:text-right">
        {task.doneLabel ?? task.dueLabel ?? "—"}
      </span>
    );
  }
  if (task.overdueLabel) {
    return (
      <span className="flex items-center gap-1 font-body-sm text-body-sm font-medium whitespace-nowrap text-secondary md:w-36 md:justify-end">
        <Icon name="schedule" className="text-[14px]" />
        {task.overdueLabel}
      </span>
    );
  }
  return (
    <span className="font-body-sm text-body-sm text-on-surface-variant md:w-28 md:text-right">
      {task.dueLabel ?? "No due date"}
    </span>
  );
}

// ---------------------------------------------------------------------------------------------
// Board view
// ---------------------------------------------------------------------------------------------

function BoardView({
  tasks,
  actions,
  onAdd,
}: {
  tasks: TaskView[];
  actions: Actions;
  onAdd: (status: TaskStatus) => void;
}) {
  const [dragging, setDragging] = useState<TaskView | null>(null);
  const [over, setOver] = useState<TaskStatus | null>(null);

  return (
    <section className="grid grid-cols-1 items-start gap-6 pb-6 md:grid-cols-3">
      {TASK_STATUSES.map((status) => {
        const column = tasks
          .filter((task) => task.status === status)
          .sort((a, b) =>
            status === "done"
              ? (b.completedAt ?? "").localeCompare(a.completedAt ?? "")
              : compareForList(a, b),
          );
        const dropping = over === status && dragging !== null && dragging.status !== status;
        return (
          <div
            key={status}
            onDragOver={(event) => {
              if (!dragging) return;
              event.preventDefault();
              setOver(status);
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(null);
            }}
            onDrop={(event) => {
              event.preventDefault();
              const task = dragging;
              setOver(null);
              setDragging(null);
              if (task) void actions.setStatus(task, status);
            }}
            className={`flex flex-col space-y-4 rounded-2xl border bg-[#F5EFEB] p-4 transition-colors ${
              dropping ? "border-primary/40" : "border-[#2A2622]/[0.03]"
            }`}
          >
            <div className="flex items-center gap-2.5 px-1 py-1">
              <h2 className="font-title text-title text-[#2A2622]">{STATUS_LABEL[status]}</h2>
              <span
                className={`rounded-full px-2 py-0.5 font-label-sm text-label-sm font-semibold ${COLUMN_BADGE[status]}`}
              >
                {column.length}
              </span>
            </div>

            <ul className="space-y-3">
              {column.map((task) => (
                <BoardCard
                  key={task.id}
                  task={task}
                  actions={actions}
                  dragging={dragging?.id === task.id}
                  onDragStart={() => setDragging(task)}
                  onDragEnd={() => {
                    setDragging(null);
                    setOver(null);
                  }}
                />
              ))}
            </ul>

            {dropping ? (
              <div className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#2A2622]/20 bg-[#EAE1DA]/60 px-4 py-5 font-body-sm text-body-sm text-on-surface-variant">
                <Icon name="drag_indicator" className="text-[18px]" />
                Drop task here
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => onAdd(status)}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg py-2.5 font-body-sm text-body-sm text-on-surface-variant transition-colors hover:bg-[#FAF6F0]/60 hover:text-primary"
            >
              <Icon name="add" className="text-[16px]" />
              Add task
            </button>
          </div>
        );
      })}
    </section>
  );
}

/** The board chip names the kind of event ("Haldi"), as in the design; "General" has no event. */
function eventChipLabel(task: TaskView): string {
  if (!task.eventType) return "General";
  if (task.eventType === "other") return task.eventName ?? "Other";
  return task.eventType === "ceremony" ? "Ceremony" : EVENT_TYPE_LABEL[task.eventType];
}

function BoardCard({
  task,
  actions,
  dragging,
  onDragStart,
  onDragEnd,
}: {
  task: TaskView;
  actions: Actions;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const done = task.status === "done";
  const chip = eventChipLabel(task);
  return (
    <li
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", task.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={`group elevation-1 relative cursor-grab overflow-hidden rounded-xl bg-[#FFFDF9] p-4 transition-all hover:-translate-y-0.5 hover:shadow-md active:cursor-grabbing ${
        dragging ? "opacity-40" : ""
      }`}
    >
      <div
        aria-hidden="true"
        className={`absolute top-0 bottom-0 left-0 w-1.5 ${done ? "bg-[#C0C8C3]" : PRIORITY_BAR[task.priority]}`}
      />
      <div className="space-y-3 pl-2">
        <div className="flex items-start justify-between gap-2">
          <h3
            className={`min-w-0 font-title text-[15px] leading-snug font-semibold ${
              done
                ? "text-on-surface-variant/70 line-through"
                : "text-[#2A2622] transition-colors group-hover:text-primary"
            }`}
          >
            <button
              type="button"
              onClick={() => actions.openDrawer({ kind: "edit", task })}
              className="text-left focus-visible:underline focus-visible:outline-none"
            >
              {task.title}
            </button>
          </h3>
          <span
            title={task.eventName ?? "Not linked to an event"}
            className="max-w-[96px] shrink-0 truncate rounded bg-[#F4EFEA] px-2 py-0.5 font-label-sm text-label-sm font-semibold tracking-wide text-[#1F4D3D] uppercase"
          >
            {chip}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 pt-1">
          {done ? (
            <span className="font-body-sm text-[12px] text-on-surface-variant">
              {task.doneLabel ?? "Done"}
            </span>
          ) : task.overdueLabel ? (
            <span className="flex items-center gap-1.5 rounded-md bg-secondary-fixed/40 px-2.5 py-1 font-body-sm text-[12px] font-medium text-secondary">
              <Icon name="schedule" className="text-[14px]" />
              {task.overdueLabel}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 font-body-sm text-[12px] text-on-surface-variant">
              <Icon name="calendar_today" className="text-[15px]" />
              {task.dueLabel ?? "No due date"}
            </span>
          )}
          <div className="flex items-center gap-1">
            <AssigneeAvatars assignees={task.assignees} variant="solid" />
            <EventMenu eventName={task.title} items={actions.menuItems(task) as EventMenuItem[]} />
          </div>
        </div>
      </div>
    </li>
  );
}
