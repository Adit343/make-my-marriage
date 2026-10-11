import { describe, expect, it } from "vitest";
import { DELETE as deleteEventRoute } from "@/app/api/v1/weddings/[weddingId]/events/[eventId]/route";
import { call } from "../../setup/http";
import { setupTestDatabase } from "../../setup/database";
import { addMember, setupWedding } from "../../setup/wedding";
import {
  createExpense,
  deleteExpense,
  getExpense,
  listExpenses,
  makeEvent,
  makeExpense,
  makePayment,
  makeVendor,
  patchExpense,
} from "./helpers";

setupTestDatabase();

describe("POST /weddings/:weddingId/expenses", () => {
  it("records an expense with defaults and derived money", async () => {
    const { weddingId, owner } = await setupWedding();
    const result = await createExpense(weddingId, owner, {
      title: "Photography package",
      category: "photography_video",
      estimatedAmountMinor: 18000000,
      agreedAmountMinor: 16500000,
      expenseDate: "2027-01-05",
      notes: "2 candid photographers",
    });
    expect(result.status).toBe(201);
    expect(result.json.data).toMatchObject({
      title: "Photography package",
      category: "photography_video",
      expenseDate: "2027-01-05",
      eventId: null,
      vendorId: null,
      estimatedAmountMinor: 18000000,
      agreedAmountMinor: 16500000,
      costMinor: 16500000,
      paidAmountMinor: 0,
      remainingAmountMinor: 16500000,
      notes: "2 candid photographers",
      createdBy: owner.user.id,
      createdByName: owner.user.name,
      canManage: true,
      version: 0,
    });
  });

  it("counts the estimate when nothing is agreed, and zero when neither is set", async () => {
    const { weddingId, owner } = await setupWedding();
    const estimated = await makeExpense(weddingId, owner, { estimatedAmountMinor: 2500000 });
    expect(estimated.costMinor).toBe(2500000);
    expect(estimated.remainingAmountMinor).toBe(2500000);
    const empty = await makeExpense(weddingId, owner, { title: "To be priced" });
    expect(empty.costMinor).toBe(0);
  });

  it("lets every role record an expense (owner decision 2026-10-10)", async () => {
    const { weddingId, owner } = await setupWedding();
    const admin = await addMember(weddingId, "admin");
    const member = await addMember(weddingId, "member");
    for (const who of [owner, admin, member]) {
      expect((await createExpense(weddingId, who, { title: "x", category: "other" })).status).toBe(
        201,
      );
    }
  });

  it("links an event and a vendor of the same wedding", async () => {
    const { weddingId, owner } = await setupWedding();
    const eventId = await makeEvent(weddingId, owner);
    const vendor = await makeVendor(weddingId, owner);
    const created = await makeExpense(weddingId, owner, { eventId, vendorId: vendor.id });
    expect(created).toMatchObject({
      eventId,
      eventName: "Haldi",
      vendorId: vendor.id,
      vendorName: "Lens & Light Studio",
    });
  });

  it.each([
    ["no title", { title: "  " }],
    ["a title over 200 characters", { title: "x".repeat(201) }],
    ["an unknown category", { category: "yachts" }],
    ["a negative amount", { agreedAmountMinor: -1 }],
    ["an amount with decimals (paise are whole numbers)", { agreedAmountMinor: 100.5 }],
    ["an impossible date", { expenseDate: "2027-02-30" }],
    ["a date with a time", { expenseDate: "2027-01-05T10:00:00Z" }],
    ["notes over 2000 characters", { notes: "n".repeat(2001) }],
    ["an unknown field", { weddingId: "0123456789abcdef01234567" }],
    ["a malformed event id", { eventId: "nope" }],
  ])("rejects %s", async (_label, patch) => {
    const { weddingId, owner } = await setupWedding();
    const result = await createExpense(weddingId, owner, {
      title: "Photography package",
      category: "photography_video",
      ...patch,
    });
    expect(result.status).toBe(400);
    expect(result.json.error.code).toBe("VALIDATION_ERROR");
  });

  it("answers 404 for an event or vendor that belongs to another wedding", async () => {
    const a = await setupWedding();
    const b = await setupWedding();
    const foreignEvent = await makeEvent(b.weddingId, b.owner);
    const foreignVendor = await makeVendor(b.weddingId, b.owner);
    const withEvent = await createExpense(a.weddingId, a.owner, {
      title: "x",
      category: "other",
      eventId: foreignEvent,
    });
    expect(withEvent.status).toBe(404);
    const withVendor = await createExpense(a.weddingId, a.owner, {
      title: "x",
      category: "other",
      vendorId: foreignVendor.id,
    });
    expect(withVendor.status).toBe(404);
  });

  it("is refused to someone who is not in the wedding, and to anyone signed out", async () => {
    const a = await setupWedding();
    const b = await setupWedding();
    const outsider = await createExpense(a.weddingId, b.owner, { title: "x", category: "other" });
    expect(outsider.status).toBe(403);
    expect(outsider.json.error.code).toBe("NOT_A_MEMBER");
    const signedOut = await createExpense(
      a.weddingId,
      { ...a.owner, cookie: "" },
      { title: "x", category: "other" },
    );
    expect(signedOut.status).toBe(401);
  });
});

