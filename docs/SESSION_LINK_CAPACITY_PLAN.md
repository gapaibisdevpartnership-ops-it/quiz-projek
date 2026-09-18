# Plan — Session link capacity/attempt/scheduling settings (name-only candidates)

**Status:** ✅ Implemented, migration applied to production, verified
end-to-end with dummy data (cleaned up after) on
`feature/session-link-capacity`. Not yet merged to `main`.

## Verification results (2026-09-20)

Applied `20260920090000_session_link_capacity.sql` to production (manual
`pg_dump` backup first). One hiccup: `supabase db push` initially refused
with `LegacyDbPushMissingLocalError` — the production database already had
`20260919090000_session_managers.sql` applied (from testing the now-
dormant `feature/session-managers` branch), but that file doesn't exist on
this branch's lineage. Fixed with
`supabase migration repair --status reverted 20260919090000` (metadata-only
— corrects the CLI's tracking table, does not touch or revert any actual
schema) after explicit approval, then the push succeeded cleanly. Note for
later: production now has a small amount of "orphaned" schema
(`profiles.can_manage_sessions`, `admin_set_can_manage_sessions()`, one
extra RLS policy) from that abandoned feature — harmless (default
`false`/unused by any current code), but worth a cleanup migration
eventually if `feature/session-managers` is formally dropped.

All 4 planned scenarios verified live via Playwright against dummy data,
cleaned up after each:
1. **`max_candidates = 1`**: 1st candidate starts and can resume
   (same attempt id both times); a 2nd, distinct candidate is rejected
   with "This link has reached its limit of candidates."
2. **`max_attempts_override = 1`** on a quiz whose own `max_attempts = 5`:
   candidate's 2nd attempt via the link is blocked at 1, confirming the
   override — not the quiz's own limit — wins.
3. **`starts_at` in the future**: entry page shows "This link isn't open
   yet" before the time, and accepts normally (form works, attempt starts)
   once `starts_at` is in the past.
4. **Regression**: an ordinary link with all 3 new fields left blank
   behaves exactly as before — no badges, normal submit, 1/1 100% Passed,
   zero console errors.

`npm run lint/typecheck/test/build` all green throughout.

## Context

Owner decision: drop the "trainer creates individual accounts" model
entirely (including the just-built `feature/session-managers` delegated-
sales-account approach — that branch is superseded, left as-is,
**not merged**). Trainer should only touch content creation and grading;
real-world trainees use one reusable, trainer-generated link with no
account of their own — exactly the already-live `feature/public-session-link`
mechanism (`/admin/quizzes/[quizId]` → Session Links card → guest via
Supabase Anonymous Auth). This plan adds the settings a trainer needs to
run that link responsibly at scale, confirmed in scope: **name-only**
candidate identification for now (WhatsApp/position/source fields
explicitly deferred until the owner asks).

**Real gap found while planning, not just a nice-to-have**:
`quiz_attempts` has no column recording *which link* produced a given
attempt. Without it, "how many candidates has this link served" can't be
computed at all — this is a prerequisite for the capacity setting, not an
optional add-on.

## Settings being added (this plan)
1. **Max candidates per link** (`max_candidates`, nullable = unlimited) —
   caps how many *distinct* people may start via this link; a candidate
   already counted may still resume/retake within their own limit.
