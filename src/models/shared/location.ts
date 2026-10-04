import { Schema } from "mongoose";

// Shared embedded sub-schemas (DB Design §5.1, §5.2). Never just a city string (Architecture §27).
// Request validation for the same shapes: src/lib/validation/location.ts.

export const addressSchema = new Schema(
  {
    line1: { type: String, trim: true, maxlength: 200 },
    line2: { type: String, trim: true, maxlength: 200 },
    city: { type: String, trim: true, maxlength: 100 },
    state: { type: String, trim: true, maxlength: 100 },
    postalCode: { type: String, trim: true, maxlength: 20 },
    country: { type: String, default: "IN", match: /^[A-Z]{2}$/ },
  },
  { _id: false },
);

// Plain numbers, not GeoJSON: no query needs a 2dsphere index in V1 (DB Design §5.2).
const coordinatesSchema = new Schema(
  {
    latitude: { type: Number, required: true, min: -90, max: 90 },
    longitude: { type: Number, required: true, min: -180, max: 180 },
  },
  { _id: false },
);

export const locationSchema = new Schema(
  {
    label: { type: String, trim: true, maxlength: 200 },
    address: { type: addressSchema },
    coordinates: { type: coordinatesSchema },
    placeId: { type: String, trim: true, maxlength: 512 },
  },
  { _id: false },
);
