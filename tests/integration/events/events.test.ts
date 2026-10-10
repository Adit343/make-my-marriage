import { describe, expect, it } from "vitest";
import {
  GET as listEvents,
  POST as createEvent,
} from "@/app/api/v1/weddings/[weddingId]/events/route";
import {
  DELETE as deleteEvent,
  GET as getEvent,
  PATCH as patchEvent,
} from "@/app/api/v1/weddings/[weddingId]/events/[eventId]/route";
import { PATCH as patchWedding } from "@/app/api/v1/weddings/[weddingId]/route";
import { setupTestDatabase } from "../../setup/database";
import { call } from "../../setup/http";
import { addMember, setupWedding, type TestMember } from "../../setup/wedding";

setupTestDatabase();

const haldi = {
  name: "Haldi",
  type: "haldi",
  startsAt: "2027-02-13T04:30:00Z",
  endsAt: "2027-02-13T07:30:00Z",
};

async function create(weddingId: string, who: TestMember, body: Record<string, unknown> = haldi) {
  return call(createEvent, { cookie: who.cookie, params: { weddingId }, body });
}

async function patch(
  weddingId: string,
  eventId: string,
  who: TestMember,
  body: Record<string, unknown>,
) {
  return call(patchEvent, {
    method: "PATCH",
    cookie: who.cookie,
    params: { weddingId, eventId },
    body,
  });
}

async function remove(weddingId: string, eventId: string, who: TestMember) {
  return call(deleteEvent, {
    method: "DELETE",
    cookie: who.cookie,
    params: { weddingId, eventId },
  });
}

async function list(weddingId: string, who: TestMember) {
  return call(listEvents, { method: "GET", cookie: who.cookie, params: { weddingId } });
}

