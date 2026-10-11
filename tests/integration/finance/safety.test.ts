import { describe, expect, it } from "vitest";
import { DELETE as deleteWedding } from "@/app/api/v1/weddings/[weddingId]/route";
import { call } from "../../setup/http";
import { setupTestDatabase } from "../../setup/database";
import { addMember, setupWedding } from "../../setup/wedding";
import {
  createExpense,
  createPayment,
  createVendor,
  deleteExpense,
  deletePayment,
  deleteVendor,
  expenseSummary,
  getExpense,
  getVendor,
  listExpenses,
  listPayments,
  listVendors,
  makeExpense,
  makePayment,
  makeVendor,
  patchExpense,
  patchPayment,
  patchVendor,
  searchPlaces,
} from "./helpers";

setupTestDatabase();

// The wedding-isolation guarantees (Architecture §45) applied to everything Phase 4 added.

describe("another wedding's finance data is out of reach", () => {
  it("denies and hides every expense, payment and vendor route across weddings", async () => {
    const a = await setupWedding("Wedding A");
    const b = await setupWedding("Wedding B");
    const expense = await makeExpense(b.weddingId, b.owner, { agreedAmountMinor: 100 });
    const payment = await makePayment(b.weddingId, expense.id, b.owner, { amountMinor: 50 });
    const vendor = await makeVendor(b.weddingId, b.owner);

    // 1. A's owner against B's wedding id: not a member there at all.
    const intruder = a.owner;
    const asIntruder = [
      await listExpenses(b.weddingId, intruder),
      await createExpense(b.weddingId, intruder, { title: "x", category: "other" }),
      await expenseSummary(b.weddingId, intruder),
      await getExpense(b.weddingId, expense.id, intruder),
      await patchExpense(b.weddingId, expense.id, intruder, { version: 0, title: "x" }),
      await deleteExpense(b.weddingId, expense.id, intruder),
      await listPayments(b.weddingId, expense.id, intruder),
      await createPayment(b.weddingId, expense.id, intruder, { amountMinor: 1 }),
      await patchPayment(b.weddingId, payment.payment.id, intruder, { version: 0, amountMinor: 1 }),
      await deletePayment(b.weddingId, payment.payment.id, intruder),
      await listVendors(b.weddingId, intruder),
      await createVendor(b.weddingId, intruder, { name: "x", category: "other" }),
      await getVendor(b.weddingId, vendor.id, intruder),
      await patchVendor(b.weddingId, vendor.id, intruder, { version: 0, name: "x" }),
      await deleteVendor(b.weddingId, vendor.id, intruder),
      await searchPlaces(b.weddingId, intruder, "photographers"),
    ];
    for (const response of asIntruder) {
      expect(response.status).toBe(403);
      expect(response.json.error.code).toBe("NOT_A_MEMBER");
    }

    // 2. A's owner in A's own wedding, naming B's ids: the ids simply do not exist there.
    const guessed = [
      await getExpense(a.weddingId, expense.id, intruder),
      await patchExpense(a.weddingId, expense.id, intruder, { version: 0, title: "x" }),
      await deleteExpense(a.weddingId, expense.id, intruder),
      await listPayments(a.weddingId, expense.id, intruder),
      await createPayment(a.weddingId, expense.id, intruder, { amountMinor: 1 }),
      await patchPayment(a.weddingId, payment.payment.id, intruder, { version: 0, amountMinor: 1 }),
      await deletePayment(a.weddingId, payment.payment.id, intruder),
      await getVendor(a.weddingId, vendor.id, intruder),
      await patchVendor(a.weddingId, vendor.id, intruder, { version: 0, name: "x" }),
      await deleteVendor(a.weddingId, vendor.id, intruder),
    ];
    for (const response of guessed) {
      expect(response.status).toBe(404);
      expect(response.json.error.code).toBe("NOT_FOUND");
    }

    // 3. Nothing of B's changed.
    const still = await getExpense(b.weddingId, expense.id, b.owner);
    expect(still.json.data.expense).toMatchObject({ title: "Photography package", version: 0 });
    expect(still.json.data.payments).toHaveLength(1);
    expect((await getVendor(b.weddingId, vendor.id, b.owner)).json.data.vendor.name).toBe(
      "Lens & Light Studio",
    );
  });

  it("refuses everything to someone signed out", async () => {
    const { weddingId, owner } = await setupWedding();
    const expense = await makeExpense(weddingId, owner);
    const vendor = await makeVendor(weddingId, owner);
    const nobody = { ...owner, cookie: "" };
    const responses = [
      await listExpenses(weddingId, nobody),
      await expenseSummary(weddingId, nobody),
      await getExpense(weddingId, expense.id, nobody),
      await listPayments(weddingId, expense.id, nobody),
      await listVendors(weddingId, nobody),
      await getVendor(weddingId, vendor.id, nobody),
      await searchPlaces(weddingId, nobody, "photographers"),
    ];
    for (const response of responses) {
      expect(response.status).toBe(401);
      expect(response.json.error.code).toBe("AUTHENTICATION_REQUIRED");
    }
  });
});

