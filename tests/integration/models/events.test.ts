import { Types } from "mongoose";
import { beforeEach, describe, expect, it } from "vitest";
import { Event } from "@/models/event.model";
import { clearCollections, setupTestDatabase } from "../../setup/database";

setupTestDatabase();
beforeEach(clearCollections);

const weddingId = new Types.ObjectId();
const createdBy = new Types.ObjectId();

const event = (overrides: Record<string, unknown> = {}) => ({
  weddingId,
  createdBy,
  name: "Haldi",
  type: "haldi" as const,
  startsAt: new Date("2027-02-13T04:30:00Z"),
  timezone: "Asia/Kolkata",
  ...overrides,
});

describe("events", () => {
  it("applies defaults and stores deletedAt as an explicit null", async () => {
    const created = await Event.create(event());
    expect(created.toObject()).toMatchObject({
      endsAt: null,
      isPublic: false,
      sortOrder: 0,
      schedule: [],
      deletedAt: null,
    });
  });

  it.each([
    ["an unknown type", { type: "birthday" }],
    ["an empty name", { name: " " }],
    ["an end before the start", { endsAt: new Date("2027-02-13T03:00:00Z") }],
    ["an end equal to the start", { endsAt: new Date("2027-02-13T04:30:00Z") }],
    ["a fractional sort order", { sortOrder: 1.5 }],
    ["a missing start", { startsAt: undefined }],
    ["a missing timezone", { timezone: undefined }],
    ["coordinates with only a latitude", { location: { coordinates: { latitude: 21.1 } } }],
  ])("rejects %s", async (_label, override) => {
    await expect(Event.create(event(override))).rejects.toThrow();
  });

  it("keeps schedule items in order and gives each its own id", async () => {
    const created = await Event.create(
      event({
        schedule: [
          { time: "07:00", title: "Makeup" },
          { time: "09:00", title: "Haldi", notes: "Yellow outfits", isPublic: true },
        ],
      }),
    );
    const items = created.toObject().schedule;
    expect(items.map((item) => item.title)).toEqual(["Makeup", "Haldi"]);
    expect(items[0]!._id).toBeInstanceOf(Types.ObjectId);
    expect(items[0]!.isPublic).toBe(false);
  });

  it.each([
    ["12-hour time", "7:00 AM"],
    ["an hour past 23", "24:00"],
    ["no leading zero", "7:00"],
    ["minutes past 59", "10:60"],
  ])("rejects a schedule time with %s", async (_label, time) => {
    await expect(Event.create(event({ schedule: [{ time, title: "Makeup" }] }))).rejects.toThrow();
  });

  it("caps the schedule at 50 items", async () => {
    const items = (count: number) =>
      Array.from({ length: count }, (_, index) => ({
        time: "10:00",
        title: `Item ${index}`,
      }));
    await expect(Event.create(event({ schedule: items(50) }))).resolves.toBeDefined();
    await expect(Event.create(event({ schedule: items(51) }))).rejects.toThrow();
  });

  it("hides soft-deleted events from normal queries", async () => {
    const created = await Event.create(event());
    await Event.updateOne({ _id: created._id }, { $set: { deletedAt: new Date() } });
    expect(await Event.countDocuments({ weddingId })).toBe(0);
    expect(await Event.countDocuments({ weddingId }, { withDeleted: true })).toBe(1);
  });

  it("refuses a stale save after someone else edited (optimistic concurrency)", async () => {
    const { _id } = await Event.create(event());
    const planner = await Event.findOne({ _id });
    const parent = await Event.findOne({ _id });

    parent!.name = "Haldi (renamed)";
    await parent!.save();

    planner!.name = "Overwritten";
    await expect(planner!.save()).rejects.toThrow(/version/i);
  });
});
