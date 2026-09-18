# Plan — Public "Session Link" entry flow (guest access via Supabase Anonymous Auth)

**Status:** 📝 Planned, not yet implemented. Awaiting go-ahead to build.

## Context

Trainers/HR want to send one shareable link (WA/chat) to N trainees, each
of whom opens it, types their name, and takes the assessment — without an
admin pre-creating an account for each person. The existing system is
entirely account-based: every quiz-taker is a real `profiles` row +
Supabase Auth user, assigned via `quiz_assignments`, gated by
`requireProfile()`.

This plan adds that as a **second, parallel entry path** alongside the
existing login-based flow, without modifying it — shippable, triable, and
turn-offable again by simply no longer generating session links, with zero
risk to the stable existing flow.

## Key finding that reshapes this plan

Exploration of the routing/middleware architecture and every place
`quiz_attempts.user_id` / `auth.uid()` is assumed (`src/features/results/service.ts`,
`src/features/analytics/service.ts`, `leaderboard()`, and all 5 quiz-engine
RPCs) points at **Supabase's built-in Anonymous Auth** as a dramatically
smaller-footprint approach than a hand-rolled guest-token system:

- `quiz_attempts.user_id uuid not null references auth.users(id)`
  (`supabase/migrations/20260907120000_quiz_engine.sql:13`) — an anonymous
  sign-in (`supabase.auth.signInAnonymously()`) creates a **real**
  `auth.users` row with a real `auth.uid()`, so this FK, every RLS policy
  keyed on `user_id = auth.uid()`, and every RPC grant `to authenticated`
  (anonymous sessions carry the `authenticated` role in Supabase) all keep
  working **completely unmodified**. No nullable-column migration, no new
  `_guest` RPC variants, no new RLS policies.
- The `handle_new_user()` trigger (`supabase/migrations/20260907090000_foundation.sql`)
  fires on every `auth.users` insert and already creates a `profiles` row —
  needs confirming it also fires for anonymous inserts (verification step
  below), but if it does, `is_active()` already passes for a fresh
  anonymous session with zero change.
- `src/features/results/service.ts`'s existing fallback-to-`"User"` logic
  (both `listAllAttempts` and `getAttemptDetail`) reads `profiles.full_name`
  — if the candidate's typed name is written to *their own*
  `profiles.full_name` right after anonymous sign-in, their name **just
  appears correctly in every existing admin screen with zero code change**.

This cuts the plan from "new nullable schema + 5 duplicate `_guest` RPCs +
retrofit every results/analytics query" down to: one new table, one small
RPC extension, one narrow self-service RPC, and a new public route that
reuses `QuizPlayer` and the existing server actions as-is.

Also confirmed while exploring: `middleware.ts` → `src/lib/supabase/middleware.ts`
gates routes by a **hardcoded path-prefix allowlist** (`/dashboard`,
`/quizzes`, `/history`, `/leaderboard`, `/profile`, `/admin`), and
`src/app/(app)/layout.tsx` calls `requireProfile()` only for routes nested
under the `(app)` route group. A new top-level route like
`/assessment/[token]` (sibling to `(app)`/`(auth)`) is naturally
unauthenticated by default — no middleware or layout change needed.

## What's still genuinely new

1. **`assessment_sessions` table** (additive, new) — `id`, `quiz_id`,
   `token` (random, unguessable, unique, indexed), `label`,
   `candidate_roster` (nullable text[] — a closed allowed-names list; NULL
   = open to anyone with the link), `expires_at`, `created_by`, `status`
   (`active`/`closed`), `created_at`. RLS: SELECT restricted to admins for
   management; a narrow `SECURITY DEFINER` RPC (next item) is the only read
   path for the public link itself, so the table is never exposed to
   `anon` directly.
2. **`start_quiz_attempt(target_quiz_id, session_token text default null)`**
   — extend (not replace) the existing function. When `session_token` is
   provided: validate it against `assessment_sessions` (active, unexpired,
   quiz matches, and — if a roster is set — the caller's `profiles.full_name`
   is on it) **instead of** calling `quiz_assigned_to_me()`. When absent,
   behavior is byte-for-byte what it is today — this is why the existing
   flow is provably unaffected. Same advisory-lock treatment as
   `docs/START_ATTEMPT_RACE_FIX_PLAN.md` — build this branch race-safe
   from day one rather than retrofitting it later.