describe("a deleted wedding's finance data is out of reach", () => {
  it("answers 403 to every finance route once the wedding is deleted", async () => {
    const { weddingId, owner, title } = await setupWedding();
    const member = await addMember(weddingId, "member");
    const expense = await makeExpense(weddingId, owner, { agreedAmountMinor: 100 });
    const vendor = await makeVendor(weddingId, owner);
    const deleted = await call(deleteWedding, {
      method: "DELETE",
      cookie: owner.cookie,
      params: { weddingId },
      body: { confirm: title },
    });
    expect(deleted.status).toBe(200);

    for (const person of [owner, member]) {
      const attempts = [
        await listExpenses(weddingId, person),
        await getExpense(weddingId, expense.id, person),
        await expenseSummary(weddingId, person),
        await createExpense(weddingId, person, { title: "after", category: "other" }),
        await listVendors(weddingId, person),
        await getVendor(weddingId, vendor.id, person),
      ];
      for (const response of attempts) expect(response.status).toBe(403);
    }
  });
});

describe("what finance responses never contain", () => {
  const FORBIDDEN = [
    "tokenHash",
    "tokenEnc",
    "passwordAuth",
    "deletedBy",
    "deletionReason",
    "purgeAt",
    "purgeAfter",
    "nameNormalized",
    "emailNormalized",
    '"weddingId"',
    '"__v"',
    '"deletedAt"',
  ];

  it("holds for every read and write, for owners, admins and members", async () => {
    const { weddingId, owner } = await setupWedding();
    const admin = await addMember(weddingId, "admin");
    const member = await addMember(weddingId, "member");
    const vendor = await makeVendor(weddingId, owner, {
      contact: { personName: "Rohan", phone: "+919825014820" },
      location: { label: "Studio", address: { line1: "Nanpura", city: "Surat" }, placeId: "p1" },
    });
    const expense = await makeExpense(weddingId, owner, {
      vendorId: vendor.id,
      agreedAmountMinor: 16500000,
    });
    const paid = await createPayment(weddingId, expense.id, owner, {
      amountMinor: 5000000,
      status: "paid",
      reference: "UPI-1",
    });
    expect(paid.status).toBe(201);

    const responses = [paid];
    for (const person of [owner, admin, member]) {
      responses.push(
        await listExpenses(weddingId, person),
        await getExpense(weddingId, expense.id, person),
        await expenseSummary(weddingId, person),
        await listPayments(weddingId, expense.id, person),
      );
    }
    for (const person of [owner, admin]) {
      responses.push(
        await listVendors(weddingId, person),
        await getVendor(weddingId, vendor.id, person),
      );
    }
    for (const response of responses) {
      expect(response.status).toBeLessThan(400);
      const body = JSON.stringify(response.json);
      for (const word of FORBIDDEN) expect(body, word).not.toContain(word);
    }
  });

  it("keeps vendor contact details away from members in every expense response", async () => {
    const { weddingId, owner } = await setupWedding();
    const member = await addMember(weddingId, "member");
    const vendor = await makeVendor(weddingId, owner, {
      contact: { personName: "Rohan Mehta", phone: "+919825014820", email: "rohan@example.com" },
      location: { address: { line1: "Studio 402, Nanpura" } },
      notes: "Quoted 1.65L, advance 30%",
    });
    const expense = await makeExpense(weddingId, owner, { vendorId: vendor.id });
    await makePayment(weddingId, expense.id, owner, { amountMinor: 100, dueDate: "2999-01-01" });

    const responses = [
      await listExpenses(weddingId, member),
      await getExpense(weddingId, expense.id, member),
      await expenseSummary(weddingId, member),
      await listPayments(weddingId, expense.id, member),
    ];
    for (const response of responses) {
      const body = JSON.stringify(response.json);
      for (const secret of [
        "+919825014820",
        "rohan@example.com",
        "Rohan Mehta",
        "Studio 402",
        "Quoted 1.65L",
      ]) {
        expect(body, secret).not.toContain(secret);
      }
    }
  });
});

describe("a member cannot widen their own powers through the API", () => {
  it("cannot reassign an expense to look like their own, and cannot send createdBy", async () => {
    const { weddingId, owner } = await setupWedding();
    const member = await addMember(weddingId, "member");
    const ownersExpense = await makeExpense(weddingId, owner, { title: "Venue" });
    const forged = await createExpense(weddingId, member, {
      title: "Forged",
      category: "other",
      createdBy: owner.user.id,
    });
    expect(forged.status).toBe(400);
    const sneaky = await patchExpense(weddingId, ownersExpense.id, member, {
      version: 0,
      createdBy: member.user.id,
    });
    expect(sneaky.status).toBe(400);
    expect(
      (await patchExpense(weddingId, ownersExpense.id, member, { version: 0, title: "Mine now" }))
        .status,
    ).toBe(403);
  });

  it("records the real author of an expense whatever the body says", async () => {
    const { weddingId, owner } = await setupWedding();
    const member = await addMember(weddingId, "member");
    const result = await createExpense(weddingId, member, { title: "Dhol", category: "other" });
    expect(result.json.data.createdBy).toBe(member.user.id);
    expect((await getExpense(weddingId, result.json.data.id, owner)).status).toBe(200);
  });
});
