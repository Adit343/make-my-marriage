import { describe, expect, it } from "vitest";
import {
  DELETE as deleteWedding,
  GET as getWedding,
  PATCH as patchWedding,
} from "@/app/api/v1/weddings/[weddingId]/route";
import { GET as listMembers } from "@/app/api/v1/weddings/[weddingId]/members/route";
import {
  DELETE as removeMember,
  PATCH as patchMember,
} from "@/app/api/v1/weddings/[weddingId]/members/[memberId]/route";
import { POST as transfer } from "@/app/api/v1/weddings/[weddingId]/members/[memberId]/transfer-ownership/route";
import { POST as restore } from "@/app/api/v1/weddings/[weddingId]/restore/route";
import { WeddingMember } from "@/models/weddingMember.model";
import { signUpUser } from "../../setup/auth";
import { setupTestDatabase } from "../../setup/database";
import { call } from "../../setup/http";
import { addMember, setupWedding } from "../../setup/wedding";

setupTestDatabase();

// API Design §3: session (401) → membership of THIS wedding (403 NOT_A_MEMBER) → role (403
// INSUFFICIENT_ROLE) → resource belongs to the wedding (404).

describe("authentication and membership", () => {
  it("requires a session", async () => {
    const { weddingId } = await setupWedding();
    const result = await call(getWedding, { method: "GET", params: { weddingId } });
    expect(result.status).toBe(401);
    expect(result.json.error.code).toBe("AUTHENTICATION_REQUIRED");
  });

  it("rejects a malformed wedding id before touching the database", async () => {
    const { owner } = await setupWedding();
    const result = await call(getWedding, {
      method: "GET",
      cookie: owner.cookie,
      params: { weddingId: "not-an-id" },
    });
    expect(result.status).toBe(400);
    expect(result.json.error.code).toBe("VALIDATION_ERROR");
  });

  it("denies a member of wedding A access to wedding B on every route", async () => {
    const a = await setupWedding("Wedding A");
    const b = await setupWedding("Wedding B");
    const params = { weddingId: b.weddingId, memberId: b.owner.memberId };
    const cookie = a.owner.cookie;

    const attempts = [
      call(getWedding, { method: "GET", cookie, params }),
      call(patchWedding, {
        method: "PATCH",
        cookie,
        params,
        body: { version: 0, title: "Hijacked" },
      }),
      call(deleteWedding, { method: "DELETE", cookie, params, body: { confirm: "Wedding B" } }),
      call(listMembers, { method: "GET", cookie, params }),
      call(patchMember, { method: "PATCH", cookie, params, body: { relationship: "friend" } }),
      call(removeMember, { method: "DELETE", cookie, params }),
      call(transfer, { method: "POST", cookie, params }),
    ];
    for (const result of await Promise.all(attempts)) {
      expect(result.status).toBe(403);
      expect(result.json.error.code).toBe("NOT_A_MEMBER");
    }
  });

  it("denies a user who has no wedding at all", async () => {
    const { weddingId } = await setupWedding();
    const loner = await signUpUser();
    const result = await call(getWedding, {
      method: "GET",
      cookie: loner.cookie,
      params: { weddingId },
    });
    expect(result.status).toBe(403);
    expect(result.json.error.code).toBe("NOT_A_MEMBER");
  });

  it("answers 404, not 403, for a member id that belongs to another wedding", async () => {
    const a = await setupWedding("Wedding A");
    const b = await setupWedding("Wedding B");
    const result = await call(patchMember, {
      method: "PATCH",
      cookie: a.owner.cookie,
      params: { weddingId: a.weddingId, memberId: b.owner.memberId },
      body: { relationship: "friend" },
    });
    expect(result.status).toBe(404);
    expect(result.json.error.code).toBe("NOT_FOUND");
  });

  it("does not let a suspended member in", async () => {
    const { weddingId } = await setupWedding();
    const member = await addMember(weddingId);
    await WeddingMember.updateOne({ _id: member.memberId }, { $set: { status: "suspended" } });
    const result = await call(getWedding, {
      method: "GET",
      cookie: member.cookie,
      params: { weddingId },
    });
    expect(result.status).toBe(403);
    expect(result.json.error.code).toBe("NOT_A_MEMBER");
  });
});

