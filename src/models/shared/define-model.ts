import mongoose, { type Schema } from "mongoose";

/**
 * Registers a model. In `next dev`, hot reload re-runs model files; replacing the stale model
 * (instead of reusing it) avoids OverwriteModelError and picks up schema edits. Production loads
 * each model once.
 */
export function defineModel<TSchema extends Schema>(name: string, schema: TSchema) {
  if (mongoose.models[name]) mongoose.deleteModel(name);
  return mongoose.model(name, schema);
}
