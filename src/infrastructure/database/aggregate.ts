import "server-only";
import { Types, type ClientSession, type Model, type PipelineStage } from "mongoose";
import { connectDb } from "@/infrastructure/database/connection";
import { notDeleted } from "@/models/plugins/softDelete";

/**
 * The only sanctioned way to run an aggregation (ESLint bans raw .aggregate() elsewhere).
 * Mongoose query middleware doesn't run for aggregate(), so this always prepends
 * `$match: { weddingId, deletedAt: { $type: "null" } }` (DB Design §10.2) — the soft-delete part
 * only for models that soft delete. Aggregations also skip casting, hence the explicit ObjectId.
 */
export async function aggregateScoped<R>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- accepts any concrete model
  model: Model<any>,
  weddingId: Types.ObjectId | string,
  pipeline: PipelineStage[],
  options: { session?: ClientSession } = {},
): Promise<R[]> {
  if (!model.schema.path("weddingId")) {
    throw new Error(`aggregateScoped: ${model.modelName} is not a wedding-owned model`);
  }

  const match: Record<string, unknown> = { weddingId: new Types.ObjectId(weddingId) };
  if (model.schema.path("deletedAt")) Object.assign(match, notDeleted());

  await connectDb();
  const aggregation = model.aggregate<R>([{ $match: match }, ...pipeline]);
  if (options.session) aggregation.session(options.session);
  return aggregation.exec();
}
