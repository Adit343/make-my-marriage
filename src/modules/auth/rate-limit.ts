import "server-only";
import { hashToken } from "@/lib/crypto/tokens";
import { AppError } from "@/lib/errors";
import { incrementCounter } from "@/modules/auth/rate-limit.repository";

// Per-endpoint limits from API Design §4 (approved decision D5: platform protection first, these
// MongoDB counters for the sensitive auth endpoints).

export interface RateLimit {
  limit: number;
  windowSeconds: number;
}

export const RATE_LIMITS = {
  signup: { limit: 10, windowSeconds: 60 * 60 },
  login: { limit: 10, windowSeconds: 15 * 60 },
  googleStart: { limit: 20, windowSeconds: 60 * 60 },
  passwordChange: { limit: 5, windowSeconds: 60 * 60 },
  resetRequest: { limit: 5, windowSeconds: 60 * 60 },
  resetConfirm: { limit: 10, windowSeconds: 60 * 60 },
  // Each invitation sends an email, so cap them per wedding (API Design §14.3: sensitive routes).
  memberInvite: { limit: 30, windowSeconds: 60 * 60 },
  invitationLookup: { limit: 60, windowSeconds: 15 * 60 },
  invitationAccept: { limit: 10, windowSeconds: 60 * 60 },
  // Guest invitations: one count per group of up to 10 recipients (a send of 50 counts 5), per wedding.
  guestSend: { limit: 60, windowSeconds: 60 * 60 },
  // The public RSVP page (a guest with a personal link), per IP. Generous: a family may share one network.
  rsvpLookup: { limit: 60, windowSeconds: 15 * 60 },
  rsvpSubmit: { limit: 30, windowSeconds: 15 * 60 },
  // Vendor search through Google Places (each search costs money), per wedding.
  placesSearch: { limit: 40, windowSeconds: 60 * 60 },
  // The public wedding website and the guest watch page, per IP. Generous: a family shares a network,
  // and the watch page re-checks its status about once a minute while it is open.
  siteLookup: { limit: 120, windowSeconds: 15 * 60 },
  liveLookup: { limit: 150, windowSeconds: 15 * 60 },
  // The guest gallery page and its photos (a guest with a shared link), per IP; and guest uploads.
  galleryLookup: { limit: 120, windowSeconds: 15 * 60 },
  galleryUpload: { limit: 60, windowSeconds: 60 * 60 },
  // ...and per shared link, so one QR code on a wedding table can serve a whole party.
  galleryUploadLink: { limit: 600, windowSeconds: 60 * 60 },
  // Checking whether a website address is free, per wedding.
  slugCheck: { limit: 120, windowSeconds: 60 * 60 },
} satisfies Record<string, RateLimit>;

/**
 * Fixed-window counter. `key` (e.g. "login:<ip>:<email>") is hashed before storage, so the
 * counters never hold raw IPs or emails. Throws RATE_LIMITED with Retry-After once over the limit.
 */
export async function enforceRateLimit(key: string, { limit, windowSeconds }: RateLimit) {
  const windowMs = windowSeconds * 1000;
  const now = Date.now();
  const windowStart = new Date(Math.floor(now / windowMs) * windowMs);
  const windowEnd = new Date(windowStart.getTime() + windowMs);

  const count = await incrementCounter(hashToken(key), windowStart, windowEnd);
  if (count > limit) {
    throw new AppError("RATE_LIMITED", {
      headers: { "Retry-After": String(Math.ceil((windowEnd.getTime() - now) / 1000)) },
    });
  }
}
