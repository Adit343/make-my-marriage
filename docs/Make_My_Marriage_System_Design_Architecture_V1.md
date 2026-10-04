# Make My Marriage — System Design Architecture Document

**Version:** 1.0  
**Date:** 28 September 2026  
**Status:** V1 architecture baseline

## 1. Executive Summary

Make My Marriage is an India-first collaborative wedding-management SaaS for couples, families, and wedding organizers/planners.

V1 is intentionally a **modular monolith** built with **Next.js + TypeScript**, using REST APIs, MongoDB Atlas with Mongoose, Zod validation, custom authentication, Amazon S3 + CloudFront for media, lightweight email delivery, and basic application logs.

The initial deployment is **Vercel** because this is a passion project and infrastructure cost should remain as close to zero as practical. The architecture keeps the application portable so it can later move to **AWS ECS/Fargate** when the product becomes commercial or requires additional infrastructure.

V1 explicitly avoids Redis, BullMQ, background workers, microservices, Docker infrastructure, Kubernetes, Kafka, GraphQL, WebSockets, NestJS, Clerk, Auth0, Better Auth, external observability platforms, and complex image-processing pipelines.


## 2. Core Business Model

### User/Wedding relationship

The current V1 rule is:

> **One user = one wedding**

> **One wedding = multiple members**

A user can therefore belong to only one wedding in the current model, while a wedding can contain multiple authenticated members.

Example:

```text
Wedding
 ├── Couple
 ├── Parent
 ├── Sibling
 └── Wedding Planner
```

### Guests

Guests are **not application users**. They do not need accounts or passwords. They access invitation, RSVP, gallery, wedding website, and live-stream experiences through controlled links.

### Vendor model

Vendors are vendors hired by the wedding. V1 does not provide a vendor marketplace.

### Payments

V1 tracks vendor/expense payments manually. It does not process payments.


## 3. Architectural Principles

1. **Simplicity first:** do not add infrastructure without a real requirement.
2. **Modular monolith:** one application and codebase, with strong internal module boundaries.
3. **Server-side security:** frontend restrictions never replace authorization.
4. **Wedding isolation:** every wedding-owned resource must be authorized against the authenticated user's membership.
5. **MongoDB is the source of truth** for application state.
6. **Direct media storage:** files live in S3, not MongoDB.
7. **CDN delivery:** CloudFront serves media.
8. **No premature distributed systems:** Redis, queues, workers and microservices are future options only.
9. **Provider abstraction:** email, Places, OAuth and livestream integrations sit behind service interfaces.
10. **Migration-friendly:** business logic should not depend on Vercel-specific infrastructure.
11. **Soft delete by default:** hard delete only data that truly requires permanent removal.


## 4. V1 Technology Stack

| Area | Decision |
|---|---|
| Language | TypeScript |
| Framework | Next.js |
| Runtime | Node.js |
| Architecture | Modular Monolith |
| API | REST |
| Validation | Zod |
| Database | MongoDB Atlas |
| ODM | Mongoose |
| Authentication | Custom application implementation |
| Password authentication | Email/password |
| OAuth | Custom Google OAuth/OIDC flow |
| Session storage | MongoDB |
| File storage | Amazon S3 |
| CDN | Amazon CloudFront |
| Email | Lightweight provider such as Resend |
| Queue | None |
| Background worker | None |
| Cache | None in V1 |
| Vendor discovery | Google Places API |
| Live streaming | Provider abstraction |
| Logging | Basic application logs |
| CI/CD | GitHub + GitHub Actions |
| Initial hosting | Vercel |
| Future hosting | AWS ECS/Fargate |
| Docker infrastructure | Not used in V1 |


## 5. High-Level Architecture

```text
                         USERS
                           |
                         HTTPS
                           |
                           v
                  +-------------------+
                  |      Vercel       |
                  |                   |
                  | Next.js           |
                  | React UI          |
                  | REST API          |
                  | Authentication    |
                  | Business Logic    |
                  | Data Access       |
                  +---------+---------+
                            |
          +-----------------+------------------+
          |                 |                  |
          v                 v                  v
   MongoDB Atlas        Amazon S3         External APIs
      Mongoose         CloudFront         Google OAuth
                                           Google Places
                                           Email Provider
                                           YouTube/Vimeo
```

There is no separate Express backend. The Next.js application contains the UI, API layer, authentication, services and repositories.


