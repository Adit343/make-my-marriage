import { after } from "next/server";
import { logger } from "@/lib/logger";

/**
 * Runs `work` once the response has been sent, so the response time can't depend on it. Used where
 * timing would leak a secret: password-reset requests answer identically (and equally fast)
 * whether or not the email has an account, because the lookup, token write and email send all
 * happen afterwards.
 *
 * Next keeps the request alive until `work` finishes (it is not a queue or a worker). Outside a
 * request — unit and integration tests calling handlers directly — `after` throws, and the work
 * simply runs inline so tests can observe its effects. Failures are logged, never thrown: the
 * caller has already answered.
 */
export async function runAfterResponse(work: () => Promise<void>): Promise<void> {
  const guarded = async () => {
    try {
      await work();
    } catch (error) {
      logger.error("http.after_response_failed", { error });
    }
  };
  try {
    after(guarded);
  } catch {
    await guarded();
  }
}
