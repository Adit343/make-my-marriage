import { describe, expect, it } from "vitest";
import { GET as getWedding } from "@/app/api/v1/weddings/[weddingId]/route";
import { GET as listMembers } from "@/app/api/v1/weddings/[weddingId]/members/route";
import {
  DELETE as removeMember,
  PATCH as patchMember,
} from "@/app/api/v1/weddings/[weddingId]/members/[memberId]/route";
import { POST as transfer } from "@/app/api/v1/weddings/[weddingId]/members/[memberId]/transfer-ownership/route";
import { POST as createWedding } from "@/app/api/v1/weddings/route";
import { WeddingMember } from "@/models/weddingMember.model";
import { setupTestDatabase } from "../../setup/database";
import { call } from "../../setup/http";
import { addMember, setupWedding } from "../../setup/wedding";

setupTestDatabase();

describe("GET /weddings/:weddingId/members", () => {
  it("lists the team with names, roles and who is the caller", async () => {
    const { weddingId, owner } = await setupWedding();
    const admin = await addMember(weddingId, "admin");
    await addMember(weddingId, "member");

    const result = await call(listMembers, {
      method: "GET",
      cookie: admin.cookie,
      params: { weddingId },
    });
    expect(result.status).toBe(200);
    expect(result.json.meta).toEqual({ page: 1, pageSize: 20, totalCount: 3 });
    const rows = result.json.data;
    expect(rows.map((row: { role: string }) => row.role)).toEqual(["owner", "admin", "member"]);
    expect(rows[0]).toMatchObject({
      id: owner.memberId,
      userId: owner.user.id,
      user: { email: owner.user.email, name: owner.user.name },
      relationship: "couple",
      status: "active",
      isYou: false,
    });
    expect(rows[1].isYou).toBe(true);
    // Only what the team screen needs: no credentials or internals.
    expect(Object.keys(rows[0]).sort()).toEqual(
      ["id", "isYou", "joinedAt", "relationship", "role", "status", "user", "userId"].sort(),
    );
  });

  it("paginates by page number", async () => {
    const { weddingId, owner } = await setupWedding();
    await addMember(weddingId);
    await addMember(weddingId);

    const second = await call(listMembers, {
      method: "GET",
      path: "/api/test?page=2&pageSize=2",
      cookie: owner.cookie,
      params: { weddingId },
    });
    expect(second.json.data).toHaveLength(1);
    expect(second.json.meta).toEqual({ page: 2, pageSize: 2, totalCount: 3 });

    const tooBig = await call(listMembers, {
      method: "GET",
      path: "/api/test?pageSize=1000",
      cookie: owner.cookie,
      params: { weddingId },
    });
    expect(tooBig.status).toBe(400);
    const unknown = await call(listMembers, {
      method: "GET",
      path: "/api/test?role=admin",
      cookie: owner.cookie,
      params: { weddingId },
    });
    expect(unknown.status).toBe(400);
  });
});

describe("PATCH /weddings/:weddingId/members/:memberId", () => {
  it("changes a role and a relationship label", async () => {
    const { weddingId, owner } = await setupWedding();
    const member = await addMember(weddingId, "member");
    const result = await call(patchMember, {
      method: "PATCH",
      cookie: owner.cookie,
      params: { weddingId, memberId: member.memberId },
      body: { role: "admin", relationship: "planner" },
    });
    expect(result.status).toBe(200);
    expect(result.json.data).toMatchObject({ role: "admin", relationship: "planner" });
  });

  it("can never grant ownership, and rejects unknown fields", async () => {
    const { weddingId, owner } = await setupWedding();
    const member = await addMember(weddingId, "member");
    for (const body of [{ role: "owner" }, { status: "suspended" }, {}, { role: "root" }]) {
      const result = await call(patchMember, {
        method: "PATCH",
        cookie: owner.cookie,
        params: { weddingId, memberId: member.memberId },
        body,
      });
      expect(result.status, JSON.stringify(body)).toBe(400);
    }
    expect(await WeddingMember.countDocuments({ weddingId, role: "owner" })).toBe(1);
  });

  it("stops anyone changing their own role, but allows their own label", async () => {
    const { weddingId } = await setupWedding();
    const admin = await addMember(weddingId, "admin");
    const params = { weddingId, memberId: admin.memberId };

    const self = await call(patchMember, {
      method: "PATCH",
      cookie: admin.cookie,
      params,
      body: { role: "member" },
    });
    expect(self.status).toBe(422);
    expect(self.json.error.code).toBe("BUSINESS_RULE_VIOLATION");

    const label = await call(patchMember, {
      method: "PATCH",
      cookie: admin.cookie,
      params,
      body: { relationship: "planner" },
    });
    expect(label.status).toBe(200);
  });
});