## 6. Modular Monolith Structure

Recommended logical modules:

```text
auth
users
weddings
members
events
tasks
guests
guest-groups
invitations
rsvp
expenses
vendors
website
gallery
livestream
notifications
```

Infrastructure modules:

```text
database
storage
email
oauth
external-apis
logging
crypto
```

Modules communicate through application services, not HTTP/network calls.

### Suggested project structure

```text
src/
├── app/
│   ├── (public)/
│   ├── (auth)/
│   ├── dashboard/
│   └── api/
├── modules/
│   ├── auth/
│   ├── users/
│   ├── weddings/
│   ├── members/
│   ├── events/
│   ├── tasks/
│   ├── guests/
│   ├── invitations/
│   ├── rsvp/
│   ├── expenses/
│   ├── vendors/
│   ├── website/
│   ├── gallery/
│   └── livestream/
├── infrastructure/
│   ├── database/
│   ├── storage/
│   ├── email/
│   ├── oauth/
│   └── external/
├── lib/
│   ├── crypto/
│   ├── errors/
│   ├── http/
│   ├── logger/
│   └── validation/
└── models/
```


## 7. Request Processing Architecture

Every protected REST request should follow:

```text
HTTP Request
    ↓
Route Handler / Controller
    ↓
Zod Validation
    ↓
Authentication
    ↓
Authorization
    ↓
Service
    ↓
Repository
    ↓
Mongoose
    ↓
MongoDB Atlas
```

Route handlers should stay thin. Business rules belong in services. Database operations belong in repositories/data-access modules.

The frontend must never connect directly to MongoDB.


## 8. Authentication

### Decision

V1 will **not use Better Auth, Clerk, Auth0 or another authentication framework**.

Authentication will be implemented in the application using established standards and Node.js built-in cryptographic primitives.

Do not invent cryptographic algorithms or custom OAuth protocols.

### Supported authentication

- Email/password
- Google OAuth
- Login
- Logout
- Session management
- Password change
- Password reset if included in final V1 scope

### Signup

```text
User
 ↓
POST /api/auth/signup
 ↓
Zod validation
 ↓
Check existing email
 ↓
Hash password
 ↓
Create User
 ↓
Create Session
 ↓
Set secure HttpOnly cookie
 ↓
Authenticated
```

**Email verification is intentionally removed from V1.**

A new user can immediately:

1. Sign up
2. Create a wedding
3. Or accept/join an existing wedding invitation

No email-verification gate should block these flows.


## 9. Password Security

Never store plaintext passwords.

Use a strong password-derived hashing construction such as Node.js `crypto.scrypt`, with a unique random salt and stored parameters/version.

Use:

- `crypto.randomBytes`
- `crypto.scrypt`
- `crypto.timingSafeEqual`

where appropriate.

The implementation must make future password-hashing parameter upgrades possible.

Passwords, session tokens, OAuth secrets and API keys must never be written to logs.


## 10. Session Architecture

Use server-side sessions stored in MongoDB.

```text
Browser
  ↓
Secure HttpOnly Cookie
  ↓
Opaque Session Token
  ↓
MongoDB Session
  ↓
User
```

Cookie requirements:

- `HttpOnly`
- `Secure` in production
- `SameSite=Lax` by default
- Appropriate `Path`
- Reasonable expiration

Recommended session fields:

```text
Session
- _id
- userId
- tokenHash
- expiresAt
- createdAt
- lastUsedAt
- revokedAt
```

Store a hash of the session token rather than exposing sensitive session state to the browser.


## 11. Google OAuth

Implement Google OAuth/OIDC on the server.

Flow:

```text
Browser
 ↓
GET /api/auth/google
 ↓
Generate state
Generate PKCE verifier/challenge where supported
 ↓
Redirect to Google
 ↓
Google authentication
 ↓
Callback
 ↓
Validate state and OAuth response
 ↓
Exchange authorization code
 ↓
Validate Google identity
 ↓
Find/create User
 ↓
Create Session
 ↓
Redirect to application
```

Requirements:

- Validate OAuth `state`
- Use PKCE where supported/appropriate
- Validate redirect URI
- Keep client secret server-side
- Never expose OAuth secrets to the browser
- Do not trust arbitrary callback parameters


## 12. Authorization

Authentication answers **who the user is**. Authorization answers **what the user can do inside the wedding**.

Every protected operation must verify:

