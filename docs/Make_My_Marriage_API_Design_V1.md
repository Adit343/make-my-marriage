# Make My Marriage — API Design Document

**Version:** 1.0
**Date:** 30 September 2026
**Status:** V1 API baseline
**Derived from:** *System Design Architecture Document V1.0* (§7, §18–§20) and *Database Design Document V1.0*
**Style:** REST over HTTPS · JSON · Zod-validated · MongoDB/Mongoose-backed

---

## Table of Contents

1. Purpose and Scope
2. Conventions
3. Authorization Model
4. Auth & Session Endpoints
5. Users Endpoint
6. Weddings, Members and Invitations
7. Events and Tasks
8. Guests, Guest Groups and RSVP
9. Expenses, Vendors and Vendor Payments
10. Wedding Website (member + public)
11. Live Streaming (member + public)
12. Gallery, Albums, Assets and Access Tokens
13. Email Logs
14. Cross-Cutting Concerns
15. Drawbacks, Limitations and Alternatives
16. Open Decisions for Product-Owner Approval
17. Architecture Compliance Check
18. Appendix A — Full Endpoint Index
19. Appendix B — Error Code Reference

---

## 1. Purpose and Scope

### In plain words

The database design document says *what the data looks like*. This document says *how the outside world reaches and changes that data*: which URL to call, with what body, under what authentication, and what comes back.

**Concrete example.** When Meena accepts Priya's invitation to help plan the wedding, her browser makes one call:

```text
POST /api/invitations/accept
{ "token": "3f9a2b7c…" }
```

Behind that single call, the service layer runs the transaction described in the database document (§6.6 of that document: claim the invitation, then create a `weddingMembers` row), and the API returns the new membership plus a session cookie, already logged in.

### Scope

This document defines every REST endpoint for the 21 collections in the database design (20 architecture collections + the conditional `passwordResetTokens`), their request/response shapes, validation, and authorization requirements. It does not redefine the database schema (see the Database Design Document) or UI behavior.

### Source-of-truth rule

Where this document conflicts with the System Design Architecture, the architecture wins (Architecture §55, rule 18). Where it conflicts with the Database Design Document, that document's field names, enums and constraints win — this API document only adds the request/response envelope around them. Places where this document *adds* conventions not stated in the architecture are listed in §17 so they can be approved explicitly, the same way the database document tracked its own additions.

---

## 2. Conventions

### 2.1 Base URL and versioning

```text
https://<app-domain>/api
```

No `/v1/` path prefix in V1 — the architecture's example routes (§18) are unprefixed, and there is only one API consumer (the app's own frontend). **Limitation:** a breaking change has no separate version to fall back to. **Alternative:** prefix routes with `/api/v1/` from day one. See open decision 1 (§16).

### 2.2 Request format

- `Content-Type: application/json` for all bodies except file bytes, which never go through this API (see §12 — uploads go directly to S3).
- Route params, query params and the body are **all** validated with Zod before any service code runs (Architecture §19).
- Every request should send `X-Request-ID`; the server generates one if absent and echoes it back for correlation with logs (Architecture §38).

### 2.3 Response envelope

The architecture (§20) defines the **error** shape only:

```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "Invalid request data" } }
```

This document adds a matching **success** shape, so every response — success or failure — has the same top-level keys and the client can branch on `success` alone:

```json
{ "success": true, "data": { /* resource or list */ }, "meta": { /* optional: pagination, etc. */ } }
```

This envelope choice is an *addition* to the architecture (flagged in §17, item 1) — it is the single most-used convention in this document, so it is called out up front rather than repeated at every endpoint.

### 2.4 HTTP methods and status codes

| Method | Use | Typical success code |
|---|---|---|
| `GET` | Read one or list | `200` |
| `POST` | Create, or an action that isn't a pure update (accept invitation, confirm upload, publish) | `201` (created) or `200` (action) |
| `PATCH` | Partial update | `200` |
| `DELETE` | Soft delete (or hard delete for the few hard-delete collections) | `200` with the updated resource, or `204` with no body — this API returns **`200` with the resource** everywhere, so the client always has the fresh `deletedAt` to show "Undo" |

No `PUT` is used — every update in this domain is partial, matching how the database document models updates (individual `PATCH`-able fields, not whole-document replacement).

### 2.5 Error model

Extends Architecture §20 with the specific codes this API needs. Every code below maps to exactly one HTTP status, so the client can switch on either.

| HTTP | `error.code` | Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Zod rejected the input |
| 401 | `AUTHENTICATION_REQUIRED` | No/invalid/expired session |
| 403 | `NOT_A_MEMBER` | Authenticated, but not a member of the requested wedding |
| 403 | `INSUFFICIENT_ROLE` | Member, but role doesn't permit this action |
| 403 | `INVALID_TOKEN` | Guest/invitation/access token missing, wrong, expired or revoked |
| 404 | `NOT_FOUND` | Resource doesn't exist, is soft-deleted, or belongs to another wedding (see §3.4 — these three cases are deliberately indistinguishable) |
| 409 | `CONFLICT` | Generic version/state conflict |
| 409 | `ALREADY_IN_WEDDING` | The `weddingMembers.userId` unique index rejected a second active membership (Database Design §9.1) |
| 409 | `VERSION_CONFLICT` | Optimistic-concurrency (`__v`) mismatch (Database Design §3.7) — client should refetch and retry |
| 409 | `SLUG_TAKEN` | Wedding-website slug collision |
| 422 | `BUSINESS_RULE_VIOLATION` | Passed validation but breaks a domain rule (e.g., `attendingCount` exceeds `1 + plusOnesAllowed`) |
| 429 | `RATE_LIMITED` | Endpoint-specific cooldown triggered |
| 500 | `INTERNAL_ERROR` | Unexpected failure. Never includes a stack trace or provider secret (Architecture §20, §49). |

Full table with example messages: Appendix B.

### 2.6 Pagination

Matches the two strategies from Database Design §8.4.

**Cursor pagination** (guests, gallery assets, expenses, vendor payments, email logs, tasks):

```text
GET /api/weddings/:weddingId/guests?limit=20&cursor=eyJuYW1lIjoiUmFodWwi...
```

```json
{
  "success": true,
  "data": [ /* up to `limit` items */ ],
  "meta": { "nextCursor": "eyJuYW1lIjoiVmlrYXMi...", "hasMore": true }
}
```

`cursor` is an opaque, base64url-encoded copy of the last row's sort key + `_id` (the exact pair the matching index is built on). The client must treat it as opaque and never construct one itself.

**Page-number pagination** (members, invitations — small admin lists):

```text
GET /api/weddings/:weddingId/members?page=1&pageSize=20
```

```json
{ "success": true, "data": [ /* items */ ], "meta": { "page": 1, "pageSize": 20, "totalCount": 6 } }
```

`limit`/`pageSize` default to 20, max 100 (Zod-enforced) to protect against accidentally-huge responses.

### 2.7 Filtering and sorting

Query params are an explicit allowlist per endpoint (never a raw pass-through of MongoDB query syntax — that would let a client shape arbitrary database queries). Each endpoint's table below states exactly which filters it accepts; anything else is a `400 VALIDATION_ERROR`.

### 2.8 Idempotency

`POST` actions that can reasonably be retried after a dropped connection (accept invitation, confirm upload, send invitation batch) are **naturally idempotent** by construction: accept-invitation re-claims are rejected by the `status: pending` guard (Database Design §6.6), and batch sends use `emailLogs.idempotencyKey` (Database Design §6.21) so a retried batch never double-sends. No generic `Idempotency-Key` header is needed in V1 because every retry-sensitive action already has its own natural guard — see open decision 2 (§16) if that changes.

### 2.9 CSRF note

Session cookies are `SameSite=Lax`, which blocks cross-site `POST`/`PATCH`/`DELETE` from ever reaching the API with the cookie attached, but `Lax` still **allows** a top-level cross-site `GET` navigation to carry the cookie. Every state-changing action in this API uses a non-`GET` method specifically so `SameSite=Lax` alone is sufficient — no endpoint performs a write on `GET`. This is why §2.4 insists `GET` is read-only with no exceptions.

### 2.10 Rate limiting

Implements Architecture §40 (no Redis; lightweight, per-endpoint). Each sensitive endpoint's table row states its own limit; see §14.3 for the shared mechanism.

---
## 3. Authorization Model

### 3.1 The four checks, at the API layer

Database Design §9.2 requires every wedding-owned lookup to include `weddingId`. This section is the API-side mirror of Architecture §12's four checks, expressed as middleware every protected route passes through in order:

