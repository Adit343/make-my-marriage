# Make My Marriage — Project Status

> **Read this first in any new chat or on a new machine.** It records everything that has been built,
> how the code is organised, every decision made with the product owner, and how to work on this
> project. The plan for what comes next is in [`FUTURE_PLANS.md`](FUTURE_PLANS.md).
>
> Last updated: **2026-10-10** · Branch: **`dev`** · Last commit when written: `983d15c`

**Contents**

1. [Snapshot](#1-snapshot)
2. [How we work (rules for the AI and the owner)](#2-how-we-work)
3. [Setting up on a new machine](#3-setting-up-on-a-new-machine)
4. [Tech stack and why](#4-tech-stack-and-why)
5. [Architecture and hard rules](#5-architecture-and-hard-rules)
6. [Project structure](#6-project-structure)
7. [Data model (Phase 1 collections)](#7-data-model)
8. [API endpoints](#8-api-endpoints)
9. [Authentication, sessions and security](#9-authentication-sessions-and-security)
10. [Roles and permissions](#10-roles-and-permissions)
11. [Pages and Stitch designs](#11-pages-and-stitch-designs)
12. [Email](#12-email)
13. [Build history, step by step](#13-build-history-step-by-step)
14. [Decisions log](#14-decisions-log)
15. [Deviations and additions beyond the design docs](#15-deviations-and-additions-beyond-the-design-docs)
16. [Testing and verification](#16-testing-and-verification)
17. [Known limitations and open items](#17-known-limitations-and-open-items)
18. [Gotchas and troubleshooting](#18-gotchas-and-troubleshooting)
19. [Commit history](#19-commit-history)

---

## 1. Snapshot

**Product.** Make My Marriage is an India-first collaborative wedding-planning SaaS. One wedding is
one shared workspace for the couple, their families and a planner. Guests never create accounts:
they use secure links. (Full product definition: `docs/Make_My_Marriage_PRD.md`.)

**Where the project is.**

| Item                | State                                                                                                |
| ------------------- | ---------------------------------------------------------------------------------------------------- |
| Release phase       | **Phase 1 (Foundation) is complete.** Steps 1.1 to 1.9 are built, tested, committed and pushed.      |
| Next phase          | **Phase 2 (Planning) is complete and pushed** (events, schedule, tasks, review). **Phase 3 (Guests and invitations) is next and has not been started.** It needs a plan, a decision on `tokenEnc`/`TOKEN_ENCRYPTION_KEY`, and Stitch designs first (see `FUTURE_PLANS.md` §5). |
| Git                 | Single working branch **`dev`** (never commit to `main`). Local and `origin/dev` are in sync.        |
| Tests               | **458 tests in 50 files, all passing** (276 at end of Phase 1). Typecheck, lint, Prettier and production build all clean. |
| Dependencies        | `npm audit --omit=dev`: 0 known vulnerabilities (checked 2026-10-06).                                |
| Deployed?           | **No.** Runs locally only. Planned host: Vercel (Hobby), later AWS ECS/Fargate.                       |
| Real email          | **Not working for arbitrary recipients yet** (no verified Resend domain). See §12.                   |
| Real Google sign-in | Built but **never tried with real Google credentials** (tests fake Google).                          |

**What a user can do today** (all verified in a real browser):

- Land on the marketing page, sign up (email/password or Google), log in, log out, reset a forgotten password.
- After signup, set up their wedding on an onboarding screen (becoming its **owner**).
- See a dashboard with the wedding name, countdown, team, and designed empty states for modules not built yet.
- Invite family or a planner by email (or copy a link), manage roles, remove people, transfer ownership.
- Join someone else's wedding from an invitation link.
- Edit wedding details, change profile name and password, see and end signed-in sessions, leave or delete a wedding, delete the account.

- Manage tasks: a list grouped by event or a drag-and-drop board (To do / In progress / Done), filtered by event, person, priority and due date; add, edit, assign (up to 10 people), mark done, delete; see an event's tasks on its page and the next tasks on the dashboard.
- Plan the wedding's events on a timeline: add, edit, duplicate and delete Mehendi, Haldi, Sangeet and so on, each with times in its own timezone, a venue, a dress code and a description; open one event's page; see the next event on the dashboard.

**What does not exist yet:** guests, RSVP, expenses, vendors, website,
live stream, gallery. The sidebar shows these as "coming soon".

---

## 2. How we work

These are standing agreements with the product owner. Treat them as rules.

### 2.1 Process

- **Plan first, build after approval.** Never scaffold files or folders, install dependencies, or
  start a new phase without the owner's explicit go-ahead in that session. Propose a plan, wait.
  (From `CLAUDE.md`.)
- **When a design document is ambiguous or silent, ask rather than guess.** Where the AI had to
  choose without asking, it flagged the choice (§14.3) so the owner can change it.
- **Numbered steps with review stops.** Phase 1 was built as steps 1.1 to 1.9. After each step the
  AI stops and reports; the owner reviews.
- **Commit and push only when the owner says so**, and only to branch **`dev`**. Never `main`.
- **Match the Stitch designs exactly.** The owner designs screens in Google Stitch and asks for them
  to be reproduced. Before any UI work, check Stitch (see §11). If no design exists, ask whether to
  build in the existing visual style or wait. (For `/join`, not-found and error pages the owner
  accepted the existing style until designed.)
- **Real data only in the UI.** No sample data. Widgets for unbuilt modules show designed empty states.
- **Mention changes to the docs' own rules before making them** (see "Core rules" in `CLAUDE.md`).

### 2.2 Core rules from `CLAUDE.md` (do not violate without flagging first)

- Soft delete by default; hard delete only for sessions, tokens and email logs (DB Design §10.1).
- One user = one wedding, enforced by a partial unique index. Never bypass in application logic.
- Every wedding-owned repository function takes `weddingId` as a required parameter. No `findById`.
- No Redis, no background workers or queues, no WebSockets, no GraphQL in V1.
- Stack: Next.js + TypeScript, MongoDB Atlas + Mongoose, Zod, S3 + CloudFront for media (metadata only in MongoDB).
- Prettier is the formatting standard; `.prettierrc.json` is committed.

### 2.3 Git routine (this is Windows; these broke commits before)

- **Stage explicit paths. Never `git add -A`.** (`git add -A` once committed an unintended deletion of `.env.example`.)
- Commit messages go in a file and are committed with `git commit -F <file>`. PowerShell 5.1 mangles
  double quotes in inline messages. A scratchpad file is fine.
- In PowerShell, chain with `if ($?) { ... }`, not `;`, so a failed step stops the sequence.
- A `cd` in a Bash tool call persists into later PowerShell calls. Use absolute paths.
- End commit messages with the `Co-Authored-By` trailer the session instructs.
- Pull with rebase if the remote moved (it did once, from a `package-lock.json`-only commit by the owner).

### 2.4 Safety rules for running things

- **The owner often runs their own `next dev` on port 3000. Never stop it.** Next 16 allows only one
  dev server per project, so browser verification uses a **production build** (`next start`) on
  another port (3130 was used) against a **throwaway in-memory MongoDB**, with environment variables
  overriding `.env.local` (`MONGODB_URI`, `APP_URL`, `SESSION_SECRET`).
- Start background servers as `exec node node_modules/next/dist/bin/next start -p <port>`, not `npx`.
  Stopping an `npx` wrapper left orphaned servers holding ports. Check a process's command line
  before killing anything.
- **Never touch the owner's real MongoDB Atlas, Resend account, or Google OAuth** while testing.
  Never print values from `.env.local`; check presence/length only. Never commit secrets.
- A `mongod` on port 27017 belongs to the owner. Do not stop it.

### 2.5 Tooling quirks learned

- Large Bash heredocs containing apostrophes break the Bash tool. Use the **Write** tool to create
  files, and small Node scripts for multi-line edits.
- `innerText` in headless browser checks returns CSS-uppercased text (e.g. `uppercase` labels), and
  includes icon-glyph names (Material Symbols render as text). Match case-insensitively / by suffix.
- Headless Edge ignores narrow window sizes. Use CDP `Emulation.setDeviceMetricsOverride` for phone widths.
- Running the signup-heavy browser scripts repeatedly on one throwaway DB hits the app's own signup
  rate limit (10/hour/IP). Restart the throwaway DB for a clean run.
- `AGENTS.md` (Next.js's managed block) is committed on purpose. Without it `next dev` injects its
  block into `CLAUDE.md`. Do not delete or reformat it.

---

## 3. Setting up on a new machine

1. **Install:** Node **24** (see `.nvmrc`; `engines` is `>=24 <25`), npm, git.
2. **Clone** the repo and `git checkout dev` (the default branch on the remote is `dev`).
3. `npm ci`
4. **Create `.env.local`** from `.env.example` (never committed):

   | Variable                                   | Required | Notes                                                                                                                                  |
   | ------------------------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------- |
   | `APP_URL`                                  | yes      | The address people open. Invitation and password-reset links are built from it. `http://localhost:3000` locally; the real domain in production. |
   | `MONGODB_URI`                              | yes      | MongoDB Atlas (or any replica set; transactions need one). Use a **separate dev database**, never production.                          |
   | `SESSION_SECRET`                           | yes      | **At least 32 characters.** Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`. It also keys the Google OAuth cookie. |
   | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | no       | Enables Google sign-in. Authorised redirect URI: `<APP_URL>/api/v1/auth/google/callback`.                                              |
   | `RESEND_API_KEY`, `EMAIL_FROM`             | no       | Empty key → emails print to the dev console. See §12 for the Resend sender rules.                                                      |

   **The env file is read once at server start** (the validated config is cached). Restart `npm run dev` after editing it.
5. `npm run dev` → http://localhost:3000
6. **Indexes:** `autoIndex` is off in production. Run `npm run db:sync-indexes` (dry run) then `npm run db:sync-indexes -- --apply` against any real database.
7. **Run the tests:** `npm test`. Integration tests download a MongoDB binary on first run, then use an in-memory replica set. They never touch a real database. CI caches the binary.
8. **Stitch MCP (to read the owner's designs).** Not stored in the repo. On a new machine add it
   at user scope with the owner's Stitch API key:
   `claude mcp add --transport http stitch https://stitch.googleapis.com/mcp --header "X-Goog-Api-Key: <KEY>" --scope user`.
   (Originally copied from the Antigravity config at `~/.gemini/config/mcp_config.json`, server "StitchMCP".)
9. **AI memory does not travel between machines.** Anything the AI "remembered" before is captured in
   this file and `FUTURE_PLANS.md`. Read both at the start of a session.

---

## 4. Tech stack and why

| Area             | Choice                                                                | Notes                                                                                                |
| ---------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Framework        | **Next.js 16.3.8** (App Router, Turbopack), **React 19.2.8**          | This is a newer Next than most training data. `AGENTS.md` says read `node_modules/next/dist/docs/` before writing Next code. |
| Language         | **TypeScript ~6.0.3**                                                 | Pinned `<6.1`: typescript-eslint only supports that range. TS 7 exists but is unsupported.           |
| Styling          | **Tailwind CSS v4** only                                              | No component or form libraries (owner decision D9). Stitch HTML targets Tailwind v3; see §11.3.      |
| Database         | **MongoDB Atlas + Mongoose 9.10.x**                                   | Transactions used only where several writes must be atomic.                                           |
| Validation       | **Zod 4**                                                             | Request bodies, query, params; shared enums.                                                          |
| Auth             | Custom (no auth framework). **`jose`** for Google ID-token verification | `jose` explicitly approved; it is not considered an "auth framework".                                |
| Passwords        | Node `crypto.scrypt` (N=32768, r=8, p=1, keyLen 64)                    | Parameters + version stored per hash so cost can be upgraded.                                         |
| Email            | Provider abstraction: console (dev), **Resend REST via `fetch`** (prod) | No SDK dependency. "Unconfigured" provider refuses sends in production without a key.                |
| Tests            | **Vitest 4** (projects: unit + integration), **mongodb-memory-server 11** (MongoDB 8.2.6 replica set) |                                                                                                       |
| Lint / format    | **ESLint 9** (not 10: Next's plugins don't support it yet), **Prettier 3.9.9** pinned |                                                                                                       |
| Node             | **24 LTS**                                                            |                                                                                                       |
| CI               | **GitHub Actions** (typecheck, lint, format check, test, build). No husky/pre-commit hooks.            |                                                                                                       |
| Hosting (planned) | **Vercel Hobby** first; AWS ECS/Fargate later. No Docker in V1.       |                                                                                                       |
| Other deps       | `server-only`, `tsx` (scripts), `@tailwindcss/postcss`                |                                                                                                       |

Production dependencies are only: `jose`, `mongoose`, `next`, `react`, `react-dom`, `server-only`, `zod`.

**Do not run `npm audit fix --force`.** Remaining audit "highs" earlier were dev-only (`braces` via `@next/eslint-plugin-next`).

**Excluded from V1 (do not introduce without owner approval):** Redis, BullMQ, background workers,
microservices, NestJS, a separate Express backend, Kafka, RabbitMQ, GraphQL, WebSockets, Kubernetes,
Docker infrastructure, Clerk, Auth0, Better Auth, Elasticsearch, complex image processing, external
logging platforms, payment processing, vendor marketplace, transportation management. No Server Actions.

---

## 5. Architecture and hard rules

A **modular monolith**: one Next.js app holds the UI, the REST API, authentication, services and
data access. There is no separate backend.

### 5.1 Request pipeline (every API route uses `route()` in `src/lib/http/route.ts`)

```
request ID → Zod validation (params, query, body) → authentication/authorization → handler → envelope
```

- Success: `{ "success": true, "data": …, "meta": … }`. Failure: `{ "success": false, "error": { "code", "message", "details"? } }`.
- Every response carries an `X-Request-ID` and **`Cache-Control: no-store`**.
- Validation runs **before** authentication (the architecture's order). The auth resolver receives the already-validated route params.
- One log line per request, with token-like path segments redacted.
- Errors never include stack traces or secrets. Error codes each map to one HTTP status (`src/lib/errors/index.ts`).

### 5.2 Layering inside each module (`src/modules/<name>/`)

`*.schemas.ts` (Zod) → `*.service.ts` (business rules) → `*.repository.ts` (the **only** files that may import Mongoose models) → model. DTO files shape what leaves the server.

- **ESLint enforces:** no import of `*.model.ts` outside repositories; no `findById*`; no raw `.aggregate()` (use `aggregateScoped`, which always prepends `weddingId` + soft-delete matches); no Server Actions.
- **Repositories** for wedding-owned collections take `weddingId` first. Cross-wedding ids in a request body must be verified in the service (`findOne({_id, weddingId, deletedAt: null})`). Exceptions that are by user or token (documented in code): `findActiveMembershipByUser`, `findUsersWithActiveMembership`, the invitation token lookups, session/token lookups.
- **Server Components** may call **services** directly (never repositories or models). The browser always uses REST.
- **404, not 403,** when a resource doesn't exist, is soft-deleted, or belongs to another wedding (information hiding). `403 NOT_A_MEMBER` is for a wedding you aren't in at all.

### 5.3 Cross-cutting conventions

- **Soft delete** filter is `deletedAt: {$type: "null"}` (matches the partial unique indexes; verified with `explain()`). `deletedAt` must be stored as an **explicit null**.
- **Optimistic concurrency:** `optimisticConcurrency: true` on collaborative models; clients send `version` (= `__v`) in `PATCH` bodies; stale writes get `409 VERSION_CONFLICT`.
- **Money** is integer minor units (paise); field names end in `Minor`. **Calendar dates** are `"YYYY-MM-DD"` strings; instants are `Date` in UTC; events carry an IANA timezone (default `Asia/Kolkata`).
- **Tokens**: 32 random bytes, base64url to the user, SHA-256 hex stored as `tokenHash` (`select: false`). MongoDB ids are never secrets.
- **Pagination**: cursor for large lists, page-number (`page`, `pageSize`, default 20, max 100) for small admin lists. Query parameters are an explicit allow-list (`z.strictObject`).
- **Enums** live once in `src/lib/constants/enums.ts`, shared by Zod and Mongoose.
- **Normalised fields** (`emailNormalized`, `nameNormalized`) set by a `pre('validate')` plugin.
- **Retention constants** in `src/lib/constants/retention.ts` (invitation 7-day life, purge +30 days, email logs 180 days, wedding purge grace 30 days, account anonymize grace 30 days).
- **After-response work:** `runAfterResponse()` (`src/lib/http/after-response.ts`) wraps Next's `after()`; outside a request (tests) it runs inline. Not a queue or worker.

---

## 6. Project structure

```
make-my-marriage/
├── CLAUDE.md                 Project instructions (imports the four design docs + these two files)
├── AGENTS.md                 Next.js managed block (keep)
├── README.md                 Setup, env vars, scripts, structure (for humans)
├── docs/                     The four design docs + PROJECT_STATUS.md + FUTURE_PLANS.md
├── .github/workflows/ci.yml  typecheck, lint, format:check, test, build
├── scripts/db-sync-indexes.ts   Index diff/apply (dry run by default)
├── next.config.ts            Security headers from src/lib/security-headers.ts
├── vitest.config.mts         Projects: unit (src/**/*.test.ts) and integration (tests/integration/**)
├── tests/
│   ├── setup/                auth, database (in-memory replica set), http (call route handlers), wedding helpers, quiet logs
│   └── integration/          auth, dashboard, database, journeys, models, security, weddings
└── src/
    ├── app/                  Pages + REST API
    │   ├── (auth)/           login, signup, forgot-password, reset-password/[token]
    │   ├── dashboard/        page.tsx (overview), team/, settings/
    │   ├── onboarding/       Set up your wedding
    │   ├── join/[token]/     Accept a member invitation
    │   ├── api/v1/…          REST routes (§8)
    │   ├── page.tsx          Landing page
    │   ├── not-found.tsx, error.tsx, layout.tsx, globals.css
    ├── modules/              Domain code (see 5.2)
    │   ├── auth/             signup/login/reset/sessions/Google, rate limiting, guards
    │   ├── users/            profile, account deletion
    │   ├── weddings/         create/read/update/delete/restore
    │   ├── members/          members, invitations, permissions, wedding guard
    │   ├── dashboard/        dashboard + team/settings page data
    │   └── notifications/    email sending, templates, email-log repository
    ├── models/               Mongoose models, plugins (softDelete, normalize), shared sub-schemas
    ├── infrastructure/       database (connection, transaction, aggregateScoped), email (providers), oauth (Google)
    ├── lib/                  http pipeline, errors, crypto, validation, logger, constants, client api-client, helpers
    └── components/           auth, dashboard (shell, sections, team/settings API), landing, ui (toast, icons, dialogs)
```

Notable helpers: `src/lib/invite-link.ts` (safe parsing of invitation tokens/links), `src/lib/user-agent.ts`
(device label for sessions), `src/lib/dates.ts`, `src/lib/text/initials.ts`, `src/lib/security-headers.ts`,
`src/components/ui/icon.tsx` (Material Symbols subset loaded by name; **new icons must be added to its
alphabetically sorted list**), `src/components/ui/toast.tsx` (react-toastify-style, no dependency).

---

## 7. Data model

Ten collections exist (eight from Phase 1, plus `events` and `tasks` from Phase 2). Full spec: `docs/Make_My_Marriage_Database_Design_V1.md`.

| Collection            | Purpose                                              | Delete type                    | Key rules and indexes                                                                                                                                                               |
| --------------------- | ---------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `users`               | Login identities                                     | Soft (anonymise later)         | Unique `emailNormalized`; `passwordAuth` (`select:false`, scrypt object, null for Google-only); `authProviders[]` (max 5); unique partial index on Google `providerUserId`; `status`: active/disabled/pending_deletion |
| `sessions`            | Server-side logins                                   | Hard (TTL)                     | Unique `tokenHash`; TTL on `expiresAt`; `persistent` flag; `userAgent` (≤300), **no IP stored**; `lastUsedAt` touched only if older than ~10 min                                      |
| `passwordResetTokens` | One-time reset links                                 | Hard (TTL)                     | Unique `tokenHash`; 30 minute life; atomic claim (`usedAt: null`)                                                                                                                   |
| `weddings`            | The wedding (root of all data)                       | Soft                           | `title`, `partners[≤2]`, `weddingDate` (string), `timezone`, `currency`, `location`, `budgetTotalMinor`, `status` (planning/completed/archived), `purgeAfter`; **no `ownerUserId`** (owner = the membership with role owner); `version` via `__v` |
| `weddingMembers`      | Person ↔ wedding link, with role                     | Soft                           | **Unique partial `{userId}` where `deletedAt` is null** (one user = one active wedding); **unique partial `{weddingId, role}` where role owner** (exactly one owner); `role` (owner/admin/member) controls permissions; `relationship` is a display label only; `status` active/suspended (nothing sets suspended yet) |
| `weddingInvitations`  | Invitations to join the team                         | Hard (TTL on `purgeAt`)        | Hash-only token; `status` pending/accepted/revoked (**"expired" is computed**, never stored); unique partial `{weddingId, emailNormalized}` where pending; `purgeAt` = expiry/accept/revoke + 30 days; role admin or member only |
| `emailLogs`           | Per-recipient send receipts                          | Hard (TTL 180 days)            | Status sent/failed, provider, sanitised error; never stores bodies or links; idempotency index ready for Phase 3                                                                      |
| `rateLimitCounters`   | Lightweight rate limiting without Redis              | Hard (TTL)                     | Keys are hashed (no raw IPs/emails stored). Addition beyond the DB doc's 21 collections (flagged in the API doc §17)                                                                  |

| `events`              | Wedding functions (Haldi, Sangeet…) with an embedded run-of-show | Soft                | `weddingId`, `name`, `type` (EVENT_TYPES), `startsAt`/`endsAt` (UTC instants, end after start), `timezone` (defaults from the wedding), `location`, `description`, `dressCode`, `sortOrder` (same-time tie-break), `isPublic` (for the Phase 5 website), **`schedule[]`** (≤50 lines of `{time "HH:mm" in the event timezone, title, notes, isPublic}`, each with its own id), `createdBy`; optimistic concurrency; index `{weddingId, startsAt}` |
| `tasks` | To-dos for the team, optionally linked to an event | Soft | `weddingId`, `eventId` (null = general), `title` ≤200, `description` ≤2000, `status` (`todo`/`in_progress`/`done`), `priority` (`low`/`medium`/`high`), `dueDate` (`"YYYY-MM-DD"` string, not an instant), `assigneeMemberIds[]` (≤10, **membership** ids of active members of this wedding), `completedAt`/`completedBy` (set by the server when a task becomes done, cleared when reopened), `createdBy`; optimistic concurrency; indexes `{weddingId,status,dueDate}`, `{weddingId,eventId}`, `{weddingId,assigneeMemberIds}` |

Not yet created (later phases): guestGroups, guests, rsvps, expenses, vendors, vendorPayments, weddingWebsites, liveStreams, galleries, galleryAlbums, galleryAssets, galleryAccessTokens.

**Wedding deletion workflow (DB Design §10.3), as built:** in one transaction, set the wedding's `deletedAt/deletedBy`, `status: archived`, `purgeAfter = +30 days`, and soft-delete **every membership** (reason `wedding_deleted`), which frees each person's one-wedding slot. Child rows are **not** individually soft-deleted: every request is gated on the wedding being live, so they become unreachable at once. Restore (former owner, within 30 days) clears the deletion, sets status back to `planning`, and re-activates the owner **and** the other members removed by the deletion (skipping anyone who has since joined a different wedding). The permanent-purge script does **not exist yet** (Phase 7).

**Account deletion (DB Design §10.4), as built:** blocked with `OWNER_MUST_RESOLVE_WEDDING` if the user owns a wedding with other members; a sole owner must pass `?deleteWedding=true` (soft-deletes the wedding with the 30-day grace); a plain member simply leaves. Then all sessions are revoked and the user is marked `pending_deletion` with `deletedAt`. The email stays reserved. The anonymise script does **not exist yet** (Phase 7).

---

## 8. API endpoints

All under `/api/v1`. 40 route handlers across 28 files. **A route-inventory test
(`src/lib/security/route-inventory.test.ts`) lists every one with its guard; adding or weakening a
route fails the build until that table is updated on purpose.**

Access legend: **public** = no session; **session** = any signed-in user; **optional** = works either way;
**wedding:`perm`** = active member of *that* wedding whose role grants `perm` (§10).

| Method | Path                                                          | Access                       | What it does                                                                                 |
| ------ | ------------------------------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------- |
| GET    | `/health`                                                     | public                       | Liveness                                                                                     |
| POST   | `/auth/signup`                                                | public (10/h/IP)             | Create account + session. `EMAIL_TAKEN` if duplicate. Returns `hasWedding`.                  |
| POST   | `/auth/login`                                                 | public (10/15 min/IP+email)  | Generic "Invalid email or password"; `rememberMe` → 30-day cookie                            |
| POST   | `/auth/logout`                                                | optional                     | Revokes current session; always clears cookie                                                |
| GET    | `/auth/google`                                                | public (20/h/IP)             | Starts OAuth (PKCE); optional `?next=/join/<token>`                                          |
| GET    | `/auth/google/callback`                                       | public                       | Finishes OAuth; redirects to `/dashboard`, `/onboarding`, or the invitation                  |
| POST   | `/auth/password/change`                                       | session (5/h/user)           | Needs current password; revokes other sessions                                               |
| POST   | `/auth/password/reset-request`                                | public (5/h/email)           | Always 200; lookup + email happen **after** the response                                     |
| POST   | `/auth/password/reset-confirm`                                | public (10/h/IP)             | Single-use token; revokes all sessions                                                       |
| GET    | `/auth/sessions`                                              | session                      | Own active sessions                                                                          |
| DELETE | `/auth/sessions`                                              | session                      | **Addition:** sign out all *other* sessions                                                  |
| DELETE | `/auth/sessions/:sessionId`                                   | session                      | End one own session (404 for anyone else's)                                                  |
| GET    | `/users/me`                                                   | session                      | Profile incl. `hasPassword`, `passwordChangedAt`, provider names                             |
| PATCH  | `/users/me`                                                   | session                      | Change `name` only (email change deferred: no verification in V1)                            |
| DELETE | `/users/me`                                                   | session                      | Account deletion rules in §7; `?deleteWedding=true`                                          |
| POST   | `/weddings`                                                   | session                      | Create wedding + owner membership in one transaction; `409 ALREADY_IN_WEDDING`               |
| GET    | `/weddings/:id`                                               | wedding:view                 | Wedding + caller's membership                                                                |
| PATCH  | `/weddings/:id`                                               | wedding:update               | Any subset + required `version`; `409 VERSION_CONFLICT` if stale                             |
| DELETE | `/weddings/:id`                                               | wedding:delete (owner)       | Body `{confirm: <exact title>}`; soft delete with 30-day grace                               |
| POST   | `/weddings/:id/restore`                                       | session (former owner)       | Restores within the grace period                                                             |
| GET    | `/weddings/:id/members`                                       | wedding:view                 | Page-number list with user name/email, `isYou`                                              |
| PATCH  | `/weddings/:id/members/:memberId`                             | members:manage               | Change `role` (admin/member only) and/or `relationship`; never the owner; never your own role |
| DELETE | `/weddings/:id/members/:memberId`                             | wedding:view (+ rule)        | Leave (own row) or remove (needs members:manage); owner row → 422                           |
| POST   | `/weddings/:id/members/:memberId/transfer-ownership`          | ownership:transfer (owner)   | Transaction: demote old owner then promote new                                              |
| GET    | `/weddings/:id/invitations`                                   | members:manage               | Page-number list; filter `status`; "expired" computed                                        |
| POST   | `/weddings/:id/invitations`                                   | members:manage (30/h/wedding) | Create + email; returns link once + `emailStatus` (+ `emailError`)                           |
| DELETE | `/weddings/:id/invitations/:invitationId`                     | members:manage               | Revoke (row kept, purged by TTL)                                                             |
| POST   | `/weddings/:id/invitations/:invitationId/resend`              | members:manage               | **Addition:** new token + fresh expiry + email again                                         |
| POST   | `/weddings/:id/invitations/:invitationId/link`                | members:manage               | **Addition:** fresh link, **no email** ("Copy invite link")                                  |
| GET    | `/weddings/:id/events`                                        | wedding:view                 | Timeline soonest first (`startsAt`, `sortOrder`, id); not paginated; each row has `canManage` for the viewer |
| POST   | `/weddings/:id/events`                                        | events:edit (all roles)      | Create; `timezone` defaults from the wedding; optional `schedule[]` (sorted by time)         |
| GET    | `/weddings/:id/events/:eventId`                               | wedding:view                 | One event                                                                                    |
| PATCH  | `/weddings/:id/events/:eventId`                               | events:edit (+ rule)         | Any subset + required `version`; `schedule` replaces the whole list (keep a line by sending its `id`); `null` clears optional fields; a member may change only their own event, admin/owner any (`INSUFFICIENT_ROLE` otherwise) |
| DELETE | `/weddings/:id/events/:eventId`                               | events:edit (+ rule)         | Soft delete, same ownership rule. Cascade to RSVPs/tasks is a documented hook until those collections exist |
| GET    | `/weddings/:id/tasks`                                         | wedding:view                 | Cursor-paginated, newest first; filters `status`, `priority`, `eventId`, `assigneeMemberId`, `dueBefore` (anything else → 400) |
| POST   | `/weddings/:id/tasks`                                         | tasks:edit (all roles)       | Create; `eventId` and every assignee must belong to this wedding (else 404); `status: done` records `completedAt/By` |
| PATCH  | `/weddings/:id/tasks/:taskId`                                 | tasks:edit (all roles)       | Any subset + required `version`; **every role may edit any task**; becoming done sets `completedAt`, reopening clears it; `completedAt` is never accepted from a client |
| DELETE | `/weddings/:id/tasks/:taskId`                                 | tasks:edit (+ rule)          | Soft delete; a member only their own tasks, admin/owner any (`INSUFFICIENT_ROLE` otherwise)  |
| GET    | `/public/invitations/:token`                                  | public (60/15min/IP)         | Landing preview; any bad link → `{valid: false}`                                             |
| POST   | `/invitations/accept`                                         | session (10/h/user)          | Claim invitation + create membership atomically; `409 ALREADY_IN_WEDDING` leaves it pending  |

Error codes in use: `VALIDATION_ERROR` 400, `AUTHENTICATION_REQUIRED` 401, `NOT_A_MEMBER`/`INSUFFICIENT_ROLE`/`INVALID_TOKEN` 403,
`NOT_FOUND` 404, `CONFLICT`/`EMAIL_TAKEN`/`ALREADY_IN_WEDDING`/`VERSION_CONFLICT`/`OWNER_MUST_RESOLVE_WEDDING` 409,
`BUSINESS_RULE_VIOLATION` 422, `RATE_LIMITED` 429, `INTERNAL_ERROR` 500.

---

## 9. Authentication, sessions and security

**Signup / login.** Email + password (min 10 characters, no composition rules, max 200; NFKC-normalised). No email verification (Architecture §8). Login timing is equalised with a dummy hash check for unknown emails. Hashes are upgraded on next login if parameters changed.

**Sessions.** An opaque token in cookie **`mmm_session`** (HttpOnly, `SameSite=Lax`, `Path=/`, `Secure` in production); only its SHA-256 hash is stored. "Remember me" = a persistent cookie with a **30-day** server-side life; otherwise a browser-session cookie with a **12-hour** rolling server-side window. Password change/reset revokes other/all sessions.

**Google OAuth.** Server-side flow, PKCE S256, `state`/verifier/nonce sealed with AES-256-GCM (key derived from `SESSION_SECRET` with HKDF) in short-lived cookie **`mmm_oauth`** (path `/api/v1/auth/google`). ID token verified with `jose`. **Pre-hijacking guard:** if the Google email matches an existing *password* account, Google is **not** linked automatically (redirect to `/login?error=email_exists_password`). Google-only accounts have no password. `?next=/join/<token>` is accepted only if it matches an invitation-path pattern (no open redirect).

**Security measures in place (steps 1.5 and 1.9).**

- Headers on every response (`src/lib/security-headers.ts`): HSTS, `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, **Content-Security-Policy** (own origin + Google Fonts only; production adds `upgrade-insecure-requests`, no `unsafe-eval`), `Permissions-Policy`, COOP. `X-Powered-By` removed.
- `Cache-Control: no-store` on all API responses.
- Password-reset **timing is identical** for known/unknown emails (measured 5.7 ms vs 6.1 ms).
- Rate limits via MongoDB counters (hashed keys) on signup, login, Google start, password change/reset, invitation create/lookup/accept.
- `/join/[token]` sets `no-referrer` and `noindex`. Invitation/guest tokens in URLs are redacted in logs.
- Logger redacts any key matching password/token/secret/authorization/cookie/api-key.
- Token links are hash-only; MongoDB ids are never used as secrets.
- Every public/guest response must use explicit field whitelists (a test scans all read endpoints for forbidden internal fields).
- CSRF: `SameSite=Lax` plus the rule that **no state change happens on a GET** (the one exception is the OAuth callback creating a session, by design). An Origin-header check was deliberately **not** added (the API doc §2.9 says SameSite alone is sufficient); it is listed as optional insurance in `FUTURE_PLANS.md`.

---

## 10. Roles and permissions

Table lives in `src/modules/members/permissions.ts` (one reviewable map; add rows as modules arrive). Guard: `requireWeddingAccess(permission)` in `src/modules/members/guards.ts` checks session → membership of **this** wedding (`NOT_A_MEMBER`) → role (`INSUFFICIENT_ROLE`). Server Components use `getWeddingAuth(auth)`.

| Capability                                           | Owner | Admin | Member |
| ---------------------------------------------------- | :---: | :---: | :----: |
| View wedding and team                                |  ✔   |  ✔   |   ✔   |
| Edit wedding details                                 |  ✔   |  ✔   |   —   |
| Invite, change roles, remove members                 |  ✔   |  ✔   |   —   |
| Delete/restore the wedding, transfer ownership       |  ✔   |   —   |   —   |
| Create events (built); edit tasks, guests, gallery *(future)* |  ✔   |  ✔   |   ✔   |
| **Edit/delete events** *(decided 2026-10-10)* | any | any | **own only** |
| **Create and edit tasks** (any task; assignees must be able to move tasks others wrote) | ✔ | ✔ | ✔ |
| **Delete tasks** *(decided 2026-10-10)* | any | any | **own only** |
| **View all expenses and record expenses** *(future, decided 2026-10-10: see §14.2)* | ✔ | ✔ | **✔** |
| Vendors, vendor payments, website editing, gallery tokens *(future; unchanged from D3)* | ✔ | ✔ | — |

Rules beyond the table (decided while building; see §14.3): an **admin may change or remove another admin**
but never the owner and never their own role; the **owner cannot leave or be removed** (transfer first);
`role: owner` can never be granted by invitation or role change; a user can **leave** via the same
endpoint by passing their own member id.

---

## 11. Pages and Stitch designs

### 11.1 Page inventory

| Route                         | Built from                                                                    | Notes                                                                                                 |
| ----------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `/`                           | Stitch landing page (Interactive)                                             | Marketing page, interactive showcase + walkthrough dialog                                             |
| `/login`                      | "Wedding Workspace Login (Interactive)"                                       | `?invite=<token>`, `?error=…` (Google errors)                                                          |
| `/signup`                     | "Create Wedding Workspace (Interactive)"                                      | Creates the **account only** → `/onboarding`. `?invite=<token>` gives a shorter form (no role/workspace) → `/join/<token>` |
| `/forgot-password`            | "Forgot Password (Field Validation & Toastify)"                               |                                                                                                       |
| `/reset-password/[token]`     | "Set New Password (Split Screen)" and "(Active with Toast Validation)"        |                                                                                                       |
| `/onboarding`                 | "Set Up Your Wedding (Onboarding)"                                            | Step 2 of 2. Pre-fills from signup via sessionStorage `mmm:onboarding-prefill`. "I have an invitation" tab accepts a pasted link → `/join/<token>` |
| `/dashboard`                  | "Member Wedding Dashboard (Interactive)"                                      | **Real data only.** Counts for unbuilt modules are 0 with designed empty states                      |
| `/dashboard/team`             | "Team & Member Management (Owner View)"                                       | Table + actions menu, "Invite member" slide-over, pending invitations                                |
| `/dashboard/settings`         | "Settings (Owner View)"                                                       | Profile, Wedding details, Security, Active sessions, Danger zone                                     |
| `/dashboard/tasks`            | "Tasks (List View Grouped by Event)", "Tasks (Board View)" and "Add / Edit Task (Slide-over)" | List/board toggle (`?view=board`), stats strip, four filter pills (`?event=<id>` starts filtered), list grouped by event with progress, drag-and-drop board, per-task menu (Edit, Change status, Assign to..., Delete), slide-over form. Real data |
| `/dashboard/events`           | "Events Timeline (Owner View)" and "Add / Edit Event (Slide-over)"            | Vertical timeline, summary strip, card menu (Edit, Manage guests, Duplicate, Delete), slide-over form. Real data; RSVP column says "No guests invited yet" until Phase 3 |
| `/dashboard/events/[eventId]` | "Event Detail (Haldi)"                                                        | Date/time with duration, venue + address + map card (Google Maps link), dress code, description. Guest responses, tasks and linked expenses cards show designed empty states |
| `/join/[token]`               | **No Stitch design** (built in auth-screen style)                              | Four states: invalid link / signed-out / already in a wedding / ready to accept                      |
| `not-found`, `error`          | **No Stitch design** (same card style)                                         | Error page shows no internals                                                                         |

Redirect rules: signed-out → `/login`; signed-in without a wedding → `/onboarding` (from login, Google, `/dashboard`); with a wedding, `/onboarding` → `/dashboard`.

### 11.2 Stitch project

- Project **"Make My Marriage Landing Page"**, id `1702525069901701200`. Use the Stitch MCP `list_screens` (titles are reliable; many canvas labels read "Generating Screen…").
- Screen ids: Login `bbfb34f3…`, Landing (Interactive) `30ba0632…` (plain `e23e0f6b…`), Create Workspace/Signup `09ff5b54…`, Forgot Password `955bebdc…`, Set New Password `7a997bdd…` and `13f9c1e0…`, Onboarding `65fc24ae…`, Dashboard `309dcdec…`, Team `71fb9e81…`, Settings `7220b150…`.
- Prefer the "(Interactive)"/newest version. For full-size screenshots append `=w1280` to the screenshot `downloadUrl`.
- The **shared shell was unified to the newest screens** (Team/Settings): sidebar labels "Overview … Members", an Expenses entry, a light-green left-bar active style, role chip on Settings, "N days left" chip in the top bar, cream confirmation modals with a red header for destructive actions. This slightly changed the dashboard's look versus its original design.

### 11.3 Porting Stitch HTML (Tailwind v3 CDN) to this app (Tailwind v4)

Map `shadow-sm→shadow-xs`, `shadow→shadow-sm`, `backdrop-blur-sm→backdrop-blur-xs`, `outline-none→outline-hidden`. Never put a text-size class on the shared `<body>` (screens differ). Icons: Material Symbols loaded as a Google Fonts subset by icon name (alphabetical, axes `opsz,wght,FILL,GRAD@20..24,350..400,0,0`; class `.ms-icon`, dashboard weight 350/opsz 20). Fonts: **Newsreader** (serif headings) and **Plus Jakarta Sans**, via `next/font`. The onboarding Stitch screen uses a different serif (Fraunces); we kept Newsreader for consistency (offered to switch).

### 11.4 Things in the designs that are not (fully) real yet

- Sidebar entries Guests, Tasks, Expenses, Vendors, Invitations, Website, Gallery, Live Stream, and Concierge Support/notifications bell: "coming soon" toasts or empty states.
- Settings: Google "Connect/Disconnect" shows an explanatory toast (no link/unlink endpoint). The "Strong" password badge and session **locations** were left out (not knowable / IPs are not stored). City/State fields are not in the Settings design, so they are not editable there (venue label and city set at onboarding are preserved on save). Timezone/currency selects offer the design's five options each.
- The footer links ("Terms", "Security & Compliance", "Contact Support") are placeholders.
- Onboarding footnote text ("256-bit encrypted", "real time") is design copy kept as designed.

---

## 12. Email

- **Providers** (`src/infrastructure/email`): `console` (default in dev), `resend` (when `RESEND_API_KEY` is set), `unconfigured` (production without a key: refuses every send). Tests swap in a capturing provider.
- **Every send** is recorded in `emailLogs` (status, provider, sanitised error; never bodies or links). **A failed send never throws and never undoes** the invitation or reset token (Architecture §49).
- **Templates** (`src/modules/notifications/templates.ts`): password reset; member invitation. Inline-styled HTML + plain-text twin, all user text HTML-escaped.
- **Invitation response** includes `emailStatus` and, if it failed, `emailError`: `{code, message}` in development, **`{code}` only in production** (Resend's message can name the operator's account). The Team page toast shows the reason.
- **Resend situation (important):**
  - Without a **verified sending domain**, Resend only accepts the shared sender `Make My Marriage <onboarding@resend.dev>` (used when `EMAIL_FROM` is empty) and only delivers to the **Resend account owner's own email address**. Sending to anyone else fails (error code `validation_error`).
  - A custom `EMAIL_FROM` whose domain isn't verified in Resend is rejected.
  - A `*.vercel.app` address **cannot** be verified (you don't control its DNS). A domain the owner owns is required: verify it in Resend (SPF/DKIM DNS records), using a subdomain such as `mail.<domain>` is fine.
  - **The owner has no verified domain yet.** Until then use **Copy invite link** on the Team page and share it (e.g. WhatsApp). The app is fully usable without email.
  - Brevo-style "verify a single sender address" providers were discussed as an alternative; **not built**, and would need owner approval (the architecture names Resend).
- Real recipients are first needed in earnest in **Phase 3** (guest invitations, RSVP reminders).

---

## 13. Build history, step by step

Everything below is on branch `dev`. Dates 2026-10-04 to 2026-10-06.

**Pre-work (2026-10-04).** The AI read the four docs and proposed structure, packages, build order and open decisions; the owner answered (§14). Docs and `CLAUDE.md` committed to `dev` first.

**Step 1.1: Tooling.** Next.js + TypeScript + Tailwind, `.prettierrc.json`, ESLint with custom rules (repository-only model imports, no `findById`, no raw `aggregate`, no Server Actions), Vitest (unit + integration projects), GitHub Actions CI, `.nvmrc`, `.gitattributes`, `.gitignore`, `.env.example`, `.vscode/`, `AGENTS.md`, security headers (basic set).

**Step 1.2: Core library.** `route()` pipeline, envelope, request IDs, error codes, pagination helpers, cookie helpers, logger with redaction, Zod primitives (ids, emails, ISO dates, IANA timezone, currency, paise), env validation, enums/retention/auth constants, text normalisation, crypto (tokens, scrypt, AES-GCM seal), browser `apiRequest` client.

**Step 1.3: Data layer.** Connection (cached on `globalThis`, small pool, `autoIndex` off in production), `withTransaction`, `aggregateScoped`, soft-delete and normalisation plugins, shared Location schema, `db-sync-indexes` script, in-memory replica-set test setup.

**Landing + auth pages (between 1.3 and 1.4).** Built from the Stitch landing, login, signup, forgot-password, reset-password screens (UI only at that point).

**Step 1.4: Models.** users, sessions, passwordResetTokens, weddings, weddingMembers, weddingInvitations, emailLogs, rateLimitCounters, with the unique/partial/TTL indexes and a model registry. Tests exercise the indexes against a real replica set.

**Step 1.5: Authentication.** Signup/login/logout, sessions (persistent vs browser), Google OAuth (PKCE, sealed state, pre-hijacking guard), password change and reset by email, session list/revoke, `GET /users/me`, `POST /weddings` (create wedding + owner), rate limits, email provider abstraction and templates, wiring of the auth pages to the API.

**Dashboard (2026-10-04).** From the Stitch "Member Wedding Dashboard (Interactive)", **with real data** (owner chose "real data + designed empty states"). Sidebar, top bar (with profile menu + sign out), notice banner, countdown hero, stat cards, RSVP/tasks/follow-up widgets (empty states), team widget, footer.

**Onboarding (2026-10-05).** From the Stitch onboarding screen. Signup now creates the account only; everyone without a wedding goes to `/onboarding` (email signup, Google signup, login). Removed the old "create wedding" card from the dashboard. Google tests updated (`/onboarding` vs `/dashboard`).

**Step 1.6: Wedding, member and role-based access routes (2026-10-05).** Role matrix as data; `requireWeddingAccess`; `route()` now passes validated params to the auth resolver; wedding get/patch/delete/restore; member list/patch/remove-or-leave/transfer-ownership; `PATCH`/`DELETE /users/me`. Tests for the role matrix, cross-wedding isolation, concurrency, restore, account deletion.

**Step 1.7: Member invitations and the join flow (2026-10-05).** Invitation create/list/revoke/resend/preview/accept (transactional, single-use, race-safe; an invitation is not "burned" if the person already has a wedding); invitation email; `/join/[token]`; `?invite=` on signup/login (shorter invited signup); Google sign-in returning to a validated join path; onboarding's "I have an invitation" tab; rate limits.

**Step 1.8: Team and Settings pages (2026-10-05/06).** First built in dashboard style (owner chose "build now" because no designs existed), then **rebuilt from the owner's two Stitch screens** when they appeared. Backend additions the designs needed: `POST …/invitations/:id/link`, `DELETE /auth/sessions`, `passwordChangedAt`. Shared `AppShell`, `ConfirmDialog`, slide-over invite drawer, popover member menu, password modal.

**Step 1.9: Hardening and review (2026-10-06).** Fixed: password-reset **timing leak** (work moved after the response), **API caching** (`no-store`), **missing CSP** (added with Permissions-Policy and COOP, scanned in a real browser). Added: route-inventory test, hardening tests (cache headers, cookie flags, no secrets in responses, cross-wedding invitation access, reset enumeration), the Phase 1 end-to-end journey test, not-found and error pages, `README.md`. Verified `db:sync-indexes` builds all indexes on a clean DB and is idempotent.

**Phase 2, step 2.1: events model (2026-10-10, committed ade759d).** `EVENT_TYPES` enum, `events` model with embedded bounded `schedule[]` (limits in `src/lib/constants/events.ts`), index `{weddingId, startsAt}`, model registry + registry test, model tests (validation, defaults, schedule limits, soft delete, concurrency).

**Phase 2, step 2.2: events service and API (2026-10-10, committed ade759d).** `src/modules/events/` (schemas, DTO, repository, service), 5 routes, permissions `events:edit` (all roles) and `events:manage-any` (admin/owner), route inventory updated, 33 integration tests (every role, ownership rule, cross-wedding 403/404, validation, concurrency, schedule replace/re-sort, soft delete). Total tests 276 → 329. Typecheck, lint, Prettier, build clean. **Not yet built:** the Events UI (2.3, waits for Stitch designs), tasks, dashboard wiring.

**Phase 2, step 2.3: events UI (2026-10-10, committed 02b5e58).** Built from three Stitch screens ("Events Timeline (Owner View)", "Event Detail (Haldi)", "Add / Edit Event (Slide-over)"). New: `src/lib/zoned-time.ts` (event wall-clock time to/from an instant in an IANA timezone, no library), `src/lib/events/{format,view}.ts` (date block, time range, duration, venue, "First event in N days"; computed on the server so server and browser never disagree), `src/components/events/*` (timeline, card menu, slide-over form, actions hook, API calls), pages `/dashboard/events` and `/dashboard/events/[eventId]`, sidebar Events link with count badge, `getEventsPage`/`getEventPage` services, and dashboard wiring (real event count, "Next Milestone Event" hero, Events stat card). 40 new tests (369 total). Verified in headless Edge against a production build and a throwaway database: 45 of 46 checks passed; the one miss was a missing `/favicon.ico` (the app has never had a favicon). Screens checked at desktop and phone width.

**Phase 2, step 2.4: schedule editor (2026-10-10, committed 28737e3).** The owner had no Stitch design for it and approved building it in the existing style, "following the same UI language". New: a **Schedule** card on `/dashboard/events/[eventId]` (times like "7:00 AM", notes, a Public chip, "All times in IST", an empty state; the edit button shows only to people who may change the event) and an **Edit schedule** slide-over that reuses the Add / Edit Event slide-over's header, fields, footer and buttons: one row per line (time, what happens, optional notes, "Show on wedding website", remove), "Add line" (starts from the previous line's time), a "N of 50 lines" counter, inline errors for a missing time or title. The whole list is saved at once (`PATCH` with `schedule`), the server returns it in time order, and lines that are kept keep their ids. Editing the event itself leaves its schedule alone. Files: `src/components/events/schedule-{card,drawer}.tsx`, `formatScheduleTime` in `src/lib/events/format.ts`, `scheduleLines` on the event view, `updateSchedule` in `events-api.ts`. Tests 369 → 376 (six `formatScheduleTime` cases and one page-data test); 22 real-browser checks passed (add, validate, reorder by time, remove, clear, Escape, event edit keeps schedule, phone width, console clean).

**Phase 2, step 2.5: tasks backend (2026-10-10, committed fcdb812).** `TASK_STATUSES`/`TASK_PRIORITIES` enums, `tasks` model and indexes (registry test updated), `src/modules/tasks/` (schemas, DTO, repository, service), 4 routes, permissions `tasks:edit` (all roles) and `tasks:manage-any` (admin/owner), route inventory updated. **Cascades:** deleting an event now runs in a transaction that sets `eventId` to null on its tasks and the response reports `tasksUnlinked`; removing or leaving a member runs in a transaction that takes them off every task's assignees and the response reports `tasksUnassigned` (this closes the Phase 1 TODO in `member.service.ts`). 40 of them are API integration tests (every role, delete rule, validation, cross-wedding 404/403, concurrency, filters, cursor paging, both cascades).

**Phase 2, step 2.6: tasks UI (2026-10-10, committed fcdb812).** Built from three Stitch screens ("Tasks (List View Grouped by Event)", "Tasks (Board View)", "Add / Edit Task (Slide-over)"). New: `src/lib/tasks/{view,filter}.ts` (overdue, grouping, sorting, filters; pure and unit-tested), `src/components/tasks/*` (tasks screen, drag-and-drop board using the browser's own drag events, task slide-over with assignee picker, status/delete actions hook, event-page task card, avatars), page `/dashboard/tasks`, sidebar Tasks link with open-task count, "Tasks for this event" card on the event page now real (checkbox, Add task, View all tasks), dashboard "Upcoming Coordination" widget and Pending Tasks stat now real. The shared popover menu gained a submenu (used by "Change status"). Together with step 2.5 this adds 69 tests (376 → 445). Verified in headless Edge against a production build and a throwaway database with two users: 54 of 54 checks passed (list, board, drag and drop, filters, forms, validation, member vs owner delete rule, event page, dashboard, phone width, console clean).

**Phase 2, step 2.7: review and hardening (2026-10-10).** Closes Phase 2.

- **Index review with `explain()`** (`tests/integration/database/query-plans.test.ts`, 300 tasks and 40 events in each of two weddings): the newest-first and "every task" queries read the **global** `_id` index and examined the other wedding's tasks too. Fixed with a `tasks` index `{weddingId: 1, _id: -1}` (same shape as `expenses`); the test now fails if any hot events/tasks query ever scans a collection or reads another wedding's documents.
- **Isolation and secrets:** the "no secret in any response" scan now covers events and tasks for all three roles; a new test proves every events and tasks route answers 403 once a wedding is deleted.
- **Accessibility pass, with axe-core** (run from a scratch folder, not added to the project): 32 violation groups across 12 screens before, **0 across 13 screens after** (Overview, Events timeline and menu and form, event page, schedule form, Tasks list, menu, form, assignee picker and board, Members, Settings). Fixed: invalid list markup on the timeline, skipped heading levels (timeline, task groups, Overview), `role="dialog"` on a `<form>` (the four slide-overs now use a proper dialog wrapper), a button nested inside a listbox option, no `<h1>` on Overview/Members/Settings (invisible headings added), and low-contrast text.
- **Keyboard and focus:** new `useDialogFocus` hook (focus moves into a dialog, Tab and Shift+Tab stay inside, focus returns to the control that opened it) used by the event, schedule, task and invite slide-overs and the confirmation dialog; the card/task popover menu now opens on its first entry and supports Arrow keys, Home, End and Escape, and returns focus to its button; the board has a screen-reader description pointing to "Change status". Checked in a real browser: 22 keyboard checks.
- **Regression runs** in headless Edge after the changes: events 45/46 (only the missing favicon), schedule 22/22, tasks 54/54.
- **Docs:** DB and API design docs updated with what was built (role refinements, `schedule[]`, `tasksUnlinked`/`tasksUnassigned`, `canManage`/`canDelete`, filters, the new index). Tests 445 → 458.

**After 1.9 (2026-10-06).** Debugging with the owner: invitation email failed because the Resend test sender only delivers to the account owner. Added `emailError` to invitation responses and surfaced Resend's actual reason in the Team page toast (committed by the owner as `983d15c "fixed issue"`). Explained that `*.vercel.app` can't be a Resend domain and that Copy invite link is the interim path. Explained the "You already belong to a wedding" screen (owner testing their own invite link in the same browser; test with a different browser profile or incognito).

---

## 14. Decisions log

### 14.1 Product-owner decisions (2026-10-04)

- **D1** API routes are prefixed `/api/v1/`.
- **D2** Password reset ships in V1 (`passwordResetTokens` in Phase 1).
- **D3** Role matrix as in §10, kept in one `permissions.ts` map.
- **D4** `jose` allowed for Google ID-token verification.
- **D5** Rate limiting: Vercel platform protection first; MongoDB counters only for login/signup/password-reset/OAuth (and later the invitation endpoints).
- **D6** Retention: invitation/token purge +30 days, emailLogs 180 days, wedding and account grace 30 days, as constants.
- **D7** Server Components may call services (never repositories/models); the browser always uses REST; Server Actions banned.
- **D8** URL scheme: `/w/[slug]` public site, `/i/[token]` guest invitation + RSVP, `/join/[token]` member invitation, `/gallery/[token]`, `/live/[token]`.
- **D9** Tailwind CSS only for now (no component/form libraries).
- **D10** Email: has a Resend account, **no verified domain** → console in dev.
- **D11–D13** Tooling: npm, Node 24 LTS, CI-only checks (no husky), mongodb-memory-server replica set for tests, separate Atlas dev cluster; accepted AI recommendations.
- **C1–C10** Doc conflicts, all resolved with the AI's recommendation: `INVALID_TOKEN` is always 403; optimistic concurrency via `version` in the PATCH body; soft-delete filter uses `$type:"null"`; Phase 1 onboarding fields are title/partners/date/location/timezone/currency; OAuth state in an encrypted short-lived cookie keyed by `SESSION_SECRET`; extra error data goes in `error.details`; member invitations live in `members/`; the Phase 3 guest-invitation module will be named `guest-invitations`.
- **Where the code lives:** work on branch `dev`, docs committed first; "no scaffolding without go-ahead" honoured per step.

### 14.2 Owner choices during the build

- Dashboard: **real data + designed empty states** (not Stitch's sample numbers).
- Signup flow revised (2026-10-05): account first, then onboarding to create the wedding.
- Team/Settings: first "build now in dashboard style", later rebuilt from the Stitch screens.
- Skipped step 1.6 temporarily (built the dashboard first), then did it.
- Kept the project without a domain for now; use Copy invite link instead of email.
- **Expenses (decided 2026-10-10, before Phase 4):** keep the tracker **simple**. Family members (the `member` role) can **see all expenses in one place** and **record expenses**, so nobody has to look in several places. **No new libraries**, no accounting-style features. This **overrides D3 for expenses only** (D3 had finance as admin+ only); the vendors, vendor-payments and website rules are unchanged. **Edit/delete rule (decided 2026-10-10):** a member can edit or delete **only the expenses they recorded**; **admins and owners can edit or delete any** expense. Implement by checking `createdBy` against the caller in the expense service (the model already stores `createdBy`).
- **Schedule model (decided 2026-10-10, for Phase 2):** each event stores its own **bounded timed list (`schedule[]`, about 50 items max)** inside the `events` document, **not** a separate collection. Example items: "7:00 AM Makeup", "9:00 AM Haldi", "11:00 AM Family photos". Distinct from tasks (a task is a to-do for a person; a schedule item is a timed line in the day's run-of-show). Needs a short note added to the DB doc when built.
- **Choices made while building 2.1–2.2 (flagged, change if disliked):** (1) a member also may **edit** only their own events (the owner decided delete only; edit follows the same rule, tasks will be looser); (2) schedule `time` is `"HH:mm"` in the event timezone (a late-night line after midnight sorts as early morning; multi-day events are not modelled); (3) `PATCH` replaces the whole `schedule` list; (4) responses include `canManage` and `createdBy`; (5) bad input, an end before the start included, is `400 VALIDATION_ERROR` (`details[0].path = endsAt`); (6) no cap on the number of events per wedding.
- **Choices made while building the events UI (2.3), flagged; change if disliked:** (1) the shared shell was **kept** rather than copying the Events designs' slightly different sidebar (it only gained the Events link and count badge); (2) the slide-over has **no "Auto-saving draft"** note (nothing auto-saves); its footer says "Shared with your team"; (3) the **Address** field is one free-text line stored as `address.line1` (the design's "search for a place" needs Google Places, Phase 4), and the hint says "Type the full address"; city/state/PIN/coordinates/place id already on an event are preserved when it is edited; (4) **"Show on wedding website" defaults to off** (the design showed it on; private by default, and the website is Phase 5); (5) the detail page **omits the "Event coordinator"** block (no such field in the DB design), the **"(Traditional Festive)"** dress-code sub-line, and the **"Owner & Admin only"** badge on Linked expenses (expenses are viewable by all members, decided 2026-10-10); the map card appears only when the event has a venue and shows coordinates only if stored; (6) **timeline cards link to the event page** through the title (the design showed no link); (7) the "Up next" highlight is the first event that has not finished; (8) Duplicate copies the schedule too and is open to every role; **Manage guests** shows a "coming soon" toast until Phase 3; (9) **Guests pill and RSVP column show zero / "No guests invited yet"**, not the design's sample numbers (real data only).
- **"Edit Wedding (Owner View)" Stitch screen (2026-10-10): not built, deferred.** The owner asked me to choose. It is a fuller version of the Settings page's wedding details (adds address line 1/2, city, state, postal code, country, total budget and wedding status). It does not belong to Phase 2, Settings already edits the core wedding fields, and the budget and status fields interact with Phase 4. Recommendation recorded in `FUTURE_PLANS.md` §10: do it as a small separate step before launch, reusing the existing wedding `PATCH` endpoint (it already accepts every field on that screen).
- **Choices made while building the tasks UI (2.6), flagged; change if disliked:** (1) **Due date is a calendar day, not a date and time.** The Stitch form showed "11 Feb 2027, 09:30 AM", but the DB design deliberately stores task due dates as `YYYY-MM-DD` strings so a date never shifts with the viewer's timezone (§3.5). I followed the DB design. Say so if you want a due time; it would be a DB design change. (2) The description box stops at **500** characters, as the design's counter shows, though the API accepts 2,000. (3) I left out the form's **"Family & Vendor Sync" banner** (it says both families get timeline updates automatically; no notifications exist) and **"Auto-saving draft"** (nothing auto-saves); the footer says "Shared with your team". (4) I left out the **"…" menu on each board column** (the design shows it but defines no actions). (5) The **Due date filter** offers Any, Overdue, Today, Next 7 days and No due date (the design only showed "Any"). (6) The board uses the **browser's own drag and drop** (no library); because phones and keyboards can't drag, every task also has **Change status** in its menu. (7) **"Assign to..."** in the menu opens the edit form scrolled to the assignees. (8) In a list group, open tasks come first by due date (undated last) and finished tasks last; events appear in timeline order and tasks without an event go under **"General"**. (9) **Anyone may edit any task; delete follows the own/any rule** (decided 2026-10-10). (10) The board chip names the event's **type** ("Haldi"), as in the design, with the full event name on hover. (11) The Tasks screen loads up to **1,000 tasks** in one read and filters in the browser; the API itself stays cursor-paginated as the API design says. (12) "Overdue" is judged against **today in the wedding's timezone**. (13) Beyond the API design: `tasksUnlinked` on event delete, `tasksUnassigned` on member removal, and `canDelete` on each task.
- **Choices made in the review (2.7), flagged; change if disliked:** (1) **The `--color-outline` colour token changed from Stitch's `#717974` to `#686f6a`** (`src/app/globals.css`). The original is 4.26:1 on the cream background, below the 4.5:1 WCAG AA minimum for small text, and it is the grey of every small caption across the app (the top bar's date line, hints, labels). The new colour looks the same and passes everywhere; revert that one line if you want Stitch's exact value. (2) A few small text colours in the new screens were darkened for the same reason (Haldi chip and event-page dress code and "Haldi Ritual" text, finished-task text). (3) Overview, Members and Settings got an **invisible `h1`** and Overview's card titles moved from `h3/h4` to `h2/h3`: no visual change. (4) Added a **`tasks` index `{weddingId, _id: -1}`** beyond the DB design's list (see above).
- **Phase 2 decisions (2026-10-10):** a `member` can delete only events/tasks they created; `admin`/`owner` can delete any (no separate "manager" role); tasks keep a single `description` field (no `notes`); statuses `todo`/`in_progress`/`done` shown as To Do / In Progress / Completed; no task comments or subtasks in V1; owner will supply Stitch designs for Events, Tasks and Schedule before the UI step.

### 14.3 Choices the AI made without asking (flagged to the owner; change if disliked)

1. An **admin can change or remove other admins** (never the owner, never their own role).
2. **Restore brings back the owner and the members the deletion removed** (not just the owner), skipping people who joined another wedding; restored status = `planning`.
3. `DELETE /users/me` reports `activeMemberCount` as **all** active members including the caller.
4. `PATCH /weddings` **requires** `version`.
5. Sole owner deleting the account must opt in with `?deleteWedding=true`.
6. Invite-form default role is **Member** (least privilege), though the Stitch mock showed Admin selected.
7. Invite-form **relationship is required** (as in the design) even though the API treats it as optional.
8. The Stitch design's "Copy invite link" **rotates the token** (the original is never stored), which invalidates any link emailed earlier.
9. The invitation-sent email address in a different wedding is **not checked** at invite time (to avoid revealing which emails have accounts); it is rejected at accept time.
10. `Origin`-header CSRF check **not** added (API doc says SameSite is sufficient).
11. CSP allows `'unsafe-inline'` for scripts because Next emits inline bootstrap scripts; a nonce-based policy would make every page dynamic.

---

## 15. Deviations and additions beyond the design docs

The architecture wins over every other document when they conflict. These are **additions** that need the owner's awareness (the API doc itself asks to flag additions):

- Response envelope `{success, data, meta}` (API doc §2.3, already flagged there).
- `rateLimitCounters` collection (API doc §14.3).
- `POST /weddings/:id/invitations/:invitationId/resend` (API doc §6.9 says "resend" but defines no route).
- `POST /weddings/:id/invitations/:invitationId/link` (Stitch "Copy invite link").
- `DELETE /auth/sessions` (Stitch "Sign out all other sessions").
- `passwordChangedAt` on the user DTO; `emailError` on invitation responses.
- Rate limits: `memberInvite` 30/h/wedding, `invitationLookup` 60/15 min/IP, `invitationAccept` 10/h/user.
- `/api/v1/public/…` path convention for token/public API routes (API doc §17).
- `404` for cross-wedding/soft-deleted resources.
- `weddingMembers.userId` index is **partial** (so a person who left can join another wedding), plus the extra owner-unique index (both noted in the DB doc §16).
- Shared shell restyle (sidebar active style, Expenses entry, days-left chip) from the newest Stitch screens.
- Not-found/error/`/join` pages without Stitch designs.
- Security headers beyond the architecture's list (CSP, Permissions-Policy, COOP).

---

## 16. Testing and verification

- **Commands:** `npm test` (all), `npm run test:unit`, `npm run test:integration`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build`. CI runs all of them on every push to `main`/`dev` and on pull requests.
- **Totals:** 276 tests in 41 files. Unit tests live next to code (`src/**/*.test.ts`); integration tests in `tests/integration/{auth,dashboard,database,journeys,models,security,weddings}`.
- **How integration tests work:** call route handlers directly with real `Request` objects (`tests/setup/http.ts`), against an in-memory MongoDB **replica set** (transactions and partial indexes need a real one). Helpers: `signUpUser`, `captureEmails`, `setupWedding`, `addMember`, `freshIp` (avoids per-IP signup limits).
- **Security tests worth knowing:** route inventory; hardening (cache headers, cookie flags, secrets scan, cross-wedding invitation denial, reset enumeration); role matrix; concurrency (simultaneous edits, accepts, transfers); the Phase 1 journey (couple → wedding → family/planner → dashboards) and the forgotten-password journey.
- **Real-browser verification** (done by the AI during development, scripts were throwaway and not committed): headless Edge driven over the DevTools protocol against a production build on port 3130 and an in-memory database. Covered: auth flows, dashboard, onboarding, join flow (new and existing accounts), Team and Settings (all actions), CSP violations on every page, fonts/icons loading, framing blocked, mobile overflow. Rule: **after UI work, verify in a real browser against a throwaway DB, never the owner's.**
- **Environment-stubbing caution in tests:** `setupTestDatabase()` stubs env vars with `vi.stubEnv`; do not call `vi.unstubAllEnvs()` (it removes them). Restore only what you changed (e.g. `NODE_ENV`) and call `resetEnvCacheForTests()`.

---

## 17. Known limitations and open items

**Owner action needed**

- **Verify a sending domain in Resend** (or accept Copy invite link) before real users get emails.
- **Try real Google sign-in** with real credentials (only fakes were tested).
- Optionally **design Stitch screens** for `/join/[token]`, the not-found page and the error page.

**Product / design items still open (from the docs)**

- Schedule/timeline model (PRD §27) is not in the DB doc: **decided 2026-10-10** to embed a bounded `schedule[]` in each event (§14.2); the DB doc still needs a note when it is built.
- Expense "date/amount" fields vs PRD §13 mismatch (expense visibility/recording by members is now **decided**, see §14.2); vendor events/documents; gallery favourites; livestream end time; in-app notifications (PRD §28); per-wedding storage quota; household-level vs per-guest RSVP links; storing Google-Places-sourced fields (check Google's terms before Phase 4); cached counters (recommended: not yet).
- `TOKEN_ENCRYPTION_KEY` / `tokenEnc` for re-showable guest links needs owner approval before Phase 3.

**Technical limitations accepted for now**

- CSP permits inline scripts (see §14.3); nonce-based CSP is a Phase 7 option.
- Purge and anonymise scripts (wedding purge after 30 days, account anonymise) are **not written** (Phase 7).
- Child rows of a soft-deleted wedding look "live" in the raw database until purge.
- No `suspended` status can be set (the field exists; nothing uses it).
- Changing a login email is deferred (no verification in V1).
- Google account linking/unlinking from Settings is not built.
- The app has **no favicon**, so every page logs one `404 /favicon.ico` in the browser console (found by the browser checks; needs a design asset).
- Drag and drop on the board uses the browser's drag events, which **phones and tablets don't fire**; touch users and keyboard users use "Change status" in the task menu. A touch drag library would be a new dependency (needs approval).
- The axe and keyboard checks were run by hand from throwaway scripts; **they are not part of CI**. A repeatable version (e.g. Playwright with axe) is a Phase 7 item.
- Prefix-only name search (no "contains"); one currency per wedding; one RSVP link per guest — per the design docs.
- `README.md` exists for humans; keep it in step when setup changes.

---

## 18. Gotchas and troubleshooting

| Symptom                                                              | Cause and fix                                                                                                                                                     |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Invitation created. The email couldn't be sent."                    | Resend refusal. Read the reason in the toast. With no verified domain: send only to the Resend account's own email, leave `EMAIL_FROM` empty, restart the server. |
| Edited `.env.local` but nothing changed                              | Env is cached at startup. Restart `npm run dev`.                                                                                                                  |
| Server won't start: "Invalid environment configuration"              | `SESSION_SECRET` shorter than 32 chars, or `APP_URL`/`MONGODB_URI` missing.                                                                                      |
| Invite link shows "You already belong to a wedding"                  | You're signed in as someone already in a wedding (cookies are shared across tabs). Open the link in incognito or another browser profile and sign up as the invitee. |
| Copied an invite link but it says invalid                            | "Copy invite link" **replaces** the link: use the newest copy for that invitation.                                                                                |
| New icon renders as its name text                                    | Add it to the alphabetically sorted `ICON_NAMES` list in `src/components/ui/icon.tsx`.                                                                           |
| Integration test fails with env undefined after your own env stubbing | Don't use `vi.unstubAllEnvs()`; see §16.                                                                                                                          |
| Browser-check script: signup returns 429 / INTERNAL                  | Per-IP signup limit hit on the throwaway DB; restart the throwaway DB and server.                                                                                |
| Deleted a wedding but a member can still sign in                     | Expected: their membership ended; they land on onboarding and can create/join another. Restore (owner, within 30 days) brings members back.                      |
| `git push` rejected                                                   | `origin/dev` has newer commits; `git pull --rebase origin dev`, then push. Never force-push.                                                                     |

---

## 19. Commit history

| Commit    | Date       | Summary                                                                                  |
| --------- | ---------- | ---------------------------------------------------------------------------------------- |
| `2e439cd` | 2026-10-04 | Project instructions and V1 design docs                                                  |
| `8e38386` | 2026-10-04 | Step 1.1: Next.js + TypeScript tooling                                                   |
| `6018ed8` | 2026-10-04 | Step 1.2: core request pipeline and shared library                                       |
| `2e2f8ae` | 2026-10-04 | Restore `.env.example` (accidentally deleted by an earlier commit)                       |
| `b56f9e0`, `9ca80f6` | 2026-10-04 | Step 1.3: MongoDB data-layer foundations                                    |
| `f29a94e` | 2026-10-04 | Landing and auth pages from Stitch designs                                               |
| `2544134` | 2026-10-04 | Step 1.4: Phase 1 Mongoose models                                                        |
| `379abc1` | 2026-10-04 | Step 1.5: authentication and sessions                                                    |
| `2051c9c` | 2026-10-04 | Dashboard page                                                                           |
| `c7fe55c` | 2026-10-05 | Owner's `package-lock.json` fix                                                          |
| `fd72c28` | 2026-10-05 | Onboarding screen after signup                                                           |
| `5ffd2d0` | 2026-10-05 | Step 1.6: wedding, member and role-based access routes                                   |
| `cb9b72b` | 2026-10-05 | Step 1.7: member invitations and the join flow                                           |
| `a6d03cd` | 2026-10-06 | Step 1.8: Team and Settings pages from Stitch designs                                    |
| `4ff2a7e` | 2026-10-06 | Step 1.9: hardening and README                                                           |
| `983d15c` | 2026-10-06 | "fixed issue": show the email failure reason (owner's commit of the AI's change)         |
| `f738c2d` | 2026-10-10 | Project status and future-plans docs                                                     |
| `ade759d` | 2026-10-10 | Phase 2 steps 2.1–2.2: events model and API with embedded schedule                       |
| `02b5e58` | 2026-10-10 | Phase 2 step 2.3: events timeline, event page and slide-over form                        |
| `28737e3` | 2026-10-10 | Phase 2 step 2.4: event schedule editor                                                  |
| `fcdb812` | 2026-10-10 | Phase 2 steps 2.5–2.6: tasks API, list and board screens, task form                      |
| *(next)*  | 2026-10-10 | Phase 2 step 2.7: review and hardening (indexes, accessibility, docs)                    |