1. User is authenticated.
2. User belongs to the requested wedding.
3. User has permission for the operation.
4. The target resource belongs to that wedding.

Example:

```text
User A → Wedding A → allowed
User A → Wedding B → denied
```

Never rely on hidden UI controls for authorization.


## 13. One User = One Wedding Enforcement

V1 must enforce the rule:

```text
User
  └── one wedding membership
```

A wedding can have many members:

```text
Wedding
 ├── Member A
 ├── Member B
 ├── Member C
 └── Member D
```

A user attempting to accept an invitation to a second wedding must be rejected.

This rule must be enforced in the service layer and supported by appropriate database constraints/indexes.


## 14. Wedding Members

Suggested model:

```text
WeddingMember
- _id
- weddingId
- userId
- role
- status
- joinedAt
- createdAt
- updatedAt
- deletedAt
```

Possible roles:

- owner
- admin
- member

The exact permission matrix can be finalized during implementation.


## 15. Member Invitations

Invitation flow:

```text
Existing Member
 ↓
Enter invitee email
 ↓
Create invitation
 ↓
Generate cryptographically random token
 ↓
Send invitation email
 ↓
Invitee opens link
 ↓
Signup/Login
 ↓
Accept invitation
 ↓
Create WeddingMember
```

**No email verification is required for accepting an invitation.**

The invitation token itself authorizes the join operation.

Invitation tokens should be:

- Cryptographically random
- Stored hashed where practical
- Expirable
- Single-use
- Revocable
- Invalidated after acceptance

An already-attached user must not be allowed to join another wedding.


## 16. Guest Architecture

Guests are separate from application users.

```text
User
= authenticated wedding member

Guest
= person managed by wedding members
```

Guests may have:

- Name
- Phone
- Email
- Group
- Address
- RSVP state
- Event assignments
- Invitation state

Guests do not need accounts.


## 17. Secure Guest Links

Guest-facing features may use secure token links:

```text
/invite/<token>
/rsvp/<token>
/gallery/<token>
/live/<token>
```

Tokens must be:

- Random
- Long enough to prevent guessing
- Expirable where appropriate
- Revocable
- Stored hashed where practical

Do not use MongoDB IDs as authorization secrets.


## 18. REST API

Use REST only in V1.

Examples:

```text
/api/auth/signup
/api/auth/login
/api/auth/logout

/api/weddings
/api/weddings/:weddingId

/api/weddings/:weddingId/members
/api/weddings/:weddingId/invitations

/api/weddings/:weddingId/events
/api/weddings/:weddingId/tasks

/api/weddings/:weddingId/guests
/api/weddings/:weddingId/rsvps

/api/weddings/:weddingId/expenses
/api/weddings/:weddingId/vendors

/api/weddings/:weddingId/website
/api/weddings/:weddingId/gallery
/api/weddings/:weddingId/livestream
```

Use `GET`, `POST`, `PATCH`, and `DELETE` according to resource semantics.


## 19. Zod Validation

All external API input should be validated with Zod before business logic executes.

Validate:

- Request bodies
- Query parameters
- Route parameters
- Relevant external API responses

Example:

```text
Request
 ↓
Zod schema
 ├── invalid → 400
 └── valid → service
```



## 20. API Error Model

Use consistent errors.

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data"
  }
}
```

Recommended mapping:

| Error | HTTP |
|---|---:|
| Validation | 400 |
| Authentication | 401 |
| Authorization | 403 |
| Not Found | 404 |
| Conflict | 409 |
| Rate Limit | 429 |
| Internal Error | 500 |

Never return stack traces or secrets to clients.


## 21. MongoDB + Mongoose

Database:

> MongoDB Atlas

ODM:

> Mongoose

Mongoose is the primary data-access abstraction.

```text
Service
 ↓
Repository
 ↓
Mongoose Model
 ↓
MongoDB Atlas
```

Suggested core collections:

```text
users
sessions
weddings
weddingMembers
weddingInvitations
events
tasks
guests
guestGroups
rsvps
expenses
vendors
vendorPayments
weddingWebsites
galleries
galleryAlbums
galleryAssets
galleryAccessTokens
liveStreams
emailLogs
```

Do not create collections without a concrete product/query need.


## 22. MongoDB Ownership and Indexing

Wedding-owned records should normally contain:

```text
weddingId
```

Examples:

```text
Guest       → weddingId
Event       → weddingId
Task        → weddingId
Expense     → weddingId
Vendor      → weddingId
Gallery     → weddingId
```

Likely indexes:

```text
users
  unique(emailNormalized)

