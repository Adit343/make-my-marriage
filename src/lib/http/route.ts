import type { z } from "zod";
import { AppError, type ErrorCode } from "@/lib/errors";
import { errorResponse, successResponse, type ApiMeta } from "@/lib/http/envelope";
import { resolveRequestId } from "@/lib/http/request-id";
import { logger } from "@/lib/logger";

// Request pipeline for every API route (Architecture §7, API Design §14.1):
//   request ID → Zod (params, query, body) → handler → envelope, with one log line per request.
// Authentication/authorization options are added in step 1.5 once sessions exist.

type InputSchema = z.ZodType | undefined;
type Infer<S extends InputSchema> = S extends z.ZodType ? z.output<S> : undefined;

/** What Next.js passes as the second route-handler argument. */
interface NextRouteContext {
  params: Promise<Record<string, string | string[] | undefined>>;
}

export interface RouteConfig<P extends InputSchema, Q extends InputSchema, B extends InputSchema> {
  params?: P;
  /** Use z.strictObject so unknown query params are rejected (API Design §2.7). */
  query?: Q;
  body?: B;
}

export interface HandlerInput<P extends InputSchema, Q extends InputSchema, B extends InputSchema> {
  request: Request;
  params: Infer<P>;
  query: Infer<Q>;
  body: Infer<B>;
  requestId: string;
}

export interface HandlerResult<T> {
  data: T;
  meta?: ApiMeta;
  /** Defaults to 200. */
  status?: number;
}

type InputLocation = "params" | "query" | "body";

async function parseInput(
  schema: InputSchema,
  value: unknown,
  location: InputLocation,
): Promise<unknown> {
  if (!schema) return undefined;
  const parsed = await schema.safeParseAsync(value);
  if (parsed.success) return parsed.data;
  throw new AppError("VALIDATION_ERROR", {
    details: parsed.error.issues.map((issue) => ({
      location,
      path: issue.path.join("."),
      message: issue.message,
    })),
  });
}

async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new AppError("VALIDATION_ERROR", {
      details: [{ location: "body", path: "", message: "Body must be valid JSON" }],
    });
  }
}

// Guest links carry secrets in the path (/api/v1/public/rsvp/<token>); never log them in full
// (Architecture §37). ObjectIds are 24 chars and are identifiers, not secrets, so they stay.
const TOKEN_LIKE_SEGMENT = /^[A-Za-z0-9_-]{32,}$/;

export function redactPath(pathname: string): string {
  return pathname
    .split("/")
    .map((segment) =>
      TOKEN_LIKE_SEGMENT.test(segment) ? `${segment.slice(0, 6)}…[redacted]` : segment,
    )
    .join("/");
}

export function route<
  P extends InputSchema = undefined,
  Q extends InputSchema = undefined,
  B extends InputSchema = undefined,
  T = unknown,
>(
  config: RouteConfig<P, Q, B>,
  handler: (input: HandlerInput<P, Q, B>) => Promise<HandlerResult<T>>,
) {
  return async function handle(request: Request, context: NextRouteContext): Promise<Response> {
    const requestId = resolveRequestId(request.headers);
    const startedAt = performance.now();
    const url = new URL(request.url);
    let status = 500;
    let errorCode: ErrorCode | undefined;

    try {
      const params = await parseInput(config.params, await context.params, "params");
      const query = await parseInput(config.query, Object.fromEntries(url.searchParams), "query");
      const body = config.body
        ? await parseInput(config.body, await readJsonBody(request), "body")
        : undefined;

      const result = await handler({
        request,
        params: params as Infer<P>,
        query: query as Infer<Q>,
        body: body as Infer<B>,
        requestId,
      });

      status = result.status ?? 200;
      return successResponse(result.data, { status, meta: result.meta, requestId });
    } catch (error) {
      const appError = error instanceof AppError ? error : new AppError("INTERNAL_ERROR");
      status = appError.status;
      errorCode = appError.code;
      if (appError.status >= 500) {
        logger.error("http.unhandled_error", { requestId, error });
      }
      return errorResponse(appError, requestId);
    } finally {
      logger.info("http.request", {
        requestId,
        method: request.method,
        path: redactPath(url.pathname),
        status,
        errorCode,
        durationMs: Math.round(performance.now() - startedAt),
      });
    }
  };
}
