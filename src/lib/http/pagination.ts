import { z } from "zod";
import { AppError } from "@/lib/errors";

// Pagination conventions (API Design §2.6, DB Design §8.4).
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

const pageSize = z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE);

/** Spread into an endpoint's query schema: z.strictObject({ ...cursorPageQuery, status }). */
export const cursorPageQuery = {
  limit: pageSize,
  cursor: z.string().min(1).max(512).optional(),
};

/** For small admin lists (members, invitations). */
export const numberedPageQuery = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize,
};

// Type aliases (not interfaces) so they are assignable to the envelope's ApiMeta index signature.
export type CursorMeta = {
  nextCursor: string | null;
  hasMore: boolean;
};

export type NumberedPageMeta = {
  page: number;
  pageSize: number;
  totalCount: number;
};

/** Opaque cursor: base64url JSON of the last row's sort key + _id. */
export function encodeCursor(position: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(position), "utf8").toString("base64url");
}

export function decodeCursor<T>(cursor: string, schema: z.ZodType<T>): T {
  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
  } catch {
    decoded = undefined;
  }
  const parsed = schema.safeParse(decoded);
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", {
      details: [{ location: "query", path: "cursor", message: "Invalid cursor" }],
    });
  }
  return parsed.data;
}

/**
 * Repositories fetch `limit + 1` rows; this trims the extra row and turns its
 * presence into `hasMore`, so no separate count query is needed.
 */
export function paginateByCursor<T>(
  rows: T[],
  limit: number,
  positionOf: (row: T) => Record<string, unknown>,
): { items: T[]; meta: CursorMeta } {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items.at(-1);
  return {
    items,
    meta: { nextCursor: hasMore && last ? encodeCursor(positionOf(last)) : null, hasMore },
  };
}