describe("the own-or-any rule for editing and deleting", () => {
  it("lets a member change and delete only the expenses they recorded", async () => {
    const { weddingId, owner } = await setupWedding();
    const member = await addMember(weddingId, "member");
    const mine = await makeExpense(weddingId, member, { title: "Marigolds" });
    const ownersOwn = await makeExpense(weddingId, owner, { title: "Venue" });

    expect(mine.canManage).toBe(true);
    expect(
      (await patchExpense(weddingId, mine.id, member, { version: 0, title: "Marigold garlands" }))
        .status,
    ).toBe(200);

    const edit = await patchExpense(weddingId, ownersOwn.id, member, { version: 0, title: "Hax" });
    expect(edit.status).toBe(403);
    expect(edit.json.error.code).toBe("INSUFFICIENT_ROLE");
    const remove = await deleteExpense(weddingId, ownersOwn.id, member);
    expect(remove.status).toBe(403);

    expect((await deleteExpense(weddingId, mine.id, member)).status).toBe(200);
  });

  it("shows a member that other people's expenses are read-only (canManage)", async () => {
    const { weddingId, owner } = await setupWedding();
    const member = await addMember(weddingId, "member");
    await makeExpense(weddingId, owner, { title: "Venue" });
    const list = await listExpenses(weddingId, member);
    expect(list.json.data).toHaveLength(1);
    expect(list.json.data[0].canManage).toBe(false);
    const asOwner = await listExpenses(weddingId, owner);
    expect(asOwner.json.data[0].canManage).toBe(true);
  });

  it("lets an admin and the owner change and delete any expense", async () => {
    const { weddingId, owner } = await setupWedding();
    const admin = await addMember(weddingId, "admin");
    const member = await addMember(weddingId, "member");
    const fromMember = await makeExpense(weddingId, member, { title: "Dhol" });
    expect(
      (await patchExpense(weddingId, fromMember.id, admin, { version: 0, title: "Dhol troupe" }))
        .status,
    ).toBe(200);
    expect((await deleteExpense(weddingId, fromMember.id, owner)).status).toBe(200);
  });
});

describe("PATCH /weddings/:weddingId/expenses/:expenseId", () => {
  it("changes any subset of fields and clears optional ones with null", async () => {
    const { weddingId, owner } = await setupWedding();
    const eventId = await makeEvent(weddingId, owner);
    const created = await makeExpense(weddingId, owner, {
      eventId,
      agreedAmountMinor: 100000,
      expenseDate: "2027-01-05",
      notes: "note",
    });
    const result = await patchExpense(weddingId, created.id, owner, {
      version: created.version,
      agreedAmountMinor: null,
      estimatedAmountMinor: 120000,
      eventId: null,
      expenseDate: null,
      notes: null,
    });
    expect(result.status).toBe(200);
    expect(result.json.data).toMatchObject({
      agreedAmountMinor: null,
      estimatedAmountMinor: 120000,
      costMinor: 120000,
      eventId: null,
      expenseDate: null,
      notes: null,
      version: 1,
    });
  });

  it("rejects a stale version, an empty change and an unknown field", async () => {
    const { weddingId, owner } = await setupWedding();
    const created = await makeExpense(weddingId, owner);
    expect(
      (await patchExpense(weddingId, created.id, owner, { version: 0, title: "First" })).status,
    ).toBe(200);
    const stale = await patchExpense(weddingId, created.id, owner, { version: 0, title: "Second" });
    expect(stale.status).toBe(409);
    expect(stale.json.error.code).toBe("VERSION_CONFLICT");
    expect((await patchExpense(weddingId, created.id, owner, { version: 1 })).status).toBe(400);
    expect(
      (await patchExpense(weddingId, created.id, owner, { version: 1, createdBy: "x" })).status,
    ).toBe(400);
  });

  it("answers 404 for another wedding's event or vendor", async () => {
    const a = await setupWedding();
    const b = await setupWedding();
    const created = await makeExpense(a.weddingId, a.owner);
    const foreignEvent = await makeEvent(b.weddingId, b.owner);
    const result = await patchExpense(a.weddingId, created.id, a.owner, {
      version: 0,
      eventId: foreignEvent,
    });
    expect(result.status).toBe(404);
  });
});