2. **Attempts-per-candidate override** (`max_attempts_override`, nullable =
   use the quiz's own `max_attempts`) — lets a trainer lock a session to
   e.g. 1 attempt without touching the quiz's own setting used elsewhere.
3. **Scheduled open** (`starts_at`, nullable = open immediately) — link
   can be prepared ahead of time but not usable until a chosen moment,
   pairing with the existing expiry.

Deferred (per your confirmation, revisit only if the owner asks): capturing
WhatsApp/position/source, per-position result filtering, auto-notifications.

## Design

### 1. Migration (new file, `20260920090000_session_link_capacity.sql`)
- `assessment_sessions`: add `max_candidates integer null check (... > 0)`,
  `max_attempts_override integer null check (... > 0)`,
  `starts_at timestamptz null`.
- `quiz_attempts`: add `session_id uuid null references assessment_sessions(id) on delete set null`
  — the missing link identified above. Nullable/`set null` since ordinary
  account-based attempts never set it, and a session row being closed
  should never touch historical attempt data.
- `start_guest_quiz_attempt` (`supabase/migrations/20260918090000_public_session_link.sql:180-` —
  edit, don't fork another copy): after the existing session/roster checks,
  add a `starts_at` check (new error `SESSION_NOT_STARTED`) and a capacity
  check — only rejects a *genuinely new* candidate
  (`not exists (select 1 from quiz_attempts where session_id = v_session.id and user_id = v_uid)`)
  once distinct-candidate count reaches `max_candidates` (new error
  `SESSION_FULL`); change the existing
  `if v_count >= v_quiz.max_attempts` line to
  `if v_count >= coalesce(v_session.max_attempts_override, v_quiz.max_attempts)`;
  set `session_id` on the `insert into quiz_attempts`. Every other line of
  this function (advisory lock, roster check, snapshot inserts) stays
  byte-for-byte.
- `validate_session_token`: add the same `starts_at` check so the
  name-entry screen shows "not open yet" up front instead of failing only
  after the candidate fills the form.

### 2. App layer
- `src/lib/validation/session.ts`: extend `createSessionSchema` with
  `maxCandidates`, `maxAttemptsOverride` (both optional positive ints) and
  `opensInDays` (same relative-days union pattern as the existing
  `expiresInDays`, sidestepping the datetime-local timezone bug per
  `docs/IMPROVEMENT_BACKLOG.md` P2 #31, consistent with how expiry was
  already built).
- `src/features/sessions/actions.ts` (`createSession`): resolve
  `startsAt` from `opensInDays` the same way `expiresAt` is resolved
  today; pass the two new numeric fields straight through to the insert.
- `src/features/sessions/service.ts` (`listSessionsForQuiz`): extend
  `AssessmentSession` with the 3 new fields plus a computed
  `candidatesUsed` (count distinct `user_id` from `quiz_attempts` where
  `session_id` matches, reduced in JS the same way this codebase already
  builds lookup Maps in `results/service.ts` — no new RPC needed).
- `src/features/sessions/session-links.tsx`: create-form gains "Max
  candidates" and "Max attempts per candidate" number inputs (both
  optional/blank = unlimited) and an "Opens" dropdown next to the existing
  "Expires" one (Now / in 1 / 3 / 7 days); the list gains a
  "`{candidatesUsed} of {max_candidates} candidates`" line (or just the
  count when unlimited) and a "not open yet" badge when `starts_at` is in
  the future.
- `src/features/assessment/service.ts` / `actions.ts`: add
  `SESSION_NOT_STARTED`/`SESSION_FULL` to the existing error-copy maps
  (same shape as `SESSION_EXPIRED`/`NOT_ON_ROSTER` already there) —
  friendly messages, no new plumbing.

### What does not change
- Name-only candidate entry — no new required fields on the candidate
  side.
- Everything about how an already-started guest attempt is taken, saved,
  graded, and shown in `/admin/results` (`isGuest` labeling, leaderboard/
  analytics/Users exclusion) — untouched.
- `feature/session-managers` branch is left alone, not merged, not
  deleted — dormant in case the owner wants delegated accounts again
  later, but the active path from here is trainer-generated links only.

## Verification
`npm run lint && npm run typecheck && npm test && npm run build`, then
manual with dummy data (cleaned up after, same discipline as prior
passes): create a link with `max_candidates = 1`, confirm a 2nd distinct
name is rejected with a clear message while the 1st candidate can still
resume; create a link with `max_attempts_override = 1` on a quiz whose own
`max_attempts` is higher, confirm the override wins; create a link with a
future `starts_at`, confirm the entry page rejects before and accepts
after; confirm an ordinary admin-quiz-page-generated link with all three
left blank behaves exactly as it does today (regression check).
