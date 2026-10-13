import "server-only";
import { connectDb } from "@/infrastructure/database/connection";
import { getEmailProvider } from "@/infrastructure/email";
import { storageStatus } from "@/infrastructure/storage";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";

/**
 * Readiness for uptime monitors (Phase 7, step 7.7): can this server reach its database, and is
 * it set up to store photos and send email? Answers with booleans only, never a setting, address
 * or provider name. The database being unreachable is the one failure that makes it unhealthy.
 */
export async function checkReadiness() {
  try {
    const { connection } = await connectDb();
    await connection.db!.command({ ping: 1 });
  } catch (error) {
    logger.error("health.database_unreachable", { error });
    throw new AppError("INTERNAL_ERROR", { message: "The database is not reachable." });
  }
  return {
    status: "ok" as const,
    database: true,
    photoStorage: storageStatus().configured,
    email: getEmailProvider().name !== "unconfigured",
  };
}
