# Improvement Backlog

**Date:** 2026-09-08 (original assessment); items updated through 2026-09-19 as they're resolved.
**Status:** Living backlog for post–Phase 8 hardening. See `docs/reports/PROJECT_STATUS_REPORT.md`
for the current overall project status.

## Context

All 8 phases of `docs/DEVELOPMENT_PLAN.md` are implemented and committed, plus the Phase 8
follow-ups (E2E run, responsive-overflow fix, attempt auto-expire — see
`docs/reports/PHASE_8_FOLLOWUP_REPORT.md`). This document is a review of **what to improve next**
before/around launch, from three read-only explorations (security/RLS/data-integrity, testing/CI,
code-quality/perf/UX). Findings are de-duplicated and ranked. Effort: **S** ≈ <1h, **M** ≈ half-day,
**L** ≈ multi-day.

The core attempt/scoring engine is solid: RLS on every table, all sales writes go through
SECURITY DEFINER RPCs, `submit`/`finalize` are `FOR UPDATE` + idempotent, and
`get_attempt_for_player` provably strips every answer-key field. The gaps are around the
**admin surface, provisioning, operational safety, and test/observability coverage**.

---

## P0 — Fix before launch (privilege-escalation) — ✅ DONE

Resolved in `supabase/migrations/20260908160000_admin_user_rpc.sql` +
`src/features/users/actions.ts` + `src/features/auth/service.ts`
(`requireSuperAdmin`), covered by
`tests/integration/admin-user-security.test.ts` (9 tests). See
`docs/reports/P0_SECURITY_REPORT.md`. Details of the original findings below.

### 1. `profiles` UPDATE policy lets any admin rewrite any role, bypassing all app guards
- **Where:** `supabase/migrations/20260907090000_foundation.sql:175-179` (`profiles: admin updates`);
  app guard it defeats — `src/features/users/actions.ts:49-80` (`updateUser` uses the caller's
  **anon-key session client**, relying entirely on this policy).
- **Problem:** Policy is `using (is_admin()) with check (is_admin())` — no column or target
  restriction. From browser dev tools an admin can run
  `supabase.from('profiles').update({ role:'super_admin' }).eq('user_id', <anyone>)` and skip the
  self-lockout / "last super_admin" logic entirely.
- **Fix (M):** Move all profile mutations to a `SECURITY DEFINER` RPC `admin_update_user(target, full_name, role, status)`
  that re-checks role rules server-side; change the RLS UPDATE policy to forbid changing `role`/`status`
  from a direct client write (e.g. `with check` that pins `role`/`status` to their existing values, or
  drop the client UPDATE policy and grant only the RPC). Route `updateUser` through the RPC.

### 2. No `super_admin`-only gating; any admin can mint or demote a super_admin
- **Where:** `src/features/users/actions.ts:22-47` & `49-80`; `src/lib/validation/user.ts:7,16`
  (`role: z.enum(ROLES)` includes `super_admin`); no `requireSuperAdmin` anywhere in
  `src/features/auth/service.ts`.
- **Problem:** `updateUser`'s only guard is *self* (`userId === me.userId`). Any admin can demote
  another super_admin, deactivate admins, or invite a new super_admin. Nothing enforces
  "≥1 active super_admin".
