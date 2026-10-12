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

  // Every member sees every expense and can record one; the service lets a member edit or delete
  // only the expenses they recorded (owner decision 2026-10-10).
  "GET /api/v1/weddings/[weddingId]/expenses": "wedding:wedding:view",
  "POST /api/v1/weddings/[weddingId]/expenses": "wedding:expenses:edit",
  "GET /api/v1/weddings/[weddingId]/expenses/summary": "wedding:wedding:view",
  "GET /api/v1/weddings/[weddingId]/expenses/[expenseId]": "wedding:wedding:view",
  "PATCH /api/v1/weddings/[weddingId]/expenses/[expenseId]": "wedding:expenses:edit",
  "DELETE /api/v1/weddings/[weddingId]/expenses/[expenseId]": "wedding:expenses:edit",
  // Members read an expense's payments; only owners and admins record them.
  "GET /api/v1/weddings/[weddingId]/expenses/[expenseId]/payments": "wedding:wedding:view",
  "POST /api/v1/weddings/[weddingId]/expenses/[expenseId]/payments": "wedding:payments:record",
  "PATCH /api/v1/weddings/[weddingId]/payments/[paymentId]": "wedding:payments:record",
  "DELETE /api/v1/weddings/[weddingId]/payments/[paymentId]": "wedding:payments:record",
  // Vendors hold contact details and terms: owners and admins only (decision D3).
  "GET /api/v1/weddings/[weddingId]/vendors": "wedding:vendors:manage",
  "POST /api/v1/weddings/[weddingId]/vendors": "wedding:vendors:manage",
  "GET /api/v1/weddings/[weddingId]/vendors/search-places": "wedding:vendors:manage",
  "GET /api/v1/weddings/[weddingId]/vendors/[vendorId]": "wedding:vendors:manage",
  "PATCH /api/v1/weddings/[weddingId]/vendors/[vendorId]": "wedding:vendors:manage",
  "DELETE /api/v1/weddings/[weddingId]/vendors/[vendorId]": "wedding:vendors:manage",

  "GET /api/v1/weddings/[weddingId]/guest-groups": "wedding:wedding:view",
  "POST /api/v1/weddings/[weddingId]/guest-groups": "wedding:guests:edit",
  "PATCH /api/v1/weddings/[weddingId]/guest-groups/[groupId]": "wedding:guests:edit",
  "DELETE /api/v1/weddings/[weddingId]/guest-groups/[groupId]": "wedding:guests:edit",

  // Every role edits the guest list (permission guests:edit); there is no per-guest ownership rule.
  "GET /api/v1/weddings/[weddingId]/guests": "wedding:wedding:view",
  "POST /api/v1/weddings/[weddingId]/guests": "wedding:guests:edit",
  "POST /api/v1/weddings/[weddingId]/guests/bulk": "wedding:guests:edit",
  "GET /api/v1/weddings/[weddingId]/guests/summary": "wedding:wedding:view",
  "GET /api/v1/weddings/[weddingId]/guests/[guestId]": "wedding:wedding:view",
  "PATCH /api/v1/weddings/[weddingId]/guests/[guestId]": "wedding:guests:edit",
  "DELETE /api/v1/weddings/[weddingId]/guests/[guestId]": "wedding:guests:edit",
  "GET /api/v1/weddings/[weddingId]/guests/[guestId]/rsvps": "wedding:wedding:view",
  "POST /api/v1/weddings/[weddingId]/guests/[guestId]/rsvps": "wedding:guests:edit",
  "PATCH /api/v1/weddings/[weddingId]/guests/[guestId]/rsvps/[eventId]": "wedding:guests:edit",
  "DELETE /api/v1/weddings/[weddingId]/guests/[guestId]/rsvps/[eventId]": "wedding:guests:edit",
  "GET /api/v1/weddings/[weddingId]/rsvps": "wedding:wedding:view",
  "GET /api/v1/weddings/[weddingId]/rsvps/replies": "wedding:wedding:view",

  // Phase 3, step 3.2: invitations, personal links and the delivery log. Every role may send (permission
  // invitations:send); the delivery log and retrying from it are admin+ (invitations:logs); the overview and a guest's existing link are wedding:view.
  "POST /api/v1/weddings/[weddingId]/guests/invite-batch": "wedding:invitations:send",
  "POST /api/v1/weddings/[weddingId]/guests/[guestId]/invite": "wedding:invitations:send",
  "GET /api/v1/weddings/[weddingId]/guests/[guestId]/link": "wedding:wedding:view",
  "POST /api/v1/weddings/[weddingId]/guests/[guestId]/link": "wedding:invitations:send",
  "POST /api/v1/weddings/[weddingId]/guests/[guestId]/link/rotate": "wedding:invitations:send",
  "GET /api/v1/weddings/[weddingId]/guest-invitations/overview": "wedding:wedding:view",
  "GET /api/v1/weddings/[weddingId]/email-logs": "wedding:invitations:logs",
  "POST /api/v1/weddings/[weddingId]/email-logs/[logId]/retry": "wedding:invitations:logs",

  // Phase 5: the wedding website. Anyone on the team can read it; setting it up, editing and publishing
  // are owner and admin (website:manage, decision D3). Reading never creates the site (POST does).
  "GET /api/v1/weddings/[weddingId]/website": "wedding:wedding:view",
  "POST /api/v1/weddings/[weddingId]/website": "wedding:website:manage",
  "PATCH /api/v1/weddings/[weddingId]/website": "wedding:website:manage",
  "POST /api/v1/weddings/[weddingId]/website/publish": "wedding:website:manage",
  "POST /api/v1/weddings/[weddingId]/website/unpublish": "wedding:website:manage",
  "GET /api/v1/weddings/[weddingId]/website/slug-check": "wedding:website:manage",
  // Phase 5: live streams. Every role manages them (livestream:edit), so whoever is at the venue can go live.
  "GET /api/v1/weddings/[weddingId]/livestreams": "wedding:wedding:view",
  "POST /api/v1/weddings/[weddingId]/livestreams": "wedding:livestream:edit",
  "PATCH /api/v1/weddings/[weddingId]/livestreams/[streamId]": "wedding:livestream:edit",
  "DELETE /api/v1/weddings/[weddingId]/livestreams/[streamId]": "wedding:livestream:edit",
  "POST /api/v1/weddings/[weddingId]/livestreams/[streamId]/link/rotate": "wedding:livestream:edit",

  // Phase 6: the photo gallery. Every role can look; making albums, uploading, captioning and
  // favouring photos is gallery:edit (every role; the service lets a member delete only what they
  // made); settings, approving guest photos and shared links/QR codes are gallery:manage (admin+).
  "GET /api/v1/weddings/[weddingId]/gallery": "wedding:wedding:view",
  "PATCH /api/v1/weddings/[weddingId]/gallery": "wedding:gallery:manage",
  "GET /api/v1/weddings/[weddingId]/albums": "wedding:wedding:view",
  "POST /api/v1/weddings/[weddingId]/albums": "wedding:gallery:edit",
  "PATCH /api/v1/weddings/[weddingId]/albums/[albumId]": "wedding:gallery:edit",
  "DELETE /api/v1/weddings/[weddingId]/albums/[albumId]": "wedding:gallery:edit",
  "GET /api/v1/weddings/[weddingId]/assets": "wedding:wedding:view",
  "POST /api/v1/weddings/[weddingId]/assets/upload-url": "wedding:gallery:edit",
  "PATCH /api/v1/weddings/[weddingId]/assets/[assetId]": "wedding:gallery:edit",
  "DELETE /api/v1/weddings/[weddingId]/assets/[assetId]": "wedding:gallery:edit",
  "POST /api/v1/weddings/[weddingId]/assets/[assetId]/confirm": "wedding:gallery:edit",
  "POST /api/v1/weddings/[weddingId]/assets/[assetId]/moderate": "wedding:gallery:manage",
  "GET /api/v1/weddings/[weddingId]/access-tokens": "wedding:gallery:manage",
  "POST /api/v1/weddings/[weddingId]/access-tokens": "wedding:gallery:manage",
  "DELETE /api/v1/weddings/[weddingId]/access-tokens/[tokenId]": "wedding:gallery:manage",

  // Token routes: the secret in the path is the credential (hash lookup, rate limited).
  "GET /api/v1/public/invitations/[token]": "public",
  // A guest's personal RSVP link (no account). The token is the credential; every unusable link is
  // the same 403. The service whitelists what a guest sees and what they may write.
  "GET /api/v1/public/rsvp/[token]": "public",
  "PATCH /api/v1/public/rsvp/[token]": "public",
  // The public wedding site (no account, no token: a published site's address) and a stream's watch
  // page (the link is the credential). Both are hand-built whitelists; every unusable one is one answer.
  "GET /api/v1/public/websites/[slug]": "public",
  "GET /api/v1/public/live/[token]": "public",
  // A shared gallery link (no account): view, and upload when the link and the gallery allow it. The
  // link is the credential; every unusable link is the same 403; photos are a hand-built whitelist.
  "GET /api/v1/public/gallery/[token]": "public",
  "POST /api/v1/public/gallery/[token]/upload-url": "public",
  "POST /api/v1/public/gallery/[token]/assets/[assetId]/confirm": "public",
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
        "/api/v1/weddings/[weddingId]/expenses",
        "/api/v1/weddings/[weddingId]/expenses/summary",
        "/api/v1/weddings/[weddingId]/expenses/[expenseId]",
        "/api/v1/weddings/[weddingId]/expenses/[expenseId]/payments",
        "/api/v1/weddings/[weddingId]/vendors",
        "/api/v1/weddings/[weddingId]/vendors/search-places",
        "/api/v1/weddings/[weddingId]/vendors/[vendorId]",
        "/api/v1/weddings/[weddingId]/guest-groups",
        "/api/v1/weddings/[weddingId]/guests",
        "/api/v1/weddings/[weddingId]/guests/summary",
        "/api/v1/weddings/[weddingId]/guests/[guestId]",
        "/api/v1/weddings/[weddingId]/guests/[guestId]/rsvps",
        "/api/v1/weddings/[weddingId]/rsvps",
        "/api/v1/weddings/[weddingId]/rsvps/replies",
        "/api/v1/weddings/[weddingId]/guests/[guestId]/link",
        "/api/v1/weddings/[weddingId]/guest-invitations/overview",
        "/api/v1/weddings/[weddingId]/email-logs",
        "/api/v1/weddings/[weddingId]/website",
        "/api/v1/weddings/[weddingId]/website/slug-check",
        "/api/v1/weddings/[weddingId]/livestreams",
        "/api/v1/weddings/[weddingId]/gallery",
        "/api/v1/weddings/[weddingId]/albums",
        "/api/v1/weddings/[weddingId]/assets",
        "/api/v1/weddings/[weddingId]/access-tokens",
        "/api/v1/public/invitations/[token]",
        "/api/v1/public/rsvp/[token]",
        "/api/v1/public/websites/[slug]",
        "/api/v1/public/live/[token]",
        "/api/v1/public/gallery/[token]",
      ].sort(),
    );
  });

  it("has exactly two handlers outside the route() pipeline: the development photo store's PUT and GET", () => {
    const raw: string[] = [];
    for (const file of routeFiles(API_ROOT)) {
      const source = readFileSync(file, "utf8");
      const path = "/api/" + relative(API_ROOT, file).split(sep).slice(0, -1).join("/");
      for (const method of METHODS) {
        if (new RegExp(`^export (?:async )?function ${method}\\b`, "m").test(source)) {
          raw.push(`${method} ${path}`);
        }
      }
    }
    expect(raw.sort()).toEqual([
      "GET /api/v1/storage/local/[...key]",
      "PUT /api/v1/storage/local/[...key]",
    ]);
  });
});