describe("GET /weddings/:weddingId/expenses (list)", () => {
  it("filters by category, event, vendor and expense date", async () => {
    const { weddingId, owner } = await setupWedding();
    const eventId = await makeEvent(weddingId, owner);
    const vendor = await makeVendor(weddingId, owner);
    await makeExpense(weddingId, owner, {
      title: "A",
      category: "venue",
      eventId,
      expenseDate: "2027-01-05",
    });
    await makeExpense(weddingId, owner, {
      title: "B",
      category: "catering",
      vendorId: vendor.id,
      expenseDate: "2027-02-10",
    });
    await makeExpense(weddingId, owner, { title: "C", category: "venue" });

    const titles = async (query: string) =>
      (await listExpenses(weddingId, owner, query)).json.data
        .map((row: { title: string }) => row.title)
        .sort();
    expect(await titles("?category=venue")).toEqual(["A", "C"]);
    expect(await titles(`?eventId=${eventId}`)).toEqual(["A"]);
    expect(await titles(`?vendorId=${vendor.id}`)).toEqual(["B"]);
    expect(await titles("?from=2027-02-01")).toEqual(["B"]);
    expect(await titles("?to=2027-01-31")).toEqual(["A"]);
    expect(await titles("?from=2027-01-01&to=2027-12-31")).toEqual(["A", "B"]);
  });

  it("rejects unknown filters and an end date before the start date", async () => {
    const { weddingId, owner } = await setupWedding();
    expect((await listExpenses(weddingId, owner, "?minAmount=5")).status).toBe(400);
    expect((await listExpenses(weddingId, owner, "?from=2027-03-01&to=2027-02-01")).status).toBe(
      400,
    );
    expect((await listExpenses(weddingId, owner, "?limit=101")).status).toBe(400);
  });

  it("pages newest first with an opaque cursor", async () => {
    const { weddingId, owner } = await setupWedding();
    for (const title of ["one", "two", "three", "four", "five"]) {
      await makeExpense(weddingId, owner, { title });
    }
    const first = await listExpenses(weddingId, owner, "?limit=2");
    expect(first.json.data.map((row: { title: string }) => row.title)).toEqual(["five", "four"]);
    expect(first.json.meta.hasMore).toBe(true);
    const second = await listExpenses(
      weddingId,
      owner,
      `?limit=2&cursor=${first.json.meta.nextCursor}`,
    );
    expect(second.json.data.map((row: { title: string }) => row.title)).toEqual(["three", "two"]);
    const third = await listExpenses(
      weddingId,
      owner,
      `?limit=2&cursor=${second.json.meta.nextCursor}`,
    );
    expect(third.json.data.map((row: { title: string }) => row.title)).toEqual(["one"]);
    expect(third.json.meta.hasMore).toBe(false);
    expect((await listExpenses(weddingId, owner, "?cursor=garbage")).status).toBe(400);
  });

  it("includes what has been paid, from the payments, in one pass", async () => {
    const { weddingId, owner } = await setupWedding();
    const expense = await makeExpense(weddingId, owner, { agreedAmountMinor: 16500000 });
    await makePayment(weddingId, expense.id, owner, {
      amountMinor: 5000000,
      status: "paid",
    });
    await makePayment(weddingId, expense.id, owner, {
      amountMinor: 11500000,
      status: "pending",
      dueDate: "2027-02-10",
    });
    const list = await listExpenses(weddingId, owner);
    expect(list.json.data[0]).toMatchObject({
      paidAmountMinor: 5000000,
      remainingAmountMinor: 11500000,
    });
  });

  it("never returns another wedding's expenses, and no internal fields", async () => {
    const a = await setupWedding();
    const b = await setupWedding();
    await makeExpense(a.weddingId, a.owner, { title: "Mine" });
    await makeExpense(b.weddingId, b.owner, { title: "Theirs" });
    const list = await listExpenses(a.weddingId, a.owner);
    expect(list.json.data.map((row: { title: string }) => row.title)).toEqual(["Mine"]);
    const text = JSON.stringify(list.json);
    for (const forbidden of ["weddingId", "deletedAt", "deletedBy", "__v", "deletionReason"]) {
      expect(text).not.toContain(forbidden);
    }
  });
});