sessions
  index(userId)
  index(expiresAt)

weddingMembers
  unique(userId)
  index(weddingId)

weddingInvitations
  index(weddingId)
  index(expiresAt)

events
  index(weddingId)

guests
  index(weddingId)

expenses
  index(weddingId)

vendors
  index(weddingId)

galleryAssets
  index(weddingId)
  index(albumId)
```

Exact indexes must follow real query patterns.


## 23. MongoDB Transactions

Use Mongoose transactions only where multiple writes need atomicity.

Examples:

### Create wedding

```text
Create Wedding
+
Create Owner Membership
```

### Accept invitation

```text
Validate Invitation
+
Create Membership
+
Mark Invitation Accepted
```

Do not use transactions for every simple CRUD operation.


## 24. Hybrid Deletion Strategy

V1 uses:

> **Soft delete by default, hard delete for data that truly needs permanent removal.**

### Soft delete

Important business entities can use:

```text
deletedAt
deletedBy
deletionReason
```

Examples:

- Wedding
- WeddingMember
- Guest
- Event
- Task
- Vendor
- Expense
- Gallery
- Album

Normal queries must exclude deleted records.

### Hard delete

Appropriate candidates include:

- Expired temporary tokens
- Old sessions
- Temporary upload metadata
- Security-sensitive transient records
- Data explicitly requiring permanent erasure

Soft deletion is not an authorization mechanism; deleted records must still be inaccessible to normal operations.


## 25. S3 + CloudFront Media Architecture

Do not store image files in MongoDB.

Use:

```text
Browser
 ↓
Next.js API
 ↓
Authorization check
 ↓
Short-lived S3 upload URL
 ↓
Browser uploads directly to S3
 ↓
CloudFront delivers media
```

Store metadata in MongoDB:

```text
GalleryAsset
- weddingId
- albumId
- uploadedBy
- objectKey
- fileName
- mimeType
- size
- visibility
- createdAt
- deletedAt
```

The S3 bucket should not be public.

For private media, use CloudFront signed URLs/cookies and appropriate S3 origin access controls.


## 26. No Image-Processing Pipeline

V1 intentionally has no:

- Lambda image processing
- Sharp pipeline
- Thumbnail workers
- Resize queue
- Video transcoding service
- Media microservice

The initial implementation stores the original uploaded asset and serves it through CloudFront.

Optimization can be introduced later if real usage demonstrates the need.


## 27. Location Data

Do not model locations using only a city string.

For vendors and location-aware records use structured data:

```text
location:
  address:
    line1
    line2
    city
    state
    postalCode
    country

  coordinates:
    latitude
    longitude

  placeId
```

Latitude and longitude should be first-class fields because they enable:

- Nearby search
- Distance calculation
- Maps
- Geographic filtering
- Better vendor discovery

Store Google `placeId` when available.


## 28. Google Places Integration

Google Places credentials remain server-side.

```text
Browser
 ↓
Next.js API
 ↓
Google Places API
 ↓
Next.js API
 ↓
Browser
```

Never expose private Google API credentials to the browser.

Vendor discovery is for the wedding's own vendor research; V1 is not a marketplace.


## 29. Email Architecture

Keep email deliberately lightweight.

V1 uses a provider such as **Resend**, without Redis, BullMQ or a worker.

For small invitation/reminder batches:

```text
API
 ↓
Create/update invitation records
 ↓
Send controlled batch
 ↓
Record each result
 ↓
Return summary
```

Example:

```text
40 recipients
 ↓
10 + 10 + 10 + 10
```

Batch size must be configurable and should respect the email provider's current limits.

Do not make a queue system a V1 dependency.


## 30. Email Idempotency and Failures

Track email operations where needed:

```text
EmailLog
- weddingId
- invitationId
- recipient
- type
- status
- providerMessageId
- sentAt
- error
```

If one email fails, successful emails should remain successful.

Example:

```text
37 sent
3 failed
```

A retry mechanism can be added without introducing BullMQ.


## 31. WhatsApp Sharing

WhatsApp sharing uses a prefilled message/link.

The user manually presses Send.

No WhatsApp API is required.

No WhatsApp background process is required.


## 32. Events, Tasks and Guests

Events belong to a wedding:

```text
Wedding
 ├── Mehendi
 ├── Haldi
 ├── Wedding
 └── Reception
