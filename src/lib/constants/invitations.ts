// Limits for sending invitations (API Design §8.7).

/** The most guests one send request may name. */
export const MAX_BATCH_GUESTS = 50;
/** Emails go out in groups of this many at a time (Architecture §29: small, controlled batches). */
export const SEND_CHUNK_SIZE = 10;
/** How many recent send batches the Invitations overview lists. */
export const RECENT_BATCHES_SHOWN = 6;
