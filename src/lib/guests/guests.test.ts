import { describe, expect, it } from "vitest";
import { formatPhone, phoneForInput, toE164 } from "@/lib/guests/phone";
import {
  invitationDisplay,
  lastUpdatedLabel,
  namesSummary,
  partnersOf,
  relativeAgo,
  replyDisplay,
  shortDate,
  sideLabel,
} from "@/lib/guests/view";

describe("toE164", () => {
  it("takes a 10-digit number as Indian, ignoring spaces, dashes and brackets", () => {
    expect(toE164("98765 43210")).toBe("+919876543210");
    expect(toE164("98765-43210")).toBe("+919876543210");
    expect(toE164("(98765) 43210")).toBe("+919876543210");
    expect(toE164("9876543210")).toBe("+919876543210");
  });

  it("accepts a leading 0 or 91, and an explicit country code", () => {
    expect(toE164("09876543210")).toBe("+919876543210");
    expect(toE164("919876543210")).toBe("+919876543210");
    expect(toE164("+91 98765 43210")).toBe("+919876543210");
    expect(toE164("0091 98765 43210")).toBe("+919876543210");
    expect(toE164("+44 7911 123456")).toBe("+447911123456");
  });

  it("refuses anything that is not a usable number", () => {
    for (const bad of [
      "",
      "   ",
      "abc",
      "12345",
      "98765 4321",
      "+0123456789",
      "+91",
      "98765x43210",
    ]) {
      expect(toE164(bad), bad).toBeNull();
    }
  });
});

describe("phone display", () => {
  it("groups Indian numbers and leaves others alone", () => {
    expect(formatPhone("+919876543210")).toBe("+91 98765 43210");
    expect(formatPhone("+447911123456")).toBe("+447911123456");
  });

  it("round-trips through the form box", () => {
    expect(phoneForInput("+919876543210")).toBe("98765 43210");
    expect(toE164(phoneForInput("+919876543210"))).toBe("+919876543210");
    expect(phoneForInput("+447911123456")).toBe("+447911123456");
    expect(toE164(phoneForInput("+447911123456"))).toBe("+447911123456");
    expect(phoneForInput(null)).toBe("");
  });
});

describe("side labels", () => {
  const partners = partnersOf([{ name: "Aarav Trivedi" }, { name: "Diya" }]);
  it("uses the couple's first names", () => {
    expect(sideLabel("partnerOne", partners)).toBe("Aarav's side");
    expect(sideLabel("partnerTwo", partners)).toBe("Diya's side");
    expect(sideLabel("both", partners)).toBe("Both");
  });

  it("falls back to neutral words when the wedding has no partner names", () => {
    const blank = partnersOf([]);
    expect(sideLabel("partnerOne", blank)).toBe("Partner one's side");
    expect(sideLabel("partnerTwo", blank)).toBe("Partner two's side");
  });
});

describe("replyDisplay", () => {
  const row = (
    eventId: string,
    status: "pending" | "attending" | "maybe" | "declined",
    count = 0,
  ) => ({
    eventId,
    status,
    attendingCount: count,
  });

  it("reads one event's reply, with the people beyond the guest", () => {
    const rsvps = [row("h", "attending", 3), row("r", "declined")];
    expect(replyDisplay(rsvps, "h")).toEqual({ tone: "attending", label: "Attending", extra: 2 });
    expect(replyDisplay(rsvps, "r")).toMatchObject({ tone: "declined", extra: null });
    expect(replyDisplay([row("h", "attending", 1)], "h").extra).toBeNull();
  });

  it("says not invited when the guest is not on that event", () => {
    expect(replyDisplay([row("h", "attending", 1)], "x")).toMatchObject({
      tone: "none",
      label: "Not invited",
    });
  });

  it("summarises all events: attending to any wins", () => {
    const result = replyDisplay([row("h", "attending", 2), row("r", "declined")], null);
    expect(result).toMatchObject({ tone: "attending", extra: 1, hint: "1 of 2 events confirmed" });
  });

  it("uses the biggest party across attended events", () => {
    expect(replyDisplay([row("h", "attending", 2), row("r", "attending", 4)], null).extra).toBe(3);
  });

  it("falls through maybe, pending, declined", () => {
    expect(replyDisplay([row("h", "maybe", 2), row("r", "pending")], null)).toMatchObject({
      tone: "maybe",
      extra: 1,
    });
    expect(replyDisplay([row("h", "declined"), row("r", "pending")], null).tone).toBe("pending");
    expect(replyDisplay([row("h", "declined"), row("r", "declined")], null).tone).toBe("declined");
  });

  it("says no events for a guest on none", () => {
    expect(replyDisplay([], null)).toMatchObject({ tone: "none", label: "No events" });
  });
});

describe("invitationDisplay", () => {
  it("shows not sent until someone has invited the guest", () => {
    expect(
      invitationDisplay(
        { status: "not_invited", lastChannel: null, lastSentAt: null, sendCount: 0 },
        "Asia/Kolkata",
      ),
    ).toEqual({ sent: false, label: "Not sent", channel: null, dateLabel: null });
  });

  it("names the channel and the day, in the wedding's timezone", () => {
    expect(
      invitationDisplay(
        {
          status: "invited",
          lastChannel: "whatsapp",
          lastSentAt: "2027-02-08T20:00:00.000Z",
          sendCount: 1,
        },
        "Asia/Kolkata",
      ),
    ).toEqual({ sent: true, label: "Sent via WhatsApp", channel: "whatsapp", dateLabel: "9 Feb" });
  });
});

describe("dates and counts", () => {
  it("formats a short date in a timezone", () => {
    expect(shortDate("2027-02-08T20:00:00.000Z", "UTC")).toBe("8 Feb");
    expect(shortDate("2027-02-08T20:00:00.000Z", "Asia/Kolkata")).toBe("9 Feb");
  });

  it("labels last updated as today or a date", () => {
    const now = new Date("2027-02-10T10:00:00.000Z");
    expect(lastUpdatedLabel("2027-02-10T06:12:00.000Z", "UTC", now)).toBe("Today, 6:12 AM");
    expect(lastUpdatedLabel("2027-02-08T06:12:00.000Z", "UTC", now)).toBe("8 Feb, 6:12 AM");
  });

  it("says how long ago", () => {
    expect(relativeAgo(0, 10_000)).toBe("just now");
    expect(relativeAgo(0, 60_000)).toBe("1 min ago");
    expect(relativeAgo(0, 4 * 60_000)).toBe("4 mins ago");
    expect(relativeAgo(0, 2 * 3_600_000)).toBe("2 hours ago");
  });

  it("shortens a long list of names", () => {
    expect(namesSummary(["A", "B"])).toBe("A, B");
    expect(namesSummary(["A", "B", "C", "D", "E"])).toBe("A, B, C +2 more");
  });
});
