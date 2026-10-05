# Make My Marriage

An India-first, collaborative wedding-planning SaaS. One wedding is one shared workspace for the
couple, their families and a planner; guests never create accounts and use secure links instead.

The product and architecture are defined in [`docs/`](docs):

| Document                                                                | What it covers                          |
| ----------------------------------------------------------------------- | --------------------------------------- |
| [PRD](docs/Make_My_Marriage_PRD.md)                                     | Product requirements and release phases |
| [System Design](docs/Make_My_Marriage_System_Design_Architecture_V1.md) | Architecture and what V1 excludes       |
| [Database Design](docs/Make_My_Marriage_Database_Design_V1.md)          | Collections, indexes, validation rules  |
| [API Design](docs/Make_My_Marriage_API_Design_V1.md)                    | REST endpoints, auth, error codes       |

## Status

Phase 1 (Foundation) is built: sign up and log in (email/password or Google), password reset,
sessions, wedding creation, team members with roles, member invitations by email, the dashboard,
team and settings pages. Later phases (events and tasks, guests and RSVP, expenses and vendors,
website, gallery) follow the PRD's release plan.

## Getting started

Requires Node 24 (see `.nvmrc`) and a MongoDB database (Atlas, or any replica set: transactions
need one).

```bash
npm ci
cp .env.example .env.local   # then fill in the values below
npm run dev                  # http://localhost:3000
```

### Environment variables

| Variable                             | Required | Notes                                                                                                                                                                 |
| ------------------------------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `APP_URL`                            | yes      | The address people open. Invitation and password-reset links are built from it.                                                                                       |
| `MONGODB_URI`                        | yes      | Use a separate database for development. Never point local at production.                                                                                             |
| `SESSION_SECRET`                     | yes      | At least 32 characters. `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`                                                              |
| `GOOGLE_CLIENT_ID`, `_CLIENT_SECRET` | no       | Enables "Continue with Google". Redirect URI: `<APP_URL>/api/v1/auth/google/callback`.                                                                                |
| `RESEND_API_KEY`, `EMAIL_FROM`       | no       | Without a key, emails print to the console in development and are refused in production. Resend only delivers to your own address until a sending domain is verified. |

`.env.local` is git-ignored. Never commit secrets.

### Database indexes

`autoIndex` is off in production. During a deploy, review then apply the indexes declared in
`src/models`:

```bash
npm run db:sync-indexes             # dry run: shows what would be created or dropped
npm run db:sync-indexes -- --apply
```

## Scripts

| Command                                       | Does                                              |
| --------------------------------------------- | ------------------------------------------------- |
| `npm run dev` / `build` / `start`             | Next.js development server, build, production run |
| `npm run typecheck` / `lint` / `format:check` | The checks CI runs                                |
| `npm test`                                    | Unit and integration tests (see below)            |
| `npm run test:unit` / `test:integration`      | One project at a time                             |

Integration tests start a throwaway in-memory MongoDB replica set (downloaded on first run), so
they never touch a real database.

## How the code is organised

```
src/
├── app/              Next.js pages and the REST API (src/app/api/v1/…)
├── modules/          One folder per domain: auth, users, weddings, members, dashboard, notifications
│   └── <module>/     *.schemas.ts (Zod) → *.service.ts (rules) → *.repository.ts (the only code
│                     that touches Mongoose models)
├── models/           Mongoose models, shared sub-schemas, plugins (soft delete, normalisation)
├── infrastructure/   database, email, oauth
├── lib/              http pipeline (route()), errors, crypto, validation, logger, constants
└── components/       UI building blocks
tests/                Integration tests, plus helpers in tests/setup
```

Rules the code and the linter enforce (details in `CLAUDE.md` and `docs/`):

- Every request goes: request ID → Zod validation → authentication → authorization → service →
  repository. API routes use the `route()` wrapper in `src/lib/http/route.ts`.
- Wedding-owned data is only reachable through repository functions that take `weddingId`;
  there is no `findById`. Models may only be imported by `*.repository.ts` files.
- Soft delete by default. Hard delete only for sessions, tokens and email logs.
- One user belongs to one wedding, enforced by a partial unique index as well as in the service.
- No Redis, queues, background workers, WebSockets or GraphQL in V1.

### Security checks that run in the test suite

- `src/lib/security/route-inventory.test.ts` lists every API route and its guard. Adding a route,
  or weakening one, fails the test until the table is updated on purpose.
- `tests/integration/security/hardening.test.ts` covers cache headers, cookie flags, secrets in
  responses, cross-wedding access and account-enumeration.
- `tests/integration/journeys/phase1.test.ts` walks the Phase 1 exit condition end to end.

Format with Prettier (`npm run format`); the config is committed in `.prettierrc.json`.
