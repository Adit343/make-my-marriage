import { describe, expect, it } from "vitest";
import { addressInput, locationInput } from "@/lib/validation/location";

describe("addressInput", () => {
  it("requires 6-digit PIN codes for India, including when country is omitted", () => {
    expect(addressInput.safeParse({ city: "Surat", postalCode: "395007" }).success).toBe(true);
    expect(addressInput.safeParse({ postalCode: "39500" }).success).toBe(false);
    expect(addressInput.safeParse({ country: "IN", postalCode: "ABC123" }).success).toBe(false);
  });

  it("allows other postal formats outside India", () => {
    expect(addressInput.safeParse({ country: "GB", postalCode: "SW1A 1AA" }).success).toBe(true);
  });

  it("rejects unknown keys", () => {
    expect(addressInput.safeParse({ city: "Surat", zip: "395007" }).success).toBe(false);
  });
});

describe("locationInput", () => {
  it("accepts a Places-sourced location", () => {
    const result = locationInput.safeParse({
      label: "Grand Palace Banquet",
      address: { city: "Surat", state: "Gujarat" },
      coordinates: { latitude: 21.17, longitude: 72.83 },
      placeId: "ChIJ-example",
    });
    expect(result.success).toBe(true);
  });

  it("requires latitude and longitude together and in range", () => {
    expect(locationInput.safeParse({ coordinates: { latitude: 21.17 } }).success).toBe(false);
    expect(
      locationInput.safeParse({ coordinates: { latitude: 91, longitude: 72.83 } }).success,
    ).toBe(false);
  });
});
