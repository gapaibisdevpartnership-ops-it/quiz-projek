# Report — Essay keyword hint + quick Correct/Wrong grading

**Date:** 2026-09-13
**Branch:** `feature/essay-keyword-hint` (not merged / pushed; migration
**not yet applied** to Supabase — see "Not done" below)
**Plan:** `docs/ESSAY_KEYWORD_HINT_PLAN.md`

## What was built

- Migration `supabase/migrations/20260913090000_essay_keywords.sql` —
  `keywords text` on `questions` and `attempt_questions`, `start_quiz_attempt()`
  re-created to snapshot it.
- `keywords` threaded through the whole question-bank stack: `src/types/domain.ts`,
  `src/lib/validation/question.ts` (essaySchema), `src/features/questions/actions.ts`
  (`questionRowFromInput` + `duplicateQuestion`), `src/features/questions/question-editor.tsx`
  (new "Keywords for grading hint" field), `src/features/results/service.ts`
  (`BreakdownQuestion.keywords`).
- `src/features/grading/keyword-match.ts` — pure `matchKeywords()` function
  (comma-split, lowercase substring match, ≥60%/1-59%/0% thresholds) + unit
  test `keyword-match.test.ts` (7 cases: empty keywords, case-insensitivity,
  each threshold band, null/empty answer, whitespace trimming).
- `src/features/grading/essay-grade-form.tsx` — renders a suggestion badge
  ("Likely Correct"/"Partial match"/"Likely Incorrect" with match count,
  explicitly labeled "suggestion only") plus two new buttons, "Mark Correct"
  and "Mark Wrong", that pre-fill the score (full points / 0) and submit
  through the existing `gradeEssay()` action — no new RPC, no new server
  logic.
- `src/app/(app)/admin/results/[attemptId]/page.tsx` — passes `keywords`/
  `answerText` into `EssayGradeForm`.
- Docs updated: `docs/DATABASE_SCHEMA.md`, `docs/SECURITY_RLS.md`
  (Answer-Key Protection list), `docs/DOMAIN_RULES.md` (Essay section),
  `docs/RELEASE_CHECKLIST.md`, `docs/TESTING_QA.md`,
  `docs/UAT_PLAYWRIGHT_PROMPT.md`.

## Verification

- `npm run lint` / `npm run typecheck` — clean.
- `npm test` — 63 unit pass (7 new `keyword-match.test.ts` cases included).
- `npm run build` — passes.
- Manual (against `npm run dev`, migration **not** applied — DB has no
  `keywords` column yet):
  - Question editor: new "Keywords for grading hint" field renders
    correctly on an essay question, screenshot confirmed.
  - `/admin/grading` → `/admin/results/[attemptId]` for an existing pending
    essay attempt: **no page errors** — confirmed the app degrades safely
    when the column doesn't exist yet (`q.keywords` reads as `undefined`,
    `matchKeywords` treats that the same as no keywords set, badge simply
    doesn't render).

## Update (2026-09-13) — migration applied to production

The user confirmed the connected Supabase project (`fvymroovientdoixbhff`)
is real production data. Applied the migration with a safety net:

1. Manual backup via `pg_dump` (PostgreSQL 18 client tools) before touching
   anything: `backup-pre-keywords-20260913-151212.sql` (665 KB, verified
   non-empty and contains `CREATE TABLE public.questions`).
2. `npx supabase migration list` re-checked immediately before pushing —
   confirmed exactly one pending migration, no drift.
3. `npx supabase db push` — succeeded (`{"upToDate":false, "dryRun":false,
   "migrations":["20260913090000_essay_keywords.sql"], ...}`).
4. Verified read-only, post-apply: `keywords` column present and readable
   on both `questions` and `attempt_questions` (sampled rows show `null`,
   as expected — no trainer has set one yet); `questions` row count
   unchanged (15) and existing `question_text` values intact on the sample
   checked.
5. **Did not** exercise `start_quiz_attempt()` live end-to-end — neither QA
   sales seed account currently has a quiz assignment, and the two
   published quizzes on the project appear to be real (not QA) quizzes.
   Creating a test assignment or attempt against production data for this
   check was judged not worth the side effect; a successful `db push` (which
   runs the migration as one script — a `create or replace function` syntax
   error would have failed the whole push) was treated as sufficient
   evidence the function replaced cleanly.
6. Logged in `docs/reports/DEPLOY_LOG.md` as a migration-only entry (no app
   deploy).

Full end-to-end UI verification (create essay question with real keywords,
submit as sales, grade as trainer, confirm badge + Mark Correct/Wrong, and
the RLS-negative check that `keywords` never reaches a sales response) is
now unblocked but still not done — see "Next steps".

## Next steps

1. Run the full manual verification from the plan against production data:
   create an essay question with keywords, duplicate it, submit an answer
   as a sales user, grade as trainer (confirm badge + Mark Correct/Wrong),
   confirm `keywords` never reaches a sales response.
2. Push `feature/essay-keyword-hint` → Vercel Preview → click-test → merge
   to `main` per the same flow used for `feature/duplicate-question`. The
   migration is already live, so this step only ships the UI/action code —
   no further DB change needed.
