import { describe, expect, it } from "vitest";
import { setupTestDatabase } from "../../setup/database";
import { addMember, setupWedding } from "../../setup/wedding";
import {
  deleteExpense,
  expenseSummary,
  makeEvent,
  makeExpense,
  makePayment,
  makeVendor,
  setBudget,
} from "./helpers";

setupTestDatabase();

describe("GET /weddings/:weddingId/expenses/summary", () => {
  it("is all zeros for a wedding with no expenses", async () => {
    const { weddingId, owner } = await setupWedding();
    const result = await expenseSummary(weddingId, owner);
    expect(result.status).toBe(200);
    expect(result.json.data).toMatchObject({
      currency: "INR",
      budgetTotalMinor: null,
      committedPercent: null,
      expenseCount: 0,
      totalCostMinor: 0,
      totalPaidMinor: 0,
      stillToPayMinor: 0,
      byCategory: [],
      byEvent: [],
      dueSoon: { count: 0, totalMinor: 0, items: [] },
      overdue: { count: 0, totalMinor: 0 },
    });
  });

  it("adds up cost, paid and still-to-pay from the expenses and payments", async () => {
    const { weddingId, owner } = await setupWedding();
    await setBudget(weddingId, owner, 100000000);
    // Photography: agreed 1,65,000, paid 50,000.
    const photo = await makeExpense(weddingId, owner, {
      category: "photography_video",
      estimatedAmountMinor: 18000000,
      agreedAmountMinor: 16500000,
    });
    await makePayment(weddingId, photo.id, owner, { amountMinor: 5000000, status: "paid" });
    // Venue: fully paid.
    const venue = await makeExpense(weddingId, owner, {
      title: "Venue",
      category: "venue",
      agreedAmountMinor: 85000000,
    });
    await makePayment(weddingId, venue.id, owner, { amountMinor: 85000000, status: "paid" });
    // Flowers: only an estimate, nothing paid.
    await makeExpense(weddingId, owner, {
      title: "Marigolds",
      category: "decor",
      estimatedAmountMinor: 2500000,
    });

    const { data } = (await expenseSummary(weddingId, owner)).json;
    expect(data).toMatchObject({
      expenseCount: 3,
      totalCostMinor: 16500000 + 85000000 + 2500000,
      totalPaidMinor: 5000000 + 85000000,
      stillToPayMinor: 11500000 + 0 + 2500000,
      budgetTotalMinor: 100000000,
    });
    // 1,04,00,000 of 1,00,00,000: over budget shows as more than 100%.
    expect(data.committedPercent).toBe(104);
  });

  it("does not let an overpaid expense reduce what is still to pay elsewhere", async () => {
    const { weddingId, owner } = await setupWedding();
    const a = await makeExpense(weddingId, owner, { agreedAmountMinor: 1000 });
    await makePayment(weddingId, a.id, owner, { amountMinor: 1500, status: "paid" });
    await makeExpense(weddingId, owner, { title: "B", agreedAmountMinor: 2000 });
    const { data } = (await expenseSummary(weddingId, owner)).json;
    expect(data.totalPaidMinor).toBe(1500);
    expect(data.stillToPayMinor).toBe(2000);
  });

  it("groups spending by category (largest first) and by event, with unlinked items last", async () => {
    const { weddingId, owner } = await setupWedding();
    const haldi = await makeEvent(weddingId, owner, "Haldi");
    await makeExpense(weddingId, owner, {
      title: "Venue",
      category: "venue",
      eventId: haldi,
      agreedAmountMinor: 7500,
    });
    await makeExpense(weddingId, owner, {
      title: "Catering",
      category: "catering",
      agreedAmountMinor: 2000,
    });
    await makeExpense(weddingId, owner, {
      title: "More catering",
      category: "catering",
      agreedAmountMinor: 500,
    });
    const { data } = (await expenseSummary(weddingId, owner)).json;
    expect(data.byCategory).toEqual([
      { category: "venue", count: 1, costMinor: 7500, paidMinor: 0 },
      { category: "catering", count: 2, costMinor: 2500, paidMinor: 0 },
    ]);
    expect(data.byEvent).toEqual([
      { eventId: haldi, name: "Haldi", costMinor: 7500, sharePercent: 75 },
      { eventId: null, name: "Unlinked items", costMinor: 2500, sharePercent: 25 },
    ]);
  });

  it("lists payments due within 30 days with overdue ones first, and counts overdue separately", async () => {
    const { weddingId, owner } = await setupWedding();
    const vendor = await makeVendor(weddingId, owner);
    const expense = await makeExpense(weddingId, owner, {
      title: "Photography package",
      vendorId: vendor.id,
      agreedAmountMinor: 99999999,
    });
    const day = (offset: number) =>
      new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
    await makePayment(weddingId, expense.id, owner, { amountMinor: 11500000, dueDate: day(-3) });
    await makePayment(weddingId, expense.id, owner, { amountMinor: 7500000, dueDate: day(5) });
    // Beyond the window, already paid and cancelled payments are not "due".
    await makePayment(weddingId, expense.id, owner, { amountMinor: 1, dueDate: day(90) });
    await makePayment(weddingId, expense.id, owner, {
      amountMinor: 2,
      status: "paid",
      dueDate: day(2),
    });
    await makePayment(weddingId, expense.id, owner, {
      amountMinor: 3,
      status: "cancelled",
      dueDate: day(2),
    });

    const { data } = (await expenseSummary(weddingId, owner)).json;
    expect(data.dueSoon.windowDays).toBe(30);
    expect(data.dueSoon.count).toBe(2);
    expect(data.dueSoon.totalMinor).toBe(19000000);
    expect(data.dueSoon.items.map((item: { amountMinor: number }) => item.amountMinor)).toEqual([
      11500000, 7500000,
    ]);
    expect(data.dueSoon.items[0]).toMatchObject({
      expenseTitle: "Photography package",
      vendorName: "Lens & Light Studio",
      isOverdue: true,
    });
    expect(data.overdue).toEqual({ count: 1, totalMinor: 11500000 });
  });

  it("forgets everything about a deleted expense, payments included", async () => {
    const { weddingId, owner } = await setupWedding();
    const expense = await makeExpense(weddingId, owner, { agreedAmountMinor: 5000 });
    await makePayment(weddingId, expense.id, owner, {
      amountMinor: 1000,
      dueDate: new Date().toISOString().slice(0, 10),
    });
    await makePayment(weddingId, expense.id, owner, { amountMinor: 2000, status: "paid" });
    await deleteExpense(weddingId, expense.id, owner);
    const { data } = (await expenseSummary(weddingId, owner)).json;
    expect(data).toMatchObject({ expenseCount: 0, totalCostMinor: 0, totalPaidMinor: 0 });
    expect(data.dueSoon.count).toBe(0);
  });

  it("shows the overall budget to owners and admins but never to members", async () => {
    const { weddingId, owner } = await setupWedding();
    const admin = await addMember(weddingId, "admin");
    const member = await addMember(weddingId, "member");
    await setBudget(weddingId, owner, 2500000000);
    await makeExpense(weddingId, owner, { agreedAmountMinor: 100 });
    const asOwner = (await expenseSummary(weddingId, owner)).json.data;
    const asAdmin = (await expenseSummary(weddingId, admin)).json.data;
    const asMember = (await expenseSummary(weddingId, member)).json.data;
    expect(asOwner.budgetTotalMinor).toBe(2500000000);
    expect(asAdmin.budgetTotalMinor).toBe(2500000000);
    expect(asMember.budgetTotalMinor).toBeNull();
    expect(asMember.committedPercent).toBeNull();
    // Everything else is the same for the member (they see all expenses).
    expect(asMember.totalCostMinor).toBe(asOwner.totalCostMinor);
    expect(JSON.stringify(asMember)).not.toContain("2500000000");
  });

  it("never mixes in another wedding's expenses", async () => {
    const a = await setupWedding();
    const b = await setupWedding();
    await makeExpense(a.weddingId, a.owner, { agreedAmountMinor: 100 });
    await makeExpense(b.weddingId, b.owner, { agreedAmountMinor: 999999 });
    const { data } = (await expenseSummary(a.weddingId, a.owner)).json;
    expect(data.totalCostMinor).toBe(100);
    expect(data.expenseCount).toBe(1);
    expect((await expenseSummary(a.weddingId, b.owner)).status).toBe(403);
  });
});
