import "server-only";
import { Error as MongooseError, Types, type ClientSession } from "mongoose";
import { connectDb } from "@/infrastructure/database/connection";
import type { VendorCategory, VendorSource, VendorStatus } from "@/lib/constants/enums";
import type { LocationInput } from "@/lib/validation/location";
import { Vendor } from "@/models/vendor.model";

type Id = Types.ObjectId | string;

// Every function takes weddingId (DB Design §9.2): there is no way to read or change a vendor
// without naming the wedding it must belong to. Soft-deleted vendors are hidden by the plugin.

export interface VendorContactInput {
  personName?: string;
  phone?: string;
  email?: string;
  website?: string;
}

export interface NewVendor {
  name: string;
  category: VendorCategory;
  status?: VendorStatus;
  contact?: VendorContactInput;
  location?: LocationInput;
  source?: VendorSource;
  notes?: string;
  createdBy: Id;
}

export interface VendorChanges {
  name?: string;
  category?: VendorCategory;
  status?: VendorStatus;
  contact?: VendorContactInput | null;
  location?: LocationInput | null;
  notes?: string | null;
}

export interface VendorFilters {
  /** Anchored prefix on the normalized name, already normalized by the caller. */
  namePrefix?: string;
  category?: VendorCategory;
  status?: VendorStatus;
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function insertVendor(weddingId: Id, input: NewVendor) {
  await connectDb();
  const vendor = await Vendor.create({ ...input, weddingId });
  return vendor.toObject();
}

export async function findVendor(weddingId: Id, vendorId: Id) {
  await connectDb();
  return Vendor.findOne({ _id: vendorId, weddingId }).lean();
}

export interface VendorCursor {
  name: string;
  id: string;
}

/**
 * A to Z by name (the index is { weddingId, nameNormalized }, DB Design §8.2), `limit + 1` rows so
 * the caller can tell whether there is another page. The cursor is the last row's name and id.
 */
export async function listVendorsPage(
  weddingId: Id,
  filters: VendorFilters,
  page: { limit: number; after?: VendorCursor },
) {
  await connectDb();
  const filter: Record<string, unknown> = { weddingId };
  if (filters.namePrefix) {
    filter.nameNormalized = { $regex: `^${escapeRegex(filters.namePrefix)}` };
  }
  if (filters.category) filter.category = filters.category;
  if (filters.status) filter.status = filters.status;
  if (page.after) {
    const { name, id } = page.after;
    filter.$and = [
      {
        $or: [
          { nameNormalized: { $gt: name } },
          { nameNormalized: name, _id: { $gt: new Types.ObjectId(id) } },
        ],
      },
    ];
  }
  return Vendor.find(filter)
    .sort({ nameNormalized: 1, _id: 1 })
    .limit(page.limit + 1)
    .lean();
}

/** Every vendor of the wedding, A to Z, for the Vendors screen and the expense form choices. */
export async function listAllVendors(weddingId: Id, limit = 1000) {
  await connectDb();
  return Vendor.find({ weddingId }).sort({ nameNormalized: 1, _id: 1 }).limit(limit).lean();
}

export async function countVendors(weddingId: Id): Promise<number> {
  await connectDb();
  return Vendor.countDocuments({ weddingId });
}

/** Optimistic concurrency (decision C5): the write only lands if the vendor is still at `version`. */
export async function updateVendor(
  weddingId: Id,
  vendorId: Id,
  version: number,
  changes: VendorChanges,
): Promise<"conflict" | "not_found" | NonNullable<Awaited<ReturnType<typeof findVendor>>>> {
  await connectDb();
  const vendor = await Vendor.findOne({ _id: vendorId, weddingId });
  if (!vendor) return "not_found";
  if (vendor.__v !== version) return "conflict";

  vendor.set(changes);
  try {
    await vendor.save();
  } catch (error) {
    if (error instanceof MongooseError.VersionError) return "conflict";
    throw error;
  }
  return vendor.toObject();
}

/** False if the vendor does not exist in this wedding or is already deleted. */
export async function softDeleteVendor(
  weddingId: Id,
  vendorId: Id,
  deletion: { by: Id; at: Date },
  session?: ClientSession,
): Promise<boolean> {
  await connectDb();
  const result = await Vendor.updateOne(
    { _id: vendorId, weddingId },
    { $set: { deletedAt: deletion.at, deletedBy: deletion.by } },
    { session },
  );
  return result.modifiedCount === 1;
}

/** Vendors that are booked: the dashboard's "Contracted Vendors". */
export async function countBookedVendors(weddingId: Id): Promise<number> {
  await connectDb();
  return Vendor.countDocuments({ weddingId, status: "booked" });
}
