# Plan — Fix `start_quiz_attempt` race (docs/IMPROVEMENT_BACKLOG.md P1 #6)

**Status:** ✅ Implemented on `fix/start-attempt-race`. Not merged, not
pushed. Kept below for the design reasoning.

## Context

`start_quiz_attempt()` (`supabase/migrations/20260913090000_essay_keywords.sql`
— the live version, `create or replace`d over the original in
`20260907120000_quiz_engine.sql`) does three unlocked reads — "is there an
in-progress attempt to resume?", "how many attempts exist so far vs.
`max_attempts`?", "what's the next `attempt_number`?" — then an insert, with
no lock serializing concurrent calls for the same `(quiz_id, user_id)` pair.
A double-click or two open tabs can let two concurrent calls both read the
same "count so far" before either commits, both pass the `max_attempts`
check, and both insert distinct attempts (different `attempt_number`, so no
unique-constraint collision) — exceeding the configured attempt limit.

This is not theoretical: `tests/chaos/start-attempt-race.test.ts` reproduces
it live against the connected (production) Supabase project, 2 of 3 runs
(`docs/reports/CHAOS_TESTING_REPORT.md`). Its assertion is already the
strict `expect(violations).toEqual([])` — it's just excluded from the
default gate (`test:chaos` is separate from `test`/`test:all`) and currently
fails when run explicitly. Fixing this flips it to a real regression guard
with no test-code changes needed.

## Fix

Add a transaction-scoped Postgres advisory lock, keyed on `(target_quiz_id,
v_uid)`, as the first thing the function does after the existing
auth/active-account checks and before the "resume?" select.
`pg_advisory_xact_lock` blocks any other concurrent call using the same key
until the first transaction commits or rolls back, and releases
automatically — no unlock call, no new table, no new column, no index. This
serializes the entire resume-check / count-check / attempt_number-
computation / insert sequence per `(user, quiz)` pair, closing the race
completely (unlike a partial unique index on `status = 'in_progress'` alone,
which only prevents duplicate *in-progress* rows and does not stop two
concurrent calls from each independently passing the `max_attempts` count
check with different `attempt_number`s).

### `supabase/migrations/20260914090000_start_attempt_lock.sql`
`create or replace function public.start_quiz_attempt(...)` — identical
body to the previous live version, with one addition right after the
`is_active()` check:
```sql
perform pg_advisory_xact_lock(hashtext(target_quiz_id::text || v_uid::text));
```
Everything else in the function — every existing check, the snapshot
inserts (questions/options/keywords), `total_points` update — is unchanged
verbatim.

## Applying to production

Same production Supabase project as before, confirmed real data
(`docs/reports/DEPLOY_LOG.md`). Following the same safety steps already used
for the essay-keywords migration: manual `pg_dump` backup first (saved
outside the repo), `supabase migration list` re-checked immediately before
pushing, `supabase db push`, then a read-only post-apply check that the
function's source now contains `pg_advisory_xact_lock`.

## Verification

`npm run lint && npm run typecheck && npm test && npm run build` — all
clean (no application code changed). The real verification is
`npm run test:chaos` (`start-attempt-race.test.ts`): it reproduced the race
before this fix and must pass after — no round exceeds `max_attempts`
across 4 rounds × 10 concurrent calls. See
`docs/reports/START_ATTEMPT_RACE_FIX_REPORT.md` for actual results.