- **Fix (M):** Add `requireSuperAdmin()` in `src/features/auth/service.ts`; require it in
  `inviteUser`/`updateUser` (and the new RPC from #1) whenever the create/target/new role touches
  `super_admin` or deactivates an admin-role account. Add a "last active super_admin" check.

### 3. `handle_new_user` trusts `raw_user_meta_data->>'role'`
- **Where:** `supabase/migrations/20260907090000_foundation.sql:82-100` (esp. `:94`).
- **Problem:** New profile's role is copied verbatim from auth metadata. Only `inviteUser` sets it
  today, but the Supabase dashboard invite, any future signup path, or a leaked admin-API call can
  self-assign `super_admin`. The CHECK constraint only rejects values outside the enum.
- **Fix (S):** Force `role := 'sales'` in the trigger. Elevated roles are set only by the gated
  server action / `admin_update_user` RPC (#1).

---

## P1 — High (operational + data-integrity)

### 4. Auto-expire cron will silently not run on Vercel Hobby — ✅ DONE

Confirmed: the Vercel deploy is rejected outright on Hobby with `*/5 * * * *`.
Resolved in `supabase/migrations/20260908170000_attempt_expiry_pgcron.sql` —
`pg_cron` runs `expire_stale_attempts()` every 5 min; `vercel.json` no longer
declares a cron; the API route stays as a manual trigger.


- **Where:** `vercel.json:6` (`*/5 * * * *`); `supabase/migrations/20260907150000_attempt_expiry.sql`
  (commented `pg_cron` block); `docs/RELEASE_CHECKLIST.md` "Attempt expiry".
- **Problem:** Sub-daily Vercel Cron needs **Pro**. On Hobby the sweep never fires, so abandoned
  `in_progress` attempts (closed tab / lost connection) stay forever and keep consuming
  `max_attempts`. `CRON_SECRET` unset also disables the route silently (503).
- **Fix (S):** Confirm the Vercel plan. If not Pro, enable the `pg_cron` block in the migration and
  remove the Vercel cron (keep exactly one driver). Set `CRON_SECRET` in Vercel prod. Add
  `export const maxDuration` to the route.

### 5. Untimed quizzes: abandoned attempts never expire at all
- **Where:** `supabase/migrations/20260907150000_attempt_expiry.sql:25-42,79-80`
  (`attempt_deadline` returns NULL when the quiz has no `duration_minutes` and no `end_at`).
- **Fix (S–M):** Add an absolute fallback in `attempt_deadline` (e.g. `started_at + interval '24 hours'`)
  or a nightly sweep of very old `in_progress` rows regardless of deadline.

### 6. `start_quiz_attempt` attempt-count race — no lock on (user, quiz) — ✅ DONE

Resolved in `supabase/migrations/20260914090000_start_attempt_lock.sql`
(applied to production 2026-09-18, `docs/START_ATTEMPT_RACE_FIX_PLAN.md`) —
a `pg_advisory_xact_lock(hashtext(...))` now serializes concurrent calls.
`tests/chaos/start-attempt-race.test.ts` is a real regression guard again
(no longer a documented known-gap) and passes.

- **Where:** `supabase/migrations/20260907120000_quiz_engine.sql:151-245` (resume check `:191`,
  count `:200-205`, insert `:211`).
- **Problem:** Double-click / two tabs can both pass `count(*) >= max_attempts` → exceed the limit
  by one, or collide on `unique(quiz_id,user_id,attempt_number)` and surface a raw `23505`.
- **Fix (M):** `pg_advisory_xact_lock(hashtext(v_uid::text || target_quiz_id::text))` at the top of
  the function, **or** a partial unique index
  `on quiz_attempts(quiz_id,user_id) where status='in_progress'`.
- **Confirmed live, 2026-09-11:** `tests/chaos/start-attempt-race.test.ts`
  reproduces this on the linked project (2 of 3 runs) — see
  `docs/reports/CHAOS_TESTING_REPORT.md`. Flip that test's assertion to a hard
  requirement once this is fixed.

### 7. Deleting a user destroys or blocks attempt history inconsistently — largely ✅ DONE

Addressed by the super-admin-only hard-delete features
(`docs/HARD_DELETE_USER_PLAN.md`, `docs/HARD_DELETE_ENTITIES_PLAN.md`,
commits `839b4df`, `8f7e806`): permanent deletion is now a distinct,
explicitly-gated `super_admin`-only action, separate from the existing
soft-delete/status toggles which remain the default removal path for
everyone else. Re-verify the authored-content FK behavior (`created_by`,
`assigned_by`, `graded_by` columns) is still exercised correctly under the
new hard-delete RPCs; original problem description kept below for context.

- **Where:** `quiz_attempts.user_id ... on delete cascade`
  (`20260907120000_quiz_engine.sql:13`); authored-content FKs (`questions.created_by`,
  `quizzes.created_by`, `quiz_assignments.assigned_by`, `attempt_answers.graded_by`) have **no**
  on-delete action.
- **Problem:** Offboarding a sales rep silently deletes all their attempts/scores (audit loss and
  skewed `leaderboard()`); deleting anyone who authored a quiz/question or graded an essay fails
  with a raw FK error.
- **Fix (M):** Make soft-delete (`status='inactive'`) the only removal path in the UI, or switch
  authored FKs to `on delete set null` and stop cascading `quiz_attempts`.

### 8. `quiz-assets` storage bucket is world-readable, no path scoping
- **Where:** `supabase/migrations/20260907093000_question_bank.sql:120-149`.
- **Problem:** Every question/option image is retrievable by anyone with the URL (potential
  answer-key leak if an image encodes the answer). Write policies check only `bucket_id + is_admin()`,
  not the key prefix; extension comes from `file.name` client-side
  (`src/features/questions/upload-client.ts:29`).
- **Fix (M):** Make the bucket private; serve via short-lived signed URLs from server code. Add
  `name like 'questions/%'` / `'options/%'` checks to the insert/update policies. Validate the
  extension against a server-side allowlist.

### 9. Raw database errors returned to the client from nearly every admin mutation
- **Where:** `src/features/{teams,assignments,questions,quizzes,users}/actions.ts` — ~30 sites
  returning `error.message` straight through (good counter-example:
  `src/features/grading/actions.ts:11-22`, `src/features/attempts/errors.ts`).
- **Fix (M):** One central error-mapper (fold in the existing `src/lib/errors/domain.ts` and
  `src/features/attempts/errors.ts` — currently two parallel systems). Apply to every action.

### 10. No observability, no error boundaries
- **Where:** `grep -riE "sentry|logger" src/` → 0 hits. No `error.tsx` / `loading.tsx` /
  `not-found.tsx` anywhere under `src/app`. Every service does `if (error) throw error`.
- **Problem:** Server-action failures and unmapped RPC codes vanish with zero trace; an unhandled
  throw is the default Next crash screen with no recovery.
- **Fix (M):** Add `src/app/error.tsx`, `src/app/(app)/loading.tsx`, `not-found.tsx`, and segment
  `error.tsx` for `admin/analytics` + `admin/results`. Add a small server-side log/report wrapper
  (Sentry or structured `console.error` with context) around service/action failures.

---

## P2 — Medium (correctness, perf, hardening, UX)

### Data / RLS hygiene
- **11 (S):** `save_objective_answer` / `save_essay_answer` don't `FOR UPDATE` the attempt — a save
  can interleave with `submit` and mutate an answer post-submission. Add the row lock before the
  `status='in_progress'` check. `20260907120000_quiz_engine.sql:329-423`.
  `tests/chaos/save-vs-submit-race.test.ts` targets this (didn't reproduce live
  in ~5 runs — narrower race window than #6 above — see
  `docs/reports/CHAOS_TESTING_REPORT.md`); flip its assertion once fixed.
- **12 (S):** SECURITY DEFINER helpers not `revoke`d from `public`/`anon`
  (`set_updated_at`, `handle_new_user`, `current_role`, `is_admin`, `is_active`,
  `quiz_assigned_to_me`) — inconsistent with every Phase 5–8 RPC. Add revoke + explicit grant.
- **13 (S):** `public.current_role()` shadows the Postgres built-in — rename to
  `current_user_role()`. `20260907090000_foundation.sql:111`.
- **14 (S):** `/history` shows `percentage`/passed to sales regardless of the quiz `show_result`
  flag, while the result page gates on it correctly. `src/app/(app)/history/page.tsx:71`.
- **15 (S):** `leaderboard()` falls back to `email` when `full_name` is empty, exposing colleague
  emails to all authenticated users. `20260907140000_analytics.sql:23`.
- **16 (S):** Essay answer length is unbounded server-side — add a cap in `save_essay_answer` or the
  action. `src/features/attempts/actions.ts:38-50`.
- **17 (M):** Non-transactional multi-step writes in the question/quiz builder (manual orphan
  rollback in `questions/actions.ts:116-126`; delete-then-reinsert options `:149-161`; parallel
  reorder UPDATEs in `quizzes/actions.ts:183-203`). Move each into one atomic RPC.
- **18 (S):** Cron route: `!==` secret compare (use `crypto.timingSafeEqual`), and it returns
  `error.message` in the 500 body. `src/app/api/cron/expire-attempts/route.ts`.
- **19 (S):** `/api/health` tells anonymous callers whether the service-role key is configured —
  return a bare `{status:"ok"}`.

### Analytics performance (all in `src/features/analytics/service.ts`)
- **20 (S):** `getQuestionAnalytics` runs two **whole-table** selects with no filter
  (`attempt_question_options` `:207-209`, `attempt_answer_options` `:214-216`). Add
  `.in("...", ids)`. Immediate win, no schema change.
- **21 (S):** Add indexes: `quiz_attempts(status)`, `quiz_attempts(quiz_id,status)`,
  `quiz_attempts(user_id,status)`, `attempt_questions(attempt_id,question_type)`,
  `attempt_question_options(attempt_question_id)`, `attempt_answer_options(attempt_answer_id)`,
  `attempt_answers(attempt_id)`.
- **22 (M):** `getAdminKpis` / `getQuizAnalytics` / `getSalesPerformance` pull entire tables and
  aggregate in JS — and KPIs run on `/dashboard` for every admin. Push into SQL views or
  `SECURITY DEFINER` aggregate RPCs (follow the existing `leaderboard` RPC pattern), or a
  materialized `attempt_stats` refreshed from `finalize_attempt`.

### Missing pagination (`.range()` used nowhere)
- **23 (S each):** `/admin/results` (hard `.limit(200)`, silently truncates), `/admin/users`
  (no limit), `/admin/quizzes`, `/admin/grading`, `/history`. Add `.range()` + prev/next.
- **24 (M):** `/admin/questions` — `listQuestions` already supports category/type/status/search
  filters but the page passes only `{status:'active'}` and renders no controls. Add filter UI +
  pagination.

### Quiz player UX / a11y (`src/features/attempts/quiz-player.tsx`)
- **25 (S):** `aria-live` on the timer region and the autosave-status line; `aria-label` +
  `aria-current` on navigator buttons; move focus to the question heading when `current` changes.
- **26 (S/M):** Replace `window.confirm` submit with a styled dialog.
- **27 (M):** Failed **essay** autosave has no retry affordance — user can navigate away / submit
  and lose it. Add a retry button + a failed-save queue; detect offline.
- **28 (M):** Timer is wall-clock `Date.now()` with a one-time server offset — drifts if the tab is
  suspended and trusts a possibly-stale cached `serverNow`. Re-sync periodically.
- **29 (S):** Option-image `alt=""` is wrong when the image *is* the answer.

### Forms / consistency
- **30 (M):** Field-level validation everywhere — auth + feature forms surface only
  `issues[0].message` in a top alert, no `aria-invalid`/`aria-describedby`. Also unify the two
  pending patterns (`useFormStatus` vs `useTransition`).
- **31 (M):** `quiz-settings-form.tsx:19-22` treats the `datetime-local` input as UTC, not the
  trainer's zone — "09:00" is stored as `09:00Z`. Fix the conversion; build the long-promised
  `<LocalTime>` client component (`src/lib/format.ts:8`) so timestamps render in local time.
- **32 (S):** Extract one `isObjectiveCorrect(options, selected)` helper — the all-or-nothing rule
  is currently re-implemented in `results/service.ts:150-160`, `analytics/service.ts:250-256`, and
  SQL `score_attempt_objective`. Have results/analytics read awarded points from the DB instead.
- **33 (S):** `suppressHydrationWarning` is on both `<html>` and `<body>`
  (`src/app/layout.tsx:24,29`) — masks any future mismatch. Narrow or remove.

### Tooling
- **34 (S):** Remove `vite-tsconfig-paths` (plugin + devDep) — Vite 8 resolves `tsconfig` paths
  natively; this clears both Vitest startup warnings. `vitest.config.ts:2,5`.
- **35 (S):** Decide on `recharts` — installed, zero imports. Either add charts to
  `/admin/analytics` or drop the dependency. Verify `@tanstack/react-query` is actually used.
- **36 (S):** `tsconfig.json` — add `noUncheckedIndexedAccess`, `noUnusedLocals`; stop excluding
  `tests` from `tsc --noEmit` (the player indexes `questions[current]` etc. freely). Bump `target`
  from `ES2017`.
- **37 (M):** ESLint — add `@typescript-eslint` type-checked rules + `no-floating-promises` (the
  player relies on bare `void persist(...)`).
- **38 (S/M):** Security headers (CSP, HSTS, X-Frame-Options) — none in `next.config.ts` or
  `vercel.json`.

---

## P3 — Test & CI coverage (no CI gate today)

- **39 (M):** CI `e2e` job is gated behind `vars.RUN_E2E == 'true'` (unset) → integration + e2e +
  pgTAP effectively never run in CI. Enable it (or a schedule), add a QA-user seeding step, cache
  the Playwright browser. `.github/workflows/ci.yml`.
- **40 (S):** In CI, missing integration env must be a hard failure — today the whole integration
  suite reports green with zero assertions (`hasSupabaseEnv ? describe : describe.skip`).
- **41 (S):** `tests/integration/rls.test.ts` swallows errors (`void error`, `isMissingTable → return`
  at ~10 sites) — schema drift passes silently. Replace with explicit assertions.
- **42 (M):** Integration tests for untested RPCs: `leaderboard`, `score_attempt_objective`,
  `finalize_attempt`, `grade_essay_answer` happy-path → `graded`, `quiz_assigned_to_me`,
  `attempt_deadline`.
- **43 (M):** E2E for the real quiz lifecycle (start → answer objective+essay → submit → result)
  and the grading UI — the primary user journey has no end-to-end test.
- **44 (S):** Run E2E against `next build && next start`, not `npm run dev`
  (`playwright.config.ts:21`).
- **45 (S):** Unit tests for `validation/team.ts`, `validation/user.ts`, `lib/format.ts`,
  `lib/errors/domain.ts` (siblings are all covered).
- **46 (M):** Flesh out `supabase/tests/rls_test.sql` — the 6 current assertions are structural
  only; add JWT-claim role-switching positive/negative visibility tests for
  questions/quizzes/attempts/assignments/storage. Wire `npm run test:rls` into CI.
- **47 (S):** Wire up `@vitest/coverage-v8` (installed, unused) — add a `test:coverage` script +
  thresholds.
- **48 (S):** CI: add a `concurrency` group + least-privilege `permissions:` block; add Dependabot.
- **49 (S):** `onToggleOption` calls `persistObjective(q, next)` (async + a
  `setState`) **from inside** the `setAnswers` state-updater function — a side
  effect inside a state updater. React Strict Mode (on by default in
  `next dev`) double-invokes updaters to catch exactly this, which produces
  duplicate autosave calls and a console warning ("Cannot update a component
  while rendering a different component") in dev; found while building
  `tests/e2e/chaos/*` (`docs/reports/CHAOS_TESTING_REPORT.md`). Fix: call
  `persistObjective(q, next)` after `setAnswers(...)`, not inside its updater.
  `src/features/attempts/quiz-player.tsx:116-131`.

---

## Known / by-design (documented, not bugs)

- Multiple-choice scoring is all-or-nothing (no partial credit) — `docs/reports/PHASE_6_REPORT.md`.
  Revisiting it touches the SQL scorer + every TS mirror (see #32) + result UI. **L.**
- Migrations are applied manually per phase (`npx supabase db push`).
- Real-device responsive pass on the player is still a manual pre-release step
  (`docs/RELEASE_CHECKLIST.md`).

---

## Suggested order

Items #1–3 (privilege escalation), #4 (cron), #6 (attempt-start lock), and
#7 (user-delete, largely) are done — see their entries above. Remaining:

1. **P1 #5** (untimed-quiz expiry fallback) — small, still open.
2. **P1 #8** (private storage bucket) if any quiz images could reveal answers.
3. **P1 #9–10** (error mapper + error boundaries + logging) — one pass across all actions.
4. **P2** analytics indexes + `.in()` filters (#20–21) are near-free; batch the rest by area.
5. **P3** CI: enable the e2e/integration gate (#39–40) before relying on the suite.

## Verification per change

- Migrations: `npx supabase db push` then `npm run test:integration` (33 tests today) +
  targeted new integration tests.
- App code: `npm run lint && npm run typecheck && npm test && npm run build`, then
  `npm run test:e2e` (12 tests) and a manual pass of the affected screen.
- Security items (#1, #2, #8): add an integration test that authenticates as the Trainer QA user
  and asserts the direct PostgREST write / storage read is now **denied**.
- Cron (#4, #5, #18): `curl` the route with and without the bearer; run `expire_stale_attempts`
  against a back-dated untimed attempt.
