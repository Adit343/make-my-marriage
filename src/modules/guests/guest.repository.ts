import "server-only";
import { Error as MongooseError, Types, type ClientSession } from "mongoose";
import { aggregateScoped } from "@/infrastructure/database/aggregate";
import { connectDb } from "@/infrastructure/database/connection";
import type {
  AgeCategory,
  DietaryPreference,
  GuestInviteStatus,
  GuestSide,
} from "@/lib/constants/enums";
import type { AddressInput } from "@/lib/validation/location";
import { Guest } from "@/models/guest.model";

type Id = Types.ObjectId | string;

// Every function takes weddingId (DB Design §9.2): there is no way to read or change a guest
// without naming the wedding it must belong to. Soft-deleted guests are hidden by the plugin.

export interface NewGuest {
  name: string;
  groupId?: Id | null;
  email?: string | null;
  phone?: string | null;
  address?: AddressInput | null;
  side: GuestSide;
  relationLabel?: string | null;
  ageCategory?: AgeCategory;
  plusOnesAllowed?: number;
  dietaryPreference?: DietaryPreference | null;
  notes?: string | null;
  createdBy: Id;
}

export interface GuestChanges {
  name?: string;
  groupId?: Id | null;
  email?: string | null;
  phone?: string | null;
  address?: AddressInput | null;
  side?: GuestSide;
  relationLabel?: string | null;
  ageCategory?: AgeCategory;
  plusOnesAllowed?: number;
  dietaryPreference?: DietaryPreference | null;
  notes?: string | null;
}

export interface GuestFilters {
  /** Anchored prefix on the normalized name, already normalized by the caller. */
  namePrefix?: string;
  /** "none" = ungrouped guests. */
  groupId?: string;
  side?: GuestSide;
  inviteStatus?: GuestInviteStatus;
  dietaryPreference?: DietaryPreference;
  /** Restrict to these guests (the service resolves RSVP-based filters to ids first). */
  idIn?: string[];
}

