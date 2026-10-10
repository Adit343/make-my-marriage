# Make My Marriage — Future Plans

> What is left to build, in order, with the decisions that must be made first.
> Where the project is *now* is in [`PROJECT_STATUS.md`](PROJECT_STATUS.md). **Read that file first.**
>
> Last updated: **2026-10-10** · Phase 1 complete · **Phase 2 in progress: events are built end to end (steps 2.1–2.3 committed and pushed). The schedule editor is committed. Tasks (backend and UI) are built, uncommitted. Left: a Phase 2 review/hardening pass.**

**Contents**

1. [How to continue in a new chat or on a new machine](#1-how-to-continue-in-a-new-chat-or-on-a-new-machine)
2. [The rules every future step follows](#2-the-rules-every-future-step-follows)
3. [Roadmap overview](#3-roadmap-overview)
4. [Phase 2: Planning (events, tasks, schedule)](#4-phase-2-planning)
5. [Phase 3: Guests and invitations](#5-phase-3-guests-and-invitations)
6. [Phase 4: Financials and vendors](#6-phase-4-financials-and-vendors)
7. [Phase 5: Wedding experience (website, live stream)](#7-phase-5-wedding-experience)
8. [Phase 6: Memories (gallery)](#8-phase-6-memories)
9. [Phase 7: Product readiness](#9-phase-7-product-readiness)
10. [Cross-cutting backlog (not tied to one phase)](#10-cross-cutting-backlog)
11. [Consolidated open decisions](#11-consolidated-open-decisions)
12. [Out of scope and forbidden for V1](#12-out-of-scope-and-forbidden-for-v1)
13. [Where the design docs define each phase](#13-where-the-design-docs-define-each-phase)

---

## 1. How to continue in a new chat or on a new machine

1. Open the project folder in Claude Code (the four design docs, `PROJECT_STATUS.md` and this file are
   imported automatically through `CLAUDE.md`).
2. If working on a new machine, follow `PROJECT_STATUS.md` §3 (Node 24, `npm ci`, `.env.local`, branch `dev`, Stitch MCP).
3. Confirm the baseline is healthy: `git status` clean on `dev`, then `npm run typecheck`, `npm run lint`, `npm test` (expect **276 passing**).
4. Start the next piece of work with a prompt like:

   > Read `docs/PROJECT_STATUS.md` and `docs/FUTURE_PLANS.md`. We are starting **Phase 2**. Do not create
   > files, install anything or write code yet. Check my Stitch project for Events and Tasks screens,
   > then propose a step-by-step plan (like Phase 1's steps) with the open decisions you need answered.
   > Wait for my approval.

5. **After each step**, the AI must update `PROJECT_STATUS.md` (what was built, decisions, new endpoints,
   test totals, commit) and tick things off here, so the next session starts correct.

---

## 2. The rules every future step follows

These come from `CLAUDE.md`, the architecture and the working agreement. Repeat them to yourself before each step.

**Process**

- Propose a plan and **wait for approval** before creating files, folders or installing dependencies.
- **Ask on ambiguity.** If a design doc is silent or conflicts, ask (several such items are listed in §11).
- Number the steps (2.1, 2.2, …), **stop and report after each**, commit and push to **`dev` only when told**.
- **Check Stitch before any UI work** and reproduce designs exactly. If none exists, ask: build in the existing style now, or wait for a design.
- Real data only in the UI; designed empty states where a module isn't built.
- Flag any addition or deviation beyond the docs (the docs ask for this), and record it in `PROJECT_STATUS.md` §14–15.

**Architecture** (details in `PROJECT_STATUS.md` §5)

- Pipeline: `route()` → Zod → auth → service → repository → Mongoose. Repositories are the only files importing models; wedding-owned functions take `weddingId` first; no `findById`; aggregations only through `aggregateScoped`.
- Cross-document ids in a body (`eventId`, `assigneeMemberIds`, …) must be verified to belong to the same wedding in the service.
- Soft delete by default; `deletedAt` explicit null; transactions only where several writes must be atomic.
- Reuse `requireWeddingAccess(permission)` and add the new permission rows to `src/modules/members/permissions.ts` (and its test).
- Use optimistic concurrency (`version`) on collaborative documents; map `E11000` to the right 409.
- Money in paise (`…Minor`); dates as `YYYY-MM-DD` strings; instants in UTC with an IANA timezone.
- Tokens: 32 random bytes, hash stored, never log them, never use Mongo ids as secrets.
- **No** Redis, queues, workers, WebSockets, GraphQL, Server Actions, new frameworks or infrastructure without approval.

**Definition of done for every step** (checklist)

- [ ] Zod schemas, service rules, repository functions with `weddingId`, DTOs that expose only intended fields.
- [ ] New enums added once in `src/lib/constants/enums.ts`; models registered in `src/models/index.ts`; indexes declared in the model; `npm run db:sync-indexes` dry run reviewed.
- [ ] Routes added with the right guard; **`src/lib/security/route-inventory.test.ts` table updated** (the build fails otherwise).
- [ ] Permission rows added to `permissions.ts` and `permissions.test.ts`.
- [ ] Integration tests: happy path, each role, cross-wedding denial (403/404), validation, concurrency where relevant, soft-delete behaviour.
- [ ] Response-leak check still passes (no hashes/tokens/internal fields in any DTO).
- [ ] UI built from the Stitch screen (or approved fallback), responsive (no horizontal scroll on phones), toasts and empty/loading/error states.
- [ ] Verified in a **real browser** against a **throwaway database** on a spare port (never the owner's DB or port 3000).
- [ ] `npm run typecheck`, `lint`, `format:check`, `test`, `build` all clean; `npm audit --omit=dev` still 0.
- [ ] `PROJECT_STATUS.md` (and this file) updated; commit message written to a file and committed with `-F`; explicit paths staged; pushed only on request.
- [ ] If setup changed (env var, script): `.env.example` and `README.md` updated, and the owner told what to change in `.env.local`.

---

## 3. Roadmap overview

| Phase | Name                    | Collections introduced                                   | Status                                                  |
| ----- | ----------------------- | -------------------------------------------------------- | ------------------------------------------------------- |
| 1     | Foundation              | users, sessions, passwordResetTokens, weddings, weddingMembers, weddingInvitations, emailLogs, rateLimitCounters | **Done** (steps 1.1–1.9)                |
| 2     | Planning                | events, tasks (+ schedule: model undecided)              | **Next**: needs a plan and decisions (§4)               |
| 3     | Guests & Invitations    | guestGroups, guests, rsvps (emailLogs already exists)    | Not started; needs a verified email domain in practice  |
| 4     | Financials & Vendors    | expenses, vendors, vendorPayments                        | Not started; PRD/role conflict to resolve (§6)          |
| 5     | Wedding Experience      | weddingWebsites, liveStreams                             | Not started                                             |
| 6     | Memories                | galleries, galleryAlbums, galleryAssets, galleryAccessTokens | Not started; needs AWS                              |
| 7     | Product Readiness       | none                                                     | Not started                                             |

Each phase's exit condition (PRD §36) is quoted below. Suggested step numbering mirrors Phase 1:
x.1 models and enums, x.2 services and API with tests, x.3 UI from Stitch, x.4 hardening/verification.

---

## 4. Phase 2: Planning

**Goal (PRD §36):** wedding members can create events, organise activities, assign tasks, and understand what needs to happen and when.
**Exit condition:** "Wedding members can create events, organize wedding activities, assign tasks, and understand what needs to happen and when."

### 4.1 Scope

- **Multiple events** per wedding (Engagement, Haldi, Mehendi, Sangeet, Wedding, Reception, custom): name, date, start/end time, venue, address, description, dress code, public flag.
- **Event-level info**; event-linked tasks, expenses (later), invitations (later), live stream (later).
- **Task planner:** title, description, assignee(s), associated event, due date, priority, status (To Do / In Progress / Completed), notes; **overdue tasks clearly identifiable**.
- **Basic wedding timeline / schedule:** time-based items per event ("7:00 AM — Makeup"), distinct from tasks (PRD §27).
- Dashboard wiring: event count, upcoming event, pending/overdue tasks (replace the zero counts and empty states in the Stitch dashboard).

### 4.2 Data model (DB doc §6.7, §6.8)

**`events`**: `weddingId`, `name` 1–120, `type` (`mehendi, haldi, sangeet, engagement, ceremony, reception, other`; `ceremony` = the main wedding), `startsAt` (UTC Date), `endsAt` (nullable, must be > `startsAt`), `timezone` (IANA, defaults from the wedding), `location` (shared Location: label, address, lat/lng both-or-neither, placeId), `description` ≤2000, `dressCode` ≤200, `sortOrder`, `isPublic` (default false; website visibility in Phase 5), `createdBy`, soft-delete block, optimistic concurrency. Index `{weddingId, startsAt}`.

**`tasks`**: `weddingId`, `eventId` (nullable = wedding-level), `title` 1–200, `description` ≤2000, `status` (`todo, in_progress, done`), `priority` (`low, medium, high`), `dueDate` (`YYYY-MM-DD` nullable), `assigneeMemberIds[]` (≤10, **membership** ids of active members of the same wedding), `completedAt`/`completedBy` (set server-side when status becomes `done`, cleared otherwise), `createdBy`, soft-delete, optimistic concurrency. Indexes `{weddingId, status, dueDate}`, `{weddingId, eventId}`, `{weddingId, assigneeMemberIds}` (multikey).

New enums: `EVENT_TYPE`, `TASK_STATUS`, `TASK_PRIORITY` (already listed in DB doc Appendix A).

### 4.3 API (API doc §7), all roles may use (member edits events and tasks)

| Method | Path                                    | Notes                                                                                                 |
| ------ | --------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| GET    | `/weddings/:id/events`                  | Sorted by `startsAt`; **not paginated** (a handful per wedding)                                       |
| POST   | `/weddings/:id/events`                  | `endsAt > startsAt` refine                                                                            |
| GET    | `/weddings/:id/events/:eventId`         |                                                                                                       |
| PATCH  | `/weddings/:id/events/:eventId`         | `version` required                                                                                    |
| DELETE | `/weddings/:id/events/:eventId`         | Soft delete **and** cascade soft-delete of its RSVP rows in one transaction (no RSVPs exist until Phase 3: build the hook, response reports rows affected); set `eventId: null` on its tasks (and later expenses) |
| GET    | `/weddings/:id/tasks`                   | Filters `status`, `eventId`, `assigneeMemberId`, `dueBefore`; **cursor-paginated**                    |
| POST   | `/weddings/:id/tasks`                   | Verify `eventId` and every assignee belong to this wedding (assignees must be *active* members)       |
| PATCH  | `/weddings/:id/tasks/:taskId`           | `version`; `done` auto-sets `completedAt/By`                                                          |
| DELETE | `/weddings/:id/tasks/:taskId`           |                                                                                                       |

Also (carry-over from Phase 1): when a member leaves or is removed, `$pull` them from `tasks.assigneeMemberIds` (marked TODO in `member.service.ts`), and surface that cleanup in the removal flow.

Permissions to add: `events:edit`, `tasks:edit` → all roles (owner, admin, member); view is `wedding:view`.

### 4.4 UI

- **Check Stitch first.** No Events/Tasks screens existed as of 2026-10-10 (the project had: landing, login, signup, forgot/reset password, onboarding, dashboard, team, settings). Ask the owner to design **Events** and **Tasks** (and Schedule) screens, or approve building in the existing dashboard style.
- Enable the sidebar's **Events** and **Tasks** entries (currently "coming soon"), add `NavSection` values, extend `AppShell`.
- Dashboard: real counts for events and pending tasks, upcoming event, overdue emphasis; fill the Tasks widget; keep empty states.
- Overdue = `dueDate` before today in the wedding's timezone and status not `done` (`src/lib/dates.ts` has `todayIn`/`daysUntil`).

### 4.5 Decisions for Phase 2 (one is settled; the rest to ask before building)

1. **Schedule model: DECIDED (owner, 2026-10-10): embed a bounded `schedule[]` array inside each `events` document** (about 50 items max; each item: time, title, optional notes, optional `isPublic` for the Phase 5 website). No separate collection. Reasoning: it is always read together with its event and never queried across weddings. Remember to add a short note to the DB doc (§6.7) when building it, and validate order/limits in Zod. A schedule item is *not* a task: a task is a to-do for a person with a due date; a schedule item is a timed line in the event's run-of-show.
2. **Task "Notes": DECIDED (owner, 2026-10-10):** keep the single `description` field (DB doc as written); no separate `notes`.
3. **Task statuses: DECIDED (owner, 2026-10-10):** DB enum `todo / in_progress / done`; UI labels To Do / In Progress / Completed.
4. **Delete rule: DECIDED (owner, 2026-10-10):** a `member` can delete only events and tasks they created; `admin` and `owner` can delete any (same pattern as expenses, enforced with `createdBy` in the service). There is no separate "manager" role. Overrides the old "members edit everything" line for **delete**; whether members may *edit* others' events/tasks is still to confirm.
5. **Comments/subtasks: DECIDED (owner, 2026-10-10):** not in V1.
6. **Stitch designs:** the owner will provide Events, Tasks and Schedule screens; UI step (2.3) waits for them.

### 4.6 Suggested steps

- **2.1** ✅ events only: `EVENT_TYPES`, `events` model with embedded `schedule[]`, registry, tests (built 2026-10-10).
- **2.2** ✅ events only: service/routes/permissions (`events:edit`, `events:manage-any`), cross-wedding checks, tests, route inventory (built 2026-10-10). - **2.5** ✅ tasks backend: model, service, routes, permissions (`tasks:edit`, `tasks:manage-any`), assignee and event validation, `completedAt/By` handling, the member-removal `$pull` and the event-delete `eventId: null` cascade, 40 tests (built 2026-10-10). The RSVP part of the event-delete cascade joins in Phase 3.
- **2.6** ✅ tasks UI from the owner's three Stitch screens: Tasks screen (list grouped by event + drag-and-drop board + filters), task slide-over, event-page task card, dashboard widget, sidebar badge (built 2026-10-10).
- **2.3** ✅ events UI: timeline, event page, add/edit/duplicate slide-over, sidebar link, dashboard wiring (built 2026-10-10 from the owner's three Events screens). (Tasks UI: see 2.6 below.) from Stitch/approved style; dashboard wiring; browser verification.
- **2.4** ✅ (schedule editor, built 2026-10-10 in the existing style with the owner's approval; no Stitch design).
- **2.7** Phase 2 review/hardening pass (not started): re-read the permission rules, check indexes with `explain()` on a realistic task set, accessibility pass on the drag-and-drop board and slide-overs, update the DB and API design docs with the additions listed in `PROJECT_STATUS.md` §14.3.

---

## 5. Phase 3: Guests and invitations

**Goal:** the guest-facing communication and RSVP layer.
**Exit condition:** "A wedding member can add guests, assign them to events, generate personalized invitations, send invitations through email or WhatsApp sharing, and receive RSVP responses without guests creating accounts."

### 5.1 Scope (PRD §15–§21, §24)

Central guest list; family/group guests (e.g. "Shah Family: 3 adults + 2 children"); event-level assignment (RSVP rows); digital wedding invitations with personalised **secure links**; guest RSVP without accounts; RSVP dashboard (totals, per-event, pending); **email invitations and email RSVP reminders**; **WhatsApp pre-filled sharing** (invitation + reminder) with **no WhatsApp API**; revocable/regenerable links.

### 5.2 Data model (DB doc §6.9–§6.11, §5.3)

- **`guestGroups`**: name/nameNormalized, `side` (`partnerOne, partnerTwo, both`), notes, sortOrder; unique partial `{weddingId, nameNormalized}`; deleting a group requires choosing `reassignTo` (null or another group); guests are never silently deleted.
- **`guests`**: `groupId`, name/nameNormalized, email, phone (E.164), address, `side`, `relationLabel`, `ageCategory` (adult/child/infant), `plusOnesAllowed` 0–10, `dietaryPreference`, private `notes`, `invitation` {status not_invited/invited, lastSentAt, lastChannel email/whatsapp/manual, sendCount}, **`link` (SecureLink)**, soft delete, optimistic concurrency. Indexes `{weddingId, nameNormalized, _id}` (cursor pagination + prefix search), `{weddingId, groupId}`, `{weddingId, phone}` sparse, unique partial `{link.tokenHash}`.
- **`rsvps`**: one row per guest per event (existence = invited), `status` (`pending, attending, declined, maybe`), `attendingCount` (includes the guest; ≤ `1 + plusOnesAllowed`, else `422 BUSINESS_RULE_VIOLATION`), `respondedAt`, `respondedVia` (`guest_link, member`), `note`. Unique partial `{guestId, eventId}`; `{weddingId, eventId, status}`.
- **`emailLogs`** already exists; add `guest_invitation` and `rsvp_reminder` usage with `batchId` and `idempotencyKey` (`guest_invitation:<guestId>:<batchId>`).
- **SecureLink** stores `tokenHash` (lookup) **and** `tokenEnc` (AES-256-GCM, `select:false`) so members can re-show/re-share the same link; needs a new env var **`TOKEN_ENCRYPTION_KEY`**. **Requires owner approval first** (DB doc §15 item 1, recommended yes). If approved, tell the owner to add the variable to `.env.local`, `.env.example`, README and Vercel.

### 5.3 API (API doc §8)

Groups CRUD; guests list (cursor, `search` anchored prefix, filters `groupId, side, inviteStatus, dietaryPreference`; list shape is thinner than detail and includes `rsvpSummary` via **one** aggregation per page); guest CRUD; `POST …/guests/:id/rsvps` (assign event); `POST …/guests/:id/invite` (`email` | `whatsapp` | `manual`); `POST …/guests/invite-batch` (≤50 ids, chunks of 10, shared `batchId`, summary `{sent, failed, failedGuestIds}`, idempotent retry); `GET …/guests/:id/link` and `POST …/link/rotate`; `GET …/rsvps?eventId=` headcount report; public `GET/PATCH /public/rsvp/:token` (whitelist: only status, attendingCount, note, dietaryPreference writable; never other guests, notes, side, members, budget; validates guest not deleted, link not revoked/expired, wedding not deleted). Guest pages live at **`/i/[token]`** (decision D8; the API doc's `/rsvp/<token>` wording is superseded) and call the `/api/v1/public/…` routes.

Rate limits on public token operations (Architecture §39). Permissions: guest/group editing for **all roles**.

### 5.4 UI and email

- Stitch screens needed: Guests list, guest detail/assign events, groups, send-invitation flow, RSVP dashboard, **guest-facing invitation/RSVP page**, WhatsApp share. Check Stitch; none existed as of 2026-10-10.
- Dashboard: wire the RSVP widget, stat cards, follow-up widget (pending RSVPs).
- New email templates: guest invitation, RSVP reminder (in `templates.ts`, all user text escaped).
- WhatsApp: build `https://wa.me/<phone>?text=<prefilled>` links; the user presses Send; mark `invitation.status: invited` optimistically (cannot know delivery). No API, no background process.
- **Practical dependency:** emailing real guests needs a **verified Resend domain** (see `PROJECT_STATUS.md` §12). Without it, use WhatsApp/manual links.

### 5.5 Open decisions

1. Approve **`tokenEnc` + `TOKEN_ENCRYPTION_KEY`** (recommended yes; otherwise "Copy link" must rotate and invalidate links already sent).
2. RSVP link **per guest or per household** (recommended: per guest first; add a group link if families ask).
3. **Digital invitation templates/content** (PRD §18: templates, photos, personalised content): the DB doc has no template collection. Decide scope: fixed template(s) in code vs stored content; likely Phase 3 = one template, richer content with the website in Phase 5.
4. Bulk **guest import** (CSV)? Not in V1 docs; duplicate-detection index exists. Ask.
5. Reminder cadence stays **manual** (no scheduler in V1).

---

## 6. Phase 4: Financials and vendors

**Goal:** practical spending and vendor management. **No payment processing, no marketplace, no complex accounting.**
**Exit condition:** "Wedding members can track spending, maintain their vendor list, discover nearby vendors/businesses, and record vendor payment status."

### 6.1 Scope (PRD §13, §14)

Manual expense tracker (categories, event link, totals, category breakdown, who recorded it); My Vendors; **Google Places** nearby discovery (server-mediated); vendor categories, contact/business info, event association; agreed / paid / remaining amounts recorded **manually**; vendor notes; vendor payments with status and due dates.

### 6.2 Data model (DB doc §6.12–§6.14)

- **`expenses`**: `title`, `category` (13 values), `eventId`, `vendorId`, `estimatedAmountMinor`, `agreedAmountMinor` (cost used in totals = `agreed ?? estimated ?? 0`), private `notes`. **Paid amount is never stored**: it is the sum of `vendorPayments` with status `paid`. Payments above the agreed amount produce a **warning**, not an error.
- **`vendors`**: name/nameNormalized, `category` (13 values), `status` (`shortlisted, contacted, booked, rejected`), `contact` {personName, phone, email, website (https)}, `location` (structured, with `placeId`), `source` (`manual | google_places`), notes. **No bank/UPI/card fields ever.**
- **`vendorPayments`**: `expenseId`, `amountMinor` > 0, `status` (`pending, paid, cancelled`), `dueDate`, `paidAt` (required when paid), `method`, `reference`, optional S3 `receipt` metadata (Phase 6), notes. No `vendorId` on payments.

### 6.3 API (API doc §9)

Expenses CRUD + `GET /expenses/summary` (one aggregation: budget, estimated/agreed/paid totals, by category); `GET …/expenses/:id` includes derived `paidAmountMinor` and `remainingAmountMinor`; vendors CRUD; `GET …/vendors/search-places?query=…` (Google Places proxied server-side, results **not persisted** until the member adds the vendor); payments under an expense (`GET/POST …/expenses/:id/payments`, `PATCH/DELETE …/payments/:paymentId`). Amounts travel in **paise**; the client formats.

New env var: **`GOOGLE_PLACES_API_KEY`** (server-side only; also set in Vercel). Tell the owner.

### 6.4 Open decisions (important conflicts)

1. **Role conflict: RESOLVED (owner, 2026-10-10).** The old matrix (D3) had finance admin+ only, but the PRD says family members can record expenses. **Decision: keep it simple. Every family member (`member` role) can see all expenses in one place and record expenses.** No new libraries, no accounting features; the point is one shared place instead of several. Build this by adding `expenses:view` and `expenses:record` for **all roles** in `permissions.ts` (vendors, vendor payments, and the budget total setting stay admin+ unless the owner says otherwise). **Edit/delete rule: DECIDED (owner, 2026-10-10): a member can edit or delete only the expenses they recorded; admins and owners can edit or delete any.** Enforce with `createdBy` in the expense service. Also update the API doc §9 note ("all routes in this section require admin+") and `PROJECT_STATUS.md`.
2. **Expense fields:** PRD §13 lists amount/category/description/date/event/person; the DB doc models `title` and estimated/agreed amounts without an expense date. Decide whether to add a date and a single "amount" notion.
3. Vendor **assigned events** and **documents** (PRD §14) are not in the DB doc: add `eventIds[]` and defer documents (PRD §33 says not a V1 priority)?
4. **Google Places terms:** store `placeId` freely; other Places-copied content only if Google's current terms allow (storage and attribution rules; verify before building). Prefer storing what the member confirms or types.
5. Cached payment counters: **no** until measured slow.

---

## 7. Phase 5: Wedding experience

**Goal:** a polished, shareable digital experience for guests.
**Exit condition:** "A wedding can have a shareable digital wedding experience where guests can view wedding information, events, venues, schedule, RSVP, and live-stream content without creating an account."

### 7.1 Wedding website (DB doc §6.15, API doc §10)

- **`weddingWebsites`** (one per wedding): `slug` (3–40, `[a-z0-9-]`, unique among live sites), reserved slugs (`api, dashboard, login, signup, invite, rsvp, gallery, live, admin, www, app, static, join, onboarding, w, i` and any route name), `status` draft/published, title/tagline/welcome/story, `sections[]` (≤20), `publicEventIds[]` (≤20; each event must also be `isPublic`), `display` {showVenueAddresses, showCountdown}, `theme`, `seo`, `heroAssetId` (must be a public gallery asset: **depends on Phase 6**, so make it optional until then).
- Routes: member editor `GET/PATCH …/website`, `POST …/website/publish|unpublish` (admin+); public `GET /api/v1/public/websites/:slug` returning a **hand-built whitelist projection** (never the stored document; 404 if not published, or the website/wedding is deleted); public page **`/w/[slug]`**.
- Never expose: `weddingId`, `createdBy`, budget, members, guests, notes, deleted fields.
- Public wedding pages may link guests to RSVP via their personal link (PRD §22); the website itself holds no private data.
- Later optimisation: CDN/edge caching of the public route (open decision, API doc §16 #6).

### 7.2 Live streaming (DB doc §6.16, API doc §11)

- **`liveStreams`**: `eventId`, `provider` (`youtube, vimeo, other`), `streamUrl` (https; host validated per provider), title, description, `startTime`, `status` (`scheduled, live, ended, cancelled`; **set manually**, no webhooks/WebSockets), `link` (SecureLink) for `/live/[token]`.
- Routes: member CRUD + `POST …/link/rotate`; public `GET /api/v1/public/live/:token`; page `/live/[token]`; "Live Now" state when status is `live`.
- The token protects **our page**, not the video (state this limitation in the UI/docs).
- **CSP:** add the embed origins to `frame-src` in `src/lib/security-headers.ts` (e.g. YouTube `www.youtube-nocookie.com`, Vimeo `player.vimeo.com`) and extend its test.
- Provider abstraction (`LiveStreamProvider`: YouTube, Vimeo, future).

### 7.3 Open decisions

- Livestream **end time** (PRD §25 lists start/end; DB doc stores only `startTime`).
- Website **template/customisation depth** (keep "customisable but simple").
- Slug change policy (V1: old URL breaks; optional `slugHistory`).
- Guest-facing navigation between invitation, website, gallery and live pages.

---

## 8. Phase 6: Memories

**Goal:** the collaborative photo layer. **Exit condition:** "Wedding participants can collectively build and share organized wedding memories, while guests can contribute photos through controlled links."

### 8.1 Scope (PRD §26, §36)

Gallery, albums (event-based), uploads by members and by **guests through a controlled link**, favourites, upload metadata, private sharing, secure gallery/upload links, **QR-code access** (a convenient entry point that **never bypasses access controls**).

### 8.2 Data and flow (DB doc §6.17–§6.20, API doc §12)

- **`galleries`** (one per wedding, created automatically; settings `allowGuestUploads`, `requireUploadApproval` default true), **`galleryAlbums`**, **`galleryAssets`** (metadata only: server-generated `objectKey`, `mimeType` allow-list, size cap, `visibility` private/guests/public, `status` pending_upload → pending_review/active/rejected, `uploadedBy` {member|guest, displayName}), **`galleryAccessTokens`** (hash + `tokenEnc`, permissions canView/canUpload/canDownload, optional album scope, `purgeAt` +30 days after revoke/expiry).
- **Three-call upload:** `POST …/assets/upload-url` (validates mime/size, creates a `pending_upload` row, returns a short-lived **presigned S3 PUT**) → browser uploads directly to S3 → `POST …/assets/:assetId/confirm` (server verifies the object, then `active` or `pending_review`). Guest equivalents under `/api/v1/public/gallery/:token/…`.
- Moderation (`POST …/assets/:id/moderate`, admin+), asset PATCH/DELETE (soft delete; S3 object kept until wedding purge), albums with the "move to root or delete assets" choice.
- Delivery through **CloudFront signed URLs/cookies** with a **private** S3 bucket (origin access control). No image-processing pipeline in V1 (no thumbnails, no Lambda, no Sharp).
- TTL index removes stale `pending_upload` rows after 24 h; orphaned S3 objects need an **S3 lifecycle rule** (no workers).
- Public gallery responses are whitelists: `id`, CloudFront URL, `mediaType`, `caption`, `width/height`; never `uploadedBy.userId`, `objectKey`, `weddingId`, other people's moderation state.

### 8.3 New requirements to plan for

- AWS account setup: S3 bucket, CloudFront distribution + key pair, least-privilege IAM; new env vars (AWS credentials/region/bucket, CloudFront signing config). **Tell the owner exactly what to add** to `.env.local`, `.env.example`, README and Vercel.
- **CSP:** add the CloudFront origin to `img-src` (and `media-src` for video) and extend the test.
- QR code generation: a small library or hand-rolled SVG is a **new dependency decision** (ask first).
- Extend the wedding purge script to delete S3 objects.

### 8.4 Open decisions

Per-wedding **storage quota** (recommended: a few GB, checked via `sum(sizeBytes)` before issuing upload URLs); gallery **favourites** (PRD §26; not in DB doc); keep the separate `galleries` collection or fold settings into `weddings`; allowed file types/sizes; whether videos are in V1 upload scope.

---

## 9. Phase 7: Product readiness

**Goal:** harden the complete product for production. **Exit condition:** production-ready on reliability, security, performance, usability, testing, deployment, analytics and monitoring (PRD §36).

### 9.1 From the PRD

- **Error handling:** consistent API errors (done), friendly error states, form validation, empty/loading states, retry where appropriate, graceful third-party failure, secure error logging.
- **Security review:** authentication, authorization, **wedding-isolation testing**, guest-token review, API review, input validation, **file-upload security**, media access controls, secrets/env review, dependency audit, privacy review, data deletion and access review.
- **Responsive design:** mobile, tablet, desktop, touch, cross-browser.
- **Performance:** page load, API, image optimisation, lazy loading, caching strategy, bundle size, **database/query review with `explain()`**, third-party API performance.
- **Testing:** unit, integration, API, end-to-end, auth/authorisation, guest flows, invitation/RSVP, email, WhatsApp sharing, gallery/upload, live stream, cross-browser, regression, production smoke.
- **Analytics** (privacy-respecting): wedding creation funnel, member invitations, events, guests, invitations, RSVP, website visits, gallery activity, errors.
- **Deployment:** production environment, CI/CD, **database migration process**, asset deployment, domain, HTTPS, email config, third-party config, secrets management, backup strategy.
- **Monitoring:** application/infrastructure/API monitoring, error tracking, performance, uptime, third-party monitoring, alerting, logs, backup monitoring, incident-response basics. (V1 architecture says no external logging platform; any monitoring tool is an owner decision.)

### 9.2 Carry-overs from the build so far

- **Purge script** (hard-delete a soft-deleted wedding's documents in batches after `purgeAfter`, plus S3 objects) and **anonymise script** (`email → deleted+<id>@invalid`, name "Deleted user", clear credentials) — manually run, not a service (DB doc §10.3–10.4).
- **Backup/restore drill** (Atlas) and **TTL verification** in a real cluster.
- **Index review** with `explain("executionStats")` on realistic data; run `db:sync-indexes` deliberately on deploys (it drops undeclared indexes: read the dry run first; changing a TTL duration needs `collMod`).
- **Nonce-based CSP** (needs a request proxy; makes pages dynamic) to drop `'unsafe-inline'` for scripts.
- Optional **`Origin`-header check** on state-changing requests as extra CSRF insurance (not required by the API doc).
- Revisit **rate limiting** (platform edge protection first; MongoDB counters only where precise control matters; Redis only if truly needed).
- **Legal pages:** Terms, Privacy Policy, DPDP compliance wording (footers currently link to placeholders).
- Replace design copy that overstates ("256-bit encrypted", "synchronized in real time", "EST. 2025", "PRODUCTION OS") if the owner wants strict accuracy.
- **Audit logging** (PRD §34 mentions logging/auditing): decide how far V1 goes beyond basic application logs.

---

## 10. Cross-cutting backlog

Items not belonging to a single phase. Ask the owner to prioritise.

**Email and accounts**

- [ ] **Verify a sending domain in Resend**, set `EMAIL_FROM`, set `RESEND_API_KEY`/`EMAIL_FROM` on Vercel. (Needed for real invitations/resets; essential before Phase 3.)
- [ ] Test **real Google sign-in** end to end (consent screen, redirect URI = `<APP_URL>/api/v1/auth/google/callback`, production URL added too).
- [ ] Google account **connect/disconnect** from Settings (must prove the password first; never auto-link; don't allow disconnecting the only sign-in method). Currently only an explanatory toast.
- [ ] **Change login email** (needs re-verification; V1 has none) — deferred by decision.
- [ ] Optional **"Sign out and use another account"** button on the join page's "You already belong to a wedding" screen (offered to the owner, not yet built).
- [ ] Optional **"Resend email"** in the Team UI (API exists; the Stitch design only has "Copy invite link" and "Revoke").
- [ ] In-app **notifications** (bell is a placeholder; PRD §28 priority 3); open decision on scope.
- [ ] `suspended` member status has no UI or endpoint.

**UI / design**

- [ ] **"Edit Wedding" Stitch screen** (decided 2026-10-10: defer). Adds address lines, city, state, postal code, country, total budget and status to the Settings wedding-details form; the wedding `PATCH` already accepts all of it, so this is UI plus the budget/status rules. Do it as a small separate step (budget visibility ties to Phase 4: the design says only owners and admins see budget figures).

- [ ] Stitch designs for `/join/[token]`, not-found, error pages; restyle if they arrive.
- [ ] Footer links (Terms, Security & Compliance, Contact Support), "Concierge Support", landing-page placeholders.
- [ ] Dashboard "Quick Actions"/notice banner content as modules arrive.
- [ ] Accessibility pass (focus management in dialogs/menus, keyboard navigation, contrast) — partly Phase 7.

**Docs and process**

- [ ] **Update the design docs** to record the additions listed in `PROJECT_STATUS.md` §15 (resend/link/DELETE sessions, `emailError`, `passwordChangedAt`, new rate limits, shell changes) so the docs and code agree.
- [ ] Keep `README.md` in step with setup changes.
- [ ] Decide when to **merge `dev` into `main`** (the owner has asked to keep everything on `dev` so far).

**Deployment (when the owner is ready)**

- [ ] Create the Vercel project from the GitHub repo; set all env variables; set `APP_URL` to the real domain; add a custom domain (also reused for Resend).
- [ ] Run `npm run db:sync-indexes -- --apply` against the production database (review the dry run first). Use a **separate production database** from development.
- [ ] Set Google OAuth production redirect URI; Atlas network access for Vercel.
- [ ] Vercel Hobby is for personal/non-commercial use; recheck terms before commercialisation. AWS ECS/Fargate is the planned later host (no Docker work until then).

---

## 11. Consolidated open decisions

Ask these when the relevant phase starts (recommendations in brackets are the AI's, not decisions).

| #  | Phase | Question                                                                                                         | Recommendation                                           |
| -- | ----- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 1  | 2     | ~~Schedule/timeline model~~ **Decided:** bounded `schedule[]` embedded in each event                             | (done)                                                    |
| 2  | 2     | ~~Task "Notes" separate from "Description"?~~ **Decided:** one field (`description`)                              | (done)                                                    |
| 3  | 3     | Approve `tokenEnc` + `TOKEN_ENCRYPTION_KEY` for re-showable guest links                                          | Yes                                                       |
| 4  | 3     | RSVP link per guest or per household                                                                             | Per guest first                                           |
| 5  | 3     | Digital invitation template scope (no collection in DB doc)                                                      | One built-in template first                               |
| 6  | 3     | Guest CSV import?                                                                                                | Ask; not in V1 docs                                       |
| 7  | 4     | ~~Who may record/view expenses~~ **Decided:** all family members view and record; members edit/delete only their own, admin+ any | (done) |
| 8  | 4     | Expense fields (date, single amount) vs DB doc                                                                   | Add an expense date                                       |
| 9  | 4     | Vendor `eventIds[]` and documents                                                                                | Add `eventIds[]`; defer documents                         |
| 10 | 4     | What Google Places data may be stored                                                                            | Store `placeId` + what the user confirms                  |
| 11 | 5     | Livestream end time                                                                                              | Add optional `endTime`                                    |
| 12 | 5     | Slug history/redirects                                                                                           | Not in V1                                                 |
| 13 | 6     | Per-wedding storage quota and file limits                                                                        | A few GB; check before issuing upload URLs               |
| 14 | 6     | Favourites; keep `galleries` collection; QR library dependency                                                   | Keep collection; ask before adding a QR dependency        |
| 15 | 7     | Monitoring/analytics tools (V1 says none external)                                                               | Owner decision                                            |
| 16 | any   | In-app notifications scope                                                                                       | Defer unless needed                                       |
| 17 | any   | Origin-check CSRF insurance                                                                                      | Optional                                                  |
| 18 | any   | Cached counters (paid totals, RSVP counts)                                                                       | No, until measured                                        |

Already decided (do not re-ask): **expenses are viewable and recordable by all family members, members edit/delete only their own entries while admins/owners can change any, kept simple with no new libraries (2026-10-10)**; **schedule items are stored inside each event (2026-10-10)**; `/api/v1` prefix, password reset in V1, the role matrix (§10 of status), `jose`, rate-limit approach, retention windows, Server Components calling services, URL scheme, Tailwind only, Resend (no domain yet), npm/Node 24/CI-only checks, doc-conflict resolutions C1–C10, signup→onboarding flow.

---

## 12. Out of scope and forbidden for V1

**Out of scope (PRD §44):** vendor marketplace, vendor bidding, vendor lead marketplace, payment processing, complex accounting, transportation management, international support, custom live-streaming infrastructure, multi-wedding planner accounts, mandatory guest accounts, WhatsApp API integration, automated WhatsApp messaging, advanced accommodation management, QR check-in as an event-management system, advanced document management.

**Future ideas (PRD §45):** transportation, accommodation, seating, QR check-in, gift registry, advanced photo discovery, AI wedding assistant, AI-generated website/invitation, smart task recommendations, advanced analytics, vendor marketplace, professional multi-wedding planner accounts, international support, WhatsApp Business API, SMS automation, communication campaigns, advanced documents/contracts.

**Technology that must not be introduced without owner approval (Architecture §53):** Redis, BullMQ, background workers, microservices, NestJS, a separate Express backend, Kafka, RabbitMQ, GraphQL, WebSockets, Kubernetes, Docker infrastructure, Clerk, Auth0, Better Auth, Elasticsearch, complex image processing, external logging platforms, payment processing, vendor marketplace, transportation management. Also: no native MongoDB driver (use Mongoose), no Server Actions, no new framework or infrastructure service "because it's best practice". If a requirement seems to conflict with the architecture, **stop and flag it** (Architecture §55).

---

## 13. Where the design docs define each phase

| Need                              | Document and section                                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Product scope, phase exit criteria | PRD §10–§33 (features), §36 (phases), §43 (locked decisions), §44–45 (out of scope / future)                   |
| Architecture rules, exclusions    | System Design §3, §7, §12, §17, §24–§31, §53–§55                                                              |
| Collections and indexes           | Database Design §6 (per collection), §8 (indexes), §9 (integrity), §10 (deletion), §11 (public projections), §15 (open decisions) |
| Endpoints, errors, rate limits    | API Design §2 (conventions), §3 (authorization), §7 (events/tasks), §8 (guests/RSVP), §9 (finance/vendors), §10 (website), §11 (live stream), §12 (gallery), §13 (email logs), §14 (cross-cutting), §16 (open decisions) |

When code and a design doc disagree, **the architecture wins**; then the database design for field names and constraints; the API doc adds the request/response envelope. Record any deviation in `PROJECT_STATUS.md`.
