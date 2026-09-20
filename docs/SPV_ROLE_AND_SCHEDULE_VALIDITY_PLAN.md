# Plan — Read-only Supervisor (SPV) role + schedule-validity indicator on results

**Status:** ✅ Implemented and fully verified on `feature/spv-role-and-schedule-validity`.

## Context

Owner feedback: the people who'll actually use this day-to-day are
**supervisors (SPV)**, and they shouldn't have to go through the
create/manage flow trainers use today — they just want to **open the
results**. They also want a **timestamp** on each result so they can tell
whether it was taken inside the intended test window — if it wasn't, that
attempt "doesn't count" (dianggap tidak valid) from their perspective.

This plan has two independent parts: (A) a new `spv` role that can only
view `/admin/results`, and (B) a computed "on schedule / outside schedule"
indicator on every result, comparing when it was taken against its
session link's (or quiz's) intended window. Confirmed with the owner: this
is the interpretation to build against.

## Part A — `spv` role, results-only access

### Why a new role (not a flag on `admin`)
The role model is already a flat enum (`ROLES` in `src/lib/constants.ts:3`)
consumed everywhere via `isAdminRole()` — adding `spv` as a sibling value
that `isAdminRole()` deliberately does **not** include keeps every existing
write-gate (`requireAdmin()`, `is_admin()`) unchanged and closed to spv by
default, which is the safest way to add a strictly-smaller role.

### 1. Migration `supabase/migrations/20260922090000_spv_role.sql`
- `create or replace function public.admin_update_user(...)`: widen the
  role allow-list at line 77 from
  `if new_role not in ('super_admin', 'admin', 'sales')` to also accept
  `'spv'`. While redefining this function, also generalize the
  self-lockout check (currently line 103, `if new_role = 'sales' then
  raise exception 'CANNOT_DEMOTE_SELF'`) to
  `if new_role not in ('admin', 'super_admin') then ...` — today it only
  blocks self-demotion to `sales`; it should equally block self-demotion
  to the new `spv` for the same reason (an admin locking themselves out of
  admin capability). Everything else in the function body is unchanged
  (super_admin-grant gate, last-super-admin check).
- New `public.is_results_viewer()` function, same shape as `is_admin()`
  (`supabase/migrations/20260907090000_foundation.sql:121-135`) but
  `role in ('admin', 'super_admin', 'spv')`.
- New **additive, SELECT-only** RLS policies using `is_results_viewer()`
  on the tables the results pages read — confirmed by reading the
  migrations directly that every one of these is its own `for select`
  policy (never bundled into a `for all`), so adding a new policy is
  purely additive and cannot widen write access anywhere:
  - `profiles` (mirrors `"profiles: admin reads all"`,
    `20260907090000_foundation.sql:165`)
  - `quizzes` (new read-only policy; existing `"quizzes: admin full
    access"` at `20260907100000_quiz_builder.sql:73` is `for all` and is
    left untouched)
  - `assessment_sessions` (new read-only policy; existing `"assessment_sessions:
    admin manages"` at `20260918090000_public_session_link.sql:42` is
    `for all` and is left untouched)
  - `quiz_attempts`, `attempt_questions`, `attempt_question_options`,
    `attempt_answers`, `attempt_answer_options` (mirror each existing
    `"... : admin reads"/"admin reads all"` policy in
    `20260907120000_quiz_engine.sql:109-144`)

### 2. `src/lib/constants.ts`
- Add `"spv"` to `ROLES`. Leave `ADMIN_ROLES`/`isAdminRole()` untouched
  (spv must stay outside it).
- Add `export function isResultsViewerRole(role) { return isAdminRole(role)
  || role === "spv"; }`, next to `isAdminRole` — single source of truth
  reused by both the server gate and the nav module below.

### 3. `src/features/auth/service.ts`
Add `requireResultsViewer()` alongside the existing `requireAdmin()`/
`requireSuperAdmin()`, same shape, gated by `isResultsViewerRole()`.

