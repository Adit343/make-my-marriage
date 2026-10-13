# Make My Marriage — Deployment and Operations Runbook

> For the person deploying (Phase 7, step 7.8). Everything below that needs an account (Vercel,
> Atlas, Cloudflare, Resend, Google) is a step only you can do; the app, scripts and checks are
> ready. Tick the boxes in order.

## 1. Before the first deploy

**Accounts and settings** (each one is a separate item you create once):

- [ ] **MongoDB Atlas**: a **separate production cluster/database** (never reuse development). Turn on
      backups for the plan you chose. Allow network access from Vercel (Atlas "Network Access":
      Vercel has no fixed address on the Hobby plan, so allow `0.0.0.0/0` with a strong database
      password, or use Vercel's Atlas integration).
- [ ] **Cloudflare R2**: a **private** bucket (do not enable public access) and an API token limited to
      that bucket (Object Read & Write). Add the bucket's **CORS rule** for your real address:
      origin `https://<your-domain>`, methods `GET`, `PUT`, `HEAD`, headers `*`, expose `ETag`, max
      age 3600. Optional: a lifecycle rule that deletes incomplete uploads after 1 day.
- [ ] **A domain** and, for email, a **verified sending domain in Resend** (add the SPF/DKIM records
      Resend shows; a subdomain such as `mail.<domain>` is fine). A `*.vercel.app` address cannot be
      verified.
- [ ] **Google OAuth** (optional): add `https://<your-domain>/api/v1/auth/google/callback` as an
      authorised redirect URI.
- [ ] **Google Places key** (optional): enable "Places API (New)", restrict the key to it, set billing alerts.

**Environment variables** (Vercel, Project Settings, Environment Variables, "Production"):

| Variable                                                                     | Value                                                                                         |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `APP_URL`                                                                    | `https://<your-domain>` (no trailing path)                                                    |
| `MONGODB_URI`                                                                | the **production** Atlas connection string                                                    |
| `SESSION_SECRET`                                                             | 32+ random characters                                                                         |
| `TOKEN_ENCRYPTION_KEY`                                                       | 32+ random characters, **different from `SESSION_SECRET`**. Keep it stable forever (changing it breaks "copy link" for stored links) |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`     | from Cloudflare. **Set the same four in the build environment too**: `next.config.ts` reads `R2_ACCOUNT_ID` at build time to allow that one address in the security policy |
| `RESEND_API_KEY`, `EMAIL_FROM`                                               | e.g. `Make My Marriage <hello@mail.<domain>>`                                                 |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_PLACES_API_KEY`          | optional                                                                                      |
| _never set_ `LOCAL_STORAGE_DIR`                                              | would put photos on a disk that is wiped between requests                                     |

Generate a secret: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.

**Check them before deploying** (put the production values in your shell or a scratch `.env.local`,
never commit them):

```bash
npm run deploy:check      # prints FAIL / warn / ok lines, never a value
```

## 2. Deploy

1. Push `dev` (or merge to `main` once you decide to; see FUTURE_PLANS) and let Vercel build. CI must be
   green first (typecheck, lint, format, tests, build, browser tests).
2. **Indexes** (first deploy and whenever a model's indexes change). Read the dry run first: it
   **drops** indexes that are no longer declared.

   ```bash
   npm run db:sync-indexes             # dry run
   npm run db:sync-indexes -- --apply
   ```

   Changing the length of an existing TTL index needs `collMod` instead of a re-create.

3. **Smoke test** the live site:

   ```bash
   npm run smoke -- https://<your-domain>
   ```

   Every line must say `ok` (the `email configured` line fails until Resend is set up).

4. By hand, once: sign up, create a wedding, add an event and a guest, copy the guest's link and open it
   in a private window, answer, upload a photo (this proves the R2 CORS rule), publish the website,
   delete the test wedding.

## 3. Monitoring (no external platform in V1)

- **Uptime:** point a free uptime monitor (for example UptimeRobot or Better Stack's free tier, your
  choice) at `https://<your-domain>/api/v1/health/ready` every 5 minutes. It answers `200` with
  `{status:"ok", database, photoStorage, email}`; a database outage returns `500`. Alert on anything but `200`.
- **Errors and requests:** every request logs one line (request id, status, error code, duration;
  tokens redacted). Read them in Vercel, Project, Logs; search `level":"ERROR"`. A user can quote the
  reference shown on the error page (`digest`) and you search for it.
- **Product numbers:** `npm run analytics:summary` (last 30 days) or `-- 7`. Counts only; no personal data.
- **Email delivery:** Team and Invitations screens show sent/failed; Resend's dashboard shows bounces.
- **Atlas alerts:** enable the default alerts (connections, disk, replica-set health) in Atlas.

## 4. Routine and occasional jobs (run by hand, from a machine with the production `MONGODB_URI` and R2 settings)

| When                         | Command                                                                           | Does                                                                                                                         |
| ---------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| About monthly                | `npm run db:purge-weddings` (dry run), then `-- --apply`                          | Permanently erases weddings deleted more than 30 days ago: photo files first, then every row                                  |
| About monthly                | `npm run db:anonymize-users` (dry run), then `-- --apply`                          | Strips personal data from accounts deleted more than 30 days ago                                                              |
| After every deploy that adds an index | `npm run db:sync-indexes`                                                  | See above                                                                                                                     |
| After rotating R2 keys       | `npm run storage:check`                                                           | Uploads, reads and deletes a test file and checks the CORS rule                                                              |

Take an Atlas snapshot before the first real purge. Both jobs are safe to repeat.

## 5. Backup and restore drill (do it once before launch, then yearly)

1. In Atlas, take an on-demand snapshot of production.
2. Restore it into a **new, separate** cluster (never over production).
3. Point a scratch `.env.local` at the restored cluster and run `npm run db:sync-indexes` (expect "in sync"),
   then `npm run dev` and sign in with a real account. Confirm weddings, guests and expenses are there.
4. Photos are in R2, not Atlas: they are not part of the snapshot. R2 keeps objects durably but has no
   versioning by default; deleting a photo or a wedding deletes its files for good (the purge job and the
   photo delete both remove files). Decide whether you need an occasional bucket copy.
5. Delete the restored cluster. Write down how long it took.

## 6. If something goes wrong

- **A bad deploy:** in Vercel, Deployments, promote the previous good deployment ("Instant rollback").
  Database changes in V1 are additive, so rolling the code back is safe.
- **A leaked secret:** rotate it at its source (Atlas password, R2 token, Resend key, Google secret),
  update Vercel and redeploy. Rotating `SESSION_SECRET` signs everyone out of Google sign-in in
  progress only; sessions are stored in the database and are unaffected. Do **not** rotate
  `TOKEN_ENCRYPTION_KEY` unless you must (guests' own links keep working, but "Copy link" issues new ones).
- **A guest link was shared too widely:** rotate it on the guest, or revoke the shared gallery link, or
  replace the live-stream link. The old one stops at once.
- **A user asks for deletion:** they can delete their account (and wedding) in Settings; the purge and
  anonymise jobs finish it after 30 days. To act sooner, run the jobs after that grace period or ask
  the owner to confirm and adjust the dates by hand in Atlas.
- **Database unreachable:** `/api/v1/health/ready` returns `500`; check Atlas status and network access.

## 7. Before you call it launched

- [ ] Legal pages: replace the drafts at `/terms` and `/privacy` with lawyer-reviewed text and add a real
      contact address (marked `[contact email to be added before launch]`).
- [ ] Resend sending domain verified; send yourself an invitation and a reset email.
- [ ] The R2 CORS rule works for the production address (the manual photo upload above).
- [ ] Atlas backups on; restore drill done.
- [ ] Uptime monitor created and alerting to you.
- [ ] `npm audit --omit=dev` shows 0; CI is green.
