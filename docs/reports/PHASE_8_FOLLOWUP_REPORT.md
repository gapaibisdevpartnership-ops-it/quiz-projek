# Phase 8 Follow-up Report — deferred hardening items

**Date:** 2026-09-07
**Status:** ✅ Complete — migration `20260907150000` applied to the linked
project; full suite green

Closes the three follow-ups left open in `docs/reports/PHASE_8_REPORT.md`.

## 1. Playwright E2E — now run

`npx playwright install chromium` succeeded in this environment, so the E2E
suite was executed instead of being deferred to CI.

Two pre-existing specs in `tests/e2e/auth.spec.ts` failed on Playwright strict
mode (not app bugs) and were fixed:

- "invalid credentials" — `getByRole("alert")` also matched Next.js's route
  announcer; now filtered by `hasText: /incorrect/i`.
- "trainer navigation" — "Question Bank" appears in the nav *and* the dashboard
  body; the assertion is now scoped to `getByRole("navigation")`.

`npx playwright test` → **12 passed** (auth 5, security 3, responsive 4).

## 2. Responsive QA — automated + one real fix

`tests/e2e/responsive.spec.ts` loads the sales screens (`/login`, `/dashboard`,
`/quizzes`, `/history`, `/leaderboard`, `/profile`) and every `/admin/*`
section at 375px (iPhone SE) and 1280px, asserting the document never scrolls
horizontally.

Found and fixed: `/admin/analytics` overflowed by 14px at 375px — the seven-
column "By quiz" table. Both tables on that page are now wrapped in
`overflow-x-auto` with a `min-w-*` so they scroll inside their card instead of
widening the page. Manual player-on-a-phone pass is still listed in
`docs/RELEASE_CHECKLIST.md`.

## 3. Auto-expire sweep for abandoned attempts

`supabase/migrations/20260907150000_attempt_expiry.sql`:

- `attempt_deadline(attempt)` — earlier of `started_at + duration_minutes` and
  `quiz.end_at`; `null` (never expires) when the quiz sets neither.
- `expire_stale_attempts()` — `service_role` only. Finalises every
  `in_progress` attempt past its deadline through the same scoring path as
  `submit_quiz_attempt`: objective questions scored, `submitted_at` stamped at
  the deadline (so `time_spent_seconds` is the allotted time, not the idle
  time), essays → `pending_review`, otherwise → `submitted` via
  `finalize_attempt`. `FOR UPDATE ... SKIP LOCKED`; idempotent.

Drivers (use exactly one per environment):

- **Vercel Cron** — `GET /api/cron/expire-attempts` every 5 min (`vercel.json`),
  guarded by `Authorization: Bearer $CRON_SECRET`; returns 503 while
  `CRON_SECRET` is unset.
- **pg_cron** — commented snippet in the migration.

New env var `CRON_SECRET` (optional) — `.env.example`, `src/lib/env.ts`,
`docs/ENVIRONMENT.md`.

Test: `tests/integration/attempt-expiry.test.ts` (3) — seeds two 30-minute
quizzes, starts attempts, back-dates `started_at`, runs the sweep, asserts the
objective attempt finalises to `submitted` at 100% with
`time_spent_seconds = 1800`, the essay attempt lands in `pending_review`, and a
fresh attempt is left alone.

## Verification

- `npm run lint` / `npm run typecheck` — clean
- `npm test` — 55 unit pass
- `npm run build` — passes; `/api/cron/expire-attempts` registered
- `npm run test:e2e` — 12 pass
- `npm run test:integration` — 4 files, **33** pass (migration `20260907150000`
  applied; `supabase migration list` shows local == remote)

## Docs touched

`docs/API_CONTRACTS.md`, `docs/DATABASE_SCHEMA.md`, `docs/ENVIRONMENT.md`,
`docs/RELEASE_CHECKLIST.md`, `docs/reports/PHASE_8_REPORT.md` (follow-ups
marked done).