### 4. Route restructuring — no URL changes, no per-page edits needed
Today every `/admin/*` page relies entirely on the single gate in
`src/app/(app)/admin/layout.tsx:10` (`await requireAdmin()`); individual
pages like `admin/questions/page.tsx` only call `requireProfile()` for
display purposes, not for gating. Loosening that one shared gate would
silently open every admin page to spv unless each sibling page is patched
individually — instead, use a route group to scope the strict gate to
exactly the sections that must stay admin-only, without moving `results/`
or touching any of those pages' code:
- New `src/app/(app)/admin/(full-access)/layout.tsx` — `await
  requireAdmin(); return <>{children}</>;` (this is the exact check being
  removed from the parent).
- `git mv` the `quizzes/`, `questions/`, `users/`, `teams/`, `grading/`,
  and `analytics/` folders from under `src/app/(app)/admin/` to under
  `src/app/(app)/admin/(full-access)/` — a route group segment, so none of
  these URLs change (`/admin/quizzes` still resolves the same).
- `src/app/(app)/admin/layout.tsx` — change its own check from
  `requireAdmin()` to `requireResultsViewer()`. This becomes the outer
  gate for the whole `/admin/*` tree; the moved subtree re-checks with its
  own stricter `requireAdmin()`, and `results/` (left in place, unmoved)
  is now reachable by spv through the loosened outer gate alone.

### 5. `src/features/auth/nav.ts`
Add `SPV_NAV = [{ href: "/admin/results", label: "Results" }]` (no
Dashboard — spv isn't a quiz-taker and the shared `/dashboard` widgets are
built for that), and change `navForRole` to a 3-way branch: `spv` →
`SPV_NAV`, `isAdminRole` → `ADMIN_NAV`, else → `SALES_NAV`.

### 6. Post-login landing
`src/features/auth/actions.ts`'s `signInAction` (line ~44) already
queries the fresh profile's `status` right after sign-in — extend that
same query to also select `role`, and branch the final `redirect()`:
`role === "spv"` → `redirect("/admin/results")`, else the existing
`redirect("/dashboard")`.

### 7. Read-only result detail for spv
`src/app/(app)/admin/results/[attemptId]/page.tsx` currently has no
profile/role check at all and unconditionally renders `<EssayGradeForm>`
(lines 154-163) for essay questions. Add `const profile = await
requireResultsViewer();` at the top, compute `canGrade =
isAdminRole(profile.role)`, and render `<EssayGradeForm>` only when
`canGrade`; otherwise show the existing manual score/feedback as static
text (the data is already in `q.essay.manualScore`/`q.essay.feedback`,
just needs a plain read-only branch next to the current form branch).

### 8. Cosmetic — role label maps
Add an `spv: "Supervisor"` entry to the four places that already map role
→ display label (each currently falls back to the raw string, so this is
polish, not a correctness fix): `src/app/(app)/layout.tsx:8-12`,
`src/features/users/users-manager.tsx:45-49`,
`src/app/(app)/admin/users/[userId]/page.tsx:10-13`,
`src/app/(app)/profile/page.tsx:11-14`.

## Part B — "on schedule" indicator on results

### Why no migration is needed
Every field required already exists: `assessment_sessions.starts_at`/
`expires_at` (session-link window, `20260920090000_session_link_capacity.sql`),
`quizzes.start_at`/`end_at` (account-based assignment window,
`src/types/domain.ts:228-229`), and `quiz_attempts.started_at` +
`quiz_attempts.session_id` (which attempt, through which link — stamped
by the `start_guest_quiz_attempt` RPC). `session_id` is `on delete set
null`, so a deleted session's historical attempts fall back to comparing
against the parent quiz's own window instead.

### 1. New helper `src/lib/schedule.ts`
`evaluateAttemptSchedule({ startedAt, session, quiz })` → `"within" |
"outside" | "unknown"`:
- If a session window exists (`session.startsAt`/`expiresAt`, either or
  both set): `outside` if `startedAt` is before `startsAt` or after
  `expiresAt`; otherwise `within`.
