import type { z } from "zod";
import { AppError, type ErrorCode } from "@/lib/errors";
import type { CookieToSet } from "@/lib/http/cookies";
import {
  errorResponse,
  redirectResponse,
  successResponse,
  type ApiMeta,
} from "@/lib/http/envelope";
import { resolveRequestId } from "@/lib/http/request-id";
import { logger } from "@/lib/logger";

// Request pipeline for every API route (Architecture §7, API Design §14.1):
//   request ID → Zod (params, query, body) → authentication → handler → envelope,
//   with one log line per request.

type InputSchema = z.ZodType | undefined;
type Infer<S extends InputSchema> = S extends z.ZodType ? z.output<S> : undefined;

/** What Next.js passes as the second route-handler argument. */
interface NextRouteContext {
  params: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Resolves who is calling, or throws (e.g. 401). Supplied by the auth module (requireSession) so
 * this file stays free of auth logic.
 */
export type AuthResolver<A> = (request: Request) => Promise<A>;

export interface RouteConfig<
  P extends InputSchema,
  Q extends InputSchema,
  B extends InputSchema,
  A,
> {
  params?: P;
  /** Use z.strictObject so unknown query params are rejected (API Design §2.7). */
  query?: Q;
  body?: B;
  auth?: AuthResolver<A>;
}

export interface HandlerInput<
  P extends InputSchema,
  Q extends InputSchema,
  B extends InputSchema,
  A,
> {
  request: Request;
  params: Infer<P>;
  query: Infer<Q>;
  body: Infer<B>;
  auth: A;
  requestId: string;
}

export type HandlerResult<T> =
  | {
      data: T;
      meta?: ApiMeta;
      /** Defaults to 200. */
      status?: number;
      cookies?: CookieToSet[];
    }
  | {
      /** Browser redirect (303) instead of a JSON body — used by the OAuth routes. */
      redirect: string;
      cookies?: CookieToSet[];
    };

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

function userIdOf(auth: unknown): string | undefined {
  if (auth && typeof auth === "object" && "userId" in auth) {
    const userId = (auth as { userId: unknown }).userId;
    return typeof userId === "string" ? userId : undefined;
  }
  return undefined;
}

export function route<
  P extends InputSchema = undefined,
  Q extends InputSchema = undefined,
  B extends InputSchema = undefined,
  A = undefined,
  T = unknown,
>(
  config: RouteConfig<P, Q, B, A>,
  handler: (input: HandlerInput<P, Q, B, A>) => Promise<HandlerResult<T>>,
) {
  return async function handle(request: Request, context: NextRouteContext): Promise<Response> {
    const requestId = resolveRequestId(request.headers);
    const startedAt = performance.now();
    const url = new URL(request.url);
    let status = 500;
    let errorCode: ErrorCode | undefined;
    let userId: string | undefined;

    try {
      const params = await parseInput(config.params, await context.params, "params");
      const query = await parseInput(config.query, Object.fromEntries(url.searchParams), "query");
      const body = config.body
        ? await parseInput(config.body, await readJsonBody(request), "body")
        : undefined;
      const auth = config.auth ? await config.auth(request) : undefined;
      userId = userIdOf(auth);

      const result = await handler({
        request,
        params: params as Infer<P>,
        query: query as Infer<Q>,
        body: body as Infer<B>,
        auth: auth as A,
        requestId,
      });

      if ("redirect" in result) {
        status = 303;
        return redirectResponse(result.redirect, { requestId, cookies: result.cookies });
      }
      status = result.status ?? 200;
      return successResponse(result.data, {
        status,
        meta: result.meta,
        requestId,
        cookies: result.cookies,
      });
    } catch (error) {
      const appError = error instanceof AppError ? error : new AppError("INTERNAL_ERROR");
      status = appError.status;
      errorCode = appError.code;
      if (appError.status >= 500) {
        logger.error("http.unhandled_error", { requestId, userId, error });
      }
      return errorResponse(appError, requestId);
    } finally {
      logger.info("http.request", {
        requestId,
        method: request.method,
        path: redactPath(url.pathname),
        status,
        errorCode,
        userId,
        durationMs: Math.round(performance.now() - startedAt),
      });
    }
  };
}
