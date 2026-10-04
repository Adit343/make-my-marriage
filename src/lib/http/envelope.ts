import type { AppError, ErrorCode } from "@/lib/errors";
import { serializeCookie, type CookieToSet } from "@/lib/http/cookies";
import { REQUEST_ID_HEADER } from "@/lib/http/request-id";

// Response envelope (API Design §2.3): clients branch on `success` alone.
export type ApiMeta = Record<string, unknown>;

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: ApiMeta;
}

export interface ApiFailure {
  success: false;
  error: { code: ErrorCode; message: string; details?: unknown };
}

function baseHeaders(requestId: string, cookies: CookieToSet[] = []): Headers {
  const headers = new Headers({ [REQUEST_ID_HEADER]: requestId });
  for (const cookie of cookies) headers.append("set-cookie", serializeCookie(cookie));
  return headers;
}

export function successResponse<T>(
  data: T,
  options: { status?: number; meta?: ApiMeta; requestId: string; cookies?: CookieToSet[] },
): Response {
  const body: ApiSuccess<T> = { success: true, data };
  if (options.meta) body.meta = options.meta;
  return Response.json(body, {
    status: options.status ?? 200,
    headers: baseHeaders(options.requestId, options.cookies),
  });
}

/** 303 so the browser always follows with a GET (OAuth start/callback). */
export function redirectResponse(
  location: string,
  options: { requestId: string; cookies?: CookieToSet[] },
): Response {
  const headers = baseHeaders(options.requestId, options.cookies);
  headers.set("location", location);
  return new Response(null, { status: 303, headers });
}

export function errorResponse(error: AppError, requestId: string): Response {
  const body: ApiFailure = {
    success: false,
    error: { code: error.code, message: error.message },
  };
  if (error.details !== undefined) body.error.details = error.details;
  const headers = baseHeaders(requestId);
  for (const [name, value] of Object.entries(error.headers)) headers.set(name, value);
  return Response.json(body, { status: error.status, headers });
}