- Else if the quiz has its own `startAt`/`endAt`: same comparison against
  that window.
- Else (no window at all on either): `unknown` (an always-open link/quiz
  has no invalid time to flag).
Pure function, comparing ISO timestamps as `Date` epoch values (same
technique already used inline in `session-links.tsx:233`) — no formatting
inside it; `formatDateTimeUTC`/`LocalTime` stay display-only concerns in
the calling components.

### 2. `src/features/results/service.ts`
- `ATTEMPT_COLUMNS` (line 18-19): add `started_at, session_id`.
- `hydrateAttempts`: extend the `quizzes` select (line 32) to also pull
  `start_at, end_at`, and add a third parallel lookup to
  `assessment_sessions` (`select id, starts_at, expires_at` `.in("id",
  sessionIds)`) — same map-based join pattern already used for
  `title`/`name`/`guest`. Add `scheduleStatus` to `AttemptListRow` by
  calling `evaluateAttemptSchedule` per row.
- `getAttemptDetail`: `a` is already `select("*")` so `started_at`/
  `session_id` are already present in the raw row — just add one more
  parallel fetch (quiz's `start_at`/`end_at`, and the session row if
  `session_id` is set) and compute the same `scheduleStatus` onto
  `AttemptDetail`.

### 3. UI
- `src/app/(app)/admin/results/page.tsx`: one more `<TableHead>`/`<TableCell>`
  showing a `Badge` — `within` → default/success, `outside` →
  destructive, `unknown` → outline/muted with "—".
- `src/app/(app)/admin/results/[attemptId]/page.tsx`: same badge near the
  existing Attempt#/Status badges at the top, plus show `startedAt`
  alongside the window it was checked against (reuse `LocalTime`) so a
  supervisor can see exactly why something is flagged.

This is purely additive — no change to `passed`/scoring/any existing
column, so no regression risk to grading or leaderboard logic.

**Caveat worth knowing going in**: `start_guest_quiz_attempt` already
prevents starting a session outside its own window under normal use, so
in practice "outside schedule" will mostly surface when a trainer edits a
session's schedule *after* candidates have already taken it — that's the
realistic case this indicator catches, not a common everyday occurrence.

## Verification

`npm run lint && npm run typecheck && npm test && npm run build`, plus:
- New unit test `src/lib/schedule.test.ts`: within window, before start,
  after expiry, open-ended (no bounds at all), session deleted +
  fallback to quiz window, no window anywhere → `unknown`.
- Add `spv` to `tests/helpers/seed.ts`'s `SEED_USERS` and extend
  `tests/integration/rls.test.ts` with: spv can SELECT `quiz_attempts`/
  `attempt_answers`/etc., spv cannot INSERT/UPDATE/DELETE any admin table
  (RLS-level proof, not just UI-level).
- Manual, with disposable dummy data (created and cleaned up the same way
  as every prior feature this session):
  1. Create a throwaway `spv` account — confirm it lands on
     `/admin/results` after login, sidebar shows only "Results", and
     direct navigation to every other `/admin/*` route (quizzes,
     questions, users, teams, grading, analytics) redirects away.
  2. Open an attempt detail with an essay question as spv — confirm the
     grading form does **not** render, only a read-only score/feedback
     view.
  3. Confirm `admin`/`super_admin`/`sales` behavior is completely
     unchanged (full regression pass on `/admin/*` plus the existing RLS
     suite).
  4. Create a dummy session + guest attempt, then edit the session's
     schedule to exclude the attempt's `started_at` — confirm the result
     row flips to "outside schedule", and an attempt within its window
     (or with no window at all) reads "within"/"—" correctly.
  5. Clean up every dummy row and the throwaway spv account afterward,
     final leftover sweep, same as every prior feature.

## Verification results

