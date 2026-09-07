# Phase 3 Report — Quiz Builder

**Date:** 2026-09-07
**Status:** 🟡 Code complete — migration `20260907100000_quiz_builder.sql` must be pushed

## Goal (`docs/DEVELOPMENT_PLAN.md`)

Quiz CRUD; settings; attach questions; reorder; points; preview;
publish/archive. Exit: an admin can produce a complete, publishable quiz.

## Database — `supabase/migrations/20260907100000_quiz_builder.sql`

- **`quizzes`** — per `docs/DATABASE_SCHEMA.md`: `title` (non-blank CHECK),
  `description`, `instructions`, `cover_image_url`, `category_id`
  (FK `on delete set null`), `status` (`draft|published|archived`),
  `duration_minutes` (`> 0` when set), `passing_score` (`0..100`),
  `max_attempts` (`>= 1`), `shuffle_questions`, `shuffle_answers`,
  `show_result`, `show_correct_answer`, `start_at`, `end_at`, `created_by`,
  timestamps. `CHECK quizzes_schedule_order` (`end_at > start_at` when both
  set). Indexes on `status`, `category_id`. `updated_at` trigger.
- **`quiz_questions`** — `quiz_id` (FK cascade), `question_id`
  (FK `on delete restrict` — a question used by a quiz can't be hard-deleted),
  `points` (`> 0`), `sort_order`, `unique(quiz_id, question_id)`. Index
  `(quiz_id, sort_order)`.
- **RLS** — admin/trainer only on both tables. Sales visibility of published
  quizzes is deferred to Phase 4 (needs assignments — `docs/DOMAIN_RULES.md`).

## Application code

- `src/lib/validation/quiz.ts` — `quizSettingsSchema` (title, scoring,
  attempts, behaviour flags, optional duration, optional availability window
  with `end > start`), `quizQuestionPointsSchema`.
- `src/types/domain.ts` — `Quiz`, `QuizQuestion`, `QuizQuestionWithQuestion`
  + row types and mappers (`numeric` columns coerced with `Number`).
- `src/features/quizzes/service.ts` — `listQuizzes`, `getQuiz`,
  `getQuizQuestions` (joined with bank question), `getQuizPreviewItems`
  (joined with question **and** options, for preview), `totalPoints`.
- `src/features/quizzes/actions.ts` — `requireAdmin()`-gated: `createQuiz`,
  `updateQuiz`, `setQuizStatus` (**blocks publishing a quiz with no
  questions**), `addQuestionToQuiz` (auto `sort_order`, friendly duplicate
  message), `removeQuizQuestion`, `setQuizQuestionPoints`,
  `reorderQuizQuestions` (writes new `sort_order` for the given id order).
- `src/features/questions/renderer.tsx` — `QuestionRenderer`, read-only
  presentation shared by preview now and reused by the player later;
  `revealCorrect` only passed in trusted admin contexts.
- Client components: `quiz-settings-form.tsx`, `quiz-questions-builder.tsx`
  (attach from bank, ▲/▼ reorder, per-question points on blur, remove),
  `quiz-status-actions.tsx` (publish / unpublish / archive / restore).
- Pages under `/admin/quizzes`: list, `new`, `[quizId]` (overview + lifecycle),
  `[quizId]/edit` (settings), `[quizId]/questions` (builder),
  `[quizId]/preview` (renders like the player, creates no attempt —
  `docs/UI_UX_SPEC.md`).

## Verification

- `npm run lint` — clean
- `npm run typecheck` — clean
- `npm test` — 4 files, **32 tests** passing (added `quiz.test.ts`: title,
  passing-score range, attempts, duration, schedule order)
- `npm run build` — passes

## Blocked / follow-ups

1. **Push the migration:** `npx supabase db push`.
2. After push: as an admin, create a quiz, add questions from the bank,
   reorder, set points, open **Preview**, then **Publish** (and confirm
   publish is refused with zero questions).
3. Reorder writes N `UPDATE`s in parallel (not a transaction). Fine for the
   small question counts a quiz has; revisit with an RPC if needed.
4. `quiz-assets` cover-image upload field is not wired into the settings form
   yet (bucket + `uploadAsset('quiz-covers', …)` already exist) — add when
   the design calls for it.

## Next: Phase 4 — Users, Teams, Assignments

`quiz_assignments`; user management UI; team CRUD + membership; individual and
team assignment; sales RLS for assigned published quizzes.
