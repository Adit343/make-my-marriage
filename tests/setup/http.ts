// Calls Next.js route handlers directly with real Request objects — the same code path as
// production, minus the HTTP server.

type RouteHandler = (
  request: Request,
  context: { params: Promise<Record<string, string>> },
) => Promise<Response>;

export interface CallOptions {
  method?: string;
  path?: string;
  body?: unknown;
  /** Value for the Cookie header, e.g. "mmm_session=abc". */
  cookie?: string;
  ip?: string;
  params?: Record<string, string>;
}

export interface CallResult {
  status: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- response bodies are asserted on
  json: any;
  headers: Headers;
  setCookies: string[];
}

export async function call(handler: RouteHandler, options: CallOptions = {}): Promise<CallResult> {
  const headers = new Headers({
    "x-forwarded-for": options.ip ?? "198.51.100.10",
    "user-agent": "vitest",
  });
  if (options.body !== undefined) headers.set("content-type", "application/json");
  if (options.cookie) headers.set("cookie", options.cookie);

  const response = await handler(
    new Request(`http://localhost${options.path ?? "/api/test"}`, {
      method: options.method ?? "POST",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    }),
    { params: Promise.resolve(options.params ?? {}) },
  );

  const isJson = response.headers.get("content-type")?.includes("application/json");
  return {
    status: response.status,
    json: isJson ? await response.json() : null,
    headers: response.headers,
    setCookies: response.headers.getSetCookie(),
  };
}

/** "name=value" for a cookie set by a response, ready to send back in a Cookie header. */
export function cookiePair(setCookies: string[], name: string): string | undefined {
  const header = setCookies.find((cookie) => cookie.startsWith(`${name}=`));
  return header?.split(";")[0];
}

export function cookieValue(setCookies: string[], name: string): string | undefined {
  const pair = cookiePair(setCookies, name);
  return pair ? decodeURIComponent(pair.slice(name.length + 1)) : undefined;
}
