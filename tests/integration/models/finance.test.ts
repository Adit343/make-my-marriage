import { Types } from "mongoose";
import { describe, expect, it } from "vitest";
import { Expense } from "@/models/expense.model";
import { Vendor } from "@/models/vendor.model";
import { VendorPayment } from "@/models/vendorPayment.model";
import { setupTestDatabase } from "../../setup/database";

// DB Design §6.12 to §6.14: the last line of defence behind the API's own validation.

setupTestDatabase();

const weddingId = new Types.ObjectId();
const user = new Types.ObjectId();

describe("expenses model", () => {
  it("stores money as whole numbers, defaults the soft-delete block and rejects bad data", async () => {
    const expense = await Expense.create({
      weddingId,
      title: "Venue",
      category: "venue",
      agreedAmountMinor: 100,
      createdBy: user,
    });
    expect(expense.deletedAt).toBeNull();
    expect(expense.eventId).toBeNull();
    expect(expense.expenseDate).toBeNull();

    const base = { weddingId, title: "x", category: "venue" as const, createdBy: user };
    await expect(Expense.create({ ...base, agreedAmountMinor: 1.5 })).rejects.toThrow(/whole/);
    await expect(Expense.create({ ...base, agreedAmountMinor: -1 })).rejects.toThrow();
    await expect(Expense.create({ ...base, category: "yachts" as never })).rejects.toThrow();
    await expect(Expense.create({ ...base, expenseDate: "5 Jan 2027" })).rejects.toThrow();
    await expect(Expense.create({ ...base, title: "" })).rejects.toThrow();
  });
});

describe("vendors model", () => {
  it("keeps a normalised name for prefix search and defaults the status and source", async () => {
    const vendor = await Vendor.create({
      weddingId,
      name: "  Lens   &  Light Studio ",
      category: "photographer",
      createdBy: user,
    });
    expect(vendor.nameNormalized).toBe("lens & light studio");
    expect(vendor.status).toBe("shortlisted");
    expect(vendor.source).toBe("manual");
    expect(vendor.deletedAt).toBeNull();
  });

  it("only takes an https website and an E.164 phone", async () => {
    const base = { weddingId, name: "V", category: "venue" as const, createdBy: user };
    await expect(Vendor.create({ ...base, contact: { website: "http://x.in" } })).rejects.toThrow();
    await expect(Vendor.create({ ...base, contact: { phone: "98250 14820" } })).rejects.toThrow();
    const ok = await Vendor.create({
      ...base,
      contact: { website: "https://x.in", phone: "+919825014820" },
    });
    expect(ok.contact?.phone).toBe("+919825014820");
  });

  it("has no place to put bank, UPI or card details", () => {
    const paths = Object.keys(Vendor.schema.paths);
    for (const path of paths) expect(path).not.toMatch(/bank|account|upi|card|ifsc|cvv/i);
  });
});

describe("vendorPayments model", () => {
  const base = { weddingId, expenseId: new Types.ObjectId(), createdBy: user };

  it("requires a positive whole amount", async () => {
    await expect(VendorPayment.create({ ...base, amountMinor: 0 })).rejects.toThrow();
    await expect(VendorPayment.create({ ...base, amountMinor: 10.5 })).rejects.toThrow();
    const ok = await VendorPayment.create({ ...base, amountMinor: 100 });
    expect(ok.status).toBe("pending");
    expect(ok.paidAt).toBeNull();
  });

  it("requires a paid date once a payment is paid", async () => {
    await expect(
      VendorPayment.create({ ...base, amountMinor: 100, status: "paid" }),
    ).rejects.toThrow(/paidAt/);
    const paid = await VendorPayment.create({
      ...base,
      amountMinor: 100,
      status: "paid",
      paidAt: new Date(),
    });
    expect(paid.status).toBe("paid");
  });

  it("only takes the listed methods and statuses", async () => {
    await expect(
      VendorPayment.create({ ...base, amountMinor: 1, method: "bitcoin" as never }),
    ).rejects.toThrow();
    await expect(
      VendorPayment.create({ ...base, amountMinor: 1, status: "refunded" as never }),
    ).rejects.toThrow();
  });
});
