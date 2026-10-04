import type { Query, Schema } from "mongoose";

// Keeps derived lookup fields (emailNormalized, nameNormalized) in sync with their source field
// on both document saves and update queries (DB Design §9.5). The target field must be declared
// in the schema so its index and TS type live next to it.

export interface NormalizedField {
  source: string;
  target: string;
  normalize: (value: string) => string;
}

const UPDATE_QUERIES = ["findOneAndUpdate", "updateOne", "updateMany"] as const;

export function normalizedFieldsPlugin(schema: Schema, options: { fields: NormalizedField[] }) {
  for (const { source, target } of options.fields) {
    if (!schema.path(source) || !schema.path(target)) {
      throw new Error(`normalizedFieldsPlugin: schema must declare both ${source} and ${target}`);
    }
  }

  schema.pre("validate", function () {
    for (const { source, target, normalize } of options.fields) {
      const value: unknown = this.get(source);
      if (typeof value === "string") this.set(target, normalize(value));
    }
  });

  schema.pre([...UPDATE_QUERIES], function (this: Query<unknown, unknown>) {
    const update = this.getUpdate();
    if (!update) return;
    if (Array.isArray(update)) {
      // A pipeline could rewrite the source field without us seeing the new value.
      throw new Error("Pipeline updates are not supported on models with normalized fields");
    }
    const set = (update.$set ?? {}) as Record<string, unknown>;
    for (const { source, target, normalize } of options.fields) {
      const value = set[source] ?? (update as Record<string, unknown>)[source];
      if (typeof value === "string") this.set(target, normalize(value));
    }
  });
}
