import { Types } from "mongoose";
import { beforeAll, describe, expect, it } from "vitest";
import { Event } from "@/models/event.model";
import { Task } from "@/models/task.model";
import { setupTestDatabase } from "../../setup/database";

// DB Design §8.1 rule 5: check indexes with explain() on realistic data. These are the queries the
// events and tasks repositories run most; each must (1) use an index, never a collection scan,
// and (2) look only at ONE wedding's documents, so a busy wedding can't slow down another.
// The queries mirror the repositories (including the soft-delete filter their plugin adds).

setupTestDatabase();

const PER_WEDDING = 300;
const weddingA = new Types.ObjectId();
const weddingB = new Types.ObjectId();
const eventA = new Types.ObjectId();
const memberA = new Types.ObjectId();
const user = new Types.ObjectId();

beforeAll(async () => {
  await Task.init();
  await Event.init();
  const statuses = ["todo", "in_progress", "done"] as const;
  const tasks = [weddingA, weddingB].flatMap((weddingId) =>
    Array.from({ length: PER_WEDDING }, (_, i) => ({
      weddingId,
      title: `Task ${i}`,
      status: statuses[i % 3],
      priority: (["low", "medium", "high"] as const)[i % 3],
      dueDate: i % 5 === 0 ? null : `2027-0${1 + (i % 3)}-${String(1 + (i % 27)).padStart(2, "0")}`,
      eventId: i % 4 === 0 ? eventA : null,
      assigneeMemberIds: i % 6 === 0 ? [memberA] : [],
      createdBy: user,
    })),
  );
  await Task.insertMany(tasks);
  await Event.insertMany(
    [weddingA, weddingB].flatMap((weddingId) =>
      Array.from({ length: 40 }, (_, i) => ({
        weddingId,
        name: `Event ${i}`,
        type: "other",
        startsAt: new Date(Date.UTC(2027, 1, 1 + i)),
        endsAt: i % 2 === 0 ? new Date(Date.UTC(2027, 1, 1 + i, 5)) : null,
        timezone: "Asia/Kolkata",
        createdBy: user,
      })),
    ),
  );
});

interface Plan {
  stages: string[];
  docsExamined: number;
  keysExamined: number;
}

function stagesOf(node: Record<string, unknown> | undefined): string[] {
  if (!node) return [];
  const children = [node.inputStage, ...((node.inputStages as unknown[]) ?? [])].filter(
    Boolean,
  ) as Record<string, unknown>[];
  return [node.stage as string, ...children.flatMap(stagesOf)];
}

async function plan(query: { explain(verbosity: string): Promise<unknown> }): Promise<Plan> {
  const explained = (await query.explain("executionStats")) as {
    queryPlanner: { winningPlan: Record<string, unknown> };
    executionStats: { totalDocsExamined: number; totalKeysExamined: number };
  };
  return {
    stages: stagesOf(explained.queryPlanner.winningPlan),
    docsExamined: explained.executionStats.totalDocsExamined,
    keysExamined: explained.executionStats.totalKeysExamined,
  };
}

function expectIndexed(result: Plan) {
  expect(result.stages, `plan: ${result.stages.join(" > ")}`).toContain("IXSCAN");
  expect(result.stages).not.toContain("COLLSCAN");
  // Never reads the other wedding's documents.
  expect(result.docsExamined).toBeLessThanOrEqual(PER_WEDDING);
}

describe("tasks queries use an index and stay inside one wedding", () => {
  const cases: [string, () => { explain(verbosity: string): Promise<unknown> }][] = [
    [
      "list newest first (the API page)",
      () => Task.find({ weddingId: weddingA }).sort({ _id: -1 }).limit(21),
    ],
    [
      "every task of the wedding (the Tasks screen)",
      () => Task.find({ weddingId: weddingA }).sort({ _id: 1 }).limit(1000),
    ],
    [
      "filter by status",
      () => Task.find({ weddingId: weddingA, status: "in_progress" }).sort({ _id: -1 }).limit(21),
    ],
    [
      "filter by event",
      () => Task.find({ weddingId: weddingA, eventId: eventA }).sort({ _id: -1 }).limit(21),
    ],
    [
      "tasks of one event (the event page)",
      () => Task.find({ weddingId: weddingA, eventId: eventA }).sort({ _id: 1 }),
    ],
    [
      "filter by assignee (My tasks)",
      () =>
        Task.find({ weddingId: weddingA, assigneeMemberIds: memberA }).sort({ _id: -1 }).limit(21),
    ],
    [
      "due before a day",
      () =>
        Task.find({ weddingId: weddingA, dueDate: { $lt: "2027-02-10" } })
          .sort({ _id: -1 })
          .limit(21),
    ],
    [
      "not done (the sidebar count)",
      () => Task.find({ weddingId: weddingA, status: { $ne: "done" } }),
    ],
    [
      "next open dated tasks (the dashboard)",
      () =>
        Task.find({ weddingId: weddingA, status: { $ne: "done" }, dueDate: { $type: "string" } })
          .sort({ dueDate: 1, _id: 1 })
          .limit(4),
    ],
  ];

  it.each(cases)("%s", async (_label, build) => {
    expectIndexed(await plan(build()));
  });
});

describe("events queries use an index and stay inside one wedding", () => {
  it("the timeline (soonest first)", async () => {
    expectIndexed(
      await plan(Event.find({ weddingId: weddingA }).sort({ startsAt: 1, sortOrder: 1, _id: 1 })),
    );
  });

  it("the next event that has not finished (dashboard)", async () => {
    const now = new Date(Date.UTC(2027, 1, 10));
    expectIndexed(
      await plan(
        Event.findOne({
          weddingId: weddingA,
          $or: [{ startsAt: { $gte: now } }, { endsAt: { $gte: now } }],
        }).sort({ startsAt: 1, sortOrder: 1, _id: 1 }),
      ),
    );
  });

  it("one event by id within its wedding", async () => {
    const any = await Event.findOne({ weddingId: weddingA }).lean();
    const result = await plan(Event.findOne({ _id: any!._id, weddingId: weddingA }));
    expect(result.stages).not.toContain("COLLSCAN");
    expect(result.docsExamined).toBeLessThanOrEqual(1);
  });
});
