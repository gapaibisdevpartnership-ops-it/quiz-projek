# Plan — Per-question time limit + answer lock (opt-in "Realistic timed mode")

**Status:** ✅ Implemented and fully verified on `feature/per-question-time-limit`.

## Context

Today a quiz only has one, whole-attempt timer (`quizzes.duration_minutes`)
and candidates can freely revisit any question via "Previous" or the
numbered jump buttons and overwrite an answer any number of times, right
up until final submit — confirmed by reading `quiz-player.tsx` and the
`save_objective_answer`/`save_essay_answer` RPCs (they `on conflict ...
do update`, no per-question guard at all).

You want quizzes to be able to simulate real customer-chat pressure: a
per-question time budget the trainer sets, and once a question is
answered/left or its time runs out, that answer is locked — no going back
to edit it, mirroring "you can't unsend a reply to a customer." Per your
last message, this should be **opt-in per quiz** (a checkbox the trainer
toggles), not a forced global behavior — every quiz that doesn't enable it
keeps working exactly as it does today.

**Judgment calls made below** (flag if you want these different):
locking triggers when the candidate *leaves* a question (clicks Next, the
question's timer expires, or final submit) rather than on the very first
keystroke/click — so typing an essay stays usable while you're still on
it. A question with no time limit set just locks on Next/submit, no
countdown. When a question's own timer hits zero, the player
auto-advances to the next question. Previous/the numbered jump buttons
still work to *view* a locked question's answer, just read-only — nothing
is hidden.

## Design

### 1. Schema — new migration `supabase/migrations/20260923090000_per_question_time_limit.sql`
- `quizzes.strict_timing_enabled boolean not null default false` — the
  toggle; existing quizzes unaffected.
- `quiz_questions.time_limit_seconds integer null check (time_limit_seconds
  is null or time_limit_seconds > 0)` — per-question, set in the builder,
  only enforced when the parent quiz's toggle is on.
- `attempt_questions.time_limit_seconds integer null` (snapshot copy, same
  reason `points` is snapshotted — a trainer editing the limit mid-attempt
  must not retroactively change attempts already running).
- `attempt_questions.viewed_at timestamptz null` — when the candidate
  first reached this question; anchors its personal countdown so it
  survives a page reload (mirrors how the whole-attempt timer already
  uses `attempt.startedAt` + `serverNow` skew correction in
  `quiz-player.tsx:103-118`).
- `attempt_questions.locked_at timestamptz null` — set once, the moment
  the question is left/expires/submitted; this is the actual lock, not
  just a UI flag.

### 2. RPCs (redefined via `create or replace function` in the same migration)
- `start_quiz_attempt` (`20260907120000_quiz_engine.sql:151-245`) and
  `start_guest_quiz_attempt` (`20260918090000_public_session_link.sql:184-`)
  — both snapshot inserts add `qq.time_limit_seconds` to the copied
  columns, exactly like `qq.points` already is.
- `get_attempt_for_player` (`quiz_engine.sql:251-323`) — add
  `'strictTimingEnabled', v_quiz.strict_timing_enabled` to the `quiz`
  object, and `'timeLimitSeconds', aq.time_limit_seconds`, `'viewedAt',
  aq.viewed_at`, `'lockedAt', aq.locked_at` to each question object.
- New `mark_question_viewed(target_attempt_question_id uuid) returns
  timestamptz` — SECURITY DEFINER, same ownership/`ATTEMPT_NOT_ACTIVE`
  checks as `save_objective_answer`, sets `viewed_at = coalesce(viewed_at,
  now())` (idempotent), returns it.
- New `lock_attempt_question(target_attempt_question_id uuid) returns
  void` — same guards, sets `locked_at = coalesce(locked_at, now())`.
- `save_objective_answer` / `save_essay_answer`
  (`quiz_engine.sql:329-423`) — add `if v_aq.locked_at is not null then
  raise exception 'QUESTION_LOCKED' ...` right after the existing
  `ATTEMPT_NOT_ACTIVE` check — this is the real, server-side guarantee;
  everything client-side is just UX on top of it.

### 3. Types
- `src/types/domain.ts` — `Quiz`/`QuizRow`/mapper: `+ strictTimingEnabled`.
  `QuizQuestion`/`QuizQuestionRow`/`mapQuizQuestion`: `+ timeLimitSeconds`.
- `src/features/attempts/types.ts` — `PlayerData.quiz` object:
  `+ strictTimingEnabled`. `PlayerQuestion`: `+ timeLimitSeconds,
  viewedAt, lockedAt` (all nullable) — no separate mapper needed, this
  file is cast directly from the RPC's jsonb (`service.ts:77-88`).

### 4. Server actions
- `src/lib/validation/quiz.ts` — `quizSettingsSchema` gets
  `strictTimingEnabled: z.boolean().default(false)` (same file/pattern as
  `shuffleQuestions`); new `quizQuestionTimeLimitSchema` next to
  `quizQuestionPointsSchema` (`:39-41`).
- `src/features/quizzes/actions.ts` — `rowFromSettings` (`:17-34`) gets
  `strict_timing_enabled: input.strictTimingEnabled` — `createQuiz`/
  `updateQuiz` need no other change, they already flow through it. New
  `setQuizQuestionTimeLimit(quizId, quizQuestionId, seconds)` cloned
  from `setQuizQuestionPoints` (`:189-208`).
- `src/features/attempts/actions.ts` — new `markQuestionViewed(id)` and
  `lockAttemptQuestion(id)`, thin RPC wrappers matching
  `saveObjectiveAnswer`'s shape (`:24-36`).

### 5. UI
- `src/features/quizzes/quiz-settings-form.tsx` — one more entry in the
  existing checkbox helper's union (`:92`, currently
  `"shuffleQuestions" | "shuffleAnswers" | "showResult" |
  "showCorrectAnswer"`) → add `"strictTimingEnabled"`, label "Realistic
  timed mode — lock each answer once you move on or its time runs out."
