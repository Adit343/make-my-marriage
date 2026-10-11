import type { Types } from "mongoose";
import type { VendorCategory, VendorSource, VendorStatus } from "@/lib/constants/enums";

// Member-facing vendor shape (API Design §9.2). Notes are private to the team.
export interface VendorLocationDto {
  label: string | null;
  address: {
    line1: string | null;
    line2: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    country: string | null;
  } | null;
  coordinates: { latitude: number; longitude: number } | null;
  placeId: string | null;
}

export interface VendorContactDto {
  personName: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
}

/**
 * What the team owes a vendor and has paid so far, summed from the linked expenses. `costMinor` is
 * the agreed amount, or the estimate where nothing is agreed yet (DB Design §6.12).
 */
export interface VendorMoneyDto {
  expenseCount: number;
  costMinor: number;
  paidMinor: number;
}

export interface VendorDto {
  id: string;
  name: string;
  category: VendorCategory;
  status: VendorStatus;
  contact: VendorContactDto | null;
  location: VendorLocationDto | null;
  source: VendorSource;
  notes: string | null;
  money: VendorMoneyDto;
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface VendorLike {
  _id: Types.ObjectId;
  name: string;
  category: VendorCategory;
  status: VendorStatus;
  contact?: {
    personName?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
  } | null;
  location?: {
    label?: string | null;
    address?: {
      line1?: string | null;
      line2?: string | null;
      city?: string | null;
      state?: string | null;
      postalCode?: string | null;
      country?: string | null;
    } | null;
    coordinates?: { latitude: number; longitude: number } | null;
    placeId?: string | null;
  } | null;
  source: VendorSource;
  notes?: string | null;
  __v?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const orNull = <T>(value: T | null | undefined): T | null => value ?? null;

export function toVendorDto(vendor: VendorLike, money: VendorMoneyDto): VendorDto {
  const { contact, location } = vendor;
  return {
    id: vendor._id.toString(),
    name: vendor.name,
    category: vendor.category,
    status: vendor.status,
    contact: contact
      ? {
          personName: orNull(contact.personName),
          phone: orNull(contact.phone),
          email: orNull(contact.email),
          website: orNull(contact.website),
        }
      : null,
    location: location
      ? {
          label: orNull(location.label),
          address: location.address
            ? {
                line1: orNull(location.address.line1),
                line2: orNull(location.address.line2),
                city: orNull(location.address.city),
                state: orNull(location.address.state),
                postalCode: orNull(location.address.postalCode),
                country: orNull(location.address.country),
              }
            : null,
          coordinates: location.coordinates
            ? {
                latitude: location.coordinates.latitude,
                longitude: location.coordinates.longitude,
              }
            : null,
          placeId: orNull(location.placeId),
        }
      : null,
    source: vendor.source,
    notes: orNull(vendor.notes),
    money,
    version: vendor.__v ?? 0,
    createdAt: (vendor.createdAt ?? new Date(0)).toISOString(),
    updatedAt: (vendor.updatedAt ?? new Date(0)).toISOString(),
  };
}
