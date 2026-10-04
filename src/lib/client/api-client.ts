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
  error?: { code?: string; message?: string; details?: unknown };
}

export async function apiRequest<T>(
  path: string,
  options: { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown } = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: options.method ?? "GET",
      headers: options.body === undefined ? undefined : { "content-type": "application/json" },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      credentials: "same-origin",
    });
  } catch {
    throw new ApiError(
      "NETWORK_ERROR",
      "Couldn't reach the server. Check your connection and try again.",
      0,
    );
  }

  const payload = (await response.json().catch(() => null)) as Envelope<T> | null;
  if (payload?.success) return payload.data as T;
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
