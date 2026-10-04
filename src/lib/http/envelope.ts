import type { AppError, ErrorCode } from "@/lib/errors";
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

export function successResponse<T>(
  data: T,
  options: { status?: number; meta?: ApiMeta; requestId: string },
): Response {
  const body: ApiSuccess<T> = { success: true, data };
  if (options.meta) body.meta = options.meta;
  return Response.json(body, {
    status: options.status ?? 200,
    headers: { [REQUEST_ID_HEADER]: options.requestId },
  });
}

export function errorResponse(error: AppError, requestId: string): Response {
  const body: ApiFailure = {
    success: false,
    error: { code: error.code, message: error.message },
  };
  if (error.details !== undefined) body.error.details = error.details;
  return Response.json(body, {
    status: error.status,
    headers: { [REQUEST_ID_HEADER]: requestId },
  });
}
