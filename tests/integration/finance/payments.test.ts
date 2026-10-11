import { describe, expect, it } from "vitest";
import { setupTestDatabase } from "../../setup/database";
import { addMember, setupWedding } from "../../setup/wedding";
import {
  createPayment,
  deletePayment,
  getExpense,
  listExpenses,
  listPayments,
  makeExpense,
  makePayment,
  patchPayment,
} from "./helpers";

setupTestDatabase();

async function setup() {
  const { weddingId, owner } = await setupWedding();
  const admin = await addMember(weddingId, "admin");
  const member = await addMember(weddingId, "member");
  const expense = await makeExpense(weddingId, owner, { agreedAmountMinor: 16500000 });
  return { weddingId, owner, admin, member, expense };
}

describe("POST /weddings/:weddingId/expenses/:expenseId/payments", () => {
  it("records a paid payment, defaulting when it was paid to now", async () => {
    const { weddingId, owner, expense } = await setup();
    const before = Date.now();
    const result = await createPayment(weddingId, expense.id, owner, {
      amountMinor: 5000000,
      status: "paid",
      method: "upi",
      reference: "UPI-88429104",
      notes: "Advance",
    });
    expect(result.status).toBe(201);
    expect(result.json.data.payment).toMatchObject({
      expenseId: expense.id,
      amountMinor: 5000000,
      status: "paid",
      method: "upi",
      reference: "UPI-88429104",
      notes: "Advance",
      dueDate: null,
      isOverdue: false,
      version: 0,
    });
    expect(new Date(result.json.data.payment.paidAt).getTime()).toBeGreaterThanOrEqual(before);
    expect(result.json.data.exceedsAgreedAmount).toBe(false);
  });

  it("keeps a paid date the client sends", async () => {
    const { weddingId, owner, expense } = await setup();
    const result = await createPayment(weddingId, expense.id, owner, {
      amountMinor: 100,
      status: "paid",
      paidAt: "2027-01-05T11:00:00.000Z",
    });
    expect(result.json.data.payment.paidAt).toBe("2027-01-05T11:00:00.000Z");
  });

  it("records a pending payment with a due date, and flags it once overdue", async () => {
    const { weddingId, owner, expense } = await setup();
    const future = await makePayment(weddingId, expense.id, owner, {
      amountMinor: 100,
      dueDate: "2999-01-01",
    });
    expect(future.payment).toMatchObject({ status: "pending", paidAt: null, isOverdue: false });
    const past = await makePayment(weddingId, expense.id, owner, {
      amountMinor: 100,
      dueDate: "2000-01-01",
    });
    expect(past.payment.isOverdue).toBe(true);
  });

  it("lets owners and admins record payments but not members", async () => {
    const { weddingId, owner, admin, member, expense } = await setup();
    for (const who of [owner, admin]) {
      expect((await createPayment(weddingId, expense.id, who, { amountMinor: 100 })).status).toBe(
        201,
      );
    }
    const refused = await createPayment(weddingId, expense.id, member, { amountMinor: 100 });
    expect(refused.status).toBe(403);
    expect(refused.json.error.code).toBe("INSUFFICIENT_ROLE");
  });

  it.each([
    ["zero", { amountMinor: 0 }],
    ["a negative amount", { amountMinor: -5 }],
    ["an amount with decimals", { amountMinor: 10.5 }],
    ["a missing amount", {}],
    ["an unknown status", { amountMinor: 1, status: "refunded" }],
    ["an unknown method", { amountMinor: 1, method: "bitcoin" }],
    ["a bad due date", { amountMinor: 1, dueDate: "10 Feb 2027" }],
    ["a paid date on a pending payment", { amountMinor: 1, paidAt: "2027-01-05T11:00:00Z" }],
    ["a reference over 100 characters", { amountMinor: 1, reference: "r".repeat(101) }],
    ["notes over 500 characters", { amountMinor: 1, notes: "n".repeat(501) }],
    ["a card number field", { amountMinor: 1, cardNumber: "4111111111111111" }],
    ["a bank account field", { amountMinor: 1, accountNumber: "1234567890" }],
  ])("rejects %s", async (_label, body) => {
    const { weddingId, owner, expense } = await setup();
    const result = await createPayment(weddingId, expense.id, owner, body);
    expect(result.status).toBe(400);
    expect(result.json.error.code).toBe("VALIDATION_ERROR");
  });

  it("warns, but does not refuse, when payments go past the agreed amount", async () => {
    const { weddingId, owner, expense } = await setup();
    await makePayment(weddingId, expense.id, owner, { amountMinor: 16500000, status: "paid" });
    const extra = await createPayment(weddingId, expense.id, owner, {
      amountMinor: 1500000,
      status: "paid",
    });
    expect(extra.status).toBe(201);
    expect(extra.json.data.exceedsAgreedAmount).toBe(true);
    expect(extra.json.data.scheduledAmountMinor).toBe(18000000);
    // Overpaid: nothing left to pay, never a negative balance.
    const list = await listExpenses(weddingId, owner);
    expect(list.json.data[0]).toMatchObject({
      paidAmountMinor: 18000000,
      remainingAmountMinor: 0,
    });
  });

  it("does not count a cancelled payment toward what is paid or scheduled", async () => {
    const { weddingId, owner, expense } = await setup();
    await makePayment(weddingId, expense.id, owner, { amountMinor: 2000000, status: "cancelled" });
    const result = await makePayment(weddingId, expense.id, owner, {
      amountMinor: 5000000,
      status: "paid",
    });
    expect(result.scheduledAmountMinor).toBe(5000000);
    const detail = await getExpense(weddingId, expense.id, owner);
    expect(detail.json.data.expense.paidAmountMinor).toBe(5000000);
  });

  it("answers 404 for an expense in another wedding, and another wedding's member gets 403", async () => {
    const a = await setup();
    const b = await setup();
    expect(
      (await createPayment(a.weddingId, b.expense.id, a.owner, { amountMinor: 100 })).status,
    ).toBe(404);
    expect(
      (await createPayment(a.weddingId, a.expense.id, b.owner, { amountMinor: 100 })).status,
    ).toBe(403);
  });
});

