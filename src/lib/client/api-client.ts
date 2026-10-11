// Browser-side helper for the app's own REST API: unwraps the { success, data | error } envelope
// (API Design §2.3) and turns failures into ApiError with the server's code and message.

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface Envelope<T> {
  success: boolean;
  data?: T;
  meta?: Record<string, unknown>;
  error?: { code?: string; message?: string; details?: unknown };
}

export async function apiRequest<T>(
  path: string,
  options: {
    method?: "GET" | "POST" | "PATCH" | "DELETE";
    body?: unknown;
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  return (await apiRequestWithMeta<T>(path, options)).data;
}

/** Like apiRequest, but also returns the envelope's `meta` (for example the next page cursor). */
export async function apiRequestWithMeta<T>(
  path: string,
  options: {
    method?: "GET" | "POST" | "PATCH" | "DELETE";
    body?: unknown;
    signal?: AbortSignal;
  } = {},
): Promise<{ data: T; meta: Record<string, unknown> }> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: options.method ?? "GET",
      headers: options.body === undefined ? undefined : { "content-type": "application/json" },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      credentials: "same-origin",
      signal: options.signal,
    });
  } catch (error) {
    // A request the caller cancelled (a newer search replaced it) is not a network failure.
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(
      "NETWORK_ERROR",
      "Couldn't reach the server. Check your connection and try again.",
      0,
    );
  }

  const payload = (await response.json().catch(() => null)) as Envelope<T> | null;
  if (payload?.success) return { data: payload.data as T, meta: payload.meta ?? {} };
  throw new ApiError(
    payload?.error?.code ?? "INTERNAL_ERROR",
    payload?.error?.message ?? "Something went wrong. Please try again.",
    response.status,
    payload?.error?.details,
  );
}

/** Message for a toast: the server's message for ApiError, a generic one otherwise. */
export function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : "Something went wrong. Please try again.";
}
