import { describe, expect, it } from "vitest";
import {
  addedLabel,
  endOfDayIso,
  expiryLabel,
  guestsCanLine,
  permissionsSummary,
  storageView,
  timeAgo,
  uploaderName,
} from "@/lib/gallery/view";

const GB = 1024 * 1024 * 1024;

describe("storageView", () => {
  it("reports the share used and what is left", () => {
    const view = storageView(1.4 * GB, 2 * GB);
    expect(view.percent).toBe(70);
    expect(view.label).toBe("1.4 GB of 2 GB used");
    expect(view.nearFull).toBe(false);
    expect(view.remainingBytes).toBeCloseTo(0.6 * GB, -3);
  });

  it("turns to a warning from 90% and never goes above 100%", () => {
    expect(storageView(1.9 * GB, 2 * GB).nearFull).toBe(true);
    expect(storageView(3 * GB, 2 * GB)).toMatchObject({ percent: 100, remainingBytes: 0 });
  });

  it("copes with an empty gallery and a zero allowance", () => {
    expect(storageView(0, 2 * GB).percent).toBe(0);
    expect(storageView(5, 0).percent).toBe(0);
  });
});

describe("timeAgo", () => {
  const now = new Date("2027-02-14T12:00:00Z");
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
  it("says it the way people do", () => {
    expect(timeAgo(ago(20_000), now)).toBe("Just now");
    expect(timeAgo(ago(60_000), now)).toBe("1 minute ago");
    expect(timeAgo(ago(2 * 3_600_000), now)).toBe("2 hours ago");
    expect(timeAgo(ago(30 * 3_600_000), now)).toBe("Yesterday");
    expect(timeAgo(ago(3 * 86_400_000), now)).toBe("3 days ago");
    expect(timeAgo(ago(30 * 86_400_000), now)).toBe("15 Jan 2027");
  });
});

describe("labels", () => {
  it("shows when a photo was added in the wedding's timezone", () => {
    expect(addedLabel("2026-12-14T04:12:00Z", "Asia/Kolkata")).toBe("14 Dec 2026 · 9:42 AM");
  });

  it("names the uploader, with a fallback for a guest who gave no name", () => {
    expect(uploaderName({ kind: "member", name: "Meena" })).toBe("Meena");
    expect(uploaderName({ kind: "guest", name: null })).toBe("A guest");
    expect(uploaderName({ kind: "member", name: " " })).toBe("A team member");
  });

  it("describes what a link allows", () => {
    expect(guestsCanLine({ canView: true, canUpload: true, canDownload: false })).toBe(
      "Guests can view and add photos.",
    );
    expect(guestsCanLine({ canView: true, canUpload: true, canDownload: true })).toBe(
      "Guests can view, add photos and download.",
    );
    expect(guestsCanLine({ canView: true, canUpload: false, canDownload: false })).toBe(
      "Guests can view.",
    );
    expect(permissionsSummary({ canView: false, canUpload: false, canDownload: false })).toBe(
      "No access.",
    );
  });

  it("shows an expiry as a date, or Never", () => {
    expect(expiryLabel(null, "Asia/Kolkata")).toBe("Never");
    expect(expiryLabel("2027-02-20T18:29:59.000Z", "Asia/Kolkata")).toBe("20 Feb 2027");
  });
});

describe("endOfDayIso", () => {
  it("is the last second of that day in the wedding's timezone", () => {
    // 23:59:59 in India (UTC+5:30) is 18:29:59 UTC.
    expect(endOfDayIso("2027-02-20", "Asia/Kolkata")).toBe("2027-02-20T18:29:59.000Z");
    expect(endOfDayIso("2027-02-20", "UTC")).toBe("2027-02-20T23:59:59.000Z");
    // A zone behind UTC ends the day later in UTC terms.
    expect(endOfDayIso("2027-02-20", "America/New_York")).toBe("2027-02-21T04:59:59.000Z");
  });
});
