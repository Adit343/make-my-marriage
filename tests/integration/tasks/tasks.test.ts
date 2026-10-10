import { describe, expect, it } from "vitest";
import { POST as createEvent } from "@/app/api/v1/weddings/[weddingId]/events/route";
import { DELETE as deleteEvent } from "@/app/api/v1/weddings/[weddingId]/events/[eventId]/route";
import { DELETE as removeMember } from "@/app/api/v1/weddings/[weddingId]/members/[memberId]/route";
import {
  GET as listTasks,
  POST as createTask,
} from "@/app/api/v1/weddings/[weddingId]/tasks/route";
import {
  DELETE as deleteTask,
  PATCH as patchTask,
} from "@/app/api/v1/weddings/[weddingId]/tasks/[taskId]/route";
import { setupTestDatabase } from "../../setup/database";
import { call } from "../../setup/http";
import { addMember, setupWedding, type TestMember } from "../../setup/wedding";

setupTestDatabase();

async function create(weddingId: string, who: TestMember, body: Record<string, unknown>) {
  return call(createTask, { cookie: who.cookie, params: { weddingId }, body });
}
async function makeTask(weddingId: string, who: TestMember, body: Record<string, unknown> = {}) {
  const result = await create(weddingId, who, { title: "Book the mandap decorator", ...body });
  if (result.status !== 201) throw new Error(JSON.stringify(result.json));
  return result.json.data as { id: string; version: number } & Record<string, unknown>;
}
async function patch(
  weddingId: string,
  taskId: string,
  who: TestMember,
  body: Record<string, unknown>,
) {
  return call(patchTask, {
    method: "PATCH",
    cookie: who.cookie,
    params: { weddingId, taskId },
    body,
  });
}
async function remove(weddingId: string, taskId: string, who: TestMember) {
  return call(deleteTask, { method: "DELETE", cookie: who.cookie, params: { weddingId, taskId } });
}
async function list(weddingId: string, who: TestMember, query = "") {
  return call(listTasks, {
    method: "GET",
    path: `/api/test${query}`,
    cookie: who.cookie,
    params: { weddingId },
  });
}
async function makeEvent(weddingId: string, who: TestMember, name = "Haldi") {
  const result = await call(createEvent, {
    cookie: who.cookie,
    params: { weddingId },
    body: { name, type: "haldi", startsAt: "2027-02-13T04:30:00Z" },
  });
  return result.json.data.id as string;
}

