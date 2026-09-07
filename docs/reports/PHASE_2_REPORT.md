# Phase 2 Report — Question Bank

**Date:** 2026-09-07
**Status:** 🟡 Code complete — migration `20260907093000_question_bank.sql` must be pushed

## Goal (from `docs/DEVELOPMENT_PLAN.md`)

Categories; question CRUD; single/multiple choice, true/false, essay; dynamic
answer options; question & option image upload; question validation. Exit:
an admin can build valid, reusable questions without database access.

## Database — `supabase/migrations/20260907093000_question_bank.sql`

Tables (per `docs/DATABASE_SCHEMA.md`):
- `quiz_categories` — `name`, `description`, `is_active`, `created_at`.
- `questions` — `category_id` (FK, `on delete set null`), `question_type`
  (`single_choice|multiple_choice|true_false|essay`), `question_text`,
  `question_image_url`, `difficulty` (`easy|medium|hard`, nullable),
  `explanation`, `sample_answer`, `grading_notes`, `status`
  (`active|archived`), `created_by`, timestamps.
  - `CHECK questions_has_content` — must have non-blank text or an image.
  - Indexes: `category_id`, `question_type`, `status`. `updated_at` trigger.
- `question_options` — `question_id` (FK, `on delete cascade`), `answer_text`,
  `image_url`, `is_correct`, `sort_order`, timestamps.
  - `CHECK question_options_has_content` — text or image required.
  - Index `(question_id, sort_order)`. `updated_at` trigger.

RLS — **admin/trainer only** on all three tables. The bank contains answer
keys (`is_correct`), sample answers and grading notes, so sales never query it
directly; they only ever read per-attempt snapshots built later
(`docs/SECURITY_RLS.md`).

Storage — `quiz-assets` bucket created in the migration: `public = true`,
5 MB limit, MIME allowlist `jpeg/png/webp`. `storage.objects` policies:
public `SELECT`; `INSERT`/`UPDATE`/`DELETE` require `public.is_admin()`.

## Application code

- `src/lib/validation/question.ts` — Zod: `categorySchema`, per-type question
  schemas (`singleChoiceSchema`, `multipleChoiceSchema`, `trueFalseSchema`,
  `essaySchema`) enforcing `docs/VALIDATION_RULES.md` (≥2 options; exactly one
  correct for single/true-false; ≥1 correct for multiple; option needs text or
  image; question needs text or image). Combined as `questionSchema`
  (`z.union`). `QUESTION_TYPE_LABELS`.
- `src/types/domain.ts` — `Category`, `Question`, `QuestionOption`,
  `QuestionWithOptions` + row types and mappers.
- `src/features/questions/service.ts` — `listCategories`, `listQuestions`
  (filter by category/type/status/search), `getQuestion` (with options).
- `src/features/questions/actions.ts` — server actions, all `requireAdmin()`
  gated: `createCategory`, `updateCategory`, `createQuestion`,
  `updateQuestion` (replaces options wholesale — safe, snapshots are copies),
  `setQuestionStatus` (archive/restore). `createQuestion` rolls back an
  orphaned question row if option insert fails.
- `src/features/questions/upload-client.ts` — browser upload to `quiz-assets`
  with client-side type/size checks; storage RLS still enforces `is_admin()`.
- `src/features/questions/question-editor.tsx` — client editor: type switch
  (locked when editing an existing question), category, difficulty, text,
  question image, explanation; dynamic answer options with add/remove/reorder
  by position, per-option image, correct-answer marking (radio for
  single/true-false, checkbox for multiple); essay grading fields
  (sample answer, grading notes). Validates with the shared Zod schema before
  submit.
- `src/features/questions/category-manager.tsx` — inline add + activate/deactivate.
- Pages: `/admin/questions` (list + category panel), `/admin/questions/new`,
  `/admin/questions/[questionId]/edit`.
- `src/components/ui/textarea.tsx`, `src/components/ui/select.tsx` added.
- `next.config.ts` — `images.remotePatterns` for the Supabase storage host.

## Verification

- `npm run lint` — clean
- `npm run build` — passes (24 routes)
- End-to-end not yet exercised: needs the migration pushed and an admin user.

## Blocked / follow-ups

1. **Push the migration:** `npx supabase db push` (blocked for the assistant by
   the Claude Code classifier; run locally).
2. After push: as an admin, create one question of each type at
   `/admin/questions/new`, upload an image, confirm validation messages, edit
   and re-save.
3. Manual RLS check: a `sales` user gets zero rows from `questions` /
   `question_options` / `quiz_categories`.
4. `updateQuestion` deletes + re-inserts options in two statements (not a true
   transaction). Acceptable now; revisit with an RPC if partial failures show
   up in practice.

## Next: Phase 3 — Quiz Builder

`quizzes`, `quiz_questions`; quiz settings, attach/reorder questions, per-quiz
points, preview, publish/archive.
