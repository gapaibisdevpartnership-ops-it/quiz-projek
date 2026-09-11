# Report — Chaos testing implemented

**Date:** 2026-09-11
**Plan:** `docs/CHAOS_TESTING_PLAN.md` (approved as-is, implemented in this
session)

## What was built

### Layer 1 — server (`tests/chaos/`, `npm run test:chaos`)

7 files, hitting RPCs directly (same pattern as `tests/integration/`):

| File | Scenario | Result across multiple runs |
| --- | --- | --- |
| `submit-concurrency.test.ts` | #3 — 20 concurrent `submit_quiz_attempt` on one attempt | ✅ always green — `FOR UPDATE` serialises them correctly |
| `input-fuzz.test.ts` | #6 — garbage/adversarial input on every attempt + grading RPC (8 cases) | ✅ always green — every RPC rejects cleanly |
| `grading-concurrency.test.ts` | #4 — two trainers grade the same essay at once | ✅ always green — last write wins, no corruption, `finalize_attempt` stays consistent |
| `expire-vs-submit-race.test.ts` | #5 — `expire_stale_attempts()` racing a live `submit_quiz_attempt` | ✅ always green — `SKIP LOCKED` does its job, no deadlock |
| `admin-role-race.test.ts` | #7, narrowed (see "Deviations" below) | ✅ always green |
| `start-attempt-race.test.ts` | #1 — concurrent `start_quiz_attempt` under `max_attempts = 1` | 🔴 **reproduces the known gap** (P1 #6) — 2 of 3 full-suite runs hit it |
| `save-vs-submit-race.test.ts` | #2 — `save_objective_answer` racing `submit_quiz_attempt` | 🟡 known gap (P2 #11), did **not** reproduce in this environment across ~5 runs — narrower race window than #1 |

### Layer 2 — client (`tests/e2e/chaos/`, `npm run test:chaos:e2e`)

- `fixture.ts` — seeds a throwaway quiz per test (service-role, same pattern
  as integration tests).
- `network-resilience.spec.ts` — scenarios #9, #10, #12. All green,
  stable across repeated runs.
- `save-submit-retry.spec.ts` — scenarios #8, #11. All green, stable across
  repeated runs.

Both intercept the real network traffic the quiz player makes: every
autosave/submit call is a **Next.js Server Action** — a POST to the current
attempt page URL carrying a `next-action` header, not a direct browser→Supabase
call (confirmed by inspection before writing the specs). `page.route()`
targets that.

## The gap it actually caught (P1 #6, confirmed live)

`start-attempt-race.test.ts` fires 10 concurrent `start_quiz_attempt` calls at
a quiz with `max_attempts = 1`. In 2 of 3 full-suite runs, **two** attempts
were created for the same user on the same quiz — exceeding the limit. This
matches the mechanism described in `docs/IMPROVEMENT_BACKLOG.md` P1 #6: the
resume-check, the `count(*) >= max_attempts` check, and the `next
attempt_number` computation are three separate unlocked reads, and a burst of
concurrent calls can interleave so two of them each insert a distinct,
successful attempt. This is no longer a theoretical read of the SQL — it's
reproduced on the live project.

`save-vs-submit-race.test.ts` targets the analogous gap in P2 #11 the same
way, but its race window (a `save`'s unlocked read-then-write straddling a
concurrent `submit`'s lock) is narrower and did not reproduce in ~5 runs here.
The code-level reasoning in `docs/IMPROVEMENT_BACKLOG.md` still holds; this
test just didn't get unlucky enough to catch it live yet. It stays in the
suite for when it does (or after the fix, as a regression guard).

## A finding chaos testing surfaced that wasn't on the original scenario list

While debugging Layer 2 flakiness, dev-tools logged:

```
Cannot update a component (`Router`) while rendering a different component
(`QuizPlayer`).
```

Root cause: `src/features/attempts/quiz-player.tsx` `onToggleOption` calls
`persistObjective()` (which does async work and `setSaveState(...)`) **from
inside** the `setAnswers()` updater function — a side effect inside a state
updater. React 19 Strict Mode (on in `next dev` by default) double-invokes
updater functions to catch exactly this, which is what produced the extra
network requests observed while building the Layer 2 specs and the warning
above. It didn't crash anything in this environment, but it's a real code
smell worth a follow-up (move `persistObjective(q, next)` out of the
`setAnswers` updater, call it after `setAnswers` instead). Not fixed here —
out of scope for "add chaos testing"; noted for the backlog.

This also confirms `docs/IMPROVEMENT_BACKLOG.md` P3 #44 ("run E2E against
`next build && next start`, not `npm run dev`") — the dev-only Strict Mode
double-invoke is exactly the kind of prod-vs-dev behavioural gap that item
warns about.

## Deviations from the approved plan

- **Scenario #7 narrowed.** The plan's framing ("two concurrent
  `admin_update_user` calls demoting the last two super_admins") can't be
  tested safely against this shared project: the only way to reach the true
  "last super_admin" edge is to demote the seeded `superadmin.qa` account
  itself, which every other suite depends on staying a super_admin. Implemented
  instead: a burst of concurrent unauthorized grant attempts must all be
  rejected (tests the authorization gate under concurrency, not the count
  invariant). Documented in the test file.
- **`it.fails` not used for the known-gap scenarios.** Race conditions are
  probabilistic — `it.fails` would itself be flaky (sometimes the race doesn't
  manifest and a test marked "expected to fail" would then fail *because it
  passed*). Used plain `it()` with a `TODO(P1 #6 / P2 #11)` comment instead, so
  a red result is visible and specific instead of silently swallowed either
  way. This is why chaos is excluded from the default gate — see
  `docs/TESTING.md`.
- **Layer 2 tests seed one quiz per test, not one per file.** The plan didn't
  specify this; it became necessary once testing showed `start_quiz_attempt`
  resumes an in-progress attempt for the same user+quiz, so sharing a quiz
  across sequential tests let one test's answers leak into the next.
- **`scripts/cleanup-uat.mjs` generalised** to sweep a `"CHAOS "` prefix
  alongside `"UAT "` (case-insensitive `ilike`, so it also catches the chaos
  suite's `"Chaos ..."` question text), for the same reason it existed for UAT
  runs: a crashed chaos run or manual debugging leaves rows behind.

## Verification

- `npm run lint` / `npm run typecheck` — clean
- `npm test` — 56 unit pass
- `npm run test:integration` — 43 pass (unaffected)
- `npm run build` — passes
- `npm run test:e2e` (non-chaos) — 12 pass (unaffected)
- `npm run test:chaos` — 6/7 files green every run; `start-attempt-race`
  reproduces the known P1 #6 gap intermittently (by design)
- `npm run test:chaos:e2e` — 5/5 pass, stable across repeated runs
- `node scripts/cleanup-uat.mjs` (dry run) — 0 leftover rows after each run

## Suggested next step

Fix `docs/IMPROVEMENT_BACKLOG.md` P1 #6 (advisory lock or a partial unique
index on `quiz_attempts(quiz_id, user_id) where status = 'in_progress'`), then
flip `start-attempt-race.test.ts`'s assertion comment into a hard requirement
— it should go green on every run once the lock is in place. Same for P2 #11
and `save-vs-submit-race.test.ts` once `save_objective_answer` /
`save_essay_answer` take `FOR UPDATE` on the attempt.
