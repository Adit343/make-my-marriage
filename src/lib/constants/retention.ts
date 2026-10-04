// Retention windows approved as DB Design open decision 6 (2026-10-04). TTL indexes are built from
// these values; changing one later needs `collMod` on the live index (see scripts/db-sync-indexes.ts).

const DAY_SECONDS = 24 * 60 * 60;

/** How long a member invitation link stays usable. */
export const MEMBER_INVITATION_TTL_DAYS = 7;

/** Accepted/revoked/expired member invitations are hard-deleted this long afterwards. */
export const INVITATION_PURGE_AFTER_DAYS = 30;

/** emailLogs rows are hard-deleted after this many days. */
export const EMAIL_LOG_RETENTION_DAYS = 180;
export const EMAIL_LOG_RETENTION_SECONDS = EMAIL_LOG_RETENTION_DAYS * DAY_SECONDS;

/** A soft-deleted wedding can be restored for this long before it may be purged. */
export const WEDDING_PURGE_GRACE_DAYS = 30;

/** A deleted account is anonymized after this grace period. */
export const ACCOUNT_ANONYMIZE_GRACE_DAYS = 30;
