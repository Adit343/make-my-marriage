import { Schema, type Query } from "mongoose";

// Soft delete by default (Architecture §24, DB Design §3.3, §10.2).
//
// Models spread `softDeleteFields` into their definition (so the TS types include them) and then
// apply `softDeletePlugin`. `deletedAt` must always be stored as an explicit null: the partial
// unique indexes use { deletedAt: { $type: "null" } }, which a missing field does not match.

export const softDeleteFields = {
  deletedAt: { type: Date, default: null },
  deletedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  deletionReason: { type: String, default: null, maxlength: 500 },
};

/**
 * The "not deleted" predicate. Deliberately `$type: "null"` rather than `deletedAt: null`:
 * it is the same predicate as the partial indexes, so MongoDB can use them (decision C6).
 * `deletedAt: null` also matches missing fields, which rules those indexes out.
 */
export function notDeleted() {
  return { deletedAt: { $type: "null" as const } };
}

const FILTERED_QUERIES = [
  "countDocuments",
  "deleteMany",
  "deleteOne",
  "distinct",
  "find",
  "findOne",
  "findOneAndDelete",
  "findOneAndReplace",
  "findOneAndUpdate",
  "replaceOne",
  "updateMany",
  "updateOne",
] as const;

/**
 * Hides soft-deleted documents from every query unless the query either
 *   - passes the option `{ withDeleted: true }`, or
 *   - filters on `deletedAt` itself (e.g. restore flows looking for deleted rows).
 *
 * Not applied to aggregate() — use aggregateScoped() (DB Design §10.2).
 */
export function softDeletePlugin(schema: Schema) {
  for (const path of Object.keys(softDeleteFields)) {
    if (!schema.path(path)) {
      throw new Error(
        `softDeletePlugin: spread softDeleteFields into the schema (missing ${path})`,
      );
    }
  }

  schema.pre([...FILTERED_QUERIES], function (this: Query<unknown, unknown>) {
    if (this.getOptions().withDeleted) return;
    if (Object.hasOwn(this.getFilter(), "deletedAt")) return;
    this.where(notDeleted());
  });
}