```text
1. requireSession      → 401 AUTHENTICATION_REQUIRED if no valid session
2. requireMembership    → 403 NOT_A_MEMBER if user has no active row in weddingMembers for :weddingId
3. requireRole(roles)   → 403 INSUFFICIENT_ROLE if membership.role isn't in the allowed set
4. (in the service)     → 404 NOT_FOUND if the target resource's weddingId doesn't match :weddingId
```

Step 4 deliberately returns `404`, not `403`: telling an attacker "that guest exists but isn't yours" (403) confirms the id is valid in *some* wedding; `404` gives nothing away (Database Design §9.2, "cross-wedding reference guard").

### 3.2 Role matrix (open decision 3 in the database document; recommended default used throughout this document)

| Action class | owner | admin | member |
|---|---|---|---|
| View wedding data (events, tasks, guests, gallery…) | ✔ | ✔ | ✔ |
| Create/edit events, tasks, guests, vendors, website, gallery | ✔ | ✔ | ✔ |
| Invite/remove members, change roles | ✔ | ✔ | — |
| View/edit expenses and vendor payments | ✔ | ✔ | — |
| Transfer ownership, delete wedding | ✔ | — | — |
| Manage gallery access tokens, publish website | ✔ | ✔ | — |

A `member`-role user therefore gets `403 INSUFFICIENT_ROLE` on finance and membership-management routes. This table is a recommendation, not fixed by the architecture — confirm it against the open decision before Phase 1 ships (Database Design §15, item 3).

### 3.3 Three request "shapes"

| Shape | Who | Identified by | Example route |
|---|---|---|---|
| **Member** | Authenticated user with an active membership | Session cookie → `weddingMembers` lookup | `/api/weddings/:weddingId/guests` |
| **Guest (public token)** | Anonymous guest | A `SecureLink`/access token in the URL, validated per Database Design §5.3 | `/api/public/rsvp/:token` |
| **Public (no auth)** | Anyone | Nothing — server explicitly whitelists fields (Database Design §11.2) | `/api/public/websites/:slug` |

Guest and public routes live under `/api/public/…` so authorization middleware never has to guess which shape a route is — the path itself says so.

### 3.4 "Not found" hides three cases on purpose

A `404` from any member route means one of: the id doesn't exist, it's soft-deleted, or it belongs to a different wedding. The response body never distinguishes which, for the same information-hiding reason as §3.1 step 4.

---

## 4. Auth & Session Endpoints

Module: `auth`. Collections touched: `users`, `sessions`, `passwordResetTokens` (conditional).

| Method | Path | Auth | Rate limit |
|---|---|---|---|
| POST | `/api/auth/signup` | none | 10 / hour / IP |
| POST | `/api/auth/login` | none | 10 / 15 min / IP + email pair |
| POST | `/api/auth/logout` | session | — |
| GET | `/api/auth/google` | none | 20 / hour / IP |
| GET | `/api/auth/google/callback` | none (state-validated) | — |
| POST | `/api/auth/password/change` | session | 5 / hour / user |
| POST | `/api/auth/password/reset-request` *(conditional)* | none | 5 / hour / email |
| POST | `/api/auth/password/reset-confirm` *(conditional)* | none | 10 / hour / IP |
| GET | `/api/auth/sessions` | session | — |
| DELETE | `/api/auth/sessions/:sessionId` | session | — |

### 4.1 `POST /api/auth/signup`

Implements the flow in Architecture §8.

**Request**

```json
{ "email": "priya@gmail.com", "password": "Str0ngPass!23", "name": "Priya Sharma" }
```

Zod: `email` valid + ≤254; `password` ≥ 10 chars (length, not composition rules — composition rules push people toward predictable patterns); `name` 1–100.

**Response `201`**

```json
{ "success": true, "data": { "user": { "id": "u1", "email": "priya@gmail.com", "name": "Priya Sharma" }, "hasWedding": false } }
```

A `Set-Cookie` header carries the new session (Database Design §6.2: `HttpOnly`, `Secure` in production, `SameSite=Lax`).

**Rules**

- Duplicate `emailNormalized` → `409 CONFLICT` with code `EMAIL_TAKEN`.
- Password hashed with scrypt per Database Design §6.1 before the `users` document is written; the plaintext never reaches a log (Architecture §9, §37).
- `hasWedding` tells the frontend whether to route to "create a wedding" or "join one" vs. the dashboard — computed from a `weddingMembers` lookup, not stored on the user (Database Design §6.1, rule 2).
- **No email-verification gate** (Architecture §8) — the user is immediately authenticated and can create or join a wedding in the same session.

### 4.2 `POST /api/auth/login`

```json
{ "email": "priya@gmail.com", "password": "Str0ngPass!23" }
```

`200` with the same `user`/`hasWedding` shape and a new session cookie. Invalid credentials → `401 AUTHENTICATION_REQUIRED` with a **deliberately generic** message ("Invalid email or password") — never "no account with that email" (that would let an attacker enumerate registered emails). `crypto.timingSafeEqual` compares hashes so response timing doesn't leak which part was wrong (Database Design §6.1).

### 4.3 `POST /api/auth/logout`

