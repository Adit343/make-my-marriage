import { Types } from "mongoose";
import { beforeAll, describe, expect, it } from "vitest";
import { EmailLog } from "@/models/emailLog.model";
import { Event } from "@/models/event.model";
import { Guest } from "@/models/guest.model";
import { GuestGroup } from "@/models/guestGroup.model";
import { Rsvp } from "@/models/rsvp.model";
import { Task } from "@/models/task.model";
import { setupTestDatabase } from "../../setup/database";

// DB Design §8.1 rule 5: check indexes with explain() on realistic data. These are the queries the
// events, tasks and guests repositories run most; each must (1) use an index, never a collection scan,
// and (2) look only at ONE wedding's documents, so a busy wedding can't slow down another.
// The queries mirror the repositories (including the soft-delete filter their plugin adds).

setupTestDatabase();

const PER_WEDDING = 300;
const weddingA = new Types.ObjectId();
const weddingB = new Types.ObjectId();
const eventA = new Types.ObjectId();
const memberA = new Types.ObjectId();
const user = new Types.ObjectId();
const groupA = new Types.ObjectId();
const eventsA = Array.from({ length: 3 }, () => new Types.ObjectId());

beforeAll(async () => {
  await Task.init();
  await Event.init();
  await Guest.init();
  await GuestGroup.init();
  await Rsvp.init();
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

// Guests and their replies: 300 guests per wedding, each invited to three events.
beforeAll(async () => {
  const guests = [weddingA, weddingB].flatMap((weddingId) =>
    Array.from({ length: PER_WEDDING }, (_, i) => ({
      _id: new Types.ObjectId(),
      weddingId,
      name: `Guest ${String(i).padStart(3, "0")}`,
      nameNormalized: `guest ${String(i).padStart(3, "0")}`,
      side: (["partnerOne", "partnerTwo", "both"] as const)[i % 3],
      groupId: i % 4 === 0 ? groupA : null,
      phone: i % 2 ? `+9198765${String(i).padStart(5, "0")}` : null,
      invitation: { status: i % 5 === 0 ? "invited" : "not_invited", sendCount: 0 },
      dietaryPreference: i % 7 === 0 ? "jain" : "no_preference",
      createdBy: user,
      deletedAt: null,
    })),
  );
  await Guest.collection.insertMany(guests);
  await Rsvp.collection.insertMany(
    guests.flatMap((guest, g) =>
      eventsA.map((eventId, e) => ({
        weddingId: guest.weddingId,
        guestId: guest._id,
        eventId,
        status: (["pending", "attending", "declined", "maybe"] as const)[(g + e) % 4],
        attendingCount: 0,
        deletedAt: null,
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

describe("guests queries use an index and stay inside one wedding", () => {
  const cases: [string, () => { explain(verbosity: string): Promise<unknown> }][] = [
    [
      "the guest list A to Z (first page)",
      () => Guest.find({ weddingId: weddingA }).sort({ nameNormalized: 1, _id: 1 }).limit(26),
    ],
    [
      "the next page after a cursor",
      () =>
        Guest.find({
          $and: [
            { weddingId: weddingA },
            {
              $or: [
                { nameNormalized: { $gt: "guest 100" } },
                { nameNormalized: "guest 100", _id: { $gt: new Types.ObjectId() } },
              ],
            },
          ],
        })
          .sort({ nameNormalized: 1, _id: 1 })
          .limit(26),
    ],
    [
      "search by the start of a name",
      () =>
        Guest.find({ weddingId: weddingA, nameNormalized: { $regex: "^guest 1" } })
          .sort({ nameNormalized: 1, _id: 1 })
          .limit(26),
    ],
    [
      "search while paging",
      () =>
        Guest.find({
          $and: [
            { weddingId: weddingA, nameNormalized: { $regex: "^guest 1" } },
            { $or: [{ nameNormalized: { $gt: "guest 150" } }] },
          ],
        })
          .sort({ nameNormalized: 1, _id: 1 })
          .limit(26),
    ],
    [
      "filter by group",
      () =>
        Guest.find({ weddingId: weddingA, groupId: groupA })
          .sort({ nameNormalized: 1, _id: 1 })
          .limit(26),
    ],
    [
      "ungrouped guests",
      () =>
        Guest.find({ weddingId: weddingA, groupId: null })
          .sort({ nameNormalized: 1, _id: 1 })
          .limit(26),
    ],
    [
      "filter by side and invitation status",
      () =>
        Guest.find({ weddingId: weddingA, side: "both", "invitation.status": "invited" })
          .sort({ nameNormalized: 1, _id: 1 })
          .limit(26),
    ],
    ["count of the wedding's guests", () => Guest.find({ weddingId: weddingA })],
    ["duplicate phone check", () => Guest.find({ weddingId: weddingA, phone: "+919876500001" })],
  ];

  it.each(cases)("%s", async (_label, build) => {
    expectIndexed(await plan(build()));
  });
});

describe("rsvp queries use an index and stay inside one wedding", () => {
  type Explainable = { explain(verbosity: string): Promise<unknown> };
  let pageOfGuests: Types.ObjectId[] = [];
  let oneGuest: Types.ObjectId;
  beforeAll(async () => {
    const some = await Guest.find({ weddingId: weddingA }).limit(25).lean();
    pageOfGuests = some.map((guest) => guest._id);
    oneGuest = some[0]!._id;
  });

  const cases: [string, () => Explainable][] = [
    [
      "replies of a page of guests",
      () => Rsvp.find({ weddingId: weddingA, guestId: { $in: pageOfGuests } }),
    ],
    [
      "who has not replied to one event",
      () => Rsvp.find({ weddingId: weddingA, eventId: eventsA[0], status: "pending" }),
    ],
    [
      "guests with a pending reply (any event)",
      () => Rsvp.find({ weddingId: weddingA, status: "pending" }),
    ],
    [
      "replies of one guest for one event",
      () => Rsvp.findOne({ weddingId: weddingA, guestId: oneGuest, eventId: eventsA[1] }),
    ],
  ];

  it.each(cases)("%s", async (_label, build) => {
    const result = await plan(build());
    expect(result.stages, `plan: ${result.stages.join(" > ")}`).toContain("IXSCAN");
    expect(result.stages).not.toContain("COLLSCAN");
    // A wedding has 300 guests x 3 events = 900 replies; never reads the other wedding's.
    expect(result.docsExamined).toBeLessThanOrEqual(PER_WEDDING * eventsA.length);
  });
});

describe("invitation queries use an index and stay inside one wedding", () => {
  type Explainable = { explain(verbosity: string): Promise<unknown> };
  let linkedGuest: Types.ObjectId;

  beforeAll(async () => {
    await EmailLog.init();
    const [first] = await Guest.find({ weddingId: weddingA }).limit(1).lean();
    linkedGuest = first!._id;
    await Guest.collection.updateOne(
      { _id: linkedGuest },
      { $set: { "link.tokenHash": "a".repeat(64), "link.revokedAt": null } },
    );
    await EmailLog.collection.insertMany(
      [weddingA, weddingB].flatMap((weddingId) =>
        Array.from({ length: PER_WEDDING }, (_, i) => ({
          weddingId,
          type: i % 5 === 0 ? "rsvp_reminder" : "guest_invitation",
          guestId: new Types.ObjectId(),
          recipientEmail: `g${i}@example.com`,
          status: i % 7 === 0 ? "failed" : "sent",
          provider: "test",
          batchId: `batch-${i % 10}`,
          idempotencyKey: `k-${weddingId}-${i}`,
          attempts: 1,
          createdAt: new Date(Date.UTC(2027, 0, 1, 0, i)),
          updatedAt: new Date(),
        })),
      ),
    );
  });

  const cases: [string, () => Explainable, number][] = [
    [
      "opening a guest's personal link (by token)",
      () => Guest.findOne({ "link.tokenHash": "a".repeat(64) }),
      1,
    ],
    [
      "the tracker's list for one event",
      () => Rsvp.find({ weddingId: weddingA, eventId: eventsA[0] }),
      PER_WEDDING,
    ],
    [
      "the delivery log, newest first",
      () =>
        EmailLog.find({ weddingId: weddingA, type: { $in: ["guest_invitation", "rsvp_reminder"] } })
          .sort({ createdAt: -1, _id: -1 })
          .limit(21),
      PER_WEDDING,
    ],
    [
      "the delivery log, failures only",
      () =>
        EmailLog.find({
          weddingId: weddingA,
          type: { $in: ["guest_invitation", "rsvp_reminder"] },
          status: "failed",
        })
          .sort({ createdAt: -1, _id: -1 })
          .limit(21),
      PER_WEDDING,
    ],
    [
      "guests nobody can reach",
      () =>
        Guest.find({
          weddingId: weddingA,
          $and: [
            { $or: [{ email: null }, { email: { $exists: false } }] },
            { $or: [{ phone: null }, { phone: { $exists: false } }] },
          ],
        })
          .sort({ nameNormalized: 1, _id: 1 })
          .limit(3),
      PER_WEDDING,
    ],
  ];

  it.each(cases)("%s", async (_label, build, maxDocs) => {
    const result = await plan(build());
    expect(result.stages, `plan: ${result.stages.join(" > ")}`).toContain("IXSCAN");
    expect(result.stages).not.toContain("COLLSCAN");
    // Never reads the other wedding's documents.
    expect(result.docsExamined).toBeLessThanOrEqual(maxDocs);
  });
});
