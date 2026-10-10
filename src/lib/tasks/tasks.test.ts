import { describe, expect, it } from "vitest";
import { addDays, formatDayMonth, formatShortDate } from "@/lib/dates";
import { applyFilters, hasActiveFilters, NO_FILTERS } from "@/lib/tasks/filter";
import {
  compareForList,
  groupTasksByEvent,
  isOverdue,
  summarize,
  toneOf,
  toTaskViews,
  type TaskEventInfo,
  type TaskMember,
} from "@/lib/tasks/view";
import type { TaskDto } from "@/modules/tasks/task.dto";

const TODAY = "2027-02-10";
const IST = "Asia/Kolkata";

const events: TaskEventInfo[] = [
  {
    id: "e-mehendi",
    name: "Mehendi",
    type: "mehendi",
    startsAt: "2027-02-12T08:30:00Z",
    timezone: IST,
    venue: "The Courtyard",
  },
  {
    id: "e-haldi",
    name: "Haldi",
    type: "haldi",
    startsAt: "2027-02-13T04:30:00Z",
    timezone: IST,
    venue: null,
  },
];
const members: TaskMember[] = [
  { id: "m-sunita", name: "Sunita Sharma", relationship: "parent" },
  { id: "m-sanjay", name: "Sanjay Kapoor", relationship: "planner" },
];

let counter = 0;
function task(overrides: Partial<TaskDto> = {}): TaskDto {
  counter += 1;
  return {
    id: `t${counter}`,
    title: `Task ${counter}`,
    description: null,
    eventId: null,
    status: "todo",
    priority: "medium",
    dueDate: null,
    assigneeMemberIds: [],
    completedAt: null,
    createdBy: "u1",
    canDelete: true,
    version: 0,
    createdAt: `2027-01-01T00:00:${String(counter).padStart(2, "0")}.000Z`,
    updatedAt: "2027-01-01T00:00:00.000Z",
    ...overrides,
  };
}
const views = (tasks: TaskDto[]) =>
  toTaskViews(tasks, { events, members, today: TODAY, timezone: IST });

describe("date labels", () => {
  it("writes dates the way the task screens do", () => {
    expect(formatShortDate("2027-02-11")).toBe("11 Feb 2027");
    expect(formatDayMonth("2027-02-11")).toBe("11 Feb");
    expect(addDays("2027-02-27", 3)).toBe("2027-03-02");
    expect(addDays("2027-12-30", 5)).toBe("2028-01-04");
  });
});

describe("isOverdue", () => {
  it.each([
    [{ dueDate: "2027-02-09", status: "todo" as const }, true],
    [{ dueDate: "2027-02-09", status: "in_progress" as const }, true],
    [{ dueDate: "2027-02-10", status: "todo" as const }, false],
    [{ dueDate: "2027-02-11", status: "todo" as const }, false],
    [{ dueDate: "2027-02-09", status: "done" as const }, false],
    [{ dueDate: null, status: "todo" as const }, false],
  ])("%j → %s", (input, expected) => {
    expect(isOverdue(input, TODAY)).toBe(expected);
  });
});

describe("toTaskViews", () => {
  it("adds the event, assignees and labels", () => {
    const [view] = views([
      task({
        eventId: "e-haldi",
        dueDate: "2027-02-09",
        assigneeMemberIds: ["m-sunita", "m-gone"],
      }),
    ]);
    expect(view).toMatchObject({
      eventName: "Haldi",
      eventType: "haldi",
      dueLabel: "9 Feb 2027",
      isOverdue: true,
      overdueLabel: "Overdue • 9 Feb",
      doneLabel: null,
    });
    // A member who is gone is simply not shown.
    expect(view!.assignees.map((a) => [a.name, a.initials, a.relationship])).toEqual([
      ["Sunita Sharma", "SS", "parent"],
    ]);
  });

  it("labels a finished task with the day it was finished in the wedding's timezone", () => {
    // 18:45 UTC on the 9th is already the 10th in IST.
    const [view] = views([task({ status: "done", completedAt: "2027-02-09T18:45:00.000Z" })]);
    expect(view!.doneLabel).toBe("Done 10 Feb");
    expect(view!.isOverdue).toBe(false);
  });

  it("gives a member the same colour every time", () => {
    expect(toneOf("abc")).toBe(toneOf("abc"));
    expect(toneOf("abc")).toBeGreaterThanOrEqual(0);
    expect(toneOf("abc")).toBeLessThan(4);
  });
});

