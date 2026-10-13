import "server-only";
import type { Model, Types } from "mongoose";
import { connectDb } from "@/infrastructure/database/connection";
import { EmailLog } from "@/models/emailLog.model";
import { Event } from "@/models/event.model";
import { Expense } from "@/models/expense.model";
import { Gallery } from "@/models/gallery.model";
import { GalleryAccessToken } from "@/models/galleryAccessToken.model";
import { GalleryAlbum } from "@/models/galleryAlbum.model";
import { GalleryAsset } from "@/models/galleryAsset.model";
import { Guest } from "@/models/guest.model";
import { GuestGroup } from "@/models/guestGroup.model";
import { LiveStream } from "@/models/liveStream.model";
import { PasswordResetToken } from "@/models/passwordResetToken.model";
import { Rsvp } from "@/models/rsvp.model";
import { Session } from "@/models/session.model";
import { Task } from "@/models/task.model";
import { User } from "@/models/user.model";
import { Vendor } from "@/models/vendor.model";
import { VendorPayment } from "@/models/vendorPayment.model";
import { Wedding } from "@/models/wedding.model";
import { WeddingInvitation } from "@/models/weddingInvitation.model";
import { WeddingMember } from "@/models/weddingMember.model";
import { WeddingWebsite } from "@/models/weddingWebsite.model";

// Data access for the manual purge and anonymise scripts (DB Design §10.3, §10.4). These are the
// only places that read soft-deleted rows across a whole wedding, and they are never reached from
// a request: only scripts/*.ts call the service that calls this file.

type Id = Types.ObjectId | string;

// Every collection that carries a weddingId, children first. Photos are handled separately
// (their files must be removed from storage before their rows). The wedding row goes last.
// Typed loosely on purpose: this list only ever runs deleteMany/countDocuments by weddingId.
type WeddingScoped = Pick<Model<never>, "deleteMany" | "countDocuments">;
const WEDDING_OWNED: ReadonlyArray<{ name: string; model: WeddingScoped }> = [
  { name: "rsvps", model: Rsvp as unknown as WeddingScoped },
  { name: "vendorPayments", model: VendorPayment as unknown as WeddingScoped },
  { name: "expenses", model: Expense as unknown as WeddingScoped },
  { name: "vendors", model: Vendor as unknown as WeddingScoped },
  { name: "tasks", model: Task as unknown as WeddingScoped },
  { name: "guests", model: Guest as unknown as WeddingScoped },
  { name: "guestGroups", model: GuestGroup as unknown as WeddingScoped },
  { name: "events", model: Event as unknown as WeddingScoped },
  { name: "liveStreams", model: LiveStream as unknown as WeddingScoped },
  { name: "weddingWebsites", model: WeddingWebsite as unknown as WeddingScoped },
  { name: "galleryAccessTokens", model: GalleryAccessToken as unknown as WeddingScoped },
  { name: "galleryAlbums", model: GalleryAlbum as unknown as WeddingScoped },
  { name: "galleries", model: Gallery as unknown as WeddingScoped },
  { name: "weddingInvitations", model: WeddingInvitation as unknown as WeddingScoped },
  { name: "weddingMembers", model: WeddingMember as unknown as WeddingScoped },
  { name: "emailLogs", model: EmailLog as unknown as WeddingScoped },
];

/** Soft-deleted weddings whose 30-day grace period is over. */
export async function findPurgeableWeddings(now: Date, limit: number) {
  await connectDb();
  return Wedding.find({ deletedAt: { $type: "date" }, purgeAfter: { $type: "date", $lte: now } })
    .select({ _id: 1, title: 1, purgeAfter: 1 })
    .sort({ purgeAfter: 1 })
    .limit(limit)
    .lean();
}

/** One page of a wedding's photo records (deleted ones included), for removing their files. */
export async function findAssetKeys(weddingId: Id, limit: number) {
  await connectDb();
  return GalleryAsset.find({ weddingId })
    .setOptions({ withDeleted: true })
    .select({ _id: 1, objectKey: 1 })
    .limit(limit)
    .lean();
}

export async function deleteAssetsByIds(weddingId: Id, ids: Id[]): Promise<number> {
  await connectDb();
  const result = await GalleryAsset.deleteMany({ weddingId, _id: { $in: ids } }).setOptions({
    withDeleted: true,
  });
  return result.deletedCount;
}

export async function countWeddingRows(weddingId: Id): Promise<Record<string, number>> {
  await connectDb();
  const counts: Record<string, number> = {};
  counts.galleryAssets = await GalleryAsset.countDocuments({ weddingId }).setOptions({
    withDeleted: true,
  });
  for (const { name, model } of WEDDING_OWNED) {
    counts[name] = await model.countDocuments({ weddingId } as never).setOptions({
      withDeleted: true,
    });
  }
  return counts;
}

/** Deletes everything the wedding owns except photos, then the wedding itself. */
export async function deleteWeddingRows(weddingId: Id): Promise<Record<string, number>> {
  await connectDb();
  const deleted: Record<string, number> = {};
  for (const { name, model } of WEDDING_OWNED) {
    const result = await model.deleteMany({ weddingId } as never).setOptions({ withDeleted: true });
    deleted[name] = result.deletedCount;
  }
  const wedding = await Wedding.deleteOne({ _id: weddingId, deletedAt: { $type: "date" } });
  deleted.weddings = wedding.deletedCount;
  return deleted;
}

/** Deleted accounts past their grace period that have not been anonymised yet. */
export async function findAnonymizableUsers(cutoff: Date, limit: number) {
  await connectDb();
  return User.find({
    status: "pending_deletion",
    deletedAt: { $type: "date", $lte: cutoff },
    emailNormalized: { $not: /^deleted\+[0-9a-f]{24}@invalid$/ },
  })
    .select({ _id: 1 })
    .limit(limit)
    .lean();
}

/** DB Design §10.4: no personal data left; the row stays so createdBy ids still resolve. */
export async function anonymizeUser(userId: Id): Promise<boolean> {
  await connectDb();
  const address = `deleted+${String(userId)}@invalid`;
  const result = await User.updateOne(
    { _id: userId, status: "pending_deletion", deletedAt: { $type: "date" } },
    {
      $set: {
        email: address,
        emailNormalized: address,
        name: "Deleted user",
        passwordAuth: null,
        authProviders: [],
        lastLoginAt: null,
      },
    },
  );
  await Session.deleteMany({ userId });
  await PasswordResetToken.deleteMany({ userId });
  return result.modifiedCount === 1;
}