describe("DELETE /weddings/:weddingId/members/:memberId", () => {
  it("lets a member leave, which frees them to join or create another wedding", async () => {
    const { weddingId } = await setupWedding();
    const member = await addMember(weddingId, "member");
    const result = await call(removeMember, {
      method: "DELETE",
      cookie: member.cookie,
      params: { weddingId, memberId: member.memberId },
    });
    expect(result.status).toBe(200);
    expect(result.json.data.id).toBe(member.memberId);

    const row = await WeddingMember.findOne({
      _id: member.memberId,
      deletedAt: { $type: "date" },
    }).lean();
    expect(row?.deletionReason).toBe("left");

    const gone = await call(getWedding, {
      method: "GET",
      cookie: member.cookie,
      params: { weddingId },
    });
    expect(gone.status).toBe(403);
    const fresh = await call(createWedding, {
      cookie: member.cookie,
      body: { title: "My own wedding", relationship: "couple" },
    });
    expect(fresh.status).toBe(201);
  });

  it("lets an admin remove a member", async () => {
    const { weddingId } = await setupWedding();
    const admin = await addMember(weddingId, "admin");
    const member = await addMember(weddingId, "member");
    const result = await call(removeMember, {
      method: "DELETE",
      cookie: admin.cookie,
      params: { weddingId, memberId: member.memberId },
    });
    expect(result.status).toBe(200);
    const row = await WeddingMember.findOne({
      _id: member.memberId,
      deletedAt: { $type: "date" },
    }).lean();
    expect(row?.deletionReason).toBe("removed");
  });

  it("won't let a plain member remove someone else", async () => {
    const { weddingId } = await setupWedding();
    const member = await addMember(weddingId, "member");
    const other = await addMember(weddingId, "member");
    const result = await call(removeMember, {
      method: "DELETE",
      cookie: member.cookie,
      params: { weddingId, memberId: other.memberId },
    });
    expect(result.status).toBe(403);
    expect(result.json.error.code).toBe("INSUFFICIENT_ROLE");
  });

  it("won't let the owner leave without transferring ownership first", async () => {
    const { weddingId, owner } = await setupWedding();
    const result = await call(removeMember, {
      method: "DELETE",
      cookie: owner.cookie,
      params: { weddingId, memberId: owner.memberId },
    });
    expect(result.status).toBe(422);
    expect(result.json.error.code).toBe("BUSINESS_RULE_VIOLATION");
  });

  it("answers 404 for someone already removed", async () => {
    const { weddingId, owner } = await setupWedding();
    const member = await addMember(weddingId, "member");
    const params = { weddingId, memberId: member.memberId };
    await call(removeMember, { method: "DELETE", cookie: owner.cookie, params });
    const again = await call(removeMember, { method: "DELETE", cookie: owner.cookie, params });
    expect(again.status).toBe(404);
  });
});

describe("POST /weddings/:weddingId/members/:memberId/transfer-ownership", () => {
  it("swaps owner and admin, leaving exactly one owner", async () => {
    const { weddingId, owner } = await setupWedding();
    const heir = await addMember(weddingId, "member");

    const result = await call(transfer, {
      method: "POST",
      cookie: owner.cookie,
      params: { weddingId, memberId: heir.memberId },
    });
    expect(result.status).toBe(200);
    expect(result.json.data.previousOwner).toMatchObject({ id: owner.memberId, role: "admin" });
    expect(result.json.data.newOwner).toMatchObject({ id: heir.memberId, role: "owner" });
    expect(await WeddingMember.countDocuments({ weddingId, role: "owner" })).toBe(1);

    // The new owner now holds the owner-only powers; the old one no longer does.
    const back = await call(transfer, {
      method: "POST",
      cookie: owner.cookie,
      params: { weddingId, memberId: owner.memberId },
    });
    expect(back.status).toBe(403);
    const onward = await call(transfer, {
      method: "POST",
      cookie: heir.cookie,
      params: { weddingId, memberId: owner.memberId },
    });
    expect(onward.status).toBe(200);
  });

  it("refuses to transfer to yourself, a suspended member, or a stranger", async () => {
    const { weddingId, owner } = await setupWedding();
    const suspended = await addMember(weddingId, "member");
    await WeddingMember.updateOne({ _id: suspended.memberId }, { $set: { status: "suspended" } });
    const outsider = await setupWedding("Another wedding");

    const toSelf = await call(transfer, {
      method: "POST",
      cookie: owner.cookie,
      params: { weddingId, memberId: owner.memberId },
    });
    expect(toSelf.status).toBe(422);
    const toSuspended = await call(transfer, {
      method: "POST",
      cookie: owner.cookie,
      params: { weddingId, memberId: suspended.memberId },
    });
    expect(toSuspended.status).toBe(422);
    const toStranger = await call(transfer, {
      method: "POST",
      cookie: owner.cookie,
      params: { weddingId, memberId: outsider.owner.memberId },
    });
    expect(toStranger.status).toBe(404);

    expect(await WeddingMember.countDocuments({ weddingId, role: "owner" })).toBe(1);
  });

  it("never ends with two owners or none when two transfers race", async () => {
    const { weddingId, owner } = await setupWedding();
    const a = await addMember(weddingId, "member");
    const b = await addMember(weddingId, "member");

    await Promise.all([
      call(transfer, {
        method: "POST",
        cookie: owner.cookie,
        params: { weddingId, memberId: a.memberId },
      }),
      call(transfer, {
        method: "POST",
        cookie: owner.cookie,
        params: { weddingId, memberId: b.memberId },
      }),
    ]);
    expect(await WeddingMember.countDocuments({ weddingId, role: "owner" })).toBe(1);
  });
});