describe("POST /weddings/:weddingId/tasks", () => {
  it("creates a task with defaults", async () => {
    const { weddingId, owner } = await setupWedding();
    const result = await create(weddingId, owner, { title: "Book the mandap decorator" });
    expect(result.status).toBe(201);
    expect(result.json.data).toMatchObject({
      title: "Book the mandap decorator",
      description: null,
      eventId: null,
      status: "todo",
      priority: "medium",
      dueDate: null,
      assigneeMemberIds: [],
      completedAt: null,
      createdBy: owner.user.id,
      canDelete: true,
      version: 0,
    });
  });

  it("lets every role create tasks", async () => {
    const { weddingId, owner } = await setupWedding();
    const admin = await addMember(weddingId, "admin");
    const member = await addMember(weddingId, "member");
    for (const who of [owner, admin, member]) {
      expect((await create(weddingId, who, { title: "A task" })).status).toBe(201);
    }
  });

  it("links an event and assigns active members", async () => {
    const { weddingId, owner } = await setupWedding();
    const member = await addMember(weddingId, "member");
    const eventId = await makeEvent(weddingId, owner);
    const result = await create(weddingId, owner, {
      title: "Order marigolds",
      description: "40 kg",
      eventId,
      priority: "high",
      dueDate: "2027-02-10",
      assigneeMemberIds: [owner.memberId, member.memberId],
    });
    expect(result.status).toBe(201);
    expect(result.json.data).toMatchObject({
      eventId,
      priority: "high",
      dueDate: "2027-02-10",
      description: "40 kg",
      assigneeMemberIds: [owner.memberId, member.memberId],
    });
  });

  it("records who finished a task created as done", async () => {
    const { weddingId, owner } = await setupWedding();
    const result = await create(weddingId, owner, { title: "Already done", status: "done" });
    expect(result.json.data.status).toBe("done");
    expect(new Date(result.json.data.completedAt).getTime()).not.toBeNaN();
  });

  it.each([
    ["no title", { title: "  " }],
    ["a title over 200 characters", { title: "x".repeat(201) }],
    ["an unknown field", { title: "x", weddingId: "a".repeat(24) }],
    ["a client-set completedAt", { title: "x", completedAt: "2027-01-01T00:00:00Z" }],
    ["an unknown status", { title: "x", status: "blocked" }],
    ["an unknown priority", { title: "x", priority: "urgent" }],
    ["a date-time instead of a calendar day", { title: "x", dueDate: "2027-02-10T10:00:00Z" }],
    ["an impossible date", { title: "x", dueDate: "2027-02-30" }],
    [
      "the same assignee twice",
      { title: "x", assigneeMemberIds: ["a".repeat(24), "a".repeat(24)] },
    ],
    [
      "more than 10 assignees",
      {
        title: "x",
        assigneeMemberIds: Array.from({ length: 11 }, (_, i) => i.toString(16).padStart(24, "0")),
      },
    ],
  ])("rejects %s with 400", async (_label, body) => {
    const { weddingId, owner } = await setupWedding();
    const result = await create(weddingId, owner, body);
    expect(result.status).toBe(400);
    expect(result.json.error.code).toBe("VALIDATION_ERROR");
  });

  it("refuses an event from another wedding with 404 and creates nothing", async () => {
    const a = await setupWedding();
    const b = await setupWedding("Another wedding");
    const foreignEvent = await makeEvent(a.weddingId, a.owner);
    const result = await create(b.weddingId, b.owner, { title: "x", eventId: foreignEvent });
    expect(result.status).toBe(404);
    expect((await list(b.weddingId, b.owner)).json.data).toHaveLength(0);
  });

  it("refuses an assignee from another wedding, and a member who was removed", async () => {
    const a = await setupWedding();
    const b = await setupWedding("Another wedding");
    const gone = await addMember(b.weddingId, "member");
    await call(removeMember, {
      method: "DELETE",
      cookie: b.owner.cookie,
      params: { weddingId: b.weddingId, memberId: gone.memberId },
    });

    expect(
      (await create(b.weddingId, b.owner, { title: "x", assigneeMemberIds: [a.owner.memberId] }))
        .status,
    ).toBe(404);
    expect(
      (await create(b.weddingId, b.owner, { title: "x", assigneeMemberIds: [gone.memberId] }))
        .status,
    ).toBe(404);
  });

  it("denies outsiders and signed-out callers", async () => {
    const a = await setupWedding();
    const b = await setupWedding("Another wedding");
    const outsider = await create(a.weddingId, b.owner, { title: "x" });
    expect(outsider.status).toBe(403);
    expect(outsider.json.error.code).toBe("NOT_A_MEMBER");
    const signedOut = await call(createTask, {
      params: { weddingId: a.weddingId },
      body: { title: "x" },
    });
    expect(signedOut.status).toBe(401);
  });
});

