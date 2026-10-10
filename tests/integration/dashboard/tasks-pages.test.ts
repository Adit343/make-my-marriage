import { describe, expect, it } from "vitest";
import { POST as createEvent } from "@/app/api/v1/weddings/[weddingId]/events/route";
import { POST as createTask } from "@/app/api/v1/weddings/[weddingId]/tasks/route";
import { PATCH as patchTask } from "@/app/api/v1/weddings/[weddingId]/tasks/[taskId]/route";
import { todayIn } from "@/lib/dates";
import { resolveSession } from "@/modules/auth/session.service";
import { getDashboard } from "@/modules/dashboard/dashboard.service";
import { getEventPage, getTasksPage } from "@/modules/dashboard/workspace-pages.service";
import { signUpUser } from "../../setup/auth";
import { setupTestDatabase } from "../../setup/database";
import { call } from "../../setup/http";
import { addMember, setupWedding, type TestMember } from "../../setup/wedding";

setupTestDatabase();

async function authFor(cookie: string) {
  const auth = await resolveSession(cookie.split("=")[1]);
  if (!auth) throw new Error("no session");
  return auth;
}

const DAY = 24 * 60 * 60 * 1000;
const dayOffset = (days: number) => todayIn("Asia/Kolkata", new Date(Date.now() + days * DAY));

async function addTask(weddingId: string, who: TestMember, body: Record<string, unknown>) {
  const result = await call(createTask, { cookie: who.cookie, params: { weddingId }, body });
  if (result.status !== 201) throw new Error(JSON.stringify(result.json));
  return result.json.data as { id: string; version: number };
}
async function addEvent(weddingId: string, who: TestMember, name: string) {
  const result = await call(createEvent, {
    cookie: who.cookie,
    params: { weddingId },
    body: {
      name,
      type: "haldi",
      startsAt: "2027-02-13T04:30:00Z",
      location: { label: "Family Home" },
    },
  });
  return result.json.data.id as string;
}

describe("getTasksPage", () => {
  it("gives every task with its event, assignees and labels, plus the summary", async () => {
    const { weddingId, owner } = await setupWedding();
    const member = await addMember(weddingId, "member");
    const eventId = await addEvent(weddingId, owner, "Haldi Ceremony");
    await addTask(weddingId, owner, {
      title: "Order marigolds",
      eventId,
      priority: "high",
      dueDate: dayOffset(-2),
      status: "in_progress",
      assigneeMemberIds: [member.memberId],
    });
    await addTask(weddingId, owner, { title: "Send thank-yous", dueDate: dayOffset(5) });
    const finished = await addTask(weddingId, owner, { title: "Book DJ" });
    await call(patchTask, {
      method: "PATCH",
      cookie: owner.cookie,
      params: { weddingId, taskId: finished.id },
      body: { version: finished.version, status: "done" },
    });

    const page = await getTasksPage(await authFor(owner.cookie));
    expect(page?.summary).toEqual({ total: 3, inProgress: 1, overdue: 1, done: 1 });
    expect(page?.today).toBe(todayIn("Asia/Kolkata"));

    const marigolds = page!.tasks.find((t) => t.title === "Order marigolds")!;
    expect(marigolds).toMatchObject({
      eventName: "Haldi Ceremony",
      isOverdue: true,
      priority: "high",
      status: "in_progress",
    });
    expect(marigolds.overdueLabel).toMatch(/^Overdue • \d{1,2} [A-Z][a-z]{2}$/);
    expect(marigolds.assignees.map((a) => [a.id, a.initials])).toEqual([[member.memberId, "PS"]]);

    const booked = page!.tasks.find((t) => t.title === "Book DJ")!;
    expect(booked.doneLabel).toMatch(/^Done \d{1,2} [A-Z][a-z]{2}$/);
    expect(booked.isOverdue).toBe(false);

    expect(page?.events.map((e) => [e.name, e.venue])).toEqual([["Haldi Ceremony", "Family Home"]]);
    expect(page?.members.map((m) => m.id).sort()).toEqual([member.memberId, owner.memberId].sort());
  });

  it("works for a plain member, flagging only their own tasks as deletable", async () => {
    const { weddingId, owner } = await setupWedding();
    const member = await addMember(weddingId, "member");
    await addTask(weddingId, owner, { title: "Owner's task" });
    await addTask(weddingId, member, { title: "Member's task" });

    const page = await getTasksPage(await authFor(member.cookie));
    expect(page?.tasks.map((t) => [t.title, t.canDelete])).toEqual([
      ["Owner's task", false],
      ["Member's task", true],
    ]);
  });

  it("is null for someone with no wedding and never shows another wedding's tasks", async () => {
    const a = await setupWedding();
    const b = await setupWedding("Another wedding");
    await addTask(a.weddingId, a.owner, { title: "Wedding A only" });

    expect((await getTasksPage(await authFor(b.owner.cookie)))?.tasks).toEqual([]);
    const { cookie } = await signUpUser();
    expect(await getTasksPage(await authFor(cookie))).toBeNull();
  });
});

describe("the event page's tasks", () => {
  it("lists only that event's tasks and carries what the task form needs", async () => {
    const { weddingId, owner } = await setupWedding();
    const haldi = await addEvent(weddingId, owner, "Haldi");
    const sangeet = await addEvent(weddingId, owner, "Sangeet");
    await addTask(weddingId, owner, { title: "Haldi task", eventId: haldi });
    await addTask(weddingId, owner, { title: "Sangeet task", eventId: sangeet });
    await addTask(weddingId, owner, { title: "General task" });

    const page = await getEventPage(await authFor(owner.cookie), haldi);
    if (!page || page === "not_found") throw new Error("expected the event page");
    expect(page.tasks.map((t) => t.title)).toEqual(["Haldi task"]);
    expect(page.taskForm.events.map((e) => e.name).sort()).toEqual(["Haldi", "Sangeet"]);
    expect(page.taskForm.members.map((m) => m.id)).toEqual([owner.memberId]);
  });
});

describe("dashboard", () => {
  it("counts tasks that are not done and lists the next few, soonest first", async () => {
    const { weddingId, owner } = await setupWedding();
    expect((await getDashboard(await authFor(owner.cookie))).workspace?.counts.pendingTasks).toBe(
      0,
    );

    await addTask(weddingId, owner, { title: "Later", dueDate: dayOffset(20) });
    await addTask(weddingId, owner, { title: "Late", dueDate: dayOffset(-3) });
    await addTask(weddingId, owner, {
      title: "Soon",
      dueDate: dayOffset(2),
      assigneeMemberIds: [owner.memberId],
    });
    await addTask(weddingId, owner, { title: "Undated" });
    await addTask(weddingId, owner, {
      title: "Already done",
      status: "done",
      dueDate: dayOffset(1),
    });

    const { workspace } = await getDashboard(await authFor(owner.cookie));
    expect(workspace?.counts.pendingTasks).toBe(4);
    expect(workspace?.upcomingTasks.map((t) => [t.title, t.isOverdue])).toEqual([
      ["Late", true],
      ["Soon", false],
      ["Later", false],
      ["Undated", false],
    ]);
    expect(workspace?.upcomingTasks[1]?.assigneeInitials).toEqual(["PS"]);
    expect(workspace?.upcomingTasks[3]?.dueLabel).toBeNull();
  });

  it("does not count deleted tasks", async () => {
    const { weddingId, owner } = await setupWedding();
    await addTask(weddingId, owner, { title: "x" });
    const dashboard = await getDashboard(await authFor(owner.cookie));
    expect(dashboard.workspace?.counts.pendingTasks).toBe(1);
  });
});
