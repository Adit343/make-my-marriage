import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import {
  DELETE as deleteWedding,
  GET as getWedding,
  PATCH as patchWedding,
} from "@/app/api/v1/weddings/[weddingId]/route";
import { POST as restore } from "@/app/api/v1/weddings/[weddingId]/restore/route";
import { POST as createWedding } from "@/app/api/v1/weddings/route";
import { Wedding } from "@/models/wedding.model";
import { WeddingMember } from "@/models/weddingMember.model";
import { setupTestDatabase } from "../../setup/database";
import { call } from "../../setup/http";
import { addMember, setupWedding } from "../../setup/wedding";

setupTestDatabase();

const DAY = 24 * 60 * 60 * 1000;

describe("GET /weddings/:weddingId", () => {
  it("returns the wedding with the caller's role", async () => {
    const { weddingId, owner } = await setupWedding();
    const result = await call(getWedding, {
      method: "GET",
      cookie: owner.cookie,
      params: { weddingId },
    });
    expect(result.status).toBe(200);
    expect(result.json.data.wedding).toMatchObject({ id: weddingId, version: 0 });
    expect(result.json.data.membership).toEqual({ id: owner.memberId, role: "owner" });
  });
});

describe("PATCH /weddings/:weddingId (optimistic concurrency, decision C5)", () => {
  async function patch(cookie: string, weddingId: string, body: unknown) {
    return call(patchWedding, { method: "PATCH", cookie, params: { weddingId }, body });
  }

  it("updates the given fields and bumps the version", async () => {
    const { weddingId, owner } = await setupWedding();
    const result = await patch(owner.cookie, weddingId, {
      version: 0,
      title: "Aarav & Diya",
      weddingDate: "2027-02-14",
      partners: [{ name: "Aarav" }, { name: "Diya" }],
      budgetTotalMinor: 2500000000,
      location: { address: { city: "Surat", state: "Gujarat" } },
    });
    expect(result.status).toBe(200);
    expect(result.json.data).toMatchObject({
      title: "Aarav & Diya",
      weddingDate: "2027-02-14",
      partners: [{ name: "Aarav" }, { name: "Diya" }],
      budgetTotalMinor: 2500000000,
      version: 1,
    });
    expect(result.json.data.location.address.city).toBe("Surat");
  });

  it("can clear nullable fields", async () => {
    const { weddingId, owner } = await setupWedding();
    await patch(owner.cookie, weddingId, { version: 0, weddingDate: "2027-02-14" });
    const result = await patch(owner.cookie, weddingId, { version: 1, weddingDate: null });
    expect(result.status).toBe(200);
    expect(result.json.data.weddingDate).toBeNull();
  });

  it("rejects a stale version instead of overwriting someone else's edit", async () => {
    const { weddingId, owner } = await setupWedding();
    const admin = await addMember(weddingId, "admin");

    const first = await patch(admin.cookie, weddingId, { version: 0, title: "Admin's title" });
    expect(first.status).toBe(200);

    const stale = await patch(owner.cookie, weddingId, { version: 0, title: "Owner's title" });
    expect(stale.status).toBe(409);
    expect(stale.json.error.code).toBe("VERSION_CONFLICT");

    const current = await call(getWedding, {
      method: "GET",
      cookie: owner.cookie,
      params: { weddingId },
    });
    expect(current.json.data.wedding.title).toBe("Admin's title");
  });

  it("lets only one of two simultaneous edits at the same version win", async () => {
    const { weddingId, owner } = await setupWedding();
    const results = await Promise.all([
      patch(owner.cookie, weddingId, { version: 0, title: "One" }),
      patch(owner.cookie, weddingId, { version: 0, title: "Two" }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  });

  it("validates input", async () => {
    const { weddingId, owner } = await setupWedding();
    const cases: unknown[] = [
      { title: "No version" },
      { version: 0 },
      { version: 0, title: "" },
      { version: 0, partners: [{ name: "A" }, { name: "B" }, { name: "C" }] },
      { version: 0, currency: "ZZZ" },
      { version: 0, weddingDate: "14/02/2027" },
      { version: 0, deletedAt: null },
      { version: 0, createdBy: new Types.ObjectId().toString() },
    ];
    for (const body of cases) {
      const result = await patch(owner.cookie, weddingId, body);
      expect(result.status, JSON.stringify(body)).toBe(400);
    }
  });
});

describe("DELETE /weddings/:weddingId", () => {
  it("needs the title retyped", async () => {
    const { weddingId, owner } = await setupWedding("Priya & Rohan");
    const result = await call(deleteWedding, {
      method: "DELETE",
      cookie: owner.cookie,
      params: { weddingId },
      body: { confirm: "priya" },
    });
    expect(result.status).toBe(400);
    expect(await Wedding.countDocuments({ _id: weddingId })).toBe(1);
  });

  it("soft-deletes the wedding and ends every membership, freeing each person", async () => {
    const { weddingId, owner } = await setupWedding("Priya & Rohan");
    const member = await addMember(weddingId, "member");

    const result = await call(deleteWedding, {
      method: "DELETE",
      cookie: owner.cookie,
      params: { weddingId },
      body: { confirm: "Priya & Rohan" },
    });
    expect(result.status).toBe(200);
    const { deletedAt, purgeAfter } = result.json.data;
    expect(new Date(purgeAfter).getTime() - new Date(deletedAt).getTime()).toBe(30 * DAY);

    const stored = await Wedding.findOne({ _id: weddingId, deletedAt: { $type: "date" } }).lean();
    expect(stored).toMatchObject({ status: "archived" });
    const rows = await WeddingMember.find({ weddingId, deletedAt: { $type: "date" } }).lean();
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.deletionReason === "wedding_deleted")).toBe(true);

    // Nobody can reach it any more...
    for (const person of [owner, member]) {
      const after = await call(getWedding, {
        method: "GET",
        cookie: person.cookie,
        params: { weddingId },
      });
      expect(after.status).toBe(403);
    }
    // ...and each person can start or join another wedding.
    const fresh = await call(createWedding, {
      cookie: member.cookie,
      body: { title: "A new start", relationship: "couple" },
    });
    expect(fresh.status).toBe(201);
  });
});

describe("POST /weddings/:weddingId/restore", () => {
  async function deleted(title = "Priya & Rohan") {
    const setup = await setupWedding(title);
    const result = await call(deleteWedding, {
      method: "DELETE",
      cookie: setup.owner.cookie,
      params: { weddingId: setup.weddingId },
      body: { confirm: title },
    });
    expect(result.status).toBe(200);
    return setup;
  }

  it("brings back the wedding, its owner and the members the deletion removed", async () => {
    const { weddingId, owner } = await setupWedding("Priya & Rohan");
    const admin = await addMember(weddingId, "admin");
    const member = await addMember(weddingId, "member");
    await call(deleteWedding, {
      method: "DELETE",
      cookie: owner.cookie,
      params: { weddingId },
      body: { confirm: "Priya & Rohan" },
    });

    const result = await call(restore, { cookie: owner.cookie, params: { weddingId } });
    expect(result.status).toBe(200);
    expect(result.json.data.wedding).toMatchObject({ id: weddingId, status: "planning" });
    expect(result.json.data.membership).toEqual({ id: owner.memberId, role: "owner" });
    expect(result.json.data.restoredMemberCount).toBe(3);

    for (const person of [owner, admin, member]) {
      const ok = await call(getWedding, {
        method: "GET",
        cookie: person.cookie,
        params: { weddingId },
      });
      expect(ok.status).toBe(200);
    }
    const stored = await Wedding.findOne({ _id: weddingId }).lean();
    expect(stored).toMatchObject({ deletedAt: null, purgeAfter: null });
  });

  it("leaves out a member who has since joined another wedding", async () => {
    const { weddingId, owner } = await setupWedding("Priya & Rohan");
    const member = await addMember(weddingId, "member");
    await call(deleteWedding, {
      method: "DELETE",
      cookie: owner.cookie,
      params: { weddingId },
      body: { confirm: "Priya & Rohan" },
    });
    const elsewhere = await call(createWedding, {
      cookie: member.cookie,
      body: { title: "Somewhere else", relationship: "couple" },
    });
    expect(elsewhere.status).toBe(201);

    const result = await call(restore, { cookie: owner.cookie, params: { weddingId } });
    expect(result.status).toBe(200);
    expect(result.json.data.restoredMemberCount).toBe(1);
  });

  it("refuses a former owner who has since created another wedding", async () => {
    const { weddingId, owner } = await deleted();
    const another = await call(createWedding, {
      cookie: owner.cookie,
      body: { title: "Second wedding", relationship: "couple" },
    });
    expect(another.status).toBe(201);

    const result = await call(restore, { cookie: owner.cookie, params: { weddingId } });
    expect(result.status).toBe(409);
    expect(result.json.error.code).toBe("ALREADY_IN_WEDDING");
    // Nothing was half-restored.
    expect(await Wedding.countDocuments({ _id: weddingId })).toBe(0);
  });

  it("is only for the former owner, not another former member", async () => {
    const { weddingId, owner } = await setupWedding("Priya & Rohan");
    const admin = await addMember(weddingId, "admin");
    await call(deleteWedding, {
      method: "DELETE",
      cookie: owner.cookie,
      params: { weddingId },
      body: { confirm: "Priya & Rohan" },
    });
    const result = await call(restore, { cookie: admin.cookie, params: { weddingId } });
    expect(result.status).toBe(404);
  });

  it("is refused once the grace period is over", async () => {
    const { weddingId, owner } = await deleted();
    await Wedding.updateOne(
      { _id: weddingId, deletedAt: { $type: "date" } },
      { $set: { purgeAfter: new Date(Date.now() - 1000) } },
    );
    const result = await call(restore, { cookie: owner.cookie, params: { weddingId } });
    expect(result.status).toBe(404);
  });

  it("refuses a wedding that was never deleted", async () => {
    const { weddingId, owner } = await setupWedding();
    const result = await call(restore, { cookie: owner.cookie, params: { weddingId } });
    expect(result.status).toBe(404);
  });
});