describe("GET /weddings/:weddingId/tasks", () => {
  it("filters by status, priority, event, assignee and due date", async () => {
    const { weddingId, owner } = await setupWedding();
    const member = await addMember(weddingId, "member");
    const eventId = await makeEvent(weddingId, owner);
    await makeTask(weddingId, owner, { title: "A", priority: "high", dueDate: "2027-02-05" });
    await makeTask(weddingId, owner, {
      title: "B",
      status: "in_progress",
      eventId,
      assigneeMemberIds: [member.memberId],
      dueDate: "2027-02-20",
    });
    await makeTask(weddingId, owner, { title: "C", status: "done" });

    const titles = async (query: string) =>
      (await list(weddingId, owner, query)).json.data.map((t: { title: string }) => t.title).sort();

    expect(await titles("")).toEqual(["A", "B", "C"]);
    expect(await titles("?status=in_progress")).toEqual(["B"]);
    expect(await titles("?priority=high")).toEqual(["A"]);
    expect(await titles(`?eventId=${eventId}`)).toEqual(["B"]);
    expect(await titles(`?assigneeMemberId=${member.memberId}`)).toEqual(["B"]);
    expect(await titles("?dueBefore=2027-02-10")).toEqual(["A"]);
  });

  it("rejects unknown filters", async () => {
    const { weddingId, owner } = await setupWedding();
    expect((await list(weddingId, owner, "?title=x")).status).toBe(400);
  });

  it("pages newest first with an opaque cursor", async () => {
    const { weddingId, owner } = await setupWedding();
    for (const title of ["one", "two", "three", "four", "five"]) {
      await makeTask(weddingId, owner, { title });
    }
    const first = await list(weddingId, owner, "?limit=2");
    expect(first.json.data.map((t: { title: string }) => t.title)).toEqual(["five", "four"]);
    expect(first.json.meta.hasMore).toBe(true);
    const second = await list(weddingId, owner, `?limit=2&cursor=${first.json.meta.nextCursor}`);
    expect(second.json.data.map((t: { title: string }) => t.title)).toEqual(["three", "two"]);
    const third = await list(weddingId, owner, `?limit=2&cursor=${second.json.meta.nextCursor}`);
    expect(third.json.data.map((t: { title: string }) => t.title)).toEqual(["one"]);
    expect(third.json.meta).toEqual({ nextCursor: null, hasMore: false });
  });

  it("tells each viewer which tasks they may delete", async () => {
    const { weddingId, owner } = await setupWedding();
    const member = await addMember(weddingId, "member");
    await makeTask(weddingId, owner, { title: "Owner's" });
    await makeTask(weddingId, member, { title: "Member's" });
    const asMember = (await list(weddingId, member)).json.data;
    expect(
      asMember.map((t: { title: string; canDelete: boolean }) => [t.title, t.canDelete]),
    ).toEqual([
      ["Member's", true],
      ["Owner's", false],
    ]);
  });

  it("never shows another wedding's tasks", async () => {
    const a = await setupWedding();
    const b = await setupWedding("Another wedding");
    await makeTask(a.weddingId, a.owner);
    expect((await list(b.weddingId, b.owner)).json.data).toEqual([]);
  });

  it("exposes only the intended fields", async () => {
    const { weddingId, owner } = await setupWedding();
    await makeTask(weddingId, owner);
    const [row] = (await list(weddingId, owner)).json.data;
    expect(Object.keys(row).sort()).toEqual(
      [
        "assigneeMemberIds",
        "canDelete",
        "completedAt",
        "createdAt",
        "createdBy",
        "description",
        "dueDate",
        "eventId",
        "id",
        "priority",
        "status",
        "title",
        "updatedAt",
        "version",
      ].sort(),
    );
  });
});

