import { z } from "zod";
import { countryCode } from "@/lib/validation/primitives";

// Request-side shapes for the shared Address / Location sub-documents (DB Design §5.1, §5.2).
// The Mongoose counterparts live in src/models/shared/location.ts.

export const addressInput = z
  .strictObject({
    line1: z.string().trim().max(200).optional(),
    line2: z.string().trim().max(200).optional(),
    city: z.string().trim().max(100).optional(),
    state: z.string().trim().max(100).optional(),
    postalCode: z.string().trim().max(20).optional(),
    /** Defaults to "IN" when stored. */
    country: countryCode.optional(),
  })
  .refine(
    (address) =>
      (address.country ?? "IN") !== "IN" ||
      address.postalCode === undefined ||
      /^\d{6}$/.test(address.postalCode),
    { path: ["postalCode"], message: "Indian PIN codes are 6 digits" },
  );

/** Both or neither: a coordinates object always carries latitude and longitude together. */
export const coordinatesInput = z.strictObject({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const locationInput = z.strictObject({
  label: z.string().trim().max(200).optional(),
  address: addressInput.optional(),
  coordinates: coordinatesInput.optional(),
  placeId: z.string().trim().max(512).optional(),
});

export type AddressInput = z.infer<typeof addressInput>;
export type LocationInput = z.infer<typeof locationInput>;