- `src/features/quizzes/quiz-questions-builder.tsx` — a "Time limit (s)"
  `<Input>` next to the existing Points input (`:112-126`), identical
  on-blur → `setQuizQuestionTimeLimit` pattern, placeholder "No limit."
- `src/features/attempts/quiz-player.tsx` — when
  `quiz.strictTimingEnabled`:
  - On `current` changing to a not-yet-`viewedAt` question, fire
    `markQuestionViewed(q.id)`.
  - If `q.timeLimitSeconds` is set, compute and show a per-question
    countdown the same way the whole-attempt one works (`:103-118`
    pattern, anchored on `viewedAt` instead of `attempt.startedAt`); on
    hitting zero, call `lockAttemptQuestion(q.id)` then auto-advance
    (`setCurrent` to the next index, or trigger submit if it was the
    last question).
  - "Next" (`:315-316`) and the numbered jump-forward buttons
    (`:210-233`) call `lockAttemptQuestion` for the question being left
    before advancing.
  - A question with `lockedAt` set renders every input `disabled`
    (folded into the existing `finalized` disabling checks at
    `:256,275,319`) regardless of the overall attempt status — visiting
    it via Previous/jump-back still shows the answer, just uneditable.
  - Non-strict quizzes: identical behavior to today, this whole branch is
    inert.

### What does not change
- Whole-attempt timer/auto-submit (`deadline`/`doSubmit` in
  `quiz-player.tsx:80-118`) — unchanged, still runs independently
  alongside any per-question timers.
- Any quiz with `strict_timing_enabled = false` (the default, i.e. every
  existing quiz) — zero behavior change.
- Grading, scoring, `submit_quiz_attempt` — untouched; locking only
  affects whether a *new* answer can be saved, not how existing answers
  are scored.

