import { describe, expect, it } from "vitest";
import { resolveSession } from "@/modules/auth/session.service";
import { getDashboard } from "@/modules/dashboard/dashboard.service";
import {
  getEventPage,
  getExpensePage,
  getExpensesPage,
  getVendorPage,
  getVendorsPage,
} from "@/modules/dashboard/workspace-pages.service";
import { setupTestDatabase } from "../../setup/database";
import { addMember, setupWedding } from "../../setup/wedding";
import {
  makeEvent,
  makeExpense,
  makePayment,
  makeVendor,
  patchVendor,
  setBudget,
} from "../finance/helpers";

setupTestDatabase();

async function authFor(cookie: string) {
  const auth = await resolveSession(cookie.split("=")[1]);
  if (!auth) throw new Error("no session");
  return auth;
}

const dayOffset = (days: number) =>
  new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

describe("getExpensesPage", () => {
  it("gives the owner the budget, every expense and the choices the form needs", async () => {
    const { weddingId, owner } = await setupWedding();
    await setBudget(weddingId, owner, 2500000000);
    const eventId = await makeEvent(weddingId, owner, "Sangeet");
    const vendor = await makeVendor(weddingId, owner);
    const expense = await makeExpense(weddingId, owner, {
      vendorId: vendor.id,
      eventId,
      agreedAmountMinor: 16500000,
    });
    await makePayment(weddingId, expense.id, owner, { amountMinor: 5000000, status: "paid" });

    const page = await getExpensesPage(await authFor(owner.cookie));
    expect(page).toMatchObject({
      weddingId,
      currency: "INR",
      timezone: "Asia/Kolkata",
      canRecordPayments: true,
      canSeeVendors: true,
      canSetBudget: true,
    });
    expect(page?.summary).toMatchObject({
      budgetTotalMinor: 2500000000,
      totalCostMinor: 16500000,
      totalPaidMinor: 5000000,
      stillToPayMinor: 11500000,
    });
    expect(page?.expenses).toHaveLength(1);
    expect(page?.expenses[0]).toMatchObject({
      paidAmountMinor: 5000000,
      vendorName: "Lens & Light Studio",
      eventName: "Sangeet",
    });
    expect(page?.events).toEqual([{ id: eventId, name: "Sangeet" }]);
    expect(page?.vendors).toEqual([{ id: vendor.id, name: "Lens & Light Studio" }]);
  });

  it("shows a member every expense and the vendor names, but no budget and no payment powers", async () => {
    const { weddingId, owner } = await setupWedding();
    const member = await addMember(weddingId, "member");
    await setBudget(weddingId, owner, 2500000000);
    const vendor = await makeVendor(weddingId, owner, { contact: { phone: "+919825014820" } });
    await makeExpense(weddingId, owner, { vendorId: vendor.id, agreedAmountMinor: 100 });

    const page = await getExpensesPage(await authFor(member.cookie));
    expect(page).toMatchObject({
      canRecordPayments: false,
      canSeeVendors: false,
      canSetBudget: false,
    });
    expect(page?.summary.budgetTotalMinor).toBeNull();
    expect(page?.expenses).toHaveLength(1);
    expect(page?.expenses[0]?.canManage).toBe(false);
    // The vendor choices are names only: nothing else about a vendor reaches a member.
    expect(page?.vendors).toEqual([{ id: vendor.id, name: "Lens & Light Studio" }]);
    expect(JSON.stringify(page)).not.toContain("+919825014820");
    expect(JSON.stringify(page)).not.toContain("2500000000");
  });

  it("is null for someone with no wedding", async () => {
    const { signUpUser } = await import("../../setup/auth");
    const { cookie } = await signUpUser();
    expect(await getExpensesPage(await authFor(cookie))).toBeNull();
  });
});

describe("getExpensePage", () => {
  it("returns the detail, and 'not_found' for an id that is not this wedding's", async () => {
    const a = await setupWedding();
    const b = await setupWedding();
    const expense = await makeExpense(a.weddingId, a.owner, { agreedAmountMinor: 500 });
    const other = await makeExpense(b.weddingId, b.owner);

    const page = await getExpensePage(await authFor(a.owner.cookie), expense.id);
    expect(page).not.toBe("not_found");
    expect(typeof page === "object" && page?.detail.expense.id).toBe(expense.id);
    expect(await getExpensePage(await authFor(a.owner.cookie), other.id)).toBe("not_found");
  });
});

