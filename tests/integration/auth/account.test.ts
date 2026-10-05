import { describe, expect, it } from "vitest";
import { DELETE as deleteAccount, GET as me, PATCH as patchMe } from "@/app/api/v1/users/me/route";
import { GET as getWedding } from "@/app/api/v1/weddings/[weddingId]/route";
import { POST as restore } from "@/app/api/v1/weddings/[weddingId]/restore/route";
import { Session } from "@/models/session.model";
import { User } from "@/models/user.model";
import { Wedding } from "@/models/wedding.model";
import { WeddingMember } from "@/models/weddingMember.model";
import { logInUser, signUpUser } from "../../setup/auth";
import { setupTestDatabase } from "../../setup/database";
import { call } from "../../setup/http";
import { addMember, setupWedding } from "../../setup/wedding";

setupTestDatabase();

describe("PATCH /users/me", () => {
  it("changes the display name and nothing else", async () => {
    const { cookie, email } = await signUpUser();
    const result = await call(patchMe, {
      method: "PATCH",
      cookie,
      body: { name: "  Priya A. Sharma " },
    });
    expect(result.status).toBe(200);
    expect(result.json.data).toMatchObject({ name: "Priya A. Sharma", email });

    for (const body of [{ email: "new@example.com" }, { name: "" }, {}, { status: "active" }]) {
      const bad = await call(patchMe, { method: "PATCH", cookie, body });
      expect(bad.status, JSON.stringify(body)).toBe(400);
    }
  });

  it("requires a session", async () => {
    const result = await call(patchMe, { method: "PATCH", body: { name: "X" } });
    expect(result.status).toBe(401);
  });
});

describe("DELETE /users/me (DB Design §10.4)", () => {
  it("deletes an account with no wedding, signs it out and keeps the email reserved", async () => {
    const { cookie, email, user } = await signUpUser();
    const result = await call(deleteAccount, { method: "DELETE", cookie });
    expect(result.status).toBe(200);
    expect(result.json.data).toEqual({ status: "deleted" });
    expect(
      result.setCookies.some((c) => c.startsWith("mmm_session=;") || c.includes("Max-Age=0")),
    ).toBe(true);

    // The old session no longer works and logging in fails like an unknown account.
    expect((await call(me, { method: "GET", cookie })).status).toBe(401);
    expect((await logInUser(email)).status).toBe(401);
    expect(await Session.countDocuments({ userId: user.id, revokedAt: null })).toBe(0);

    const stored = await User.findOne({ _id: user.id, deletedAt: { $type: "date" } }).lean();
    expect(stored).toMatchObject({ status: "pending_deletion", emailNormalized: email });
  });

  it("lets a plain member leave their wedding by deleting their account", async () => {
    const { weddingId, owner } = await setupWedding();
    const member = await addMember(weddingId, "member");

    const result = await call(deleteAccount, { method: "DELETE", cookie: member.cookie });
    expect(result.status).toBe(200);

    const row = await WeddingMember.findOne({
      _id: member.memberId,
      deletedAt: { $type: "date" },
    }).lean();
    expect(row?.deletionReason).toBe("account_deleted");
    const wedding = await call(getWedding, {
      method: "GET",
      cookie: owner.cookie,
      params: { weddingId },
    });
    expect(wedding.status).toBe(200);
  });

  it("blocks an owner whose wedding still has other members, naming the way out", async () => {
    const { weddingId, owner } = await setupWedding();
    await addMember(weddingId, "admin");
    await addMember(weddingId, "member");

    for (const path of ["/api/test", "/api/test?deleteWedding=true"]) {
      const result = await call(deleteAccount, { method: "DELETE", path, cookie: owner.cookie });
      expect(result.status).toBe(409);
      expect(result.json.error.code).toBe("OWNER_MUST_RESOLVE_WEDDING");
      expect(result.json.error.details).toEqual({ weddingId, activeMemberCount: 3 });
    }
    // Nothing happened.
    expect((await call(me, { method: "GET", cookie: owner.cookie })).status).toBe(200);
    expect(await Wedding.countDocuments({ _id: weddingId })).toBe(1);
  });

  it("makes a sole owner opt in to deleting the wedding along with the account", async () => {
    const { weddingId, owner } = await setupWedding();

    const without = await call(deleteAccount, { method: "DELETE", cookie: owner.cookie });
    expect(without.status).toBe(409);
    expect(without.json.error.details).toEqual({ weddingId, activeMemberCount: 1 });

    const withFlag = await call(deleteAccount, {
      method: "DELETE",
      path: "/api/test?deleteWedding=true",
      cookie: owner.cookie,
    });
    expect(withFlag.status).toBe(200);

    // The wedding is soft-deleted with the usual grace period, not erased.
    const stored = await Wedding.findOne({ _id: weddingId, deletedAt: { $type: "date" } }).lean();
    expect(stored?.purgeAfter).toBeInstanceOf(Date);
    expect(await WeddingMember.countDocuments({ weddingId })).toBe(0);
  });

  it("rejects an invalid flag value", async () => {
    const { cookie } = await signUpUser();
    const result = await call(deleteAccount, {
      method: "DELETE",
      path: "/api/test?deleteWedding=maybe",
      cookie,
    });
    expect(result.status).toBe(400);
  });

  it("can't be undone by restoring the wedding: the deleted owner can no longer sign in", async () => {
    const { weddingId, owner } = await setupWedding();
    await call(deleteAccount, {
      method: "DELETE",
      path: "/api/test?deleteWedding=true",
      cookie: owner.cookie,
    });
    const result = await call(restore, { cookie: owner.cookie, params: { weddingId } });
    expect(result.status).toBe(401);
  });
});
