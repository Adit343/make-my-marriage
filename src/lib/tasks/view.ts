import type { EventType, TaskPriority, TaskStatus } from "@/lib/constants/enums";
import { formatDayMonth, formatShortDate } from "@/lib/dates";
import { calendarDayIn } from "@/lib/events/format";
import { initialsOf } from "@/lib/text/initials";
import type { TaskDto } from "@/modules/tasks/task.dto";

// A task plus every label a screen needs, computed once on the server (so server and browser
// never disagree about "overdue" or a date), plus the pure grouping/sorting the Tasks screen uses.

export interface AssigneeView {
  id: string;
  name: string;
  initials: string;
  relationship: string | null;
  /** 0–3: which of the avatar colours this person gets (stable per member). */
  tone: number;
}

export interface TaskEventInfo {
  id: string;
  name: string;
  type: EventType;
  startsAt: string;
  timezone: string;
  venue: string | null;
}

export interface TaskMember {
  id: string;
  name: string;
  relationship: string | null;
}

export interface TaskView extends TaskDto {
  eventName: string | null;
  eventType: EventType | null;
  assignees: AssigneeView[];
  /** "11 Feb 2027" */
  dueLabel: string | null;
  isOverdue: boolean;
  /** "Overdue • 10 Feb" */
  overdueLabel: string | null;
  /** "Done 10 Feb" */
  doneLabel: string | null;
}

export interface TaskGroup {
  key: string;
  eventId: string | null;
  title: string;
  /** "12 Feb 2027 • The Courtyard, Dumas Road" */
  subtitle: string | null;
  tasks: TaskView[];
  doneCount: number;
}

export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
};

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

/** A stable colour slot per member id, so the same person looks the same everywhere. */
export function toneOf(memberId: string): number {
  let hash = 0;
  for (const char of memberId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % 4;
}

/** Due before today, and not finished. `today` is the wedding's own calendar day. */
export function isOverdue(
  task: { dueDate: string | null; status: TaskStatus },
  today: string,
): boolean {
  return task.status !== "done" && task.dueDate !== null && task.dueDate < today;
}

export function toTaskViews(
  tasks: TaskDto[],
  context: {
    events: TaskEventInfo[];
    members: TaskMember[];
    today: string;
    timezone: string;
  },
): TaskView[] {
  const eventById = new Map(context.events.map((event) => [event.id, event]));
  const memberById = new Map(context.members.map((member) => [member.id, member]));

  return tasks.map((task) => {
    const event = task.eventId ? eventById.get(task.eventId) : undefined;
    const overdue = isOverdue(task, context.today);
    return {
      ...task,
      eventName: event?.name ?? null,
      eventType: event?.type ?? null,
      assignees: task.assigneeMemberIds.flatMap((id) => {
        const member = memberById.get(id);
        return member
          ? [
              {
                id,
                name: member.name,
                initials: initialsOf(member.name),
                relationship: member.relationship,
                tone: toneOf(id),
              },
            ]
          : [];
      }),
      dueLabel: task.dueDate ? formatShortDate(task.dueDate) : null,
      isOverdue: overdue,
      overdueLabel: overdue && task.dueDate ? `Overdue • ${formatDayMonth(task.dueDate)}` : null,
      doneLabel:
        task.status === "done" && task.completedAt
          ? `Done ${formatDayMonth(calendarDayIn(new Date(task.completedAt), context.timezone))}`
          : null,
    };
  });
}

/** Open tasks first (soonest due first, undated last), finished ones at the bottom. */
export function compareForList(a: TaskView, b: TaskView): number {
  if ((a.status === "done") !== (b.status === "done")) return a.status === "done" ? 1 : -1;
  if (a.dueDate !== b.dueDate) {
    if (a.dueDate === null) return 1;
    if (b.dueDate === null) return -1;
    return a.dueDate < b.dueDate ? -1 : 1;
  }
  return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
}

/**
 * Tasks grouped by event in timeline order, with tasks that have no event last under "General".
 * Events without tasks are left out.
 */
export function groupTasksByEvent(tasks: TaskView[], events: TaskEventInfo[]): TaskGroup[] {
  const groups: TaskGroup[] = [];
  const make = (
    key: string,
    eventId: string | null,
    title: string,
    subtitle: string | null,
    members: TaskView[],
  ) => ({
    key,
    eventId,
    title,
    subtitle,
    tasks: [...members].sort(compareForList),
    doneCount: members.filter((task) => task.status === "done").length,
  });

  for (const event of events) {
    const members = tasks.filter((task) => task.eventId === event.id);
    if (members.length === 0) continue;
    const day = formatShortDate(calendarDayIn(new Date(event.startsAt), event.timezone));
    groups.push(
      make(event.id, event.id, event.name, [day, event.venue].filter(Boolean).join(" • "), members),
    );
  }
  const general = tasks.filter(
    (task) => !task.eventId || !events.some((e) => e.id === task.eventId),
  );
  if (general.length > 0) {
    groups.push(make("general", null, "General", "Tasks for the wedding as a whole", general));
  }
  return groups;
}

export function summarize(tasks: TaskView[]) {
  return {
    total: tasks.length,
    inProgress: tasks.filter((task) => task.status === "in_progress").length,
    overdue: tasks.filter((task) => task.isOverdue).length,
    done: tasks.filter((task) => task.status === "done").length,
  };
}

/**
 * The task as it will look once its status changes, for showing the change at once while the
 * server confirms it: overdue and "Done 10 Feb" follow the new status.
 */
export function withStatus(task: TaskView, status: TaskStatus, today: string): TaskView {
  const overdue = isOverdue({ dueDate: task.dueDate, status }, today);
  return {
    ...task,
    status,
    isOverdue: overdue,
    overdueLabel: overdue && task.dueDate ? `Overdue • ${formatDayMonth(task.dueDate)}` : null,
    doneLabel: status === "done" ? (task.doneLabel ?? `Done ${formatDayMonth(today)}`) : null,
  };
}
