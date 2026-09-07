# Phase 5 Report — Quiz Engine

**Date:** 2026-09-07
**Status:** 🟡 Code complete — migration `20260907120000_quiz_engine.sql` must be pushed

## Goal (`docs/DEVELOPMENT_PLAN.md`)

Start-attempt RPC; snapshots; quiz player; objective input; essay input;
autosave; timer; resume; submit. Exit: sales can complete a quiz reliably.

## Database — `supabase/migrations/20260907120000_quiz_engine.sql`

### Tables (per `docs/DATABASE_SCHEMA.md`)
`quiz_attempts`, `attempt_questions`, `attempt_question_options`,
`attempt_answers`, `attempt_answer_options` — with the documented columns,
`unique(quiz_id, user_id, attempt_number)`, `unique(attempt_id,
attempt_question_id)`, `unique(attempt_answer_id, attempt_question_option_id)`,
and the recommended indexes. `attempt_answers.updated_at` trigger.
`quiz_attempts.quiz_id` / `attempt_questions.source_*` use `on delete
restrict` / nullable so history survives quiz or question changes
(`docs/DOMAIN_RULES.md` Historical Integrity, ADR-002).

### RLS (`docs/SECURITY_RLS.md`)
- `quiz_attempts`: owner reads own; admin reads all. **No** direct
  insert/update/delete for anyone — all mutations go through the RPCs.
- `attempt_questions`, `attempt_question_options`: **admin SELECT only**.
  Sales never touch these directly (they carry `is_correct`, `sample_answer`,
  `grading_notes`).
- `attempt_answers`: admin + owner SELECT; no direct writes.

### RPCs (all `SECURITY DEFINER`, `EXECUTE` granted to `authenticated` only)
- **`start_quiz_attempt(quiz_id)`** → attempt id. Validates authenticated +
  active, quiz published, assigned (`quiz_assigned_to_me`), schedule window,
  attempts `< max_attempts`. Resumes an existing `in_progress` attempt instead
  of creating a duplicate. Transactionally: next attempt number → insert
  attempt → snapshot questions → snapshot options → set `total_points`.
- **`get_attempt_for_player(attempt_id)`** → JSON. Owner-checked. Returns quiz
  meta, `serverNow`, questions and options **without** `is_correct` /
  `sample_answer` / `grading_notes`, plus the user's saved answers. This is the
  only read path the player uses.
- **`save_objective_answer(attempt_question_id, uuid[])`** — owner + attempt
  `in_progress` + question in attempt + options belong to the question + not
  an essay. Replaces the selected-option set atomically.
- **`save_essay_answer(attempt_question_id, text)`** — same guards; essay type
  only; upsert on `(attempt_id, attempt_question_id)`.
- **`submit_quiz_attempt(attempt_id)`** — `SELECT … FOR UPDATE` lock; owner
  check; **idempotent** (a finalized attempt returns its status, no mutation);
  sets `pending_review` when the attempt contains an essay else `submitted`;
  stamps `submitted_at`, `time_spent_seconds`, `requires_manual_grading`,
  `total_points`. *Objective score / percentage / pass-fail are filled in by
  Phase 6, which extends this same RPC.*

## Application code

- `features/attempts/types.ts` — `PlayerData` / `PlayerQuestion` /
  `PlayerOption` (the safe payload shape).
- `features/attempts/errors.ts` — maps RPC error codes to readable messages
  (`ATTEMPT_LIMIT_REACHED`, `QUIZ_CLOSED`, …).
- `features/attempts/service.ts` — `listMyAttempts`, `getMyAttempt`,
  `getAttemptForPlayer` (RPC).
- `features/attempts/actions.ts` — `startAttempt`, `saveObjectiveAnswer`,
  `saveEssayAnswer`, `submitAttempt` (thin `requireProfile()` + RPC wrappers).
- `features/attempts/shuffle.ts` — `seededShuffle` (stable per attempt),
  `formatCountdown`.
- `features/attempts/quiz-player.tsx` — the player: question navigator,
  Previous/Next, per-question save status, **objective autosave on select**,
  **essay debounced autosave (800 ms)**, **server-anchored countdown** (offset
  from `serverNow`, auto-submit at zero), submit with confirm, read-only when
  the attempt is already finalized. Optional question/answer shuffle driven by
  quiz settings.
- Pages: `/quizzes/[quizId]/start` (runs the RPC then redirects / shows the
  mapped error), `/quizzes/[quizId]/attempt/[attemptId]` (loads the safe
  payload, renders the player), `/quizzes/[quizId]/result/[attemptId]`
  (status + placeholder score, "Pending review" messaging).
- `/quizzes/[quizId]` — real Start / **Resume** button, attempts-used counter,
  links to past attempts' results.

## Verification

- `npm run lint` — clean (satisfied the new `react-hooks` purity rules by
  moving all clock reads into the timer effect)
- `npm run typecheck` — clean
- `npm test` — 6 files, **46 tests** (added `shuffle.test.ts`:
  determinism, element preservation, no mutation, `formatCountdown`)
- `npm run build` — passes
- `tests/integration/rls.test.ts` — added: sales cannot read
  `attempt_questions` / `attempt_question_options`, cannot insert a
  `quiz_attempt` (guarded by `isMissingTable`).

## Blocked / follow-ups

1. **Push the migration:** `npx supabase db push`.
2. End-to-end check: as Sales QA 01 (assigned a published quiz) — Start,
   answer each type, refresh mid-attempt (answers + timer must persist),
   Submit; confirm a second Submit is a no-op; confirm attempt #2 works and #3
   is refused when `max_attempts = 2`.
3. Auto-expire of abandoned `in_progress` attempts past their deadline is not
   implemented (the client auto-submits if the tab stays open; a scheduled
   sweep can be added later).
4. `/history` still a placeholder — filled in Phase 6 with real results.

## Next: Phase 6 — Scoring & Grading

Extend `submit_quiz_attempt` with server-side objective scoring
(single/true-false full-or-zero, multiple-choice all-or-nothing); manual
grading queue + `grade_essay_answer` RPC; final score, percentage, pass/fail;
result page; `/history`.
