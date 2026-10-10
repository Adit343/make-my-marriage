import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

// A reviewed inventory of every API endpoint and what protects it. The test reads the real route
// files, so a NEW route, or one whose guard was changed or removed, fails here until someone
// updates this table on purpose. That turns "did I remember the auth guard?" into a failing test.
//
//   public          — no session: signup, login, OAuth, password reset, health, public invitation preview
//   optional        — works with or without a session (logout is idempotent)
//   session         — any signed-in user
//   wedding:<perm>  — an active member of THAT wedding whose role grants <perm> (members/permissions.ts)

type Access = "public" | "optional" | "session" | `wedding:${string}`;

const INVENTORY: Record<string, Access> = {
  "GET /api/v1/health": "public",

  "POST /api/v1/auth/signup": "public",
  "POST /api/v1/auth/login": "public",
  "POST /api/v1/auth/logout": "optional",
  "GET /api/v1/auth/google": "public",
  "GET /api/v1/auth/google/callback": "public",
  "POST /api/v1/auth/password/reset-request": "public",
  "POST /api/v1/auth/password/reset-confirm": "public",
  "POST /api/v1/auth/password/change": "session",
  "GET /api/v1/auth/sessions": "session",
  "DELETE /api/v1/auth/sessions": "session",
  "DELETE /api/v1/auth/sessions/[sessionId]": "session",

  "GET /api/v1/users/me": "session",
  "PATCH /api/v1/users/me": "session",
  "DELETE /api/v1/users/me": "session",

  "POST /api/v1/weddings": "session",
  "GET /api/v1/weddings/[weddingId]": "wedding:wedding:view",
  "PATCH /api/v1/weddings/[weddingId]": "wedding:wedding:update",
  "DELETE /api/v1/weddings/[weddingId]": "wedding:wedding:delete",
  // The caller's membership was ended by the deletion; the service proves they are the former owner.
  "POST /api/v1/weddings/[weddingId]/restore": "session",

  "GET /api/v1/weddings/[weddingId]/members": "wedding:wedding:view",
  "PATCH /api/v1/weddings/[weddingId]/members/[memberId]": "wedding:members:manage",
  // Any member may call this on their own row to leave; the service requires members:manage for others.
  "DELETE /api/v1/weddings/[weddingId]/members/[memberId]": "wedding:wedding:view",
  "POST /api/v1/weddings/[weddingId]/members/[memberId]/transfer-ownership":
    "wedding:ownership:transfer",

  "GET /api/v1/weddings/[weddingId]/invitations": "wedding:members:manage",
  "POST /api/v1/weddings/[weddingId]/invitations": "wedding:members:manage",
  "DELETE /api/v1/weddings/[weddingId]/invitations/[invitationId]": "wedding:members:manage",
  "POST /api/v1/weddings/[weddingId]/invitations/[invitationId]/resend": "wedding:members:manage",
  "POST /api/v1/weddings/[weddingId]/invitations/[invitationId]/link": "wedding:members:manage",

  "GET /api/v1/weddings/[weddingId]/events": "wedding:wedding:view",
  "POST /api/v1/weddings/[weddingId]/events": "wedding:events:edit",
  "GET /api/v1/weddings/[weddingId]/events/[eventId]": "wedding:wedding:view",
  // Open to every role at the route; the service lets a member change only events they created.
  "PATCH /api/v1/weddings/[weddingId]/events/[eventId]": "wedding:events:edit",
  "DELETE /api/v1/weddings/[weddingId]/events/[eventId]": "wedding:events:edit",

  "GET /api/v1/weddings/[weddingId]/tasks": "wedding:wedding:view",
  "POST /api/v1/weddings/[weddingId]/tasks": "wedding:tasks:edit",
  // Every role may edit any task; the service lets a member delete only tasks they created.
  "PATCH /api/v1/weddings/[weddingId]/tasks/[taskId]": "wedding:tasks:edit",
  "DELETE /api/v1/weddings/[weddingId]/tasks/[taskId]": "wedding:tasks:edit",

  // Token routes: the secret in the path is the credential (hash lookup, rate limited).
  "GET /api/v1/public/invitations/[token]": "public",
  "POST /api/v1/invitations/accept": "session",
};

const API_ROOT = join(process.cwd(), "src", "app", "api");
const METHODS = ["GET", "POST", "PATCH", "PUT", "DELETE"] as const;

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return routeFiles(full);
    return entry === "route.ts" ? [full] : [];
  });
}

/** What the source of one handler declares as its guard. */
function accessOf(handlerSource: string): Access {
  const weddingGuard = /requireWeddingAccess\(\s*"([^"]+)"\s*\)/.exec(handlerSource);
  if (weddingGuard) return `wedding:${weddingGuard[1]}`;
  if (/\bauth:\s*requireSession\b/.test(handlerSource)) return "session";
  if (/\bauth:\s*optionalSession\b/.test(handlerSource)) return "optional";
  return "public";
}

function discover(): Record<string, Access> {
  const found: Record<string, Access> = {};
  for (const file of routeFiles(API_ROOT)) {
    const source = readFileSync(file, "utf8");
    const path =
      "/api/" +
      relative(API_ROOT, file)
        .split(sep)
        .slice(0, -1) // drop route.ts
        .join("/");
    // Each `export const METHOD = route(` up to the next export (or end of file).
    const parts = source.split(/^export const /m).slice(1);
    for (const part of parts) {
      const method = METHODS.find((m) => part.startsWith(`${m} = route(`));
      if (method) found[`${method} ${path}`] = accessOf(part);
    }
  }
  return found;
}

describe("API route inventory", () => {
  const found = discover();

  it("matches the reviewed table exactly (no unreviewed, missing or weakened routes)", () => {
    expect(Object.keys(found).sort()).toEqual(Object.keys(INVENTORY).sort());
    expect(found).toEqual(INVENTORY);
  });

  it("finds the routes at all (guards against the scan silently matching nothing)", () => {
    expect(Object.keys(found).length).toBeGreaterThan(25);
  });

  it("guards every route under /weddings/:weddingId with a membership+role check, except restore", () => {
    for (const [name, access] of Object.entries(found)) {
      if (!name.includes("/weddings/[weddingId]")) continue;
      if (name.endsWith("/restore")) continue;
      expect(access, name).toMatch(/^wedding:/);
    }
  });

  it("never exposes an unauthenticated route that changes wedding data", () => {
    for (const [name, access] of Object.entries(found)) {
      if (access !== "public") continue;
      expect(name, name).not.toMatch(/weddings|members|invitations\/accept|users/);
    }
  });

  it("uses only GET for read-only routes: no state change behind a GET except OAuth sign-in", () => {
    const writes = Object.keys(found)
      .filter((name) => name.startsWith("GET "))
      .map((name) => name.slice(4));
    // The OAuth callback creates a session on a GET navigation from Google — by design (API §4.4).
    expect(writes.sort()).toEqual(
      [
        "/api/v1/health",
        "/api/v1/auth/google",
        "/api/v1/auth/google/callback",
        "/api/v1/auth/sessions",
        "/api/v1/users/me",
        "/api/v1/weddings/[weddingId]",
        "/api/v1/weddings/[weddingId]/members",
        "/api/v1/weddings/[weddingId]/invitations",
        "/api/v1/weddings/[weddingId]/events",
        "/api/v1/weddings/[weddingId]/events/[eventId]",
        "/api/v1/weddings/[weddingId]/tasks",
        "/api/v1/public/invitations/[token]",
      ].sort(),
    );
  });
});
