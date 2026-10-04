import type { Types } from "mongoose";

// Member-facing wedding shape. `version` is the optimistic-concurrency token clients send back
// on PATCH (decision C5).
export interface WeddingDto {
  id: string;
  title: string;
  partners: { name: string }[];
  weddingDate: string | null;
  timezone: string;
  currency: string;
  location: unknown;
  budgetTotalMinor: number | null;
  status: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

interface WeddingLike {
  _id: Types.ObjectId;
  title: string;
  partners?: { name: string }[] | null;
  weddingDate?: string | null;
  timezone: string;
  currency: string;
  location?: unknown;
  budgetTotalMinor?: number | null;
  status: string;
  __v?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export function toWeddingDto(wedding: WeddingLike): WeddingDto {
  return {
    id: wedding._id.toString(),
    title: wedding.title,
    partners: (wedding.partners ?? []).map((partner) => ({ name: partner.name })),
    weddingDate: wedding.weddingDate ?? null,
    timezone: wedding.timezone,
    currency: wedding.currency,
    location: wedding.location ?? null,
    budgetTotalMinor: wedding.budgetTotalMinor ?? null,
    status: wedding.status,
    version: wedding.__v ?? 0,
    createdAt: (wedding.createdAt ?? new Date(0)).toISOString(),
    updatedAt: (wedding.updatedAt ?? new Date(0)).toISOString(),
  };
}
