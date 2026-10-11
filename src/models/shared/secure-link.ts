import { Schema } from "mongoose";

// DB Design §5.3. A guest-facing link (the guest's personal RSVP link). The token itself is never
// stored in the clear: `tokenHash` (SHA-256) is what lookups use, and `tokenEnc` (AES-256-GCM, never
// selected by default) lets the team re-show the SAME link. A link is valid only while
// revokedAt is null and expiresAt is null or in the future.
export const secureLinkSchema = new Schema(
  {
    tokenHash: { type: String, required: true, select: false },
    tokenEnc: { type: String, required: true, select: false },
    createdAt: { type: Date, required: true },
    /** null = never expires (allowed "where appropriate", Architecture §17). */
    expiresAt: { type: Date, default: null },
    /** Set when the link is revoked or replaced. */
    revokedAt: { type: Date, default: null },
  },
  { _id: false },
);
