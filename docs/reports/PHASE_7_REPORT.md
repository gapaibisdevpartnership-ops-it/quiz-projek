# Phase 7 Report — Analytics

**Date:** 2026-09-07
**Status:** 🟡 Code complete — migration `20260907140000_analytics.sql` must be pushed

## Goal (`docs/DEVELOPMENT_PLAN.md`)

Admin KPI dashboard; quiz analytics; question analytics; sales performance;
leaderboard.

## Database — `supabase/migrations/20260907140000_analytics.sql`

Admin dashboards aggregate over tables admins can already read (RLS), so they
are computed in the app layer. The only privileged path is the **sales-visible
leaderboard** — a sales user cannot read other users' attempts:

- **`leaderboard(row_limit int default 20)`** — `SECURITY DEFINER`, `EXECUTE`
  granted to `authenticated`. Returns aggregate rows only (`user_id`,
  `full_name`, `attempts`, `avg_percentage`, `passed_count`) for active
  `sales` users over finalized attempts (`status = 'submitted'`,
  `percentage not null`), ordered by average, capped at 100.

## Application code

- `features/analytics/aggregate.ts` — pure `round1` / `average` / `rate`
  helpers (unit-tested).
- `features/analytics/service.ts`
  - `getAdminKpis()` — active sales, published quizzes, completed attempts,
    pending reviews, average score, pass rate.
  - `getQuizAnalytics()` — per quiz: attempts, finished, pending, avg %,
    pass rate.
  - `getSalesPerformance()` — per sales user: attempts, passed, avg %.
  - `getQuestionAnalytics(quizId)` — objective correct-rate per **source**
    question, grouped across all of that quiz's attempt snapshots (essays
    excluded — no objective answer). Correctness re-derived with the same
    all-or-nothing rule as the SQL scorer.
  - `getLeaderboard(limit)` — wraps the `leaderboard` RPC.
- `components/stat-card.tsx` — shared KPI tile.
- Pages
  - `/admin/analytics` — 6 KPI tiles + "By quiz" table (→ per-quiz drill-in)
    + "Sales performance" table.
  - `/admin/analytics/[quizId]` — question analytics table.
  - `/leaderboard` — replaces the placeholder; sales + admin; highlights the
    current user's row.
  - `/dashboard` — real numbers now: admin sees the KPI tiles, sales see
    assigned / in-progress / completed / average, plus quick links.

## Verification

- `npm run lint` / `npm run typecheck` — clean
- `npm test` — 8 files, **55 tests** (added `aggregate.test.ts`)
- `npm run build` — passes

## Blocked / follow-ups

1. **Push the migration:** `npx supabase db push`.
2. After some attempts exist: check `/admin/analytics` totals against
   `/admin/results`, open a quiz drill-in, and confirm `/leaderboard` shows
   sales ranked by average and marks "(you)".
3. Analytics run unindexed table scans over `quiz_attempts` /
   `attempt_answer_options`. Fine at current volume; add materialised views or
   summary columns if the data grows large.
4. No charts yet (Recharts is installed) — the tables cover the V1 requirement;
   visualisations can be layered on without schema changes.

## Next: Phase 8 — Hardening

RLS audit, answer-key security audit, attempt-integrity tests, image-storage
tests, responsive QA, production smoke testing, Vercel deployment validation.
