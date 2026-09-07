# AGENTS.md

## Purpose

This file contains mandatory operating instructions for AI coding assistants and autonomous coding agents working on this repository.

## Required Reading

Before making code changes, read:

- `README.md`
- `PRD.md`
- `ARCHITECTURE.md`
- `DOMAIN_RULES.md`
- `DATABASE_SCHEMA.md`
- `SECURITY_RLS.md`
- `QUESTION_TYPES.md`
- `VALIDATION_RULES.md`
- `TESTING_QA.md`

Do not implement based only on a single file.

Also skim `docs/reports/` for the latest phase/change reports — they record
what already exists, what is verified, and what is currently blocked.

## Core Rules

1. Do not bypass Supabase RLS.
2. Never expose the Supabase service role key to client code.
3. Never expose answer keys to sales users before the relevant quiz result is allowed to show them.
4. Objective scoring must be server-side.
5. Submitted attempts are immutable.
6. Historical attempts must use snapshots of questions and options.
7. Admin edits to source questions must never mutate completed or active historical attempts.
8. Do not hardcode answer count to A–D.
9. Question rendering must be driven by `question_type`.
10. Essay questions use manual grading.
11. Quiz assets are stored in Supabase Storage.
12. All schema changes must be done through migrations.
13. All destructive operations require review of historical data impact.
14. Prefer soft delete/archive over hard delete.
15. Do not introduce features outside V1 without explicit instruction.

## Implementation Order

Prefer working in this order:

1. Database schema and constraints.
2. RLS policies.
3. Server-side domain functions / RPC.
4. Types and validators.
5. Data-access layer.
6. UI.
7. Tests.
8. Production validation.

## Database Changes

For every database change:

- create a migration;
- include constraints;
- include indexes where needed;
- review RLS;
- update `DATABASE_SCHEMA.md` if architecture changes;
- add or update tests.

Do not manually mutate production schema outside controlled migrations.

## Security Expectations

Frontend visibility is not authorization.

Do not rely on:

- hidden buttons;
- route guards only;
- client-side role checks;
- URL obscurity.

Authorization must be enforced by database RLS and server-side checks.

## Quiz Engine Expectations

Starting a quiz must validate:

- authenticated user;
- assignment;
- quiz status;
- schedule;
- remaining attempts.

Submitting a quiz must:

- validate ownership;
- validate status;
- prevent duplicate submission;
- score objective questions on the server;
- detect manual-grading requirements;
- lock the attempt.

## Code Quality

Prefer:

- small modules;
- explicit domain types;
- shared Zod schemas;
- no duplicated authorization logic;
- no magic strings for statuses;
- deterministic functions;
- clear error handling;
- strong database constraints.

Avoid:

- giant page components;
- hidden business logic inside UI components;
- duplicated scoring logic;
- client-generated authoritative score values;
- direct table access when a controlled RPC is more appropriate.

## Progress Reports (mandatory — do not wait to be asked)

Every time a development phase is finished, **or** any notable change is made
(a migration, a new feature area, an infrastructure/tooling change, a
deployment, a security or RLS change), write a Markdown report and save it in
`docs/reports/`. This is a standing requirement: the user should never have to
ask for it, and it is part of finishing the work — a change is not "done"
until its report is written and committed in the same change.

### Location and naming

- Directory: `docs/reports/`
- Phase work: `PHASE_<n>_REPORT.md` (e.g. `PHASE_3_REPORT.md`).
- Non-phase change: `<TOPIC>_REPORT.md` in SCREAMING_SNAKE_CASE
  (e.g. `TESTING_SETUP_REPORT.md`, `VERCEL_DEPLOY_REPORT.md`).
- If a phase report already exists and the phase is revisited, update it in
  place and bump its status line rather than creating a second file.

### Required contents

Each report must be detailed enough to reconstruct the work without reading
the diff. Include, in this order:

1. **Title, date, status** — status is one of `✅ Complete`,
   `🟡 Code complete / blocked`, `🔴 Blocked`, with the blocker named.
2. **Goal** — quote or cite the relevant part of `DEVELOPMENT_PLAN.md` /
   the spec docs.
3. **Database** — every migration file added, tables/columns/constraints/
   indexes, triggers/functions, and the RLS policies with their intent.
4. **Application code** — grouped by area (validation, types, services,
   server actions/RPC, data-access, UI, components), one line per file
   describing what it does and any non-obvious decision.
5. **Verification** — exact commands run and their result
   (`npm run lint`, `npm run typecheck`, `npm test`,
   `npm run test:integration`, `npm run build`, smoke tests, manual checks),
   plus any live checks against Supabase/Vercel.
6. **Blocked / follow-ups** — anything not done, why, and the exact command
   or access needed to unblock it.
7. **Next** — the next phase or task and its first steps.

### Also

- Update `DATABASE_SCHEMA.md` (and any other affected spec doc) when the
  architecture actually changes — the report does not replace that.
- Keep `docs/TESTING.md` and other living how-to docs current when the
  workflow changes.
- Reference the report file in the commit message.

## Completion Standard

A task is not complete until:

- implementation is finished;
- type checks pass;
- lint passes;
- relevant tests pass;
- authorization is verified;
- edge cases are considered;
- documentation is updated when architecture changes;
- a report has been written to `docs/reports/` per **Progress Reports** above
  and committed with the change.