describe("PATCH /weddings/:weddingId/tasks/:taskId", () => {
  it("lets any member edit any task, bumping the version", async () => {
    const { weddingId, owner } = await setupWedding();
    const member = await addMember(weddingId, "member");
    const task = await makeTask(weddingId, owner, { assigneeMemberIds: [member.memberId] });

    const result = await patch(weddingId, task.id, member, {
      version: 0,
      status: "in_progress",
      priority: "high",
    });
    expect(result.status).toBe(200);
    expect(result.json.data).toMatchObject({ status: "in_progress", priority: "high", version: 1 });
  });

  it("sets completedAt when a task becomes done and clears it when it is reopened", async () => {
    const { weddingId, owner } = await setupWedding();
    const task = await makeTask(weddingId, owner);

    const done = await patch(weddingId, task.id, owner, { version: 0, status: "done" });
    expect(done.json.data.status).toBe("done");
    expect(new Date(done.json.data.completedAt).getTime()).not.toBeNaN();

    const reopened = await patch(weddingId, task.id, owner, { version: 1, status: "todo" });
    expect(reopened.json.data.completedAt).toBeNull();
  });

  it("does not move completedAt when the status stays done", async () => {
    const { weddingId, owner } = await setupWedding();
    const task = await makeTask(weddingId, owner, { status: "done" });
    const result = await patch(weddingId, task.id, owner, { version: 0, title: "Renamed" });
    expect(result.json.data.completedAt).toBe(task.completedAt);
  });

  it("clears optional fields with null and replaces the assignees", async () => {
    const { weddingId, owner } = await setupWedding();
    const member = await addMember(weddingId, "member");
    const eventId = await makeEvent(weddingId, owner);
    const task = await makeTask(weddingId, owner, {
      description: "x",
      eventId,
      dueDate: "2027-02-10",
      assigneeMemberIds: [owner.memberId],
    });
    const result = await patch(weddingId, task.id, owner, {
      version: 0,
      description: null,
      eventId: null,
      dueDate: null,
      assigneeMemberIds: [member.memberId],
    });
    expect(result.json.data).toMatchObject({
      description: null,
      eventId: null,
      dueDate: null,
      assigneeMemberIds: [member.memberId],
    });
  });

  it("rejects a stale write with 409 VERSION_CONFLICT", async () => {
    const { weddingId, owner } = await setupWedding();
    const planner = await addMember(weddingId, "admin");
    const task = await makeTask(weddingId, owner);
    expect((await patch(weddingId, task.id, owner, { version: 0, title: "First" })).status).toBe(
      200,
    );
    const stale = await patch(weddingId, task.id, planner, { version: 0, title: "Second" });
    expect(stale.status).toBe(409);
    expect(stale.json.error.code).toBe("VERSION_CONFLICT");
  });

  it.each([
    ["nothing to change", { version: 0 }],
    ["no version", { title: "x" }],
    ["a client-set completedAt", { version: 0, completedAt: "2027-01-01T00:00:00Z" }],
    ["a client-set createdBy", { version: 0, createdBy: "a".repeat(24) }],
  ])("rejects %s with 400", async (_label, body) => {
    const { weddingId, owner } = await setupWedding();
    const task = await makeTask(weddingId, owner);
    expect((await patch(weddingId, task.id, owner, body)).status).toBe(400);
  });

  it("answers 404 for another wedding's task and for a foreign event or assignee", async () => {
    const a = await setupWedding();
    const b = await setupWedding("Another wedding");
    const task = await makeTask(a.weddingId, a.owner);
    const mine = await makeTask(b.weddingId, b.owner);

    expect((await patch(b.weddingId, task.id, b.owner, { version: 0, title: "x" })).status).toBe(
      404,
    );
    const foreignEvent = await makeEvent(a.weddingId, a.owner);
    expect(
      (await patch(b.weddingId, mine.id, b.owner, { version: 0, eventId: foreignEvent })).status,
    ).toBe(404);
    expect(
      (
        await patch(b.weddingId, mine.id, b.owner, {
          version: 0,
          assigneeMemberIds: [a.owner.memberId],
        })
      ).status,
    ).toBe(404);
    // Untouched.
    expect((await list(a.weddingId, a.owner)).json.data[0].title).toBe("Book the mandap decorator");
  });
});