No body. Revokes the *current* session (`revokedAt = now`; Database Design §6.2 keeps it, doesn't hard-delete — the TTL index cleans it up later). `200` and a cookie-clearing header.

### 4.4 Google OAuth — `GET /api/auth/google` and `GET /api/auth/google/callback`

Implements the flow diagram in Architecture §11 exactly; this section is the URL-level view of it.

```text
GET /api/auth/google
  → generate state + PKCE verifier/challenge, store server-side (short-lived, e.g. a signed cookie)
  → 302 redirect to Google with state + challenge

GET /api/auth/google/callback?code=...&state=...
  → validate state matches what was issued
  → exchange code for tokens (server-to-server; client secret never leaves the server)
  → validate Google identity (verified email, audience, issuer)
  → find-or-create users row (see the pre-hijacking rule below)
  → create session
  → 302 redirect to the app, already logged in
```

**Response:** both routes are browser redirects, not JSON — there is no fetch-able "response body" for an OAuth flow. On failure, redirect to `/login?error=oauth_failed` with no provider details in the URL (Architecture §49: never expose provider secrets).

**Rule — pre-hijacking guard (Database Design §6.1, rule 3):** when Google reports an email that already has a **password-based** `users` row, the callback does **not** silently attach the Google identity. It redirects to `/login?error=email_exists_password` and requires the person to log in with the password first, then link Google from account settings. Auto-linking here would let an earlier attacker who pre-registered the victim's email with their own password gain access via the victim's real Google login.

### 4.5 `POST /api/auth/password/change`

```json
{ "currentPassword": "Str0ngPass!23", "newPassword": "Ev3nStr0nger!" }
```

`200` with the user object. Verifies `currentPassword` first (`401` if wrong — note this is `401` not `403`, since it's re-proving identity, not authorization). On success: re-hash, save, then **revoke every other session** for this user except the current one (Database Design §6.2), so a stolen session elsewhere is cut off.

### 4.6–4.7 Password reset *(conditional on open decision 2, Database Design §15)*

```text
POST /api/auth/password/reset-request  { "email": "..." }
  → 200 ALWAYS, regardless of whether the email exists (prevents account enumeration)
  → if it exists: create passwordResetTokens row, email a link

POST /api/auth/password/reset-confirm  { "token": "...", "newPassword": "..." }
  → atomically claim the token (Database Design §6.3, rule "findOneAndUpdate with usedAt: null")
  → 200 on success, 400 INVALID_TOKEN if already used/expired
  → revoke all sessions for that user
```

### 4.8 `GET /api/auth/sessions` / `DELETE /api/auth/sessions/:sessionId`

Lists the user's own sessions (`userId`, `userAgent`, `createdAt`, `lastUsedAt`, `isCurrent` — never `tokenHash`, which is `select: false` at the schema level, Database Design §12.4). `DELETE` revokes one (e.g., "log out that old phone"); a user can never fetch or revoke another user's session (filter always includes `userId: currentUser.id`, no route param for it).

---

## 5. Users Endpoint

Module: `users`.

| Method | Path | Auth |
|---|---|---|
| GET | `/api/users/me` | session |
| PATCH | `/api/users/me` | session |
| DELETE | `/api/users/me` | session |

### 5.1 `GET /api/users/me`

```json
{ "success": true, "data": { "id": "u1", "email": "priya@gmail.com", "name": "Priya Sharma", "authProviders": ["google"], "createdAt": "2026-09-28T09:00:00Z" } }
```

`authProviders` is returned as a list of provider *names* only — never `providerUserId` (an external identifier with no client use) and never anything from `passwordAuth`.

### 5.2 `PATCH /api/users/me`

```json
{ "name": "Priya A. Sharma" }
```

Only `name` is editable here; email changes are out of scope for V1 (changing the login identity safely needs re-verification, which V1 doesn't have — see open decision, §16 item 4).

### 5.3 `DELETE /api/users/me`

Implements the account-deletion workflow (Database Design §10.4).

**Response `200` (no wedding owned, or non-owner member):**

```json
{ "success": true, "data": { "status": "deleted" } }
```

**Response `409 CONFLICT` (owns a wedding with other active members):**

```json
{
  "success": false,
  "error": { "code": "OWNER_MUST_RESOLVE_WEDDING", "message": "Transfer ownership or delete the wedding before deleting your account." },
  "data": { "weddingId": "w1", "activeMemberCount": 4 }
}
```

The frontend uses this `data` to route the user to "transfer ownership" or "delete wedding" (Database Design §10.4 table) rather than the API silently choosing one path. Sole-owner-with-no-other-members weddings may pass `?deleteWedding=true` on the same `DELETE` call to do both in one step (still runs as the two-phase workflow in Database Design §10.3 underneath — not a shortcut that skips the 30-day soft-delete grace period).

---
## 6. Weddings, Members and Invitations

Modules: `weddings`, `members`. Collections: `weddings`, `weddingMembers`, `weddingInvitations`.

| Method | Path | Auth | Role |
|---|---|---|---|
| POST | `/api/weddings` | session | any (must have no active membership) |
| GET | `/api/weddings/:weddingId` | member | any |
| PATCH | `/api/weddings/:weddingId` | member | admin+ |
| DELETE | `/api/weddings/:weddingId` | member | owner |
| POST | `/api/weddings/:weddingId/restore` | member (special — see 6.4) | owner |
| GET | `/api/weddings/:weddingId/members` | member | any |
| PATCH | `/api/weddings/:weddingId/members/:memberId` | member | admin+ |
| DELETE | `/api/weddings/:weddingId/members/:memberId` | member | admin+ (or self, to leave) |
| POST | `/api/weddings/:weddingId/members/:memberId/transfer-ownership` | member | owner |
| GET | `/api/weddings/:weddingId/invitations` | member | admin+ |
| POST | `/api/weddings/:weddingId/invitations` | member | admin+ |
| DELETE | `/api/weddings/:weddingId/invitations/:invitationId` | member | admin+ |
| GET | `/api/public/invitations/:token` | guest token | — |
| POST | `/api/invitations/accept` | session | any (no active membership) |

### 6.1 `POST /api/weddings` — create a wedding

```json
{ "title": "Aarav & Diya's Wedding", "weddingDate": "2027-02-14", "partners": [{"name":"Aarav"},{"name":"Diya"}], "timezone": "Asia/Kolkata", "currency": "INR" }
```

Only `title` is required; everything else has defaults (Database Design §6.4). **`201`**, and the response includes the caller's brand-new `owner` membership:

```json
{ "success": true, "data": { "wedding": { "id": "w1", "title": "...", "status": "planning", "..." : "..." }, "membership": { "id": "m1", "role": "owner" } } }
```

**Rules**

- Runs inside the transaction from Database Design §9.3 ("create wedding + owner membership" — never one without the other).
- If the user already has an active membership anywhere, the `weddingMembers.userId` unique index rejects the second insert → the transaction aborts → `409 ALREADY_IN_WEDDING` (Database Design §9.1). This is the database enforcing Architecture §13 at the API's front door.

### 6.2 `GET` / `PATCH /api/weddings/:weddingId`

`PATCH` accepts any subset of: `title`, `weddingDate`, `partners`, `timezone`, `currency`, `location`, `budgetTotalMinor`, `status`. Optimistic concurrency (Database Design §3.7): the client sends back the `version` it last read; a stale write returns `409 VERSION_CONFLICT`.

### 6.3 `DELETE /api/weddings/:weddingId` — soft-delete the wedding

Runs the full workflow in Database Design §10.3: marks the wedding deleted with a 30-day `purgeAfter`, soft-deletes every membership (freeing each user's one-wedding slot), unpublishes the website, and revokes every guest/livestream/gallery token for the wedding.

```json
{ "success": true, "data": { "id": "w1", "deletedAt": "2026-10-01T12:00:00Z", "purgeAfter": "2026-10-31T12:00:00Z" } }
```

Requires the body `{ "confirm": "Aarav & Diya's Wedding" }` — the caller must retype the wedding's title — as a deliberate friction point before an irreversible-feeling action (it's recoverable for 30 days, but the UI shouldn't make that obvious enough to invite carelessness).

### 6.4 `POST /api/weddings/:weddingId/restore`

Available only within the 30-day grace window (Database Design §10.3, step 3). This is the one route where `requireMembership` is relaxed: the caller must be the **former owner** (looked up by `weddingId` + `role: owner` on the soft-deleted membership row, not the normal active-membership check, since restoring the membership *is* the action). If the caller has since joined another wedding, `409 ALREADY_IN_WEDDING`. On success, `200` with the reactivated wedding and membership.

### 6.5 `GET /api/weddings/:weddingId/members`

Page-number pagination (§2.6). Returns `id`, `userId`, `user.name`, `user.email`, `role`, `relationship`, `status`, `joinedAt` — a small joined view built with one extra `users` lookup (`$in` on the page's `userId`s, never per-row — Database Design §12.4, rule 4).

### 6.6 `PATCH /api/weddings/:weddingId/members/:memberId`

```json
{ "role": "admin", "relationship": "planner" }
```

Cannot set `role: "owner"` here — that only happens through transfer-ownership (6.8), which is transactional. Cannot change your own role (prevents an admin from silently promoting themselves — must go through the owner).

### 6.7 `DELETE /api/weddings/:weddingId/members/:memberId`

Removes (soft-deletes) a membership. A member may call this on **their own** `:memberId` to leave voluntarily — same endpoint, relaxed role check when `memberId == caller's own membership id`. The owner's own row is rejected (`422 BUSINESS_RULE_VIOLATION`, code detail `"Transfer ownership first"`) — matches Database Design §6.5, rule 2. Also triggers the task-assignee cleanup (`$pull` from `tasks.assigneeMemberIds`, same rule reference).

### 6.8 `POST /api/weddings/:weddingId/members/:memberId/transfer-ownership`

No body beyond the target `:memberId`. Runs the two-step transaction from Database Design §6.5, rule 2 (demote-then-promote, in that order, so the owner-unique index never briefly sees two owners or zero). `200` with both updated membership rows.

### 6.9–6.11 Invitations

```json
// POST /api/weddings/:weddingId/invitations
{ "email": "meena@example.com", "role": "member", "relationship": "parent", "message": "Would love your help planning!" }
```

`201` with the invitation **and the plaintext link** (shown once, for the inviter to copy/resend — the server only ever stores its hash, Database Design §6.6):

```json
{ "success": true, "data": { "invitation": { "id": "i1", "email": "meena@example.com", "status": "pending", "expiresAt": "2026-10-07T09:00:00Z" }, "inviteLink": "https://app/invite/3f9a2b7c..." } }
```

- A pending invite already exists for that email in this wedding → `409 CONFLICT` (Database Design §6.6, partial unique index on `weddingId + emailNormalized + status:pending`). The response suggests resending instead of creating a duplicate.
- Also creates an `emailLogs` row for the send attempt (module `notifications`, §13).
- `DELETE /api/weddings/:weddingId/invitations/:invitationId` = revoke (`status: revoked`, `revokedAt/By` set) — does **not** hard-delete immediately; the TTL purge (Database Design §6.6) handles that 30 days later.

```text
GET /api/public/invitations/:token
```

Guest-shape route (no session). Returns just enough for a "Join Priya's wedding team?" landing page **before** signup: `{ weddingTitle, inviterName, role, expiresAt, status }`. Never the full wedding document. If invalid/expired/revoked → `200` with `{ valid: false }` rather than an error status, since an expired-link landing page is a normal, expected outcome, not a client error.

```json
// POST /api/invitations/accept  (requires an active session — the person must sign up/log in first)
{ "token": "3f9a2b7c..." }
```

Runs the exact two-step transaction in Database Design §6.6, rule 2: atomically claim the invitation (`findOneAndUpdate` on `status: pending`), then create the `weddingMembers` row. If the caller already has an active membership, the transaction aborts and the invitation is **left `pending`** (not burned by a failed attempt) → `409 ALREADY_IN_WEDDING`. On success, `200` with the new membership.

---

## 7. Events and Tasks

Modules: `events`, `tasks`.

| Method | Path | Role |
|---|---|---|
| GET | `/api/weddings/:weddingId/events` | any |
| POST | `/api/weddings/:weddingId/events` | any |
| GET | `/api/weddings/:weddingId/events/:eventId` | any |
| PATCH | `/api/weddings/:weddingId/events/:eventId` | any |
| DELETE | `/api/weddings/:weddingId/events/:eventId` | any |
| GET | `/api/weddings/:weddingId/tasks` | any |
| POST | `/api/weddings/:weddingId/tasks` | any |
| PATCH | `/api/weddings/:weddingId/tasks/:taskId` | any |
| DELETE | `/api/weddings/:weddingId/tasks/:taskId` | any |

### 7.1 Events

```json
// POST
{ "name": "Haldi", "type": "haldi", "startsAt": "2027-02-13T04:30:00Z", "endsAt": "2027-02-13T07:30:00Z",
  "timezone": "Asia/Kolkata", "location": { "label": "Family Home", "address": { "city": "Surat" } },
  "dressCode": "Yellow", "isPublic": false }
```

`GET /events` returns all events sorted `startsAt` ascending (served by the `{weddingId, startsAt}` index, Database Design §8.2) — small enough per wedding (handful of functions) that this list is never paginated.

Every field maps directly to Database Design §6.7. `PATCH` accepts any subset; `endsAt > startsAt` is Zod-refined. `DELETE` soft-deletes the event **and** cascades to its `rsvps` rows in the same transaction (Database Design §6.7, rule 1) — the response includes how many RSVP rows were affected, so the UI can show "12 RSVPs for this event were also removed."

### 7.2 Tasks

```json
// POST
{ "title": "Book the mandap decorator", "eventId": "e-haldi", "priority": "high", "dueDate": "2027-01-01", "assigneeMemberIds": ["m1","m3"] }
```

**Query params on `GET /tasks`:** `status`, `eventId`, `assigneeMemberId`, `dueBefore` — each maps straight onto the compound indexes in Database Design §8.2/§8.3 ("Tasks due soon that aren't done", "My tasks"). Cursor-paginated.

**Rules**

- `eventId`, if present, is verified to belong to the same wedding before saving (Database Design §9.2, rule 1) — a mismatched id is `404 NOT_FOUND`, not silently accepted.
- Each id in `assigneeMemberIds` must be an **active** `weddingMembers` row for this wedding (Database Design §6.8, rule "Assignees must be active members of the same wedding").
- Setting `status: "done"` auto-sets `completedAt/completedBy` server-side; the client cannot set those fields directly (Database Design §6.8).
- Optimistic concurrency applies (Database Design §3.7): concurrent edits return `409 VERSION_CONFLICT`.

---
## 8. Guests, Guest Groups and RSVP

Modules: `guests`, `guest-groups`, `rsvp`. Collections: `guestGroups`, `guests`, `rsvps`, `emailLogs`.

| Method | Path | Role |
|---|---|---|
| GET / POST | `/api/weddings/:weddingId/guest-groups` | any |
| PATCH / DELETE | `/api/weddings/:weddingId/guest-groups/:groupId` | any |
| GET / POST | `/api/weddings/:weddingId/guests` | any |
| GET / PATCH / DELETE | `/api/weddings/:weddingId/guests/:guestId` | any |
| POST | `/api/weddings/:weddingId/guests/:guestId/invite` | any |
| POST | `/api/weddings/:weddingId/guests/:guestId/link/rotate` | any |
| GET | `/api/weddings/:weddingId/guests/:guestId/link` | any |
| GET / POST | `/api/weddings/:weddingId/guests/:guestId/rsvps` | any |
| GET | `/api/weddings/:weddingId/rsvps` | any |
| GET | `/api/public/rsvp/:token` | guest token |
| PATCH | `/api/public/rsvp/:token` | guest token |

### 8.1 Guest groups

Plain CRUD over `guestGroups` (Database Design §6.9). `DELETE` requires the caller to state what happens to its guests, matching the rule that a group's deletion must never silently delete guests:

```json
{ "reassignTo": null }       // ungroup its guests
{ "reassignTo": "gg-other" } // move them to another group (validated same-wedding)
```

### 8.2 `GET /api/weddings/:weddingId/guests` — the guest list

Cursor-paginated (Database Design §8.4), served by `{weddingId, nameNormalized, _id}`.

**Query params:** `search` (anchored prefix on `nameNormalized`, e.g. `?search=sha` matches "Sharma…" — never a "contains" search, Database Design §3.5), `groupId`, `side`, `inviteStatus`, `dietaryPreference`.

**Response item (list shape — deliberately thinner than the full guest document):**

```json
{ "id": "g1", "name": "Rahul Sharma", "groupId": "gg1", "side": "partnerOne",
  "invitation": { "status": "invited", "lastChannel": "whatsapp" },
  "rsvpSummary": { "invitedToCount": 2, "respondedCount": 1 } }
```

`rsvpSummary` is computed with **one** aggregation over `rsvps` for the whole page of guest ids (`$in`), not one query per guest (Database Design §12.4, rule 4 — avoid N+1). `notes` is never included in the list shape (private field, only on `GET .../guests/:guestId`).

### 8.3 `POST /api/weddings/:weddingId/guests`

```json
{ "name": "Rahul Sharma", "groupId": "gg1", "phone": "+919876543210", "side": "partnerOne",
  "ageCategory": "adult", "plusOnesAllowed": 1, "dietaryPreference": "vegetarian" }
```

`201`. Creating a guest does **not** automatically create `rsvps` rows or a `link` — those are separate, explicit actions (8.5, 8.6), because a guest can exist in the system (e.g., during planning) before any event assignment or invitation exists.

### 8.4 `GET/PATCH/DELETE /api/weddings/:weddingId/guests/:guestId`

`GET` returns the full private shape including `notes`, `address`, `invitation`. `DELETE` soft-deletes the guest, revokes their `link`, and cascades to their `rsvps` (Database Design §6.10, rule 3) — same "affected rows" response pattern as event deletion (§7.1).

### 8.5 `GET/POST /api/weddings/:weddingId/guests/:guestId/rsvps` — event assignment

```json
// POST: assign this guest to an event
{ "eventId": "e-haldi" }
```

Creates a `rsvps` row with `status: "pending"` (Database Design §6.11 — "the row's existence means this guest is invited to this event"). `eventId` is verified same-wedding first. Duplicate assignment (row already exists) → `409 CONFLICT` (the unique `{guestId, eventId}` index). `GET` lists the guest's event assignments with their current status.

### 8.6 Invitation sending — `POST /api/weddings/:weddingId/guests/:guestId/invite`

```json
{ "channel": "email" }   // or "whatsapp" or "manual"
```

**For `email`:** creates/reuses the guest's `link`, sends via the email provider (Architecture §29), writes an `emailLogs` row, and updates `guests.invitation` (`status: invited`, `lastSentAt`, `lastChannel`, `sendCount++`). Response includes the send result (`sent` or `failed`, per Architecture §30 — one failure never blocks others when this is called in bulk, see 8.7).

**For `whatsapp`:** returns a prefilled `wa.me` link for the member to tap and send themselves (Architecture §31 — no WhatsApp API, no background process). `guests.invitation` is updated optimistically (the app cannot confirm actual delivery, Database Design §6.10, rule 4).

**For `manual`:** just marks `invitation.status: invited` with no link generation — for a member who called or texted the guest personally.

### 8.7 `POST /api/weddings/:weddingId/guests/invite-batch`

```json
{ "guestIds": ["g1","g2", "... up to 50"], "channel": "email" }
```

Implements Architecture §29's controlled-batch pattern directly: internally chunks into groups of 10 (configurable) and sends sequentially, recording each result to `emailLogs` with a shared `batchId`. `200` with a summary:

```json
{ "success": true, "data": { "batchId": "b-77", "sent": 37, "failed": 3, "failedGuestIds": ["g14","g22","g31"] } }
```

Matches Architecture §30's example exactly ("37 sent, 3 failed") — the endpoint exists specifically so that example is a real, retryable API response, not just a log line. Calling this endpoint again with the same `guestIds` reuses `emailLogs.idempotencyKey` (Database Design §6.21) so already-sent recipients aren't emailed twice, which is what makes "retry the 3 failures" safe to implement as "call again with just those 3 ids."

### 8.8 Guest link — `GET .../guests/:guestId/link` and `POST .../link/rotate`

`GET` returns the current plaintext link for re-display/re-sharing (made possible by `tokenEnc`, Database Design §5.3 — this is the endpoint that decision exists to support). `POST /rotate` issues a brand-new token and immediately invalidates the old one (sets `revokedAt` on the old value implicitly by overwriting it) — for when a link may have leaked.

### 8.9 `GET /api/weddings/:weddingId/rsvps` — headcount and reporting view

**Query params:** `eventId` (required), `status`.

```json
{ "success": true, "data": { "byStatus": { "attending": 142, "declined": 8, "maybe": 3, "pending": 27 }, "totalAttendingCount": 268 } }
```

A single aggregation (`{weddingId, eventId, status}` index) — this is the "who hasn't replied / how many for catering" answer described in Database Design §6.11.

### 8.10 Public RSVP — `GET/PATCH /api/public/rsvp/:token`

Guest-shape routes, no session. Validates the token exactly as Database Design §6.10, rule 2 describes: guest not deleted, link not revoked/expired, **and the wedding itself not soft-deleted**.

**`GET`** returns the guest's own name and their event assignments (`name`, `startsAt`, `endsAt`, `timezone`, `location`, `dressCode`, `description` per event — the whitelist from Database Design §11.2). Never other guests, never `notes`, never anything from `weddingMembers`.

**`PATCH`** body, per event:

```json
{ "responses": [ { "eventId": "e-haldi", "status": "attending", "attendingCount": 2, "note": "So excited!" } ], "dietaryPreference": "vegetarian" }
```

Field whitelist enforced server-side exactly as Database Design §11.2 states: only `rsvps.status`, `attendingCount`, `note`, and the guest's own `dietaryPreference` are writable. `attendingCount` must be ≤ `1 + guest.plusOnesAllowed` → violating that is `422 BUSINESS_RULE_VIOLATION`, not a generic validation error, since it's a cross-field domain rule rather than a shape problem. Sets `respondedAt`, `respondedVia: "guest_link"`.

---

## 9. Expenses, Vendors and Vendor Payments

Modules: `expenses`, `vendors`. Collections: `expenses`, `vendors`, `vendorPayments`. **All routes in this section require `admin+`** (Database Design §11.1 classifies this whole area as private/financial; §3.2 of this document restricts it to owner/admin).

| Method | Path | Notes |
|---|---|---|
| GET / POST | `/api/weddings/:weddingId/expenses` | |
| GET / PATCH / DELETE | `/api/weddings/:weddingId/expenses/:expenseId` | |
| GET | `/api/weddings/:weddingId/expenses/summary` | budget rollup |
| GET / POST | `/api/weddings/:weddingId/vendors` | |
| GET / PATCH / DELETE | `/api/weddings/:weddingId/vendors/:vendorId` | |
| GET | `/api/weddings/:weddingId/vendors/search-places` | Google Places proxy |
| GET / POST | `/api/weddings/:weddingId/expenses/:expenseId/payments` | |
| PATCH / DELETE | `/api/weddings/:weddingId/payments/:paymentId` | |

### 9.1 Expenses

```json
// POST
{ "title": "Photography package", "category": "photography_video", "vendorId": "v1",
  "estimatedAmountMinor": 18000000, "agreedAmountMinor": 16500000 }
```

Amounts are **already in paise** on the wire (Database Design §3.5) — the API does not do rupee↔paise conversion; the client sends and receives minor units directly, and formats for display itself. This is a conscious trade-off: it keeps the server from ever guessing a currency's minor-unit multiplier, at the cost of the frontend needing a shared formatting helper.

**`GET /expenses/:id`** response includes computed payment totals (Database Design §9.4 — "never stored, always derived"):

```json
{ "id": "x1", "title": "Photography package", "agreedAmountMinor": 16500000,
  "paidAmountMinor": 5000000, "remainingAmountMinor": 11500000, "vendorId": "v1", "eventId": null }
```

**`GET /expenses/summary`** — the budget page in one call:

```json
{ "success": true, "data": {
  "budgetTotalMinor": 2500000000,
  "totalEstimatedMinor": 2100000000, "totalAgreedMinor": 1980000000, "totalPaidMinor": 640000000,
  "byCategory": [ { "category": "photography_video", "agreedMinor": 16500000, "paidMinor": 5000000 }, "..." ]
} }
```

One aggregation over `expenses` joined to `vendorPayments` (`$lookup` on the `{weddingId, expenseId}` index), grouped by category — this is the one place this API does a heavier aggregate, and it exists precisely so the frontend never has to fetch every expense and sum client-side.

### 9.2 Vendors

```json
// POST
{ "name": "Lens & Light Studio", "category": "photographer", "status": "shortlisted",
  "contact": { "phone": "+919000011111" },
  "location": { "label": "Lens & Light Studio", "address": {"city":"Surat"}, "placeId": "ChIJ..." },
  "source": "google_places" }
```

**`GET /vendors/search-places`** — the server-mediated Google Places proxy (Architecture §28):

```text
GET /vendors/search-places?query=photographers+in+surat
```

```json
{ "success": true, "data": [ { "placeId": "ChIJ...", "name": "...", "address": "...", "location": {"lat":21.17,"lng":72.83} } ] }
```

Google API credentials stay server-side (Architecture §28 — never in the response, never in a client bundle); this endpoint's only job is to shape the Places response into the fields the "add vendor" form needs, so the frontend never talks to Google directly. Results are **not** persisted — nothing is written to `vendors` until the member explicitly submits the "add vendor" form (Database Design §6.13, rule "not stored until the user chooses to add one").

**Rule (Database Design §6.13):** no route in this API accepts a bank account, UPI PIN, or card field on a vendor. `contact` and `notes` are free text only.

### 9.3 Vendor payments

```json
// POST /expenses/:expenseId/payments
{ "amountMinor": 5000000, "status": "paid", "paidAt": "2027-01-05T11:00:00Z", "method": "upi", "reference": "UPI-8842..." }
```

`expenseId` must belong to the same wedding (route param already scopes this — no separate `weddingId` needed in the body). `PATCH/.../payments/:paymentId` lives directly under the wedding (not nested under the expense) since a payment's own id is sufficient once created — mirrors the "no `vendorId` denormalization" choice in Database Design §6.14: the API doesn't need the expense in the URL to locate a specific payment by its own id, only to create one.

A payment whose running total would exceed the expense's `agreedAmountMinor` still succeeds (`200`), but the response includes a `warning` field (`"exceedsAgreedAmount": true`) rather than rejecting it — matches Database Design §6.12's "real weddings have unplanned extras" rule.

---
## 10. Wedding Website (member + public)

Module: `website`. Collection: `weddingWebsites`.

| Method | Path | Auth | Role |
|---|---|---|---|
| GET | `/api/weddings/:weddingId/website` | member | any |
| PATCH | `/api/weddings/:weddingId/website` | member | admin+ |
| POST | `/api/weddings/:weddingId/website/publish` | member | admin+ |
| POST | `/api/weddings/:weddingId/website/unpublish` | member | admin+ |
| GET | `/api/public/websites/:slug` | public | — |

### 10.1 Member-facing editor routes

`GET` returns the full stored document (the editor needs everything, including `draft` content not yet public). `PATCH` accepts any subset of the editable fields from Database Design §6.15 (`slug`, `title`, `tagline`, `welcomeMessage`, `story`, `heroAssetId`, `sections[]`, `publicEventIds[]`, `display`, `theme`, `seo`).

**Rules mirrored from the database document:**

- `slug` is checked against the reserved list (Database Design §6.15) and uniqueness → `409 SLUG_TAKEN` if already used by another wedding.
- Each id in `publicEventIds` must belong to this wedding **and** have `isPublic: true` on the event itself (two checks — the website can't showcase an event that was never marked shareable). A mismatch is `422 BUSINESS_RULE_VIOLATION`, not silently dropped, so the editor UI can surface exactly which event needs `isPublic` turned on first.
- `heroAssetId`, if set, must reference a `galleryAssets` row with `visibility: public` — otherwise `422`.
- Optimistic concurrency applies (one wedding website document, possibly edited by two admins at once).

### 10.2 `POST /website/publish` and `/unpublish`

No body. Flips `status` (`draft ↔ published`) and sets/clears `publishedAt`. Separated from the general `PATCH` so "go live" is always an explicit, auditable action rather than a side effect of an unrelated field edit.

### 10.3 `GET /api/public/websites/:slug` — the public site

No auth. Implements the whitelist in Database Design §11.2 exactly — this is the one endpoint in the whole API where the response is a hand-built projection, never a stored document passed through:

```json
{
  "success": true,
  "data": {
    "title": "Aarav & Diya's Wedding", "tagline": "...", "story": "...",
    "sections": [ { "type": "schedule", "title": "Events", "body": "..." } ],
    "events": [ { "name": "Reception", "startsAt": "2027-02-14T18:00:00Z", "dressCode": "Formal" } ],
    "heroImageUrl": "https://cdn.example/cloudfront-signed-or-public-url"
  }
}
```

**404, not 403**, if: `status != published`, the website is soft-deleted, **or the wedding itself is soft-deleted** (Database Design §10.3 — child resources become unreachable the instant the parent wedding is hidden, with no separate cascade needed). A reserved or unclaimed slug is also `404`.

**Never returned:** `weddingId`, `createdBy`, budget, members, guests, `notes`, any event's `description`/`notes` beyond what's whitelisted, or a venue address unless `display.showVenueAddresses` is true.

---

## 11. Live Streaming (member + public)

Module: `livestream`. Collection: `liveStreams`.

| Method | Path | Auth | Role |
|---|---|---|---|
| GET / POST | `/api/weddings/:weddingId/livestreams` | member | any |
| PATCH / DELETE | `/api/weddings/:weddingId/livestreams/:streamId` | member | any |
| POST | `/api/weddings/:weddingId/livestreams/:streamId/link/rotate` | member | any |
| GET | `/api/public/live/:token` | guest token | — |

```json
// POST
{ "eventId": "e-ceremony", "provider": "youtube", "streamUrl": "https://youtube.com/watch?v=...",
  "title": "Wedding Ceremony — Live", "startTime": "2027-02-14T13:00:00Z" }
```

`streamUrl` host is checked against the provider's known hosts for `youtube`/`vimeo`; any `https://` host is accepted for `other` (Database Design §6.16). `status` (`scheduled/live/ended/cancelled`) is set **manually** by a `PATCH` from a member — there is no webhook or polling, matching Architecture §35's "no WebSockets" and the database document's note that status changes are human-driven in V1.

`GET /api/public/live/:token` returns `{ title, description, startTime, status, streamUrl, provider }` once the token validates (not revoked/expired, stream and wedding not deleted). Carries forward the honest limitation from Database Design §6.16: this protects the *page*, not the underlying video — a guest who copies the raw YouTube/Vimeo URL can still share it further.

---

## 12. Gallery, Albums, Assets and Access Tokens

Module: `gallery`. Collections: `galleries`, `galleryAlbums`, `galleryAssets`, `galleryAccessTokens`.

| Method | Path | Auth | Role |
|---|---|---|---|
| GET / PATCH | `/api/weddings/:weddingId/gallery` | member | any / admin+ |
| GET / POST | `/api/weddings/:weddingId/albums` | member | any |
| PATCH / DELETE | `/api/weddings/:weddingId/albums/:albumId` | member | any |
| POST | `/api/weddings/:weddingId/assets/upload-url` | member | any |
| POST | `/api/weddings/:weddingId/assets/:assetId/confirm` | member | any |
| GET | `/api/weddings/:weddingId/assets` | member | any |
| PATCH / DELETE | `/api/weddings/:weddingId/assets/:assetId` | member | any (moderation below is admin+) |
| POST | `/api/weddings/:weddingId/assets/:assetId/moderate` | member | admin+ |
| GET / POST | `/api/weddings/:weddingId/access-tokens` | member | admin+ |
| DELETE | `/api/weddings/:weddingId/access-tokens/:tokenId` | member | admin+ |
| GET | `/api/public/gallery/:token` | guest token | — |
| POST | `/api/public/gallery/:token/upload-url` | guest token | — |
| POST | `/api/public/gallery/:token/assets/:assetId/confirm` | guest token | — |

### 12.1 Gallery settings and albums

`GET/PATCH /gallery` — settings only (`title`, `description`, `allowGuestUploads`, `requireUploadApproval`, `coverAssetId`); one document per wedding (Database Design §6.17). Albums are plain CRUD over `galleryAlbums` (§6.18); `DELETE` requires the same "move to root or delete its assets" choice as guest groups (§8.1) and event deletion.

### 12.2 The direct-to-S3 upload flow (member)

This is the API's mirror of Database Design §6.19's five-step lifecycle. Three calls, not one, because the file bytes never pass through this API (Architecture §3.6, §25):

```text
1. POST /assets/upload-url
   { "albumId": "al1", "fileName": "IMG_2041.jpg", "mimeType": "image/jpeg", "sizeBytes": 3200000 }
   → validates mimeType against the allowlist and sizeBytes against the configured max
   → creates a galleryAssets row: status = "pending_upload", server-generated objectKey
   → 200 { assetId: "ga1", uploadUrl: "https://s3.../...(short-lived, presigned PUT)", objectKey: "weddings/w1/gallery/ga1/..." }

2. Browser PUTs the file bytes directly to `uploadUrl` — never touches this API.

3. POST /assets/:assetId/confirm
   → server verifies the S3 object exists and its size/type match what was declared
   → status → "active" (member upload) — matches Database Design §6.19's lifecycle diagram
   → 200 with the full asset record, including its CloudFront delivery URL
```

**Why three calls and not one:** a single `POST /assets` with the file inline would mean the file travels through the Next.js function (slow, costly, and against Architecture §25's "direct media storage" principle) or would require multipart handling this API deliberately avoids. **Drawback:** the client must handle a two-network-hop flow and the "confirm never called" case. **Mitigation:** the `pending_upload` TTL index (Database Design §8.5) cleans up abandoned rows after 24 hours automatically — no client-side retry logic is load-bearing for correctness, only for UX.

### 12.3 `GET /assets` — the gallery grid

Cursor-paginated, served by `{weddingId, albumId, status, _id}` (Database Design §8.2). **Query params:** `albumId`, `status` (defaults to `active` for members; moderators can pass `pending_review`), `mediaType`.

### 12.4 `PATCH/DELETE /assets/:assetId`

`PATCH` allows `caption`, `visibility`, `albumId` (move between albums, same wedding validated). `DELETE` soft-deletes the row — the S3 object is **not** deleted immediately (it's deleted only at wedding-purge time, Database Design §10.1) — so a photo can be restored within the normal wedding-restore window if deleted by mistake.

### 12.5 `POST /assets/:assetId/moderate`

```json
{ "decision": "approve" }   // or "reject"
```

Only meaningful for `status: pending_review` (guest uploads under `requireUploadApproval`). `approve → active`, `reject → rejected`. Admin-only (§3.2): moderation is a gatekeeping action, not ordinary editing.

### 12.6 Access tokens (`galleryAccessTokens`)

```json
// POST /access-tokens
{ "albumId": "al-reception", "label": "Reception QR", "permissions": { "canView": true, "canUpload": true, "canDownload": true } }
```

`201` with the plaintext link shown once (same `tokenEnc`-for-redisplay pattern as guest RSVP links, §8.8, Database Design §5.3) — a QR code can be regenerated from it at any time without minting a new token, since the `GET`-once response and the stored `tokenEnc` both resolve to the same link until the token is explicitly revoked or rotated. `DELETE` sets `revokedAt` (hard-deleted later by the TTL index per Database Design §6.20).

### 12.7 Guest-facing gallery routes (`/api/public/gallery/:token`)

`GET` returns a paginated asset list scoped to the token's `albumId` (or the whole gallery) and `permissions.canView`, with only the whitelist fields from Database Design §11.2: `id`, a CloudFront URL, `mediaType`, `caption`, `width/height` — never `uploadedBy.userId`, `objectKey`, or `weddingId`.

If `permissions.canUpload`, the same two-call presigned flow as §12.2 is available under the token (no session): `POST .../upload-url` then `POST .../assets/:assetId/confirm`. The created asset's `uploadedBy` is `{ kind: "guest", guestId: token.guestId ?? null, displayName: <from request body if the token has no guestId> }` and its `status` becomes `pending_review` if the gallery's `requireUploadApproval` is on, else `active` directly (Database Design §6.19's upload lifecycle, guest branch).

---

## 13. Email Logs

Module: `notifications`. Collection: `emailLogs`. **Read-only from the API's perspective** — rows are written internally by the invitation/RSVP-reminder/batch-send flows (§6.9, §8.6, §8.7), never created directly through a client-facing `POST`.

| Method | Path | Role |
|---|---|---|
| GET | `/api/weddings/:weddingId/email-logs` | admin+ |
| POST | `/api/weddings/:weddingId/email-logs/:logId/retry` | admin+ |

`GET` is cursor-paginated by `{weddingId, createdAt desc}`; filters: `type`, `status`, `batchId`. Returns `recipientEmail`, `type`, `status`, `sentAt`, `error` — never the rendered email body or any token (Database Design §6.21, "never store the rendered email body or any token/link" — there is nothing to leak because it was never captured). `POST .../retry` re-sends one failed row, reusing the same `idempotencyKey` pattern from §8.7 so a double-click can't double-send.

---
## 14. Cross-Cutting Concerns

### 14.1 Request pipeline (mirrors Architecture §7)

```text
HTTP Request
 ↓
Route Handler (thin — parses params, calls the next steps, formats the response envelope)
 ↓
Zod Validation (body + query + route params)
 ↓
Authentication (requireSession)
 ↓
Authorization (requireMembership → requireRole, or the guest/public-token equivalent)
 ↓
Service (business rules, cross-document reference checks — Database Design §9.2)
 ↓
Repository (always takes weddingId as a required parameter — Database Design §9.2, rule 2)
 ↓
Mongoose → MongoDB Atlas
```

Route handlers never call Mongoose models directly — every read or write goes through a repository whose function signature makes the wedding scope impossible to omit (e.g., `findGuest(weddingId, guestId)`, not `findGuest(guestId)`), turning "forgot to scope by wedding" from a runtime security bug into a TypeScript compile error.

### 14.2 Security headers

Applied to every response (Architecture §39):

| Header | Value |
|---|---|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` (no route in this app is meant to be iframed) |
| `Content-Security-Policy` | restrictive default; relaxed only for the wedding-website public route if embeds are ever needed |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |

### 14.3 Rate limiting mechanism (no Redis, Architecture §40)

A small MongoDB-backed counter collection, `rateLimitCounters`, keyed by `{bucket, windowStart}` (e.g., `bucket = "login:203.0.113.4:priya@gmail.com"`), with a TTL index on `windowStart` so old windows clean themselves up automatically — the same pattern already used for tokens, so no new infrastructure category is introduced. **This is an addition beyond the database document's 21 collections** (flagged in §17, item 2) specifically to make Architecture §40's requirement concrete without Redis.

**Drawback:** a database write on every rate-limited request, adding latency to already-sensitive endpoints (login, signup). **Alternative:** Vercel/platform-level edge rate limiting (Architecture §40 lists this as an option) — cheaper, but depends on the hosting platform's specific feature set rather than being portable if the app later moves to ECS/Fargate (Architecture §10, "migration-friendly"). **Recommendation:** use the platform's edge protection as the first line of defense (open decision 5, §16) and keep the MongoDB counters only for the handful of endpoints in §4's rate-limit table, where precise, portable control matters most.

### 14.4 Request logging

Every request logs the fields from Architecture §37/§38: `timestamp`, `level`, `event` (e.g., `"guest.created"`), `requestId`, `userId` when available, `weddingId` when available, `errorCode`, `message`. **Never logged:** request/response bodies wholesale (they may contain `password`, `tokenHash`-adjacent values, or guest personal data) — only the specific whitelisted fields above.

### 14.5 What this API deliberately does not have

- **No GraphQL, no WebSockets, no server-sent events** (Architecture §36, §53) — livestream status and RSVP counts are pulled by the client (`GET`), not pushed.
- **No bulk `PUT`/replace semantics** — every update is a `PATCH` over named fields, matching the database document's field-by-field validation approach.
- **No generic `/search` endpoint** across collections — each list route has its own small, indexed filter set (§2.7), because an unscoped cross-collection search would have no backing index and would violate Database Design §8.1's "don't build an index without a real query."

---

## 15. Drawbacks, Limitations and Alternatives

| # | Decision | Drawback / limitation | Alternative | Why this was chosen |
|---|---|---|---|---|
| 1 | Custom success/error envelope (`{success, data, meta}` / `{success, error}`) | Not a widely standardized format (e.g., not JSON:API) | Adopt JSON:API or a similar spec | Simpler for a single first-party frontend; no external API consumers in V1 |
| 2 | No `/api/v1/` prefix | A breaking change has no side-by-side old version | Prefix from day one | Single consumer; architecture's own example routes are unprefixed |
| 3 | Guest-facing routes under `/api/public/…` rather than token-in-header | URL-based tokens can end up in browser history / referrer headers | Require the token as a header, not a path segment | Matches Architecture §17's literal `/invite/<token>` style link format; mitigated by `Referrer-Policy` (§14.2) and short/expirable tokens where appropriate |
| 4 | Amounts sent/received in minor units (paise) with no server-side currency formatting | Frontend must own all display formatting and rupee↔paise conversion | Server formats a display string too | Keeps the API currency-agnostic per wedding (Database Design §3.5) |
| 5 | Batch invitation send is a single synchronous `POST` that loops internally | A very large guest list could make the request slow, and V1 has no background worker to hand it off to | Real async job queue (BullMQ) | Architecture explicitly excludes queues/workers in V1 (§53); batch size (10 at a time) keeps individual calls fast enough for realistic wedding guest counts |
| 6 | `404` used to hide "wrong wedding" vs. "doesn't exist" vs. "deleted" | Slightly less debuggable from the outside (a legitimate client bug looks identical to a malicious probe) | Return distinct codes for each case | Information-hiding matters more than debuggability for cross-tenant isolation (Database Design §9.2) |
| 7 | MongoDB-backed rate-limit counters, not Redis | Extra write per sensitive request | Redis, or pure platform/edge rate limiting | No new infrastructure category; stays portable to ECS/Fargate later |
| 8 | Three-call direct-to-S3 upload flow | More client-side state to manage than a single upload endpoint | Proxy the upload through the API | Matches Architecture §25's direct-to-S3 principle; keeps large file bytes off the Next.js function entirely |
| 9 | No generic `Idempotency-Key` header | A client can't get idempotency for granted on arbitrary new endpoints without the API team adding one | Add a generic idempotency-key mechanism up front | Every retry-sensitive action in V1 already has its own natural guard (§2.8); revisit if new endpoints without one appear |

---

## 16. Open Decisions for Product-Owner Approval

Mirrors the format of Database Design §15; several items reference decisions still pending there.

| # | Question | Recommendation |
|---|---|---|
| 1 | Prefix all routes with `/api/v1/` now, before any client depends on the unprefixed paths? | **Yes**, cheap now, expensive to retrofit later. |
| 2 | Add a generic `Idempotency-Key` request header for all `POST` actions, beyond the endpoint-specific guards already in place? | Not yet — revisit once a specific endpoint's natural guard proves insufficient. |
| 3 | Confirm the role matrix in §3.2 (same as Database Design §15, item 3) — this document's every "Role" column depends on it. | Confirm before Phase 1 ends. |
| 4 | Should users ever be able to change their login email, and if so, does that require re-verification (which V1 otherwise has none of)? | Defer to a later phase; email changes are a common account-takeover vector without verification. |
| 5 | Rate limiting: MongoDB counters (this document's §14.3) vs. relying primarily on Vercel/platform edge protection? | Edge protection as the first line, MongoDB counters only for the endpoints in §4's table. |
| 6 | Should the public wedding-website route (`/api/public/websites/:slug`) be cached at the CDN/edge level, given it's read-heavy and the same for all visitors until republished? | Recommended once real traffic justifies it; not needed for V1 launch. |
| 7 | Expense/vendor routes restricted to `admin+` (§9) — should `owner`-only be enforced instead, given how sensitive financial data is? | Current recommendation is `admin+`, matching Database Design's "Private" classification, which doesn't by itself require owner-only; confirm alongside decision 3. |

---

## 17. Architecture Compliance Check

### 17.1 What this design confirms

- REST only, `GET/POST/PATCH/DELETE` per resource semantics, Zod validation at the boundary, and the exact request pipeline from Architecture §7.
- Every wedding-scoped route requires membership **and** role, mirroring Architecture §12's four checks.
- The frontend never talks to MongoDB, Google, or the email provider directly — every external call is server-mediated (Google Places §9.2, Google OAuth §4.4, email §8.6–§8.7).
- No GraphQL, WebSockets, background workers, or queues anywhere in this design (§14.5), matching Architecture §53's exclusion list.
- File uploads go directly browser→S3 with only metadata through the API (§12.2), matching Architecture §25.
- Error responses never include stack traces or provider secrets (§2.5, §4.4); sensitive endpoints (login, signup, password reset, OAuth, invitation acceptance, RSVP token operations) are enumerated with rate limits matching Architecture §39's list.

### 17.2 Additions and deviations that need explicit approval

| Item | Type | Reason |
|---|---|---|
| Success response envelope `{success, data, meta}` | Addition | Architecture §20 only specifies the error shape |
| No `/v1/` path prefix | Deviation from common REST practice, not from the architecture | Matches the architecture's own unprefixed example routes; flagged since it's a one-way door |
| `rateLimitCounters` collection | Addition beyond the Database Design's 21 collections | Makes Architecture §40 ("small application-level counters... database-backed counters only where justified") concrete without Redis |
| `/api/public/…` path convention for guest/public routes | Addition | Architecture doesn't prescribe a URL convention for token-based routes beyond the `/invite/<token>`-style examples; this document generalizes that pattern to a `/api/public/` prefix for API routes specifically (the guest-facing *pages* like `/rsvp/<token>` remain frontend routes, not API routes, and call the corresponding `/api/public/...` endpoint) |
| `404` (not `403`) for cross-wedding/soft-deleted resources | Refinement | Architecture §12 says "never" for hidden UI controls but doesn't specify the API error code; this document picks the information-hiding option |
| Three-call S3 upload flow (`upload-url` → S3 PUT → `confirm`) | Concretization | Architecture §25 diagrams this flow at a high level; this document pins down the exact endpoint boundaries |
| Batch invitation endpoint with internal chunking | Concretization | Architecture §29 describes the batching pattern narratively; this document turns it into one concrete endpoint |

---

## 18. Appendix A — Full Endpoint Index

```text
AUTH
POST   /api/auth/signup
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/google
GET    /api/auth/google/callback
POST   /api/auth/password/change
POST   /api/auth/password/reset-request        (conditional)
POST   /api/auth/password/reset-confirm        (conditional)
GET    /api/auth/sessions
DELETE /api/auth/sessions/:sessionId

USERS
GET    /api/users/me
PATCH  /api/users/me
DELETE /api/users/me

WEDDINGS
POST   /api/weddings
GET    /api/weddings/:weddingId
PATCH  /api/weddings/:weddingId
DELETE /api/weddings/:weddingId
POST   /api/weddings/:weddingId/restore

MEMBERS & INVITATIONS
GET    /api/weddings/:weddingId/members
PATCH  /api/weddings/:weddingId/members/:memberId
DELETE /api/weddings/:weddingId/members/:memberId
POST   /api/weddings/:weddingId/members/:memberId/transfer-ownership
GET    /api/weddings/:weddingId/invitations
POST   /api/weddings/:weddingId/invitations
DELETE /api/weddings/:weddingId/invitations/:invitationId
GET    /api/public/invitations/:token
POST   /api/invitations/accept

EVENTS & TASKS
GET    /api/weddings/:weddingId/events
POST   /api/weddings/:weddingId/events
GET    /api/weddings/:weddingId/events/:eventId
PATCH  /api/weddings/:weddingId/events/:eventId
DELETE /api/weddings/:weddingId/events/:eventId
GET    /api/weddings/:weddingId/tasks
POST   /api/weddings/:weddingId/tasks
PATCH  /api/weddings/:weddingId/tasks/:taskId
DELETE /api/weddings/:weddingId/tasks/:taskId

GUESTS, GROUPS & RSVP
GET    /api/weddings/:weddingId/guest-groups
POST   /api/weddings/:weddingId/guest-groups
PATCH  /api/weddings/:weddingId/guest-groups/:groupId
DELETE /api/weddings/:weddingId/guest-groups/:groupId
GET    /api/weddings/:weddingId/guests
POST   /api/weddings/:weddingId/guests
GET    /api/weddings/:weddingId/guests/:guestId
PATCH  /api/weddings/:weddingId/guests/:guestId
DELETE /api/weddings/:weddingId/guests/:guestId
POST   /api/weddings/:weddingId/guests/:guestId/invite
POST   /api/weddings/:weddingId/guests/invite-batch
GET    /api/weddings/:weddingId/guests/:guestId/link
POST   /api/weddings/:weddingId/guests/:guestId/link/rotate
GET    /api/weddings/:weddingId/guests/:guestId/rsvps
POST   /api/weddings/:weddingId/guests/:guestId/rsvps
GET    /api/weddings/:weddingId/rsvps
GET    /api/public/rsvp/:token
PATCH  /api/public/rsvp/:token

EXPENSES, VENDORS & PAYMENTS
GET    /api/weddings/:weddingId/expenses
POST   /api/weddings/:weddingId/expenses
GET    /api/weddings/:weddingId/expenses/:expenseId
PATCH  /api/weddings/:weddingId/expenses/:expenseId
DELETE /api/weddings/:weddingId/expenses/:expenseId
GET    /api/weddings/:weddingId/expenses/summary
GET    /api/weddings/:weddingId/vendors
POST   /api/weddings/:weddingId/vendors
GET    /api/weddings/:weddingId/vendors/:vendorId
PATCH  /api/weddings/:weddingId/vendors/:vendorId
DELETE /api/weddings/:weddingId/vendors/:vendorId
GET    /api/weddings/:weddingId/vendors/search-places
GET    /api/weddings/:weddingId/expenses/:expenseId/payments
POST   /api/weddings/:weddingId/expenses/:expenseId/payments
PATCH  /api/weddings/:weddingId/payments/:paymentId
DELETE /api/weddings/:weddingId/payments/:paymentId

WEBSITE
GET    /api/weddings/:weddingId/website
PATCH  /api/weddings/:weddingId/website
POST   /api/weddings/:weddingId/website/publish
POST   /api/weddings/:weddingId/website/unpublish
GET    /api/public/websites/:slug

LIVESTREAM
GET    /api/weddings/:weddingId/livestreams
POST   /api/weddings/:weddingId/livestreams
PATCH  /api/weddings/:weddingId/livestreams/:streamId
DELETE /api/weddings/:weddingId/livestreams/:streamId
POST   /api/weddings/:weddingId/livestreams/:streamId/link/rotate
GET    /api/public/live/:token

GALLERY
GET    /api/weddings/:weddingId/gallery
PATCH  /api/weddings/:weddingId/gallery
GET    /api/weddings/:weddingId/albums
POST   /api/weddings/:weddingId/albums
PATCH  /api/weddings/:weddingId/albums/:albumId
DELETE /api/weddings/:weddingId/albums/:albumId
POST   /api/weddings/:weddingId/assets/upload-url
POST   /api/weddings/:weddingId/assets/:assetId/confirm
GET    /api/weddings/:weddingId/assets
PATCH  /api/weddings/:weddingId/assets/:assetId
DELETE /api/weddings/:weddingId/assets/:assetId
POST   /api/weddings/:weddingId/assets/:assetId/moderate
GET    /api/weddings/:weddingId/access-tokens
POST   /api/weddings/:weddingId/access-tokens
DELETE /api/weddings/:weddingId/access-tokens/:tokenId
GET    /api/public/gallery/:token
POST   /api/public/gallery/:token/upload-url
POST   /api/public/gallery/:token/assets/:assetId/confirm

EMAIL LOGS
GET    /api/weddings/:weddingId/email-logs
POST   /api/weddings/:weddingId/email-logs/:logId/retry
```

---

## 19. Appendix B — Error Code Reference

| `error.code` | HTTP | Example message | Where it appears |
|---|---|---|---|
| `VALIDATION_ERROR` | 400 | "Invalid request data" | Any endpoint, on a bad body/query/param |
| `EMAIL_TAKEN` | 409 | "An account with this email already exists" | Signup |
| `AUTHENTICATION_REQUIRED` | 401 | "Invalid email or password" / "Session expired, please log in again" | Login, any member route with no/expired session |
| `NOT_A_MEMBER` | 403 | "You don't have access to this wedding" | Any member route, no active membership |
| `INSUFFICIENT_ROLE` | 403 | "This action requires an admin or owner" | Role-gated routes (§3.2) |
| `INVALID_TOKEN` | 403 | "This link is invalid or has expired" | Guest/invitation/access-token routes |
| `NOT_FOUND` | 404 | "Resource not found" | Any route — deliberately generic (§3.4) |
| `CONFLICT` | 409 | "This action conflicts with the current state" | Duplicate pending invitation, duplicate RSVP assignment |
| `ALREADY_IN_WEDDING` | 409 | "You already belong to a wedding" | Create wedding, accept invitation, restore wedding |
| `VERSION_CONFLICT` | 409 | "This was updated elsewhere — please refresh and try again" | Any `PATCH` with optimistic concurrency |
| `SLUG_TAKEN` | 409 | "This website address is already in use" | Website slug update |
| `BUSINESS_RULE_VIOLATION` | 422 | "Attending count exceeds allowed plus-ones" | RSVP submission, event/website cross-reference checks |
| `OWNER_MUST_RESOLVE_WEDDING` | 409 | "Transfer ownership or delete the wedding before deleting your account" | Delete own account while owning a wedding with other members |
| `RATE_LIMITED` | 429 | "Too many attempts — please try again later" | Login, signup, password reset, OAuth start |
| `INTERNAL_ERROR` | 500 | "Something went wrong. Please try again." | Unhandled failures |

---

*End of document — Make My Marriage API Design V1.0*