describe("GET /weddings/:weddingId/expenses/:expenseId", () => {
  it("returns the expense, its payments and the vendor, with the over-payment warning", async () => {
    const { weddingId, owner } = await setupWedding();
    const vendor = await makeVendor(weddingId, owner, {
      contact: { phone: "+919825014820", personName: "Rohan Mehta" },
    });
    const expense = await makeExpense(weddingId, owner, {
      vendorId: vendor.id,
      agreedAmountMinor: 16500000,
    });
    await makePayment(weddingId, expense.id, owner, { amountMinor: 5000000, status: "paid" });
    await makePayment(weddingId, expense.id, owner, {
      amountMinor: 11500000,
      status: "pending",
      dueDate: "2027-02-10",
    });
    const calm = await getExpense(weddingId, expense.id, owner);
    expect(calm.status).toBe(200);
    expect(calm.json.data.payments).toHaveLength(2);
    expect(calm.json.data.exceedsAgreedAmount).toBe(false);
    expect(calm.json.data.scheduledAmountMinor).toBe(16500000);
    expect(calm.json.data.vendor).toMatchObject({
      name: "Lens & Light Studio",
      phone: "+919825014820",
    });

    await makePayment(weddingId, expense.id, owner, { amountMinor: 1500000, status: "pending" });
    const over = await getExpense(weddingId, expense.id, owner);
    expect(over.json.data.exceedsAgreedAmount).toBe(true);
  });

  it("shows a member the expense and its payments, but not the vendor's phone", async () => {
    const { weddingId, owner } = await setupWedding();
    const member = await addMember(weddingId, "member");
    const vendor = await makeVendor(weddingId, owner, { contact: { phone: "+919825014820" } });
    const expense = await makeExpense(weddingId, owner, { vendorId: vendor.id });
    await makePayment(weddingId, expense.id, owner, { amountMinor: 100, status: "paid" });
    const result = await getExpense(weddingId, expense.id, member);
    expect(result.status).toBe(200);
    expect(result.json.data.payments).toHaveLength(1);
    expect(result.json.data.vendor).toMatchObject({ name: "Lens & Light Studio", phone: null });
  });

  it("answers 404 for a missing expense, one in another wedding and one that was deleted", async () => {
    const a = await setupWedding();
    const b = await setupWedding();
    const theirs = await makeExpense(b.weddingId, b.owner);
    expect((await getExpense(a.weddingId, theirs.id, a.owner)).status).toBe(404);
    expect((await getExpense(a.weddingId, "0123456789abcdef01234567", a.owner)).status).toBe(404);
    const mine = await makeExpense(a.weddingId, a.owner);
    await deleteExpense(a.weddingId, mine.id, a.owner);
    expect((await getExpense(a.weddingId, mine.id, a.owner)).status).toBe(404);
    // Another wedding's member cannot even reach the route for this wedding.
    expect((await getExpense(a.weddingId, mine.id, b.owner)).status).toBe(403);
  });
});

describe("DELETE /weddings/:weddingId/expenses/:expenseId", () => {
  it("soft deletes the expense and its payments together", async () => {
    const { weddingId, owner } = await setupWedding();
    const expense = await makeExpense(weddingId, owner, { agreedAmountMinor: 100000 });
    await makePayment(weddingId, expense.id, owner, { amountMinor: 40000, status: "paid" });
    await makePayment(weddingId, expense.id, owner, { amountMinor: 60000, status: "pending" });
    const result = await deleteExpense(weddingId, expense.id, owner);
    expect(result.status).toBe(200);
    expect(result.json.data).toMatchObject({ id: expense.id, paymentsRemoved: 2 });
    expect((await listExpenses(weddingId, owner)).json.data).toEqual([]);
    expect((await deleteExpense(weddingId, expense.id, owner)).status).toBe(404);
  });
});

describe("deleting an event keeps its expenses", () => {
  it("makes them wedding-level and reports how many", async () => {
    const { weddingId, owner } = await setupWedding();
    const eventId = await makeEvent(weddingId, owner);
    const expense = await makeExpense(weddingId, owner, { eventId, agreedAmountMinor: 500 });
    const result = await call(deleteEventRoute, {
      method: "DELETE",
      cookie: owner.cookie,
      params: { weddingId, eventId },
    });
    expect(result.status).toBe(200);
    expect(result.json.data.expensesUnlinked).toBe(1);
    const after = await getExpense(weddingId, expense.id, owner);
    expect(after.json.data.expense).toMatchObject({ eventId: null, eventName: null });
  });
});
