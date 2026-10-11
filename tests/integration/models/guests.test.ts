import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { Guest } from "@/models/guest.model";
import { GuestGroup } from "@/models/guestGroup.model";
import { Rsvp } from "@/models/rsvp.model";
import { setupTestDatabase } from "../../setup/database";

// DB Design §6.9 to §6.11 against a real MongoDB: validation, the derived search key, and the
// partial unique indexes that must ignore soft-deleted rows.

setupTestDatabase();

const wedding = () => new Types.ObjectId();
const user = new Types.ObjectId();

async function newGuest(weddingId: Types.ObjectId, overrides: Record<string, unknown> = {}) {
  return Guest.create({
    weddingId,
    name: "Rahul Sharma",
    side: "partnerOne",
    createdBy: user,
    ...overrides,
  });
}

describe("Guest model", () => {
  it("applies the documented defaults and an explicit null deletedAt", async () => {
    const guest = (await newGuest(wedding())).toObject();
    expect(guest).toMatchObject({
      groupId: null,
      email: null,
      phone: null,
      ageCategory: "adult",
      plusOnesAllowed: 0,
      nameNormalized: "rahul sharma",
      deletedAt: null,
      invitation: { status: "not_invited", lastChannel: null, lastSentAt: null, sendCount: 0 },
    });
  });

  it("requires a name, a side and a creator", async () => {
    const weddingId = wedding();
    await expect(Guest.create({ weddingId, side: "both", createdBy: user })).rejects.toThrow();
    await expect(Guest.create({ weddingId, name: "x", createdBy: user })).rejects.toThrow();
    await expect(Guest.create({ weddingId, name: "x", side: "both" })).rejects.toThrow();
  });

  it("rejects values outside the allowed sets", async () => {
    const weddingId = wedding();
    for (const bad of [
      { side: "left" },
      { ageCategory: "teen" },
      { dietaryPreference: "keto" },
      { plusOnesAllowed: 11 },
      { plusOnesAllowed: -1 },
      { plusOnesAllowed: 1.5 },
      { phone: "98765 43210" },
      { phone: "+0123456789" },
      { name: "x".repeat(121) },
      { notes: "n".repeat(1001) },
      { invitation: { status: "sent" } },
    ]) {
      await expect(newGuest(weddingId, bad), JSON.stringify(bad)).rejects.toThrow();
    }
  });

  it("lowercases the email and keeps an E.164 phone as given", async () => {
    const guest = await newGuest(wedding(), { email: "Rahul@Example.COM", phone: "+919876543210" });
    expect(guest.email).toBe("rahul@example.com");
    expect(guest.phone).toBe("+919876543210");
  });

  it("derives the search key: lowercase, trimmed, inner spaces collapsed, accents kept", async () => {
    const guest = await newGuest(wedding(), { name: "  Zoë   O'Brien " });
    expect(guest.nameNormalized).toBe("zoë o'brien");
  });

  it("keeps the search key in step when the name is updated through a query", async () => {
    const weddingId = wedding();
    const guest = await newGuest(weddingId);
    await Guest.updateOne({ _id: guest._id, weddingId }, { $set: { name: "Vikram SHAH" } });
    const reread = await Guest.findById(guest._id).lean();
    expect(reread?.nameNormalized).toBe("vikram shah");
  });

  it("hides soft-deleted guests from normal queries", async () => {
    const weddingId = wedding();
    const guest = await newGuest(weddingId);
    await Guest.updateOne({ _id: guest._id }, { $set: { deletedAt: new Date(), deletedBy: user } });
    expect(await Guest.countDocuments({ weddingId })).toBe(0);
    expect(await Guest.countDocuments({ weddingId }).setOptions({ withDeleted: true })).toBe(1);
  });

  it("rejects a stale save (optimistic concurrency)", async () => {
    const weddingId = wedding();
    const created = await newGuest(weddingId);
    const first = await Guest.findById(created._id);
    const second = await Guest.findById(created._id);
    first!.name = "First";
    await first!.save();
    second!.name = "Second";
    await expect(second!.save()).rejects.toThrow(/version/i);
  });
});

describe("GuestGroup model", () => {
  const group = (weddingId: Types.ObjectId, name: string) =>
    GuestGroup.create({ weddingId, name, side: "both", createdBy: user });

  it("refuses a second live group with the same name in a wedding, ignoring case and spacing", async () => {
    const weddingId = wedding();
    await group(weddingId, "Sharma Family");
    await expect(group(weddingId, "  sharma   family ")).rejects.toMatchObject({ code: 11000 });
  });

  it("allows the same name in another wedding", async () => {
    await group(wedding(), "Sharma Family");
    await expect(group(wedding(), "Sharma Family")).resolves.toBeDefined();
  });

  it("frees the name when the group is soft-deleted", async () => {
    const weddingId = wedding();
    const first = await group(weddingId, "Sharma Family");
    await GuestGroup.updateOne({ _id: first._id }, { $set: { deletedAt: new Date() } });
    await expect(group(weddingId, "Sharma Family")).resolves.toBeDefined();
  });

  it("requires a side from the allowed set", async () => {
    await expect(
      GuestGroup.create({
        weddingId: wedding(),
        name: "x",
        side: "left" as never,
        createdBy: user,
      }),
    ).rejects.toThrow();
  });
});

describe("Rsvp model", () => {
  const rsvp = (
    weddingId: Types.ObjectId,
    guestId: Types.ObjectId,
    eventId: Types.ObjectId,
    extra = {},
  ) => Rsvp.create({ weddingId, guestId, eventId, ...extra });

  it("starts pending with nobody counted and an explicit null deletedAt", async () => {
    const row = (await rsvp(wedding(), new Types.ObjectId(), new Types.ObjectId())).toObject();
    expect(row).toMatchObject({
      status: "pending",
      attendingCount: 0,
      respondedAt: null,
      respondedVia: null,
      deletedAt: null,
    });
  });

  it("allows one live row per guest per event", async () => {
    const weddingId = wedding();
    const guestId = new Types.ObjectId();
    const eventId = new Types.ObjectId();
    await rsvp(weddingId, guestId, eventId);
    await expect(rsvp(weddingId, guestId, eventId)).rejects.toMatchObject({ code: 11000 });
    await expect(rsvp(weddingId, guestId, new Types.ObjectId())).resolves.toBeDefined();
    await expect(rsvp(weddingId, new Types.ObjectId(), eventId)).resolves.toBeDefined();
  });

  it("allows inviting the guest to the event again after the row was soft-deleted", async () => {
    const weddingId = wedding();
    const guestId = new Types.ObjectId();
    const eventId = new Types.ObjectId();
    const first = await rsvp(weddingId, guestId, eventId);
    await Rsvp.updateOne({ _id: first._id }, { $set: { deletedAt: new Date() } });
    await expect(rsvp(weddingId, guestId, eventId)).resolves.toBeDefined();
  });

  it("rejects an unknown status and a fractional or oversized count", async () => {
    const weddingId = wedding();
    const guestId = new Types.ObjectId();
    await expect(
      rsvp(weddingId, guestId, new Types.ObjectId(), { status: "yes" }),
    ).rejects.toThrow();
    await expect(
      rsvp(weddingId, guestId, new Types.ObjectId(), { attendingCount: 1.5 }),
    ).rejects.toThrow();
    await expect(
      rsvp(weddingId, guestId, new Types.ObjectId(), { attendingCount: 12 }),
    ).rejects.toThrow();
    await expect(
      rsvp(weddingId, guestId, new Types.ObjectId(), { respondedVia: "psychic" }),
    ).rejects.toThrow();
  });
});