3. **`set_my_guest_display_name(name text)`** — new narrow
   `SECURITY DEFINER` RPC, callable by `authenticated`, that writes
   `profiles.full_name` for the **caller's own row only**, and only when
   `auth.jwt() ->> 'is_anonymous' = 'true'` — so it can never be used by a
   real account to rename itself, and never used to rename someone else.
4. **New public route `src/app/assessment/[token]/page.tsx`** (sibling to
   `(app)`/`(auth)`): validates the token, shows a name-entry form, calls
   `signInAnonymously()` → `set_my_guest_display_name()` →
   `start_quiz_attempt(quizId, token)`, then renders the **existing**
   `QuizPlayer` (`src/features/attempts/quiz-player.tsx`) and existing
   server actions in `src/features/attempts/actions.ts` completely
   unchanged — they already just wrap `auth.uid()`-scoped RPCs, which now
   resolve to the anonymous session.
5. **Exclude guests from the internal sales leaderboard/performance
   reports** — `leaderboard()` (`supabase/migrations/20260907140000_analytics.sql:8-39`)
   and `getSalesPerformance()` (`src/features/analytics/service.ts:128-174`)
   both filter/join on `profiles.role = 'sales'`; an anonymous guest would
   also get `role='sales'` from the trigger, incorrectly mixing one-off
   test-takers into real rep performance tracking. Fix: join against
   `auth.users.is_anonymous = false` in the `leaderboard()` SQL function
   — **needs verification** this Supabase version has it queryable from a
   `SECURITY DEFINER` function; fall back to a
   `profiles.is_guest boolean default false` column, set `true` by
   `handle_new_user()` when the inserted row is anonymous, if not.
6. **Admin UI**: "Create Session" on a quiz (generate link, optional
   roster paste, expiry) + a session list/close action — new
   `src/features/sessions/` module following the existing
   action/service/RLS split pattern already used by every other feature.
7. **Results labeling** (cosmetic): `/admin/results` and grading screens
   mark guest-session rows distinctly (e.g. a small "via session link"
   badge) — the `auth.users.is_anonymous` (or `profiles.is_guest`) flag
   from item 5 already gives us this for free.
8. **Cleanup**: anonymous Supabase auth users accumulate over time (one
   per link open). Supabase has a built-in setting to auto-expire
   anonymous users after N days — enable it; document the retention choice
   in `docs/DOMAIN_RULES.md` (needs verification of exact cascade behavior
   on `quiz_attempts` when an anonymous auth user is expired).

## Two things to verify with a tiny spike before writing the real migration
(cheap, ~30 min, de-risks the whole plan before committing to it)
1. Does `handle_new_user()` fire on `supabase.auth.signInAnonymously()`,
   and does the resulting `profiles` row pass `is_active()` with zero
   changes?
2. Is `auth.users.is_anonymous` queryable from a `SECURITY DEFINER` SQL
   function on this Supabase version, for the leaderboard exclusion?

## Explicitly out of scope for this plan
- Changing or removing the existing login-based entry flow in any way.
- A global open-vs-closed roster setting — the trainer chooses per session
  when creating the link (roster column nullable = open by default).
- Deciding the exact anonymous-account retention window — flagged for a
  product decision, defaulted to a conservative value (e.g. 30 days)
  unless told otherwise.

## Verification (once built)
- Unit tests for the new `(session_id, candidate_name)`-scoped resume/
  attempt-limit branch inside `start_quiz_attempt`.
- New chaos test mirroring `tests/chaos/start-attempt-race.test.ts` for the
  guest branch specifically — first anonymous-access surface in the app,
  deserves at least the same scrutiny.
- RLS/negative test: confirm an anonymous session still cannot read another
  candidate's attempt, cannot call `set_my_guest_display_name` to rename a
  real account, and that `get_attempt_for_player` still proves answer-key
  fields absent for the guest path too.
- Manual: generate a session link, open in an incognito window, submit as
  2 different candidate names, confirm both appear correctly labeled in
  `/admin/results` and are **absent** from `/leaderboard`; confirm the
  *existing* login-based flow is completely unaffected (full regression
  pass on `tests/e2e/*`).

## Effort estimate
Smaller than first assessed thanks to reusing Anonymous Auth: **M–L**
(roughly 1–2 focused days, not multi-day) — one new table, one extended +
one new small RPC, one new public route that reuses the existing player
and actions verbatim, one admin feature module, and the 2 verification
spikes above done first to avoid surprises mid-build.
