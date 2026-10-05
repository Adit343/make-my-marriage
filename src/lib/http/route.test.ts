import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { redactPath, route } from "@/lib/http/route";
import { objectId } from "@/lib/validation/primitives";

const WEDDING_ID = "64b7f0c2a1b2c3d4e5f60718";

function context(params: Record<string, string> = {}) {
  return { params: Promise.resolve(params) };
}

function jsonRequest(url: string, body?: unknown, headers: Record<string, string> = {}) {
  return new Request(url, {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("route()", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("wraps handler data in the success envelope and passes parsed input", async () => {
    const handler = route(
      {
        params: z.strictObject({ weddingId: objectId }),
        query: z.strictObject({ limit: z.coerce.number().int().default(20) }),
        body: z.strictObject({ title: z.string() }),
      },
      async ({ params, query, body }) => ({
        data: { weddingId: params.weddingId, limit: query.limit, title: body.title },
        meta: { hasMore: false },
        status: 201,
      }),
    );

    const response = await handler(
      jsonRequest(`http://localhost/api/v1/weddings/${WEDDING_ID}?limit=5`, { title: "Haldi" }),
      context({ weddingId: WEDDING_ID }),
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      success: true,
      data: { weddingId: WEDDING_ID, limit: 5, title: "Haldi" },
      meta: { hasMore: false },
    });
  });

  it("hands the validated route params to the auth resolver, after validation", async () => {
    const auth = vi.fn(
      async (_request: Request, params: { weddingId: string }) => params.weddingId,
    );
    const handler = route(
      { params: z.strictObject({ weddingId: objectId }), auth },
      async ({ auth: resolved }) => ({ data: { resolved } }),
    );

    const ok = await handler(
      jsonRequest("http://localhost/api"),
      context({ weddingId: WEDDING_ID }),
    );
    expect((await ok.json()).data.resolved).toBe(WEDDING_ID);

    // A malformed id is a 400 and never reaches the resolver (no database lookup on garbage).
    auth.mockClear();
    const bad = await handler(jsonRequest("http://localhost/api"), context({ weddingId: "nope" }));
    expect(bad.status).toBe(400);
    expect(auth).not.toHaveBeenCalled();
  });

  it("echoes a safe client X-Request-ID and generates one otherwise", async () => {
    const handler = route({}, async () => ({ data: null }));

    const echoed = await handler(
      jsonRequest("http://localhost/x", undefined, { "x-request-id": "abc-123" }),
      context(),
    );
    expect(echoed.headers.get("x-request-id")).toBe("abc-123");

    const generated = await handler(
      jsonRequest("http://localhost/x", undefined, { "x-request-id": 'bad id "quoted"' }),
      context(),
    );
    expect(generated.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("returns VALIDATION_ERROR with details for invalid params, query and body", async () => {
    const handler = route(
      {
        params: z.strictObject({ weddingId: objectId }),
        query: z.strictObject({}),
      },
      async () => ({ data: null }),
    );

    const badParam = await handler(jsonRequest("http://localhost/x"), context({ weddingId: "1" }));
    expect(badParam.status).toBe(400);
    expect(await badParam.json()).toMatchObject({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        details: [{ location: "params", path: "weddingId", message: "Invalid id" }],
      },
    });

    const unknownQuery = await handler(
      jsonRequest("http://localhost/x?sort[$gt]=1"),
      context({ weddingId: WEDDING_ID }),
    );
    expect(unknownQuery.status).toBe(400);
    expect((await unknownQuery.json()).error.details[0].location).toBe("query");
  });

  it("rejects malformed JSON bodies", async () => {
    const handler = route({ body: z.strictObject({ a: z.string() }) }, async () => ({
      data: null,
    }));
    const response = await handler(jsonRequest("http://localhost/x", "{not json"), context());
    expect(response.status).toBe(400);
    expect((await response.json()).error.details[0]).toMatchObject({ location: "body" });
  });

  it("maps AppError to its status, code and client-safe details", async () => {
    const handler = route({}, async () => {
      throw new AppError("ALREADY_IN_WEDDING", { details: { weddingId: WEDDING_ID } });
    });
    const response = await handler(jsonRequest("http://localhost/x"), context());
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      success: false,
      error: {
        code: "ALREADY_IN_WEDDING",
        message: "You already belong to a wedding",
        details: { weddingId: WEDDING_ID },
      },
    });
  });

  it("hides unexpected errors behind INTERNAL_ERROR and logs them server-side", async () => {
    const handler = route({}, async () => {
      throw new Error("connection string mongodb://user:pass@host leaked?");
    });
    const response = await handler(jsonRequest("http://localhost/x"), context());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toEqual({
      code: "INTERNAL_ERROR",
      message: "Something went wrong. Please try again.",
    });
    expect(JSON.stringify(body)).not.toContain("mongodb://");
    expect(errorSpy).toHaveBeenCalledOnce();
  });

  it("logs one line per request with status and a redacted path", async () => {
    const token = "Zx9aQ2bR7cT1dU4eV6fW8gX0hY3iZ5jK7lM9nO1pQ3r";
    const handler = route({}, async () => ({ data: null }));
    await handler(jsonRequest(`http://localhost/api/v1/public/rsvp/${token}`), context());

    expect(logSpy).toHaveBeenCalledOnce();
    const line = JSON.parse(logSpy.mock.calls[0]?.[0] as string);
    expect(line).toMatchObject({
      level: "INFO",
      event: "http.request",
      method: "GET",
      status: 200,
    });
    expect(line.path).not.toContain(token);
  });
});

describe("redactPath()", () => {
  it("redacts token-like segments but keeps ObjectIds", () => {
    const token = "a".repeat(43);
    expect(redactPath(`/api/v1/public/rsvp/${token}`)).toBe(
      "/api/v1/public/rsvp/aaaaaa…[redacted]",
    );
    expect(redactPath(`/api/v1/weddings/${WEDDING_ID}/guests`)).toBe(
      `/api/v1/weddings/${WEDDING_ID}/guests`,
    );
  });
});
