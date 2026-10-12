import "server-only";
import { headers } from "next/headers";
import { AppError } from "@/lib/errors";
import { enforceRateLimit, RATE_LIMITS } from "@/modules/auth/rate-limit";
import { getPublicGallery, type PublicGallery } from "@/modules/gallery/public-gallery.service";

/**
 * What a guest's gallery pages load first: the gallery as that link allows, or null for ANY link
 * that can't be used (unknown, revoked, expired, deleted) and for a rate-limited visitor, which
 * read the same to a person. A real fault still throws. `limit` is how many photos to load.
 */
export async function loadGuestGallery(
  token: string,
  limit: number,
): Promise<{ gallery: PublicGallery; nextCursor: string | null } | null> {
  try {
    const requestHeaders = await headers();
    const ip =
      requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      requestHeaders.get("x-real-ip")?.trim() ||
      "unknown";
    await enforceRateLimit(`gallery-page:${ip}`, RATE_LIMITS.galleryLookup);
    const { data, meta } = await getPublicGallery(token, { limit });
    return { gallery: data, nextCursor: meta.nextCursor };
  } catch (error) {
    if (
      !(error instanceof AppError) ||
      (error.code !== "INVALID_TOKEN" && error.code !== "RATE_LIMITED")
    ) {
      throw error;
    }
    return null;
  }
}
