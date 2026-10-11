import "server-only";
import { decryptSecret, encryptSecret } from "@/lib/crypto/secret-box";
import { generateToken, hashToken } from "@/lib/crypto/tokens";
import { getEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import {
  findGuestWithLink,
  setGuestLink,
  type StoredLink,
} from "@/modules/guests/guest.repository";
import type { WeddingAuth } from "@/modules/members/guards";

// A guest's personal RSVP link (DB Design §5.3, API Design §8.8). The token is shown to the team
// as https://<app>/i/<token>, so the guest needs no account. Only its SHA-256 is used for lookup;
// an encrypted copy (AES-256-GCM) lets the team copy or share the SAME link again, which a hash
// alone could not. Rotating issues a new token and kills the old one at once.

export interface GuestLinkDto {
  inviteUrl: string;
  createdAt: string;
}

/** What the link helpers need from a guest row loaded with `+link.tokenEnc`. */
export interface GuestWithLink {
  _id: { toString(): string };
  link?: {
    tokenEnc?: string | null;
    createdAt?: Date | null;
    expiresAt?: Date | null;
    revokedAt?: Date | null;
  } | null;
}

/** The key that encrypts stored link tokens: its own variable, or one derived from SESSION_SECRET. */
function encryptionKey(): string {
  const env = getEnv();
  return env.TOKEN_ENCRYPTION_KEY ?? env.SESSION_SECRET;
}

export function inviteUrlFor(token: string): string {
  return new URL(`/i/${token}`, getEnv().APP_URL).toString();
}

function isUsable(link: GuestWithLink["link"], now = new Date()): boolean {
  if (!link || link.revokedAt) return false;
  return !link.expiresAt || link.expiresAt.getTime() > now.getTime();
}

function readToken(link: GuestWithLink["link"]): string | null {
  return link?.tokenEnc ? decryptSecret(link.tokenEnc, encryptionKey()) : null;
}

function freshLink(): { token: string; stored: StoredLink } {
  const token = generateToken();
  return {
    token,
    stored: {
      tokenHash: hashToken(token),
      tokenEnc: encryptSecret(token, encryptionKey()),
      createdAt: new Date(),
      expiresAt: null,
      revokedAt: null,
    },
  };
}

/** The guest's current link without creating one (reads only: used for GET). */
export function existingLinkOf(guest: GuestWithLink): { token: string; createdAt: Date } | null {
  if (!isUsable(guest.link)) return null;
  const token = readToken(guest.link);
  return token ? { token, createdAt: guest.link?.createdAt ?? new Date(0) } : null;
}

/**
 * The guest's link, creating it when they have none. Two simultaneous callers end up with the same
 * link (the write is guarded), so a link already sent is never silently replaced. A stored link
 * that can no longer be decrypted (the key was changed) is replaced, because it cannot be shown.
 */
export async function ensureLinkFor(
  weddingId: string,
  guest: GuestWithLink,
): Promise<{ token: string; createdAt: Date }> {
  const existing = existingLinkOf(guest);
  if (existing) return existing;

  const unreadable = isUsable(guest.link); // usable, but the token can't be recovered
  const { token, stored } = freshLink();
  const written = await setGuestLink(weddingId, guest._id.toString(), stored, {
    onlyIfUnusable: !unreadable,
  });
  if (written) return { token, createdAt: stored.createdAt };

  // Someone else created it first (or the guest is gone): use theirs.
  const again = await findGuestWithLink(weddingId, guest._id.toString());
  const theirs = again ? existingLinkOf(again) : null;
  if (!theirs) throw new AppError("NOT_FOUND");
  return theirs;
}

const toDto = (link: { token: string; createdAt: Date }): GuestLinkDto => ({
  inviteUrl: inviteUrlFor(link.token),
  createdAt: link.createdAt.toISOString(),
});

/** GET: the current link, or null if the guest has none yet. Never writes. */
export async function getGuestLink(
  auth: WeddingAuth,
  guestId: string,
): Promise<GuestLinkDto | null> {
  const guest = await findGuestWithLink(auth.weddingId, guestId);
  if (!guest) throw new AppError("NOT_FOUND");
  const link = existingLinkOf(guest);
  return link ? toDto(link) : null;
}

/** POST: the current link, created if the guest has none ("Copy invite link"). */
export async function createGuestLink(auth: WeddingAuth, guestId: string): Promise<GuestLinkDto> {
  const guest = await findGuestWithLink(auth.weddingId, guestId);
  if (!guest) throw new AppError("NOT_FOUND");
  return toDto(await ensureLinkFor(auth.weddingId, guest));
}

/** A brand-new link; the old one stops working immediately (for a link that may have leaked). */
export async function rotateGuestLink(auth: WeddingAuth, guestId: string): Promise<GuestLinkDto> {
  const guest = await findGuestWithLink(auth.weddingId, guestId);
  if (!guest) throw new AppError("NOT_FOUND");
  const { token, stored } = freshLink();
  const written = await setGuestLink(auth.weddingId, guestId, stored, { onlyIfUnusable: false });
  if (!written) throw new AppError("NOT_FOUND");
  return toDto({ token, createdAt: stored.createdAt });
}