describe("GET .../expenses/:expenseId/payments", () => {
  it("lets every member read the payments", async () => {
    const { weddingId, owner, member, expense } = await setup();
    await makePayment(weddingId, expense.id, owner, { amountMinor: 100, status: "paid" });
    const result = await listPayments(weddingId, expense.id, member);
    expect(result.status).toBe(200);
    expect(result.json.data).toHaveLength(1);
    expect(JSON.stringify(result.json)).not.toContain("weddingId");
  });
});

describe("PATCH /weddings/:weddingId/payments/:paymentId", () => {
  it("marks a pending payment paid, recording when, and back to pending clears it", async () => {
    const { weddingId, owner, expense } = await setup();
    const created = await makePayment(weddingId, expense.id, owner, {
      amountMinor: 11500000,
      dueDate: "2027-02-10",
    });
    const paid = await patchPayment(weddingId, created.payment.id, owner, {
      version: created.payment.version,
      status: "paid",
      method: "bank_transfer",
    });
    expect(paid.status).toBe(200);
    expect(paid.json.data.payment).toMatchObject({ status: "paid", method: "bank_transfer" });
    expect(paid.json.data.payment.paidAt).not.toBeNull();

    const back = await patchPayment(weddingId, created.payment.id, owner, {
      version: paid.json.data.payment.version,
      status: "pending",
    });
    expect(back.json.data.payment).toMatchObject({ status: "pending", paidAt: null });
  });

  it("changes the amount and clears optional fields with null", async () => {
    const { weddingId, owner, expense } = await setup();
    const created = await makePayment(weddingId, expense.id, owner, {
      amountMinor: 100,
      dueDate: "2027-02-10",
      reference: "INV-1",
      method: "cheque",
    });
    const result = await patchPayment(weddingId, created.payment.id, owner, {
      version: 0,
      amountMinor: 250,
      dueDate: null,
      reference: null,
      method: null,
    });
    expect(result.json.data.payment).toMatchObject({
      amountMinor: 250,
      dueDate: null,
      reference: null,
      method: null,
    });
  });

  it("refuses a paid date on a payment that is not paid (422) and a stale version (409)", async () => {
    const { weddingId, owner, expense } = await setup();
    const created = await makePayment(weddingId, expense.id, owner, { amountMinor: 100 });
    const noDate = await patchPayment(weddingId, created.payment.id, owner, {
      version: 0,
      paidAt: "2027-01-05T11:00:00Z",
    });
    expect(noDate.status).toBe(422);
    expect(noDate.json.error.code).toBe("BUSINESS_RULE_VIOLATION");
    await patchPayment(weddingId, created.payment.id, owner, { version: 0, amountMinor: 200 });
    const stale = await patchPayment(weddingId, created.payment.id, owner, {
      version: 0,
      amountMinor: 300,
    });
    expect(stale.status).toBe(409);
    expect(stale.json.error.code).toBe("VERSION_CONFLICT");
  });

  it("is refused to members and 404 across weddings", async () => {
    const a = await setup();
    const b = await setup();
    const created = await makePayment(a.weddingId, a.expense.id, a.owner, { amountMinor: 100 });
    const asMember = await patchPayment(a.weddingId, created.payment.id, a.member, {
      version: 0,
      amountMinor: 1,
    });
    expect(asMember.status).toBe(403);
    // B's owner names A's payment in B's own wedding path: it simply does not exist there.
    const cross = await patchPayment(b.weddingId, created.payment.id, b.owner, {
      version: 0,
      amountMinor: 1,
    });
    expect(cross.status).toBe(404);
    const crossDelete = await deletePayment(b.weddingId, created.payment.id, b.owner);
    expect(crossDelete.status).toBe(404);
  });
});

describe("DELETE /weddings/:weddingId/payments/:paymentId", () => {
  it("removes the payment and its effect on the totals", async () => {
    const { weddingId, owner, expense } = await setup();
    const created = await makePayment(weddingId, expense.id, owner, {
      amountMinor: 5000000,
      status: "paid",
    });
    const result = await deletePayment(weddingId, created.payment.id, owner);
    expect(result.status).toBe(200);
    const detail = await getExpense(weddingId, expense.id, owner);
    expect(detail.json.data.payments).toEqual([]);
    expect(detail.json.data.expense.paidAmountMinor).toBe(0);
    expect((await deletePayment(weddingId, created.payment.id, owner)).status).toBe(404);
  });

  it("is refused to members", async () => {
    const { weddingId, owner, member, expense } = await setup();
    const created = await makePayment(weddingId, expense.id, owner, { amountMinor: 100 });
    expect((await deletePayment(weddingId, created.payment.id, member)).status).toBe(403);
  });
});
