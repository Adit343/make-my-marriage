import "server-only";
import { Error as MongooseError, type ClientSession, type Types } from "mongoose";
import { connectDb } from "@/infrastructure/database/connection";
import type { WebsiteSectionType, WebsiteStatus, WebsiteTemplate } from "@/lib/constants/enums";
import { isDuplicateKeyError } from "@/lib/errors";
import { WeddingWebsite } from "@/models/weddingWebsite.model";

type Id = Types.ObjectId | string;

// DB Design §6.15. Wedding-owned: every function but the public lookup by address takes weddingId.

export interface WebsiteSectionRow {
  /** Kept when the section already exists; a new section gets a fresh id. */
  _id?: Id;
  type: WebsiteSectionType;
  title: string;
  body: string;
  isVisible: boolean;
  sortOrder: number;
}

export interface NewWebsite {
  slug: string;
  title: string;
  sections: WebsiteSectionRow[];
  publicEventIds: Id[];
  seo: { title: string; description: string };
  createdBy: Id;
}

export interface WebsiteChanges {
  slug?: string;
  title?: string;
  tagline?: string;
  welcomeMessage?: string;
  heroAssetId?: Id | null;
  sections?: WebsiteSectionRow[];
  publicEventIds?: Id[];
  display?: { showVenueAddresses: boolean; showCountdown: boolean };
  theme?: { templateKey: WebsiteTemplate; accentColor: string };
  seo?: { title: string; description: string };
}

export async function findWebsite(weddingId: Id) {
  await connectDb();
  return WeddingWebsite.findOne({ weddingId }).lean();
}

/**
 * The ONE website lookup that is by address instead of by wedding: a guest opening /w/<slug> has
 * no session and no wedding in the URL (DB Design §8.3). The service then checks the site is
 * published and the wedding is live. Soft-deleted sites are never found (the plugin filters them).
 */
export async function findWebsiteBySlug(slug: string) {
  await connectDb();
  return WeddingWebsite.findOne({ slug }).lean();
}

/** True if another wedding already uses this address. */
export async function slugUsedByAnother(slug: string, weddingId: Id): Promise<boolean> {
  await connectDb();
  return (await WeddingWebsite.exists({ slug, weddingId: { $ne: weddingId } })) !== null;
}

/** "slug_taken" when the unique index rejects the address (two people picked it at once). */
export async function insertWebsite(
  weddingId: Id,
  input: NewWebsite,
): Promise<"slug_taken" | "exists" | NonNullable<Awaited<ReturnType<typeof findWebsite>>>> {
  await connectDb();
  try {
    const site = await WeddingWebsite.create({ ...input, weddingId });
    return site.toObject();
  } catch (error) {
    if (isDuplicateKeyError(error, "slug")) return "slug_taken";
    if (isDuplicateKeyError(error, "weddingId")) return "exists";
    throw error;
  }
}

/** Optimistic concurrency (decision C5): the write only lands if the site is still at `version`. */
export async function updateWebsite(
  weddingId: Id,
  version: number,
  changes: WebsiteChanges,
): Promise<
  "conflict" | "not_found" | "slug_taken" | NonNullable<Awaited<ReturnType<typeof findWebsite>>>
> {
  await connectDb();
  const site = await WeddingWebsite.findOne({ weddingId });
  if (!site) return "not_found";
  if (site.__v !== version) return "conflict";

  site.set(changes);
  try {
    await site.save();
  } catch (error) {
    if (error instanceof MongooseError.VersionError) return "conflict";
    if (isDuplicateKeyError(error, "slug")) return "slug_taken";
    throw error;
  }
  return site.toObject();
}

/**
 * Publishing is its own explicit action (API Design §10.2), not a side effect of an edit. It takes
 * no version from the client: it only flips the status, so it retries once if an edit slipped in.
 */
export async function setWebsiteStatus(
  weddingId: Id,
  status: WebsiteStatus,
  at: Date,
): Promise<"not_found" | NonNullable<Awaited<ReturnType<typeof findWebsite>>>> {
  await connectDb();
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const site = await WeddingWebsite.findOne({ weddingId });
    if (!site) return "not_found";
    site.status = status;
    site.publishedAt = status === "published" ? at : null;
    try {
      await site.save();
      return site.toObject();
    } catch (error) {
      if (!(error instanceof MongooseError.VersionError) || attempt === 1) throw error;
    }
  }
  return "not_found";
}

/** Deleting an event takes it off the website's list of events in the same transaction. */
export async function removeEventFromWebsite(
  weddingId: Id,
  eventId: Id,
  session?: ClientSession,
): Promise<void> {
  await connectDb();
  await WeddingWebsite.updateOne(
    { weddingId, publicEventIds: eventId },
    { $pull: { publicEventIds: eventId }, $inc: { __v: 1 } },
    { session },
  );
}
