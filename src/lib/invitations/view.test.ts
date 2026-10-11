import { describe, expect, it } from "vitest";
import {
  agoWords,
  batchWhen,
  feedWhen,
  invitedAgo,
  logNote,
  logTimestamp,
  peopleLabel,
  percent,
  replySegments,
} from "@/lib/invitations/view";

describe("percent", () => {
  it("rounds, and is 0 for nobody", () => {
    expect(percent(152, 248)).toBe(61);
    expect(percent(0, 0)).toBe(0);
    expect(percent(5, 0)).toBe(0);
    expect(percent(3, 2)).toBe(100);
  });
});

describe("replySegments", () => {
  it("gives each reply its share of the guests", () => {
    const widths = replySegments({ attending: 2, declined: 1, maybe: 0, pending: 1 });
    expect(widths).toEqual({ attending: 50, declined: 25, maybe: 0, pending: 25 });
  });

  it("is all zero when there are no replies at all", () => {
    expect(replySegments({ attending: 0, declined: 0, maybe: 0, pending: 0 })).toEqual({
      attending: 0,
      declined: 0,
      maybe: 0,
      pending: 0,
    });
  });
});

describe("how long ago", () => {
  const now = new Date("2027-02-11T12:00:00Z").getTime();

  it("says today, yesterday and N days ago", () => {
    expect(agoWords("2027-02-11T01:00:00Z", now)).toBe("today");
    expect(agoWords("2027-02-10T05:00:00Z", now)).toBe("yesterday");
    expect(agoWords("2027-01-30T12:00:00Z", now)).toBe("12 days ago");
  });

  it("describes an invitation, or the lack of one", () => {
    expect(invitedAgo("2027-01-30T12:00:00Z", now)).toBe("Invited 12 days ago");
    expect(invitedAgo(null, now)).toBe("Not invited yet");
  });

  it("shortens the latest-responses feed", () => {
    expect(feedWhen("2027-02-11T11:59:40Z", now, "Asia/Kolkata")).toBe("just now");
    expect(feedWhen("2027-02-11T11:38:00Z", now, "Asia/Kolkata")).toBe("22m ago");
    expect(feedWhen("2027-02-11T10:00:00Z", now, "Asia/Kolkata")).toBe("2h ago");
    expect(feedWhen("2027-02-10T06:00:00Z", now, "Asia/Kolkata")).toBe("Yesterday");
    expect(feedWhen("2027-02-01T06:00:00Z", now, "Asia/Kolkata")).toBe("1 Feb");
  });
});

describe("when a batch was sent", () => {
  const now = new Date("2027-02-11T09:00:00Z");

  it("reads in the wedding's timezone", () => {
    expect(batchWhen("2027-02-11T06:00:00Z", "Asia/Kolkata", now)).toBe("Today, 11:30 AM");
    expect(batchWhen("2027-02-10T06:00:00Z", "Asia/Kolkata", now)).toBe("Yesterday");
    expect(batchWhen("2027-02-08T06:00:00Z", "Asia/Kolkata", now)).toBe("8 Feb");
  });

  it("does not move a late-night send onto the wrong day", () => {
    // 20:00 UTC on the 10th is already the 11th in India.
    expect(batchWhen("2027-02-10T20:00:00Z", "Asia/Kolkata", now)).toMatch(/^Today,/);
  });
});

describe("delivery log wording", () => {
  it("timestamps with the zone", () => {
    expect(logTimestamp("2027-02-11T06:00:14Z", "Asia/Kolkata")).toBe("11 Feb 2027, 11:30:14 IST");
  });

  it("explains a failure or a success", () => {
    expect(logNote(null)).toBe("Delivered to the email provider");
    expect(logNote({ code: "mailbox_full" })).toBe("mailbox_full");
    expect(logNote({ code: "mailbox_full", message: "Mailbox full (552)" })).toBe(
      "mailbox_full: Mailbox full (552)",
    );
  });

  it("counts people", () => {
    expect(peopleLabel(1)).toBe("1 person");
    expect(peopleLabel(3)).toBe("3 people");
  });
});