describe("ordering and grouping", () => {
  it("sorts open tasks by due date, undated last, and finished tasks at the bottom", () => {
    const sorted = views([
      task({ title: "done", status: "done", dueDate: "2027-02-01" }),
      task({ title: "undated" }),
      task({ title: "late", dueDate: "2027-02-20" }),
      task({ title: "soon", dueDate: "2027-02-11" }),
    ]).sort(compareForList);
    expect(sorted.map((t) => t.title)).toEqual(["soon", "late", "undated", "done"]);
  });

  it("groups by event in timeline order, General last, skipping events without tasks", () => {
    const groups = groupTasksByEvent(
      views([
        task({ eventId: "e-haldi", status: "done" }),
        task({ eventId: "e-haldi" }),
        task({}),
        task({ eventId: "e-mehendi" }),
      ]),
      events,
    );
    expect(groups.map((g) => [g.title, g.tasks.length, g.doneCount])).toEqual([
      ["Mehendi", 1, 0],
      ["Haldi", 2, 1],
      ["General", 1, 0],
    ]);
    expect(groups[0]!.subtitle).toBe("12 Feb 2027 • The Courtyard");
    expect(groups[1]!.subtitle).toBe("13 Feb 2027");
  });

  it("treats a task whose event no longer exists as a General task", () => {
    const groups = groupTasksByEvent(views([task({ eventId: "e-deleted" })]), events);
    expect(groups.map((g) => g.title)).toEqual(["General"]);
  });

  it("summarises counts for the stat strip", () => {
    expect(
      summarize(
        views([
          task({ status: "in_progress" }),
          task({ status: "done" }),
          task({ dueDate: "2027-02-01" }),
          task(),
        ]),
      ),
    ).toEqual({ total: 4, inProgress: 1, overdue: 1, done: 1 });
  });
});

describe("applyFilters", () => {
  const all = views([
    task({ title: "mehendi-high", eventId: "e-mehendi", priority: "high", dueDate: "2027-02-09" }),
    task({
      title: "haldi-sunita",
      eventId: "e-haldi",
      assigneeMemberIds: ["m-sunita"],
      dueDate: "2027-02-10",
    }),
    task({ title: "general", dueDate: "2027-02-14" }),
    task({ title: "far", dueDate: "2027-03-30" }),
    task({ title: "undated", priority: "low" }),
  ]);
  const titles = (f: Partial<typeof NO_FILTERS>) =>
    applyFilters(all, { ...NO_FILTERS, ...f }, TODAY).map((t) => t.title);

  it("keeps everything with no filters", () => {
    expect(titles({})).toHaveLength(5);
    expect(hasActiveFilters(NO_FILTERS)).toBe(false);
  });

  it("filters by event, including tasks without one", () => {
    expect(titles({ event: "e-haldi" })).toEqual(["haldi-sunita"]);
    expect(titles({ event: "none" })).toEqual(["general", "far", "undated"]);
  });

  it("filters by assignee, including unassigned", () => {
    expect(titles({ assignee: "m-sunita" })).toEqual(["haldi-sunita"]);
    expect(titles({ assignee: "none" })).toEqual(["mehendi-high", "general", "far", "undated"]);
  });

  it("filters by priority", () => {
    expect(titles({ priority: "high" })).toEqual(["mehendi-high"]);
    expect(titles({ priority: "low" })).toEqual(["undated"]);
  });

  it("filters by due date", () => {
    expect(titles({ due: "overdue" })).toEqual(["mehendi-high"]);
    expect(titles({ due: "today" })).toEqual(["haldi-sunita"]);
    expect(titles({ due: "week" })).toEqual(["haldi-sunita", "general"]);
    expect(titles({ due: "none" })).toEqual(["undated"]);
  });

  it("combines filters and reports when any is active", () => {
    expect(titles({ event: "none", due: "week" })).toEqual(["general"]);
    expect(hasActiveFilters({ ...NO_FILTERS, due: "week" })).toBe(true);
  });
});