describe("role matrix (decision D3)", () => {
  it("lets every role view the wedding and the team", async () => {
    const { weddingId } = await setupWedding();
    for (const role of ["admin", "member"] as const) {
      const person = await addMember(weddingId, role);
      const wedding = await call(getWedding, {
        method: "GET",
        cookie: person.cookie,
        params: { weddingId },
      });
      expect(wedding.status).toBe(200);
      expect(wedding.json.data.membership.role).toBe(role);
      const team = await call(listMembers, {
        method: "GET",
        cookie: person.cookie,
        params: { weddingId },
      });
      expect(team.status).toBe(200);
    }
  });

  it("stops a plain member from editing the wedding or managing the team", async () => {
    const { weddingId, owner } = await setupWedding();
    const member = await addMember(weddingId, "member");
    const other = await addMember(weddingId, "member");
    const cookie = member.cookie;

    const attempts = [
      call(patchWedding, {
        method: "PATCH",
        cookie,
        params: { weddingId },
        body: { version: 0, title: "X" },
      }),
      call(patchMember, {
        method: "PATCH",
        cookie,
        params: { weddingId, memberId: other.memberId },
        body: { role: "admin" },
      }),
      call(removeMember, {
        method: "DELETE",
        cookie,
        params: { weddingId, memberId: other.memberId },
      }),
      call(deleteWedding, {
        method: "DELETE",
        cookie,
        params: { weddingId },
        body: { confirm: "x" },
      }),
      call(transfer, {
        method: "POST",
        cookie,
        params: { weddingId, memberId: owner.memberId },
      }),
    ];
    for (const result of await Promise.all(attempts)) {
      expect(result.status).toBe(403);
      expect(result.json.error.code).toBe("INSUFFICIENT_ROLE");
    }
  });

  it("lets an admin edit and manage, but not delete the wedding or transfer ownership", async () => {
    const { weddingId, owner } = await setupWedding();
    const admin = await addMember(weddingId, "admin");
    const member = await addMember(weddingId, "member");
    const cookie = admin.cookie;

    const edit = await call(patchWedding, {
      method: "PATCH",
      cookie,
      params: { weddingId },
      body: { version: 0, title: "Renamed by admin" },
    });
    expect(edit.status).toBe(200);
    const promote = await call(patchMember, {
      method: "PATCH",
      cookie,
      params: { weddingId, memberId: member.memberId },
      body: { role: "admin" },
    });
    expect(promote.status).toBe(200);

    const del = await call(deleteWedding, {
      method: "DELETE",
      cookie,
      params: { weddingId },
      body: { confirm: "Renamed by admin" },
    });
    expect(del.status).toBe(403);
    expect(del.json.error.code).toBe("INSUFFICIENT_ROLE");
    const move = await call(transfer, {
      method: "POST",
      cookie,
      params: { weddingId, memberId: member.memberId },
    });
    expect(move.status).toBe(403);
    expect(move.json.error.code).toBe("INSUFFICIENT_ROLE");

    // ...and an admin never touches the owner.
    const touchOwner = await call(patchMember, {
      method: "PATCH",
      cookie,
      params: { weddingId, memberId: owner.memberId },
      body: { role: "member" },
    });
    expect(touchOwner.status).toBe(422);
    const removeOwner = await call(removeMember, {
      method: "DELETE",
      cookie,
      params: { weddingId, memberId: owner.memberId },
    });
    expect(removeOwner.status).toBe(422);
  });
});

describe("restore", () => {
  it("is not available to someone who was never the owner", async () => {
    const { weddingId } = await setupWedding();
    const stranger = await signUpUser();
    const result = await call(restore, { cookie: stranger.cookie, params: { weddingId } });
    expect(result.status).toBe(404);
  });
});