```

Tasks can belong to a wedding/event and can be assigned to members.

Guests can attend multiple events, so do not model a guest as belonging to only one event.

Use event-assignment data appropriate to the final query patterns.


## 33. RSVP

Guests use secure RSVP links.

```text
Guest
 ↓
Secure RSVP link
 ↓
Validate token
 ↓
Validate guest/wedding association
 ↓
Submit RSVP
 ↓
Store response
```

Guests do not need application accounts.


## 34. Wedding Website

The public wedding website is rendered from explicitly public wedding data.

```text
Public URL
 ↓
Next.js
 ↓
WeddingWebsiteService
 ↓
MongoDB
 ↓
Public page
```

Never expose the full wedding document through a public endpoint.

Private data such as expenses, internal notes and member information must never be returned to the public wedding website.


## 35. Live Streaming

Use a provider abstraction:

```text
LiveStreamProvider
 ├── YouTubeProvider
 ├── VimeoProvider
 └── FutureProvider
```

V1 can primarily store:

```text
provider
streamUrl
title
description
startTime
status
```

No WebSockets are required.


## 36. Caching and Background Work

### Redis

**Not used in V1.**

### BullMQ

**Not used in V1.**

### Cache

No Redis cache is required.

Use:

- Efficient MongoDB queries
- Proper indexes
- Next.js caching where appropriate
- HTTP caching where appropriate
- CloudFront caching for media

### Future

Redis/BullMQ may be introduced later for:

- High-volume email
- Scheduled jobs
- Large notification campaigns
- Image processing
- Heavy asynchronous workloads


## 37. Logging

V1 uses only basic application logs.

No external logging platform is required.

Recommended levels:

```text
INFO
WARN
ERROR
```

Log fields:

```text
timestamp
level
event
requestId
userId when available
weddingId when available
errorCode
message
stack for server-side errors
```

Never log:

- Passwords
- Session tokens
- OAuth secrets
- API keys
- Complete private invitation tokens
- Unnecessary sensitive personal data


## 38. Request IDs

Every API request should have a request/correlation ID.

```text
X-Request-ID
```

If a client does not provide one, the server can generate one.

This provides useful debugging capability without an external observability platform.


## 39. Security

Minimum requirements:

- HTTPS
- Secure HttpOnly cookies
- SameSite cookie protection
- Strong password hashing
- Cryptographically random tokens
- OAuth state validation
- PKCE where appropriate
- Server-side authorization
- Zod validation
- Rate limiting for sensitive endpoints
- Secure HTTP headers
- No secrets in frontend bundles
- Private S3 bucket
- CloudFront access controls for private media
- Least-privilege AWS credentials
- Safe error responses

Sensitive endpoints include:

- Login
- Signup
- Password reset
- OAuth
- Invitation acceptance
- RSVP token operations
- Public token endpoints


## 40. Rate Limiting Without Redis

Because Redis is excluded from V1, use lightweight controls.

Possible mechanisms:

- Vercel/platform protection
- Endpoint-specific cooldowns
- Small application-level counters
- Database-backed counters only where justified

Do not build a distributed rate-limiting system for V1.

If stronger distributed rate limiting becomes necessary, Redis can be introduced later.


## 41. Environment Configuration

Local:

```text
.env.local
```

Vercel:

> Environment Variables

Never commit secrets.

Typical variables:

```text
MONGODB_URI
SESSION_SECRET
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
AWS credentials/configuration
CLOUDFRONT signing configuration
RESEND_API_KEY
```

Use separate development and production configuration. Development must never accidentally write to production data.


## 42. Deployment — V1

Use Vercel for the passion-project phase.

```text
Developer
 ↓
GitHub
 ↓
Vercel
 ↓
Next.js application
```

Vercel's current Hobby plan is listed at $0/month and is intended for personal, non-commercial use; its limits and terms should be rechecked before commercialization.

No ECS/Fargate deployment is required during V1 development.


## 43. Future Deployment — Commercial

When the application becomes commercial or needs additional runtime infrastructure:

```text
GitHub
 ↓
GitHub Actions
 ↓
Container image
 ↓
Amazon ECR
 ↓
ECS/Fargate
 ├── Next.js application
 └── Optional worker later