describe("the event page's linked expenses", () => {
  it("lists only the expenses recorded against that event, for every role", async () => {
    const { weddingId, owner } = await setupWedding();
    const member = await addMember(weddingId, "member");
    const haldi = await makeEvent(weddingId, owner, "Haldi");
    const sangeet = await makeEvent(weddingId, owner, "Sangeet");
    const marigolds = await makeExpense(weddingId, owner, {
      title: "Marigolds",
      eventId: haldi,
      agreedAmountMinor: 2500000,
    });
    await makePayment(weddingId, marigolds.id, owner, { amountMinor: 1000000, status: "paid" });
    await makeExpense(weddingId, owner, { title: "DJ", eventId: sangeet, agreedAmountMinor: 1 });
    await makeExpense(weddingId, owner, { title: "General", agreedAmountMinor: 1 });

    for (const who of [owner, member]) {
      const page = await getEventPage(await authFor(who.cookie), haldi);
      if (!page || page === "not_found") throw new Error("expected the event page");
      expect(page.currency).toBe("INR");
      expect(page.expenses.map((expense) => expense.title)).toEqual(["Marigolds"]);
      expect(page.expenses[0]).toMatchObject({ costMinor: 2500000, paidAmountMinor: 1000000 });
    }
  });
});

describe("getVendorsPage and getVendorPage", () => {
  it("lists every vendor with its money for an owner or admin", async () => {
    const { weddingId, owner } = await setupWedding();
    const admin = await addMember(weddingId, "admin");
    const vendor = await makeVendor(weddingId, owner);
    await makeExpense(weddingId, owner, { vendorId: vendor.id, agreedAmountMinor: 16500000 });

    for (const who of [owner, admin]) {
      const page = await getVendorsPage(await authFor(who.cookie));
      expect(page).toMatchObject({ forbidden: false, currency: "INR" });
      expect(page && !page.forbidden && page.vendors[0]?.money.costMinor).toBe(16500000);
    }
  });

  it("tells a member the page is not for them, without sending any vendor", async () => {
    const { weddingId, owner } = await setupWedding();
    const member = await addMember(weddingId, "member");
    const vendor = await makeVendor(weddingId, owner, { name: "Secret Caterers" });

    const list = await getVendorsPage(await authFor(member.cookie));
    expect(list).toMatchObject({ forbidden: true });
    const one = await getVendorPage(await authFor(member.cookie), vendor.id);
    expect(one).toMatchObject({ forbidden: true });
    expect(JSON.stringify([list, one])).not.toContain("Secret Caterers");
  });

  it("gives a vendor's expenses and payment milestones, overdue first", async () => {
    const { weddingId, owner } = await setupWedding();
    const vendor = await makeVendor(weddingId, owner);
    const expense = await makeExpense(weddingId, owner, {
      title: "Photography package",
      vendorId: vendor.id,
      agreedAmountMinor: 16500000,
    });
    await makePayment(weddingId, expense.id, owner, { amountMinor: 5000000, status: "paid" });
    await makePayment(weddingId, expense.id, owner, {
      amountMinor: 7500000,
      dueDate: dayOffset(20),
    });
    await makePayment(weddingId, expense.id, owner, {
      amountMinor: 4000000,
      dueDate: dayOffset(-4),
    });
    await makePayment(weddingId, expense.id, owner, { amountMinor: 1, status: "cancelled" });

    const page = await getVendorPage(await authFor(owner.cookie), vendor.id);
    if (!page || page === "not_found" || page.forbidden) throw new Error("expected a vendor page");
    expect(page.detail.expenses).toHaveLength(1);
    expect(page.detail.milestones.map((m) => [m.status, m.amountMinor, m.isOverdue])).toEqual([
      ["pending", 4000000, true],
      ["pending", 7500000, false],
      ["paid", 5000000, false],
    ]);
    expect(page.detail.milestones[0]?.expenseTitle).toBe("Photography package");
    expect(page.events).toEqual([]);
    expect(page.vendorChoices).toEqual([{ id: vendor.id, name: "Lens & Light Studio" }]);
  });

  it("answers 'not_found' for another wedding's vendor", async () => {
    const a = await setupWedding();
    const b = await setupWedding();
    const theirs = await makeVendor(b.weddingId, b.owner);
    expect(await getVendorPage(await authFor(a.owner.cookie), theirs.id)).toBe("not_found");
  });
});

describe("the dashboard's vendor numbers", () => {
  it("count the directory and the booked ones for owners and admins, and nothing for a member", async () => {
    const { weddingId, owner } = await setupWedding();
    const member = await addMember(weddingId, "member");
    const booked = await makeVendor(weddingId, owner, { name: "A" });
    await makeVendor(weddingId, owner, { name: "B" });
    await patchVendor(weddingId, booked.id, owner, { version: 0, status: "booked" });

    const asOwner = await getDashboard(await authFor(owner.cookie));
    expect(asOwner.workspace?.counts).toMatchObject({ vendors: 2, bookedVendors: 1 });
    const asMember = await getDashboard(await authFor(member.cookie));
    expect(asMember.workspace?.counts).toMatchObject({ vendors: null, bookedVendors: null });
  });
});
