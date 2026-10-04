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
