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

## Not done yet (deliberately, pending user confirmation)

- **Migration not applied to Supabase** (`supabase db push`). This was a
  deliberate pause: the session flagged uncertainty over whether the
  connected Supabase project is a QA/staging project or shares data with
  production, and the user chose to hold off applying any schema change
  until that's resolved, rather than risk it in the wrong environment.
- Consequently, **full end-to-end verification is not done**: creating an
  essay question with real keywords, submitting an answer as a sales user,
  and confirming the badge/Mark Correct/Wrong buttons against a live
  `keywords` column all require the migration to be applied first.
- The RLS-negative check from the plan (sales client cannot read
  `attempt_questions.keywords`; `get_attempt_for_player()` has no `keywords`
  key) also needs the column to exist to be meaningfully tested — today it
  trivially "passes" only because the column isn't there at all.

## Next steps

1. Confirm which Supabase project `.env.local` points at (dedicated
   QA/staging vs. shared with real data) before running `supabase db push`.
2. Once confirmed safe: `supabase db push`, then run the full manual
   verification from the plan (create essay question with keywords,
   duplicate it, submit as sales, grade as trainer, confirm badge + Mark
   Correct/Wrong, confirm `keywords` never reaches a sales response).
3. Push `feature/essay-keyword-hint` → Vercel Preview → click-test → merge
   to `main` per the same flow used for `feature/duplicate-question`.
