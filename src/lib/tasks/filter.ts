import { addDays } from "@/lib/dates";
import type { TaskPriority } from "@/lib/constants/enums";
import type { TaskView } from "@/lib/tasks/view";

// The four filters on the Tasks screen (Stitch: Event, Assignee, Priority, Due date). Pure, so
// the list and the board always agree and the rules can be tested.

export type DueFilter = "any" | "overdue" | "today" | "week" | "none";

export interface TaskFilters {
  /** "all", an event id, or "none" for tasks without an event. */
  event: string;
  /** "all", a member id, or "none" for unassigned tasks. */
  assignee: string;
  priority: "all" | TaskPriority;
  due: DueFilter;
}

export const NO_FILTERS: TaskFilters = {
  event: "all",
  assignee: "all",
  priority: "all",
  due: "any",
};

export const DUE_OPTIONS: { value: DueFilter; label: string }[] = [
  { value: "any", label: "Any" },
  { value: "overdue", label: "Overdue" },
  { value: "today", label: "Today" },
  { value: "week", label: "Next 7 days" },
  { value: "none", label: "No due date" },
];

export function hasActiveFilters(filters: TaskFilters): boolean {
  return (
    filters.event !== "all" ||
    filters.assignee !== "all" ||
    filters.priority !== "all" ||
    filters.due !== "any"
  );
}

/** `today` is the wedding's own calendar day ("YYYY-MM-DD"). */
export function applyFilters(tasks: TaskView[], filters: TaskFilters, today: string): TaskView[] {
  const weekEnd = addDays(today, 7);
  return tasks.filter((task) => {
    if (
      filters.event === "none"
        ? task.eventId !== null
        : filters.event !== "all" && task.eventId !== filters.event
    ) {
      return false;
    }
    if (filters.assignee === "none") {
      if (task.assigneeMemberIds.length > 0) return false;
    } else if (filters.assignee !== "all" && !task.assigneeMemberIds.includes(filters.assignee)) {
      return false;
    }
    if (filters.priority !== "all" && task.priority !== filters.priority) return false;
    switch (filters.due) {
      case "overdue":
        return task.isOverdue;
      case "today":
        return task.dueDate === today;
      case "week":
        return task.dueDate !== null && task.dueDate >= today && task.dueDate <= weekEnd;
      case "none":
        return task.dueDate === null;
      default:
        return true;
    }
  });
}