```

Managed Redis can be introduced only if the product actually needs queues/cache.

The domain modules, services, repositories and database model should remain largely unchanged.


## 44. Why Docker Is Not Used Now

Docker infrastructure is deliberately excluded from V1.

Reasons:

- Vercel deployment does not require project-owned Docker infrastructure.
- Docker would add operational complexity.
- There is no current need for orchestration.
- ECS migration can be introduced later when it has a real purpose.

The codebase should remain portable so containerization can be added later.


## 45. CI/CD and Testing

GitHub Actions can run:

- TypeScript checks
- Linting
- Unit tests
- Integration tests
- Build validation

Important tests:

### Authentication

- Signup
- Login
- Logout
- Session expiration
- Invalid credentials

### Wedding isolation

- User A can access Wedding A
- User A cannot access Wedding B
- User A cannot access Wedding B's guest by guessed ID

### Membership

- User can create one wedding
- User cannot join a second wedding
- Invitation is single-use
- Expired/revoked invitation is rejected

### Guest flows

- RSVP token validation
- Event assignment
- Invitation access

### Media

- Unauthorized media access denied
- Authorized media access works
- Deleted assets are not returned


## 46. Performance

Priorities:

1. Correct indexes
2. Efficient Mongoose queries
3. Pagination
4. Avoid N+1 queries
5. Lean queries where appropriate
6. Direct S3 uploads
7. CloudFront media delivery
8. Lazy-load gallery content
9. Small API payloads

Do not add Redis merely as a performance precaution.


## 47. Pagination

Paginate potentially large collections:

- Guests
- Expenses
- Vendors
- Gallery assets
- Tasks
- Events
- Members

Cursor pagination is preferred for large/scrolling datasets. Page-number pagination is acceptable for small administrative lists.


## 48. Data Ownership and Public Data

Every wedding-owned document should have a clear `weddingId`.

Data categories:

### Private

- Expenses
- Vendor payment details
- Internal notes
- Member information
- Private guest information

### Public

Only wedding website fields explicitly configured as public.

### Guest-restricted

- Invitations
- RSVP
- Gallery
- Live stream

The server must explicitly select fields exposed to public/guest clients.


## 49. External Provider Failure Handling

External systems can fail.

Examples:

- Google Places unavailable
- Email provider unavailable
- S3 unavailable
- Google OAuth unavailable

The application should:

1. Preserve valid MongoDB state where possible.
2. Return a safe user-facing error.
3. Log the failure.
4. Avoid exposing provider secrets.
5. Allow retry where appropriate.

Example:

```text
Invitation created
Email failed
```

The invitation should not automatically be deleted just because delivery failed.


## 50. Account and Wedding Deletion

Account deletion requires special handling because of the one-user-one-wedding relationship.

If the user owns a wedding, determine the appropriate workflow before deletion:

```text
Transfer ownership
OR
Delete wedding
OR
Cancel account deletion
```

Do not blindly hard-delete the user.

Wedding deletion defaults to soft deletion. Related records can be soft-deleted through a controlled workflow.

Permanent cleanup can occur later.


## 51. Backup and Recovery

MongoDB Atlas backup/recovery should be used according to the selected Atlas plan.

The application should not build a custom backup service in V1.

S3 retention/lifecycle policies can be introduced as media volume grows.



## 52. Release Phase Mapping

### Phase 1 — Foundation

- Next.js
- TypeScript
- Custom authentication
- Sessions
- Authorization
- MongoDB Atlas
- Mongoose
- REST
- Zod
- Wedding
- Members
- Vercel

### Phase 2 — Planning

- Events
- Tasks
- Schedules
- Member assignments

### Phase 3 — Guests & Invitations

- Guests
- Groups
- Event assignments
- Invitations
- RSVP
- Email
- WhatsApp sharing
- Secure links

### Phase 4 — Financials & Vendors

- Expenses
- Vendors
- Google Places
- Address
- Latitude/longitude
- Manual payment tracking

### Phase 5 — Wedding Experience

- Wedding website
- Guest-facing pages
- Live-stream provider abstraction

### Phase 6 — Memories

- S3
- CloudFront
- Gallery
- Albums
- Guest uploads
- Private sharing
- QR links

### Phase 7 — Product Readiness

- Security review
- Performance
- Testing
- Responsive design
- Basic analytics if required
- Deployment hardening
- Backup/recovery verification


## 53. Explicitly Excluded from V1

The following must not be introduced unless the product owner explicitly approves an architecture change:

```text
Redis
BullMQ
Background workers
Microservices
NestJS
Separate Express backend
Kafka
RabbitMQ
GraphQL
WebSockets
Kubernetes
Docker infrastructure
Clerk
Auth0
Better Auth
Elasticsearch
Complex image processing
External logging platforms
Payment processing
Vendor marketplace
Transportation management
```


## 54. Final V1 Architecture

```text
                         USERS
                           |
                         HTTPS
                           |
                           v
                  +-------------------+
                  |      VERCEL       |
                  |                   |
                  | Next.js + React   |
                  | REST API          |
                  | Custom Auth       |
                  | Services          |
                  | Repositories      |
                  +---------+---------+
                            |
          +-----------------+------------------+
          |                 |                  |
          v                 v                  v
   MongoDB Atlas        Amazon S3         External APIs
      Mongoose         CloudFront         Google OAuth
                                           Google Places
                                           Email Provider
                                           YouTube/Vimeo

             NO REDIS
             NO BULLMQ
             NO WORKER
             NO MICROSERVICES
             NO DOCKER INFRASTRUCTURE
