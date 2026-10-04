import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import {
  cursorPageQuery,
  decodeCursor,
  encodeCursor,
  paginateByCursor,
} from "@/lib/http/pagination";

const positionSchema = z.strictObject({ name: z.string(), id: z.string() });

describe("cursor encoding", () => {
  it("round-trips a position", () => {
    const cursor = encodeCursor({ name: "rahul sharma", id: "g1" });
    expect(decodeCursor(cursor, positionSchema)).toEqual({ name: "rahul sharma", id: "g1" });
  });

  it("rejects garbage and tampered cursors with VALIDATION_ERROR", () => {
    const tampered = encodeCursor({ name: { $gt: "" }, id: "g1" });
    for (const cursor of ["not-base64-json", tampered]) {
      expect(() => decodeCursor(cursor, positionSchema)).toThrow(AppError);
    }
  });
});

describe("paginateByCursor()", () => {
  const rows = [1, 2, 3].map((n) => ({ name: `guest ${n}`, id: `g${n}` }));
  const positionOf = (row: { name: string; id: string }) => ({ name: row.name, id: row.id });

  it("trims the extra row and returns a cursor for the last item kept", () => {
    const { items, meta } = paginateByCursor(rows, 2, positionOf);
    expect(items).toHaveLength(2);
    expect(meta.hasMore).toBe(true);
    expect(decodeCursor(meta.nextCursor!, positionSchema)).toEqual({ name: "guest 2", id: "g2" });
  });

  it("reports the last page", () => {
    const { items, meta } = paginateByCursor(rows, 5, positionOf);
    expect(items).toHaveLength(3);
    expect(meta).toEqual({ nextCursor: null, hasMore: false });
  });
});

describe("cursorPageQuery", () => {
  const schema = z.strictObject(cursorPageQuery);

  it("defaults and coerces limit", () => {
    expect(schema.parse({})).toEqual({ limit: 20 });
    expect(schema.parse({ limit: "50" })).toEqual({ limit: 50 });
  });

  it("caps limit at 100", () => {
    expect(schema.safeParse({ limit: "101" }).success).toBe(false);
  });
});
