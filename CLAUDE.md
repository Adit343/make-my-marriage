# Make My Marriage — Project Memory

## What this is
An India-first collaborative wedding-planning SaaS. One wedding = one shared
workspace for the couple, family, and a planner. Guests never create accounts —
they access everything through secure tokenized links.

## Reference docs — read before any planning or implementation work
- @docs/Make_My_Marriage_PRD.md — product requirements
- @docs/Make_My_Marriage_System_Design_Architecture_V1.md — system design architecture (V1)
- @docs/Make_My_Marriage_Database_Design_V1.md — MongoDB collections, indexes, validation rules
- @docs/Make_My_Marriage_API_Design_V1.md — REST endpoints, auth, error codes

## Core rules (do not violate without flagging it to me first)
- Soft delete by default; hard delete only for sessions, tokens, and email logs
  (see Make_My_Marriage_Database_Design_V1.md §10.1 for the exact list)
- One user = one wedding, enforced by a partial unique index — never bypass this
  in application logic
- Every wedding-owned repository function takes weddingId as a required
  parameter — no findById() without it
- No Redis, no background workers/queues, no WebSockets, no GraphQL in V1
- Stack: Next.js + TypeScript, MongoDB Atlas + Mongoose, Zod validation,
  S3 + CloudFront for media (metadata only in MongoDB)
- Code formatting: Prettier is the project standard (already used in the editor) —
  include a committed .prettierrc so formatting is consistent for anyone working
  on this repo, not just locally in the editor

## Working agreement
- Never scaffold files, create folders, or install dependencies without my
  explicit go-ahead in that session. Propose a plan first and wait for approval.
- When a design-doc detail is ambiguous or missing, ask rather than guess.