```

Future commercial evolution:

```text
GitHub
  ↓
GitHub Actions
  ↓
ECR
  ↓
ECS/Fargate
  ├── Next.js application
  └── Optional worker later
        ↓
     Managed Redis later if needed

MongoDB Atlas
S3
CloudFront
External providers
```

The central design decision is:

> **Build clean boundaries now, but keep V1 operationally simple and pay for additional infrastructure only when the product actually needs it.**


## 55. Implementation Rules for AI Coding Agents

If this document is supplied to an AI coding agent:

1. Do not introduce a new framework without approval.
2. Do not introduce a new infrastructure service merely because it is a common "best practice."
3. Do not introduce Better Auth, Clerk, Auth0 or another auth framework.
4. Do not introduce Redis or BullMQ in V1.
5. Do not introduce microservices.
6. Do not introduce Docker infrastructure.
7. Preserve the one-user-one-wedding rule.
8. Preserve wedding-level authorization on every protected resource.
9. Use TypeScript throughout.
10. Use Mongoose rather than the native MongoDB driver.
11. Validate API inputs with Zod.
12. Use soft delete by default.
13. Do not build an image-processing pipeline.
14. Keep email sending lightweight and batch-controlled.
15. Keep logs basic.
16. Never expose secrets to the client.
17. Prefer correctness and security over unnecessary abstraction.
18. If a requirement appears to conflict with this document, stop and identify the conflict before changing architecture.


## 56. Architecture Decision Summary

| Decision | V1 |
|---|---|
| Architecture | Modular monolith |
| Framework | Next.js |
| Language | TypeScript |
| API | REST |
| Validation | Zod |
| Database | MongoDB Atlas |
| ODM | Mongoose |
| Authentication | Custom |
| Email verification | Not required |
| Google OAuth | Custom OAuth/OIDC |
| Sessions | MongoDB server-side sessions |
| Authorization | Application-level permissions |
| User model | One user = one wedding |
| Wedding model | One wedding = multiple members |
| Guests | No accounts |
| Storage | S3 |
| CDN | CloudFront |
| Image processing | None |
| Email | Lightweight provider + small batches |
| Redis | No |
| BullMQ | No |
| Background worker | No |
| Cache | No Redis cache |
| Google Places | Server-mediated |
| Location | Address + latitude + longitude + place ID |
| Live stream | Provider abstraction |
| Logs | Basic application logs |
| External observability | No |
| Delete strategy | Hybrid soft/hard delete |
| Initial deployment | Vercel |
| Future deployment | ECS/Fargate |
| Docker | No |
| Microservices | No |
| Kafka | No |
| GraphQL | No |
| WebSockets | No |
| Kubernetes | No |
| Clerk | No |
| Auth0 | No |
| Better Auth | No |


## Appendix — Current Technical References

- Vercel Pricing: https://vercel.com/pricing
- Mongoose TypeScript Schemas: https://mongoosejs.com/docs/typescript/schemas.html
- Mongoose Transactions: https://mongoosejs.com/docs/transactions.html
- AWS CloudFront Signed URLs: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-signed-urls.html
- AWS CloudFront Private Content: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-overview.html