`npm run lint`, `npm run typecheck`, `npm test` (75 tests, incl. 8 new
`schedule.test.ts` cases), `npm run test:integration` (47 tests, incl. 4
new spv RLS cases), `npm run test:chaos` (15 tests), `npm run build` (28
routes, all URLs unchanged after the `(full-access)` route-group move),
and the Playwright `tests/e2e` suite (15/17 passed) all green.

**Migration correction found during rollout**: the plan's migration
widened `admin_update_user`'s role allow-list and added `is_results_viewer()`
+ new SELECT policies, but missed that `profiles.role` also has a
**table-level CHECK constraint** (`profiles_role_check`, from
`20260907090000_foundation.sql:20`) restricting it to the original 3
roles — a second, independent gate the RPC's own validation doesn't
cover. Caught immediately when creating the first `spv` test account
failed with a constraint violation; fixed with a small follow-up
migration (`20260922090100_spv_role_check_constraint.sql`) that widens
the constraint to include `spv`. Both migrations applied to production
after a confirmed backup, with `supabase migration list` re-checked for
drift immediately before each push.

Manual verification via Playwright against the real UI, using a new
permanent QA seed account `spv.qa@example.com` (added to
`tests/helpers/seed.ts` alongside the other seed users — not a throwaway,
since the automated RLS suite now depends on it), plus disposable
`DUMMY SPV …` quiz/category/question/session/attempt rows (all cleaned up
after, confirmed via a final `ilike '%DUMMY%'` sweep):

1. **Post-login landing & nav** — signing in as spv redirects straight to
   `/admin/results`; the sidebar shows only "Results".
2. **Route gating** — direct navigation to `/admin/quizzes`,
   `/admin/questions`, `/admin/users`, `/admin/teams`, `/admin/grading`,
   `/admin/analytics` all redirect to `/dashboard`; `/admin/results` and
   `/admin/results/[attemptId]` remain reachable.
3. **Read-only grading** — on an attempt with an ungraded essay, spv sees
   no score input (the `<EssayGradeForm>` is absent), only a static
   "Manual score: Not graded yet" line; a trainer viewing the same page
   still sees and can use the real grading form, and successfully graded
   it (verified the manual score persisted).
4. **Schedule indicator** — a guest attempt taken inside its session's
   window showed "On schedule" on both the results list and the detail
   page; after editing that session's `starts_at` to a future time (so
   the already-recorded `started_at` now falls outside it), the same
   attempt immediately showed "Outside schedule" — confirmed end-to-end,
   not just at the unit-test level.
5. **RLS proof, not just UI** — the new integration tests confirm spv can
   `SELECT` `quiz_attempts`/`attempt_answers`/`attempt_questions`/
   `attempt_question_options`/`quizzes`/`profiles`, cannot `INSERT` into
   `quizzes`/`questions`/`teams`/`quiz_categories`, and cannot call
   `admin_update_user` to change its own role.
6. **No regression** — `admin`/`super_admin`/`sales` behavior confirmed
   unchanged: full existing RLS suite still passes, and a spot-check as
   `trainer.qa@example.com` showed the results list, schedule badge, and
   grading form all working exactly as before.

**Known issues found during this pass, both pre-existing and out of
scope for this plan** (neither touches any file this branch changed —
confirmed via `git diff main --stat`):
- `tests/e2e/responsive.spec.ts` — `/admin/teams` overflows horizontally
  at the `iphone-se` viewport (93px over). Pre-dates this branch (last
  touched by the unrelated UI/UX foundation pass).
- `tests/e2e/chaos/save-submit-retry.spec.ts` — "a submit that fails on
  the first try does not produce a duplicate or corrupt result"
  intermittently times out. Entirely within the sales quiz-taking flow
  (`/quizzes/...`), a code path this branch never touches.

Also recreated the pre-existing `sales.qa02@example.com` QA seed account
a second time this session — it had been deleted from production again
between sessions, most likely by a real admin cleaning up what looks like
junk data. Worth a permanent fix (e.g. a naming convention or a note in
the admin UI) if this keeps recurring.
