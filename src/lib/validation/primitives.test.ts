import { describe, expect, it } from "vitest";
import {
  countryCode,
  currency,
  email,
  isoDate,
  minorAmount,
  objectId,
  timezone,
} from "@/lib/validation/primitives";

describe("validation primitives", () => {
  it("objectId accepts 24 hex chars only", () => {
    expect(objectId.safeParse("64b7f0c2a1b2c3d4e5f60718").success).toBe(true);
    expect(objectId.safeParse("64b7f0c2a1b2c3d4e5f6071").success).toBe(false);
    expect(objectId.safeParse("zzb7f0c2a1b2c3d4e5f60718").success).toBe(false);
  });

  it("email trims but keeps the typed casing", () => {
    expect(email.parse("  Priya@Gmail.com ")).toBe("Priya@Gmail.com");
    expect(email.safeParse("not-an-email").success).toBe(false);
  });

  it("isoDate requires a real calendar day", () => {
    expect(isoDate.safeParse("2027-02-14").success).toBe(true);
    expect(isoDate.safeParse("2027-02-30").success).toBe(false);
    expect(isoDate.safeParse("2027-02-14T10:00:00Z").success).toBe(false);
  });

  it("timezone accepts IANA names", () => {
    expect(timezone.safeParse("Asia/Kolkata").success).toBe(true);
    expect(timezone.safeParse("Mars/Olympus").success).toBe(false);
  });

  it("currency accepts known ISO 4217 codes", () => {
    expect(currency.safeParse("INR").success).toBe(true);
    expect(currency.safeParse("inr").success).toBe(false);
    expect(currency.safeParse("XYZ").success).toBe(false);
  });

  it("countryCode accepts alpha-2", () => {
    expect(countryCode.safeParse("IN").success).toBe(true);
    expect(countryCode.safeParse("IND").success).toBe(false);
  });

  it("minorAmount rejects decimals and negatives", () => {
    expect(minorAmount.safeParse(15000000).success).toBe(true);
    expect(minorAmount.safeParse(499.5).success).toBe(false);
    expect(minorAmount.safeParse(-1).success).toBe(false);
  });
});