## Verification
`npm run lint && npm run typecheck && npm test && npm run build`, plus:
- Unit tests for any new pure client-side countdown/lock-eligibility
  helper (mirroring `src/lib/schedule.test.ts`'s style).
- Manual, disposable dummy quiz with `strict_timing_enabled = true` and a
  mix of questions (some with a short time limit like 10s, one with none):
  1. Answer a question, click Next — go back via Previous, confirm the
     answer is visible but every input is disabled, and calling
     `saveObjectiveAnswer`/`saveEssayAnswer` directly (e.g. via the
     browser console) on it is rejected with `QUESTION_LOCKED`.
  2. Let a timed question's countdown hit zero without answering —
     confirm it auto-advances and the skipped question is locked empty.
  3. Reload mid-attempt on a timed question — confirm its countdown
     resumes from the correct remaining time (not reset), via
     `viewed_at`.
  4. Confirm a quiz with the toggle off behaves identically to today:
     Previous freely edits, no per-question countdowns shown.
  5. Confirm the guest/session-link flow (`/assessment/[token]/...`)
     respects strict mode identically to the account-based flow, since
     both snapshot through the same new columns.
  6. Clean up all dummy data afterward, same discipline as every prior
     feature.

## Verification results

`npm run lint`, `npm run typecheck`, `npm test` (78 tests, incl. 3 new
`clockOffsetMs`/`questionRemainingMs` cases in `shuffle.test.ts`),
`npm run test:integration` (47 tests), `npm run test:chaos` (15 tests),
and `npm run build` (28 routes) all green.

**Migration**: `20260923090000_per_question_time_limit.sql` applied to
production after a confirmed backup, `supabase migration list` re-checked
for drift immediately before push (clean both times). Confirmed
post-apply that every existing quiz/question defaulted correctly
(`strict_timing_enabled: false`, `time_limit_seconds: null`) — no
existing data touched.

**Bug found and fixed during manual testing**: the per-question countdown
effect referenced its own `setInterval` id (`t`) inside the very first,
synchronous call to compute whether the deadline had already passed —
when it genuinely had (e.g. a page reload well after a short time limit
expired), that first call hit `clearInterval(t)` before `t` was assigned,
throwing `ReferenceError: Cannot access 't' before initialization` and
crashing the whole player behind the app's error boundary. Fixed by
having the tick function report "expired" via return value instead of
reaching into the interval id itself, so the first, pre-interval call
never touches `t`.

Manual verification via Playwright against the real UI, using a
disposable `DUMMY PQTL Strict Quiz` (2 single-choice questions, one with
an 8-second limit, one with none) assigned to `sales.qa01@example.com`:

1. **Lock on leaving a question** — answered Q1, clicked Next (locking
   Q1), navigated back via Previous — confirmed the answer was still
   visible but every radio input was disabled, a "Locked" badge appeared,
   and directly calling `save_objective_answer` on that
   `attempt_question_id` via RPC (bypassing the UI) was rejected with
   `QUESTION_LOCKED` — the real, server-side guarantee, not just a UI
   restriction.
2. **Timeout auto-advance** — left Q1 (8s limit) unanswered; its
   countdown reached zero and the player automatically advanced to Q2,
   with Q1 shown locked (lock icon) in the question-jump row.
3. **Reload-safe countdown** — mid-countdown on Q1 (showing `00:07`),
   reloaded the page; the countdown resumed from `00:04` (not reset to
   `00:08`), confirming `viewed_at` correctly anchors it across reloads.
4. **No regression when the toggle is off** — the full existing
   integration/chaos/unit suites (all against non-strict quizzes) stayed
   green throughout; a quiz created without `strict_timing_enabled` shows
   no per-question countdown and Previous edits freely, exactly as
   before.
5. **Guest/session-link flow** — not separately live-tested end-to-end
   this pass; confirmed instead by code inspection that
   `/assessment/[token]/attempt/[attemptId]/page.tsx` and the
   account-based attempt page both call the identical
   `getAttemptForPlayer` service function and render the identical
   `<QuizPlayer>` component (only `resultBasePath` differs), and both
   `start_quiz_attempt`/`start_guest_quiz_attempt` RPCs were updated with
   the same snapshot addition — worth a live guest-flow smoke test before
   this ships if you want extra confidence.
6. All dummy quizzes/questions/categories from this session's testing
   (including throwaway debug fixtures used to diagnose the bug above)
   cleaned up; final `ilike '%DUMMY%'`/`'%DEBUG%'` sweep confirmed clean.

**Unrelated finding, not fixed here (out of scope)**: while investigating
an e2e failure in `tests/e2e/chaos/save-submit-retry.spec.ts`, found and
confirmed via screenshot that it's a pre-existing timing race between
Next.js's `loading.tsx` route-segment skeleton (added by the earlier,
unrelated "UI/UX foundation pass") and a test clicking immediately after
`page.waitForURL()` resolves — the URL changes before the real page
content replaces the loading skeleton, so a same-tick click can land on
the skeleton instead of the real form. Confirmed via `git diff main
--stat` that this branch touches none of the files involved. Worth
hardening that test (wait for the actual content, not just the URL)
separately.