export interface GuestCursor {
  name: string;
  id: string;
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function filterFor(weddingId: Id, filters: GuestFilters): Record<string, unknown> {
  const filter: Record<string, unknown> = { weddingId };
  if (filters.namePrefix) {
    filter.nameNormalized = { $regex: `^${escapeRegex(filters.namePrefix)}` };
  }
  if (filters.groupId === "none") filter.groupId = null;
  else if (filters.groupId) filter.groupId = filters.groupId;
  if (filters.side) filter.side = filters.side;
  if (filters.inviteStatus) filter["invitation.status"] = filters.inviteStatus;
  if (filters.dietaryPreference) filter.dietaryPreference = filters.dietaryPreference;
  if (filters.idIn) filter._id = { $in: filters.idIn.map((id) => new Types.ObjectId(id)) };
  return filter;
}

export async function insertGuest(weddingId: Id, input: NewGuest, session?: ClientSession) {
  await connectDb();
  const [guest] = await Guest.create([{ ...input, weddingId }], { session });
  return guest!.toObject();
}

export async function findGuest(weddingId: Id, guestId: Id) {
  await connectDb();
  return Guest.findOne({ _id: guestId, weddingId }).lean();
}

/** Only the ids that exist in this wedding come back (a cross-wedding id is simply absent). */
export async function findGuestsByIds(weddingId: Id, guestIds: Id[]) {
  await connectDb();
  return Guest.find({ weddingId, _id: { $in: guestIds } }).lean();
}

/** Alphabetical, `limit + 1` rows so the caller can tell whether there is another page. */
export async function listGuestsPage(
  weddingId: Id,
  filters: GuestFilters,
  page: { limit: number; after?: GuestCursor },
) {
  await connectDb();
  const filter = filterFor(weddingId, filters);
  if (page.after) {
    const clause = {
      $or: [
        { nameNormalized: { $gt: page.after.name } },
        { nameNormalized: page.after.name, _id: { $gt: new Types.ObjectId(page.after.id) } },
      ],
    };
    // The name prefix and the cursor both constrain nameNormalized, so combine them with $and.
    return Guest.find({ $and: [filter, clause] })
      .sort({ nameNormalized: 1, _id: 1 })
      .limit(page.limit + 1)
      .lean();
  }
  return Guest.find(filter)
    .sort({ nameNormalized: 1, _id: 1 })
    .limit(page.limit + 1)
    .lean();
}

export async function countGuests(weddingId: Id, filters: GuestFilters = {}): Promise<number> {
  await connectDb();
  return Guest.countDocuments(filterFor(weddingId, filters));
}

/** Guests that have not been marked invited yet (the "Unsent invitations" card). */
export async function countUninvitedGuests(weddingId: Id): Promise<number> {
  return countGuests(weddingId, { inviteStatus: "not_invited" });
}

/**
 * Optimistic concurrency (DB Design §3.7): the write only lands if the guest is still at the
 * version the client last read. save() adds the same guard against a write that sneaks in between
 * our read and our save.
 */
export async function updateGuest(
  weddingId: Id,
  guestId: Id,
  version: number,
  changes: GuestChanges,
  session?: ClientSession,
): Promise<"conflict" | "not_found" | NonNullable<Awaited<ReturnType<typeof findGuest>>>> {
  await connectDb();
  const guest = await Guest.findOne({ _id: guestId, weddingId }).session(session ?? null);
  if (!guest) return "not_found";
  if (guest.__v !== version) return "conflict";

  guest.set(changes);
  try {
    await guest.save({ session });
  } catch (error) {
    if (error instanceof MongooseError.VersionError) return "conflict";
    throw error;
  }
  return guest.toObject();
}

/** False if the guest does not exist in this wedding or is already deleted. */
export async function softDeleteGuest(
  weddingId: Id,
  guestId: Id,
  deletion: { by: Id; at: Date },
  session: ClientSession,
): Promise<boolean> {
  await connectDb();
  const result = await Guest.updateOne(
    { _id: guestId, weddingId },
    { $set: { deletedAt: deletion.at, deletedBy: deletion.by } },
    { session },
  );
  return result.modifiedCount === 1;
}

/** Returns how many were deleted. */
export async function softDeleteGuests(
  weddingId: Id,
  guestIds: Id[],
  deletion: { by: Id; at: Date },
  session: ClientSession,
): Promise<number> {
  await connectDb();
  const result = await Guest.updateMany(
    { weddingId, _id: { $in: guestIds } },
    { $set: { deletedAt: deletion.at, deletedBy: deletion.by } },
    { session },
  );
  return result.modifiedCount;
}

/** Puts these guests in a group (or none). Returns how many changed. */
export async function setGroupForGuests(
  weddingId: Id,
  guestIds: Id[],
  groupId: Id | null,
  session?: ClientSession,
): Promise<number> {
  await connectDb();
  const result = await Guest.updateMany(
    { weddingId, _id: { $in: guestIds } },
    { $set: { groupId } },
    { session },
  );
  return result.modifiedCount;
}

/** Moves every guest of a group to another group (or to none) when the group is deleted. */
export async function reassignGuestsOfGroup(
  weddingId: Id,
  fromGroupId: Id,
  toGroupId: Id | null,
  session: ClientSession,
): Promise<number> {
  await connectDb();
  const result = await Guest.updateMany(
    { weddingId, groupId: fromGroupId },
    { $set: { groupId: toGroupId } },
    { session },
  );
  return result.modifiedCount;
}

/** Whole-wedding counts by invitation status, for the stat cards. */
export async function countGuestsByInviteStatus(
  weddingId: Id,
): Promise<Record<GuestInviteStatus, number>> {
  const rows = await aggregateScoped<{ _id: GuestInviteStatus; count: number }>(Guest, weddingId, [
    { $group: { _id: "$invitation.status", count: { $sum: 1 } } },
  ]);
  const counts: Record<GuestInviteStatus, number> = { not_invited: 0, invited: 0 };
  for (const row of rows) counts[row._id] = row.count;
  return counts;
}

// ---------------------------------------------------------------------------------------------
// Personal RSVP links and invitation tracking (DB Design §5.3, §6.10)
// ---------------------------------------------------------------------------------------------

export interface StoredLink {
  tokenHash: string;
  tokenEnc: string;
  createdAt: Date;
  expiresAt: Date | null;
  revokedAt: Date | null;
}

/** The guest with their link's encrypted token (never selected by default). */
export async function findGuestWithLink(weddingId: Id, guestId: Id) {
  await connectDb();
  return Guest.findOne({ _id: guestId, weddingId }).select("+link.tokenEnc").lean();
}

export async function findGuestsWithLinks(weddingId: Id, guestIds: Id[]) {
  await connectDb();
  return Guest.find({ weddingId, _id: { $in: guestIds } })
    .select("+link.tokenEnc")
    .lean();
}

/**
 * Stores a new link. `onlyIfUnusable` makes it safe against two simultaneous requests: the write
 * only lands if the guest has no link, or only a revoked or expired one; the loser re-reads the
 * winner's link instead of replacing it (so a link already sent is never silently invalidated).
 * Returns null when the guard stopped the write.
 */
export async function setGuestLink(
  weddingId: Id,
  guestId: Id,
  link: StoredLink,
  options: { onlyIfUnusable: boolean },
) {
  await connectDb();
  const filter: Record<string, unknown> = { _id: guestId, weddingId };
  if (options.onlyIfUnusable) {
    filter.$or = [
      { link: { $exists: false } },
      { link: null },
      { "link.revokedAt": { $ne: null } },
      { "link.expiresAt": { $lte: new Date() } },
    ];
  }
  return Guest.findOneAndUpdate(filter, { $set: { link } }, { returnDocument: "after" })
    .select("+link.tokenEnc")
    .lean()
    .exec();
}

/**
 * The ONE guest lookup that is by token instead of by wedding: a guest opening /i/<token> has no
 * session and no wedding in the address (DB Design §8.3). The service then checks the link and the
 * wedding are still usable. Soft-deleted guests are never found (the plugin filters them).
 */
export async function findGuestByTokenHash(tokenHash: string) {
  await connectDb();
  return Guest.findOne({ "link.tokenHash": tokenHash }).lean();
}

/** Records that these guests were invited (or reminded) through a channel. Returns how many changed. */
export async function markGuestsInvited(
  weddingId: Id,
  guestIds: Id[],
  channel: "email" | "whatsapp" | "manual",
  at: Date,
): Promise<number> {
  if (guestIds.length === 0) return 0;
  await connectDb();
  const result = await Guest.updateMany(
    { weddingId, _id: { $in: guestIds } },
    {
      $set: {
        "invitation.status": "invited",
        "invitation.lastSentAt": at,
        "invitation.lastChannel": channel,
      },
      $inc: { "invitation.sendCount": 1 },
    },
  );
  return result.modifiedCount;
}

/** The guest's own dietary answer from their RSVP page. Does not bump the edit version. */
export async function setGuestDietary(
  weddingId: Id,
  guestId: Id,
  dietaryPreference: DietaryPreference,
  session?: ClientSession,
) {
  await connectDb();
  await Guest.updateOne({ _id: guestId, weddingId }, { $set: { dietaryPreference } }, { session });
}

/** Guests with no email and no phone: nobody can reach them (the Invitations "incomplete registry"). */
export async function countGuestsWithoutContact(weddingId: Id): Promise<number> {
  await connectDb();
  const empty = (field: string) => ({ $or: [{ [field]: null }, { [field]: { $exists: false } }] });
  return Guest.countDocuments({ weddingId, $and: [empty("email"), empty("phone")] });
}

/** Invited guests by the channel they were last invited through (the progress bar's legend). */
export async function countInvitedByChannel(
  weddingId: Id,
): Promise<Record<"email" | "whatsapp" | "manual", number>> {
  const rows = await aggregateScoped<{
    _id: "email" | "whatsapp" | "manual" | null;
    count: number;
  }>(Guest, weddingId, [
    { $match: { "invitation.status": "invited" } },
    { $group: { _id: "$invitation.lastChannel", count: { $sum: 1 } } },
  ]);
  const counts = { email: 0, whatsapp: 0, manual: 0 };
  for (const row of rows) if (row._id) counts[row._id] = row.count;
  return counts;
}

/** The first few guests with no way to be reached, A to Z (the overview's "Group B"). */
export async function listGuestsWithoutContact(weddingId: Id, limit: number) {
  await connectDb();
  const empty = (field: string) => ({ $or: [{ [field]: null }, { [field]: { $exists: false } }] });
  return Guest.find({ weddingId, $and: [empty("email"), empty("phone")] })
    .sort({ nameNormalized: 1, _id: 1 })
    .limit(limit)
    .lean();
}