describe("POST /weddings/:weddingId/events", () => {
  it("creates an event with defaults, taking the timezone from the wedding", async () => {
    const { weddingId, owner } = await setupWedding();
    await call(patchWedding, {
      method: "PATCH",
      cookie: owner.cookie,
      params: { weddingId },
      body: { version: 0, timezone: "Asia/Dubai" },
    });

    const result = await create(weddingId, owner);
    expect(result.status).toBe(201);
    expect(result.json.data).toMatchObject({
      name: "Haldi",
      type: "haldi",
      startsAt: "2027-02-13T04:30:00.000Z",
      endsAt: "2027-02-13T07:30:00.000Z",
      timezone: "Asia/Dubai",
      isPublic: false,
      sortOrder: 0,
      schedule: [],
      description: null,
      createdBy: owner.user.id,
      canManage: true,
      version: 0,
    });
  });

  it("accepts a start time with a UTC offset and stores it as the same instant", async () => {
    const { weddingId, owner } = await setupWedding();
    const result = await create(weddingId, owner, {
      ...haldi,
      startsAt: "2027-02-13T10:00:00+05:30",
      endsAt: undefined,
    });
    expect(result.status).toBe(201);
    expect(result.json.data.startsAt).toBe("2027-02-13T04:30:00.000Z");
    expect(result.json.data.endsAt).toBeNull();
  });

  it("lets every role create events", async () => {
    const { weddingId, owner } = await setupWedding();
    const admin = await addMember(weddingId, "admin");
    const member = await addMember(weddingId, "member");
    for (const who of [owner, admin, member]) {
      expect((await create(weddingId, who)).status).toBe(201);
    }
  });

  it("sorts the schedule by time and gives each line a stable id", async () => {
    const { weddingId, owner } = await setupWedding();
    const result = await create(weddingId, owner, {
      ...haldi,
      schedule: [
        { time: "11:00", title: "Family photos" },
        { time: "07:00", title: "Makeup", notes: "Bring the kit", isPublic: true },
        { time: "09:00", title: "Haldi" },
      ],
    });
    expect(result.status).toBe(201);
    const items = result.json.data.schedule;
    expect(items.map((item: { title: string }) => item.title)).toEqual([
      "Makeup",
      "Haldi",
      "Family photos",
    ]);
    expect(items[0]).toMatchObject({ time: "07:00", notes: "Bring the kit", isPublic: true });
    expect(items[1]).toMatchObject({ notes: null, isPublic: false });
    expect(items[0].id).toMatch(/^[a-f0-9]{24}$/);
  });

  it.each([
    ["an end before the start", { endsAt: "2027-02-13T03:00:00Z" }],
    ["a start without a timezone offset", { startsAt: "2027-02-13T10:00:00" }],
    ["a date instead of an instant", { startsAt: "2027-02-13" }],
    ["an unknown type", { type: "birthday" }],
    ["an unknown field", { weddingId: "abc" }],
    ["an unknown timezone", { timezone: "Mars/Olympus" }],
    ["an empty name", { name: "  " }],
    ["a 12-hour schedule time", { schedule: [{ time: "7:00 AM", title: "Makeup" }] }],
    [
      "repeated schedule ids",
      {
        schedule: [
          { id: "a".repeat(24), time: "07:00", title: "One" },
          { id: "a".repeat(24), time: "08:00", title: "Two" },
        ],
      },
    ],
    [
      "more than 50 schedule lines",
      { schedule: Array.from({ length: 51 }, (_, i) => ({ time: "10:00", title: `L${i}` })) },
    ],
  ])("rejects %s with 400", async (_label, override) => {
    const { weddingId, owner } = await setupWedding();
    const result = await create(weddingId, owner, { ...haldi, ...override });
    expect(result.status).toBe(400);
    expect(result.json.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("GET /weddings/:weddingId/events", () => {
  it("lists the timeline soonest first, with each viewer's own canManage flag", async () => {
    const { weddingId, owner } = await setupWedding();
    const member = await addMember(weddingId, "member");
    await create(weddingId, owner, {
      ...haldi,
      name: "Reception",
      startsAt: "2027-02-14T13:00:00Z",
      endsAt: undefined,
      type: "reception",
    });
    await create(weddingId, member, {
      ...haldi,
      name: "Mehendi",
      startsAt: "2027-02-12T09:00:00Z",
      endsAt: undefined,
      type: "mehendi",
    });
    await create(weddingId, owner);

    const asMember = await list(weddingId, member);
    expect(asMember.status).toBe(200);
    expect(asMember.json.data.map((e: { name: string }) => e.name)).toEqual([
      "Mehendi",
      "Haldi",
      "Reception",
    ]);
    // The member created Mehendi only.
    expect(asMember.json.data.map((e: { canManage: boolean }) => e.canManage)).toEqual([
      true,
      false,
      false,
    ]);
    const asOwner = await list(weddingId, owner);
    expect(asOwner.json.data.every((e: { canManage: boolean }) => e.canManage)).toBe(true);
  });

  it("breaks ties between same-time events by sortOrder", async () => {
    const { weddingId, owner } = await setupWedding();
    await create(weddingId, owner, { ...haldi, name: "Second", sortOrder: 2 });
    await create(weddingId, owner, { ...haldi, name: "First", sortOrder: 1 });
    const result = await list(weddingId, owner);
    expect(result.json.data.map((e: { name: string }) => e.name)).toEqual(["First", "Second"]);
  });

  it("exposes only the intended fields", async () => {
    const { weddingId, owner } = await setupWedding();
    await create(weddingId, owner);
    const [row] = (await list(weddingId, owner)).json.data;
    expect(Object.keys(row).sort()).toEqual(
      [
        "canManage",
        "createdAt",
        "createdBy",
        "description",
        "dressCode",
        "endsAt",
        "id",
        "isPublic",
        "location",
        "name",
        "schedule",
        "sortOrder",
        "startsAt",
        "timezone",
        "type",
        "updatedAt",
        "version",
      ].sort(),
    );
  });
});

describe("who may edit and delete (owner decision 2026-10-10)", () => {
  it("lets a member change and delete their own event", async () => {
    const { weddingId } = await setupWedding();
    const member = await addMember(weddingId, "member");
    const { id } = (await create(weddingId, member)).json.data;

    const edited = await patch(weddingId, id, member, { version: 0, name: "Haldi (family)" });
    expect(edited.status).toBe(200);
    expect(edited.json.data.name).toBe("Haldi (family)");

    expect((await remove(weddingId, id, member)).status).toBe(200);
  });

  it("refuses a member editing or deleting someone else's event, and changes nothing", async () => {
    const { weddingId, owner } = await setupWedding();
    const member = await addMember(weddingId, "member");
    const { id } = (await create(weddingId, owner)).json.data;

    const edit = await patch(weddingId, id, member, { version: 0, name: "Hijacked" });
    expect(edit.status).toBe(403);
    expect(edit.json.error.code).toBe("INSUFFICIENT_ROLE");

    const del = await remove(weddingId, id, member);
    expect(del.status).toBe(403);
    expect(del.json.error.code).toBe("INSUFFICIENT_ROLE");

    const still = await call(getEvent, {
      method: "GET",
      cookie: owner.cookie,
      params: { weddingId, eventId: id },
    });
    expect(still.json.data).toMatchObject({ name: "Haldi", version: 0 });
  });

  it("lets an admin and the owner change or delete any event", async () => {
    const { weddingId, owner } = await setupWedding();
    const admin = await addMember(weddingId, "admin");
    const member = await addMember(weddingId, "member");

    const first = (await create(weddingId, member)).json.data.id;
    expect((await patch(weddingId, first, admin, { version: 0, name: "By admin" })).status).toBe(
      200,
    );
    expect((await remove(weddingId, first, admin)).status).toBe(200);

    const second = (await create(weddingId, member)).json.data.id;
    expect((await patch(weddingId, second, owner, { version: 0, name: "By owner" })).status).toBe(
      200,
    );
    expect((await remove(weddingId, second, owner)).status).toBe(200);
  });

  it("lets an owner edit an admin's event, and an admin edit the owner's", async () => {
    const { weddingId, owner } = await setupWedding();
    const admin = await addMember(weddingId, "admin");
    const byOwner = (await create(weddingId, owner)).json.data.id;
    const byAdmin = (await create(weddingId, admin)).json.data.id;
    expect((await patch(weddingId, byOwner, admin, { version: 0, name: "x" })).status).toBe(200);
    expect((await patch(weddingId, byAdmin, owner, { version: 0, name: "y" })).status).toBe(200);
  });
});

describe("wedding isolation", () => {
  it("denies people outside the wedding and signed-out callers", async () => {
    const a = await setupWedding();
    const b = await setupWedding("Another wedding");
    const { id } = (await create(a.weddingId, a.owner)).json.data;

    const outsider = await call(listEvents, {
      method: "GET",
      cookie: b.owner.cookie,
      params: { weddingId: a.weddingId },
    });
    expect(outsider.status).toBe(403);
    expect(outsider.json.error.code).toBe("NOT_A_MEMBER");

    expect((await create(a.weddingId, b.owner)).status).toBe(403);
    expect((await patch(a.weddingId, id, b.owner, { version: 0, name: "x" })).status).toBe(403);
    expect((await remove(a.weddingId, id, b.owner)).status).toBe(403);

    const signedOut = await call(listEvents, { method: "GET", params: { weddingId: a.weddingId } });
    expect(signedOut.status).toBe(401);
  });

  it("answers 404 when a member names another wedding's event under their own wedding", async () => {
    const a = await setupWedding();
    const b = await setupWedding("Another wedding");
    const { id } = (await create(a.weddingId, a.owner)).json.data;

    const read = await call(getEvent, {
      method: "GET",
      cookie: b.owner.cookie,
      params: { weddingId: b.weddingId, eventId: id },
    });
    expect(read.status).toBe(404);
    expect((await patch(b.weddingId, id, b.owner, { version: 0, name: "x" })).status).toBe(404);
    expect((await remove(b.weddingId, id, b.owner)).status).toBe(404);

    // Untouched in its own wedding.
    expect((await list(a.weddingId, a.owner)).json.data).toHaveLength(1);
  });
});

describe("PATCH /weddings/:weddingId/events/:eventId", () => {
  it("changes only the fields sent and bumps the version", async () => {
    const { weddingId, owner } = await setupWedding();
    const { id } = (await create(weddingId, owner, { ...haldi, dressCode: "Yellow" })).json.data;

    const result = await patch(weddingId, id, owner, {
      version: 0,
      description: "At the family home",
      location: { label: "Family Home", address: { city: "Surat" } },
    });
    expect(result.status).toBe(200);
    expect(result.json.data).toMatchObject({
      name: "Haldi",
      dressCode: "Yellow",
      description: "At the family home",
      location: { label: "Family Home", address: { city: "Surat", country: "IN" } },
      version: 1,
    });
  });

  it("clears optional fields with null", async () => {
    const { weddingId, owner } = await setupWedding();
    const { id } = (await create(weddingId, owner, { ...haldi, dressCode: "Yellow" })).json.data;
    const result = await patch(weddingId, id, owner, {
      version: 0,
      dressCode: null,
      endsAt: null,
    });
    expect(result.json.data).toMatchObject({ dressCode: null, endsAt: null });
  });

  it("rejects a stale write with 409 VERSION_CONFLICT", async () => {
    const { weddingId, owner } = await setupWedding();
    const planner = await addMember(weddingId, "admin");
    const { id } = (await create(weddingId, owner)).json.data;

    expect((await patch(weddingId, id, owner, { version: 0, name: "Parent's edit" })).status).toBe(
      200,
    );
    const stale = await patch(weddingId, id, planner, { version: 0, name: "Planner's edit" });
    expect(stale.status).toBe(409);
    expect(stale.json.error.code).toBe("VERSION_CONFLICT");
  });

  it("refuses an end that would land before the stored start, and the reverse", async () => {
    const { weddingId, owner } = await setupWedding();
    const { id } = (await create(weddingId, owner)).json.data;

    const earlyEnd = await patch(weddingId, id, owner, {
      version: 0,
      endsAt: "2027-02-13T01:00:00Z",
    });
    expect(earlyEnd.status).toBe(400);
    expect(earlyEnd.json.error.details[0].path).toBe("endsAt");

    const lateStart = await patch(weddingId, id, owner, {
      version: 0,
      startsAt: "2027-02-13T09:00:00Z",
    });
    expect(lateStart.status).toBe(400);
  });

  it("replaces the schedule, keeps the ids of lines that are kept, and re-sorts", async () => {
    const { weddingId, owner } = await setupWedding();
    const created = await create(weddingId, owner, {
      ...haldi,
      schedule: [
        { time: "07:00", title: "Makeup" },
        { time: "09:00", title: "Haldi" },
      ],
    });
    const { id, schedule } = created.json.data;

    const result = await patch(weddingId, id, owner, {
      version: 0,
      schedule: [
        { id: schedule[1].id, time: "06:30", title: "Haldi (earlier)" },
        { time: "12:00", title: "Lunch" },
      ],
    });
    expect(result.status).toBe(200);
    const items = result.json.data.schedule;
    expect(items.map((item: { title: string }) => item.title)).toEqual([
      "Haldi (earlier)",
      "Lunch",
    ]);
    expect(items[0].id).toBe(schedule[1].id);
  });

  it.each([
    ["nothing to change", { version: 0 }],
    ["no version", { name: "x" }],
    ["an unknown field", { version: 0, createdBy: "a".repeat(24) }],
  ])("rejects %s with 400", async (_label, body) => {
    const { weddingId, owner } = await setupWedding();
    const { id } = (await create(weddingId, owner)).json.data;
    expect((await patch(weddingId, id, owner, body)).status).toBe(400);
  });
});

describe("DELETE /weddings/:weddingId/events/:eventId", () => {
  it("soft deletes: the event vanishes from reads, edits and a second delete", async () => {
    const { weddingId, owner } = await setupWedding();
    const { id } = (await create(weddingId, owner)).json.data;

    const result = await remove(weddingId, id, owner);
    expect(result.status).toBe(200);
    expect(result.json.data.id).toBe(id);
    expect(new Date(result.json.data.deletedAt).getTime()).not.toBeNaN();

    expect((await list(weddingId, owner)).json.data).toHaveLength(0);
    const read = await call(getEvent, {
      method: "GET",
      cookie: owner.cookie,
      params: { weddingId, eventId: id },
    });
    expect(read.status).toBe(404);
    expect((await patch(weddingId, id, owner, { version: 0, name: "x" })).status).toBe(404);
    expect((await remove(weddingId, id, owner)).status).toBe(404);
  });

  it("rejects a malformed event id with 400", async () => {
    const { weddingId, owner } = await setupWedding();
    expect((await remove(weddingId, "not-an-id", owner)).status).toBe(400);
  });
});
