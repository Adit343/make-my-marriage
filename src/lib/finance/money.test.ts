import { describe, expect, it } from "vitest";
import {
  costOf,
  currencySymbol,
  formatMoney,
  isPaymentOverdue,
  minorToInput,
  paidPercent,
  parseAmountToMinor,
  remainingOf,
} from "@/lib/finance/money";

describe("costOf", () => {
  it("uses the agreed amount, else the estimate, else nothing", () => {
    expect(costOf({ agreedAmountMinor: 165, estimatedAmountMinor: 180 })).toBe(165);
    expect(costOf({ agreedAmountMinor: null, estimatedAmountMinor: 180 })).toBe(180);
    expect(costOf({ estimatedAmountMinor: 180 })).toBe(180);
    expect(costOf({})).toBe(0);
  });

  it("treats an agreed amount of zero as agreed (a free item), not as missing", () => {
    expect(costOf({ agreedAmountMinor: 0, estimatedAmountMinor: 500 })).toBe(0);
  });
});

describe("remainingOf and paidPercent", () => {
  it("never goes negative", () => {
    expect(remainingOf(1000, 400)).toBe(600);
    expect(remainingOf(1000, 1000)).toBe(0);
    expect(remainingOf(1000, 1500)).toBe(0);
  });

  it("rounds the paid share and caps it at 100", () => {
    expect(paidPercent(16500000, 5000000)).toBe(30);
    expect(paidPercent(100, 250)).toBe(100);
    expect(paidPercent(0, 50)).toBe(0);
  });
});

describe("isPaymentOverdue", () => {
  it("is only a pending payment whose due day has passed", () => {
    const today = "2027-02-12";
    expect(isPaymentOverdue({ status: "pending", dueDate: "2027-02-10" }, today)).toBe(true);
    expect(isPaymentOverdue({ status: "pending", dueDate: "2027-02-12" }, today)).toBe(false);
    expect(isPaymentOverdue({ status: "pending", dueDate: null }, today)).toBe(false);
    expect(isPaymentOverdue({ status: "paid", dueDate: "2027-02-10" }, today)).toBe(false);
    expect(isPaymentOverdue({ status: "cancelled", dueDate: "2027-02-10" }, today)).toBe(false);
  });
});

describe("formatMoney", () => {
  it("groups Indian style and drops empty paise", () => {
    expect(formatMoney(16500000)).toBe("₹1,65,000");
    expect(formatMoney(250000000)).toBe("₹25,00,000");
    expect(formatMoney(0)).toBe("₹0");
    expect(formatMoney(49950)).toBe("₹499.50");
    expect(formatMoney(5)).toBe("₹0.05");
  });

  it("uses another currency's own symbol", () => {
    expect(formatMoney(150000, "USD")).toContain("$");
    expect(currencySymbol("INR")).toBe("₹");
  });
});

describe("parseAmountToMinor", () => {
  it.each([
    ["1,65,000", 16500000],
    ["165000", 16500000],
    ["₹ 1,65,000", 16500000],
    ["499.5", 49950],
    ["499.50", 49950],
    ["0.05", 5],
    ["0", 0],
    [" 12 ", 1200],
  ])("reads %s as %i paise", (typed, expected) => {
    expect(parseAmountToMinor(typed)).toBe(expected);
  });

  it.each(["", "abc", "-5", "12.345", "1.2.3", "12e3", "NaN", ".", ","])("refuses %j", (typed) => {
    expect(parseAmountToMinor(typed)).toBeNull();
  });

  it("never produces a float for amounts that are awkward in binary", () => {
    expect(parseAmountToMinor("0.29")).toBe(29);
    expect(parseAmountToMinor("1.15")).toBe(115);
    expect(parseAmountToMinor("4.35")).toBe(435);
  });

  it("refuses a number too large to hold exactly", () => {
    expect(parseAmountToMinor("99999999999999999999")).toBeNull();
  });
});

describe("minorToInput", () => {
  it("gives what goes back into an amount box", () => {
    expect(minorToInput(16500000)).toBe("165000");
    expect(minorToInput(49950)).toBe("499.50");
    expect(minorToInput(5)).toBe("0.05");
    expect(minorToInput(0)).toBe("0");
    expect(minorToInput(null)).toBe("");
    expect(minorToInput(undefined)).toBe("");
  });

  it("round-trips with parseAmountToMinor", () => {
    for (const minor of [0, 1, 99, 100, 49950, 16500000, 12345678]) {
      expect(parseAmountToMinor(minorToInput(minor))).toBe(minor);
    }
  });
});