describe("DELETE /weddings/:weddingId/tasks/:taskId (owner decision 2026-10-10)", () => {
  it("lets a member delete their own task but not someone else's", async () => {
    const { weddingId, owner } = await setupWedding();
    const member = await addMember(weddingId, "member");
    const ownTask = await makeTask(weddingId, member, { title: "Mine" });
    const ownersTask = await makeTask(weddingId, owner, { title: "Owner's" });

    const refused = await remove(weddingId, ownersTask.id, member);
    expect(refused.status).toBe(403);
    expect(refused.json.error.code).toBe("INSUFFICIENT_ROLE");
    expect((await list(weddingId, owner)).json.data).toHaveLength(2);

    expect((await remove(weddingId, ownTask.id, member)).status).toBe(200);
    expect((await list(weddingId, owner)).json.data.map((t: { title: string }) => t.title)).toEqual(
      ["Owner's"],
    );
  });

  it("lets an admin and the owner delete any task", async () => {
    const { weddingId, owner } = await setupWedding();
    const admin = await addMember(weddingId, "admin");
    const member = await addMember(weddingId, "member");
    const first = await makeTask(weddingId, member);
    const second = await makeTask(weddingId, member);
    expect((await remove(weddingId, first.id, admin)).status).toBe(200);
    expect((await remove(weddingId, second.id, owner)).status).toBe(200);
  });

  it("soft deletes: gone from reads and edits, and a second delete is a 404", async () => {
    const { weddingId, owner } = await setupWedding();
    const task = await makeTask(weddingId, owner);
    const result = await remove(weddingId, task.id, owner);
    expect(result.json.data.id).toBe(task.id);
    expect((await list(weddingId, owner)).json.data).toEqual([]);
    expect((await patch(weddingId, task.id, owner, { version: 0, title: "x" })).status).toBe(404);
    expect((await remove(weddingId, task.id, owner)).status).toBe(404);
  });

  it("answers 404 for another wedding's task", async () => {
    const a = await setupWedding();
    const b = await setupWedding("Another wedding");
    const task = await makeTask(a.weddingId, a.owner);
    expect((await remove(b.weddingId, task.id, b.owner)).status).toBe(404);
    expect((await list(a.weddingId, a.owner)).json.data).toHaveLength(1);
  });
});

describe("what happens to tasks when something else goes away", () => {
  it("deleting an event keeps its tasks as wedding-level tasks and says how many", async () => {
    const { weddingId, owner } = await setupWedding();
    const eventId = await makeEvent(weddingId, owner);
    const other = await makeEvent(weddingId, owner, "Sangeet");
    await makeTask(weddingId, owner, { title: "On Haldi 1", eventId });
    await makeTask(weddingId, owner, { title: "On Haldi 2", eventId });
    await makeTask(weddingId, owner, { title: "On Sangeet", eventId: other });

    const result = await call(deleteEvent, {
      method: "DELETE",
      cookie: owner.cookie,
      params: { weddingId, eventId },
    });
    expect(result.status).toBe(200);
    expect(result.json.data.tasksUnlinked).toBe(2);

    const tasks = (await list(weddingId, owner)).json.data;
    const byTitle = Object.fromEntries(
      tasks.map((t: { title: string; eventId: string | null }) => [t.title, t.eventId]),
    );
    expect(byTitle).toEqual({ "On Haldi 1": null, "On Haldi 2": null, "On Sangeet": other });
  });

  it("removing a member takes them off every task, and leaves other assignees alone", async () => {
    const { weddingId, owner } = await setupWedding();
    const leaver = await addMember(weddingId, "member");
    await makeTask(weddingId, owner, {
      title: "Shared",
      assigneeMemberIds: [owner.memberId, leaver.memberId],
    });
    await makeTask(weddingId, owner, {
      title: "Only leaver",
      assigneeMemberIds: [leaver.memberId],
    });
    await makeTask(weddingId, owner, { title: "Only owner", assigneeMemberIds: [owner.memberId] });

    const result = await call(removeMember, {
      method: "DELETE",
      cookie: owner.cookie,
      params: { weddingId, memberId: leaver.memberId },
    });
    expect(result.status).toBe(200);
    expect(result.json.data.tasksUnassigned).toBe(2);

    const tasks = (await list(weddingId, owner)).json.data;
    const byTitle = Object.fromEntries(
      tasks.map((t: { title: string; assigneeMemberIds: string[] }) => [
        t.title,
        t.assigneeMemberIds,
      ]),
    );
    expect(byTitle).toEqual({
      Shared: [owner.memberId],
      "Only leaver": [],
      "Only owner": [owner.memberId],
    });
  });

  it("leaving the wedding yourself does the same", async () => {
    const { weddingId, owner } = await setupWedding();
    const member = await addMember(weddingId, "member");
    await makeTask(weddingId, owner, { assigneeMemberIds: [member.memberId] });
    const result = await call(removeMember, {
      method: "DELETE",
      cookie: member.cookie,
      params: { weddingId, memberId: member.memberId },
    });
    expect(result.status).toBe(200);
    expect((await list(weddingId, owner)).json.data[0].assigneeMemberIds).toEqual([]);
  });
});
