# Report — Duplicate Question

**Date:** 2026-09-13
**Branch:** `feature/duplicate-question` (not merged / pushed yet)
**Plan:** `docs/DUPLICATE_QUESTION_PLAN.md`

## What was built

- `duplicateQuestion(sourceId)` server action —
  `src/features/questions/actions.ts`.
- `QuestionRowActions` client component (Edit + Duplicate, pending/error
  state) — `src/features/questions/question-row-actions.tsx`, wired into
  `src/app/(app)/admin/questions/page.tsx` in place of the bare "Edit" link.
- Docs: `docs/DOMAIN_RULES.md` ("Questions" #7), `docs/API_CONTRACTS.md`
  ("Duplicate Question (admin)" — also the first documented contract for the
  question-bank actions; `createQuestion`/`updateQuestion` were never
  documented there either).

No migration, no RLS change, no new dependency — matches the plan.

## Verification

- `npm run lint` / `npm run typecheck` — clean
- `npm test` — 56 unit pass
- `npm run build` — passes
- `npm run test:e2e` (auth, security, responsive) — 12 pass, no regression
  (responsive suite covers `/admin/questions` at 320px — the new button
  doesn't break mobile layout)
- Manual, via Playwright against `npm run dev`, one of each question type:
  - **Single choice** (with `difficulty: easy`, `explanation`): clone got
    `"Copy of DUPQ single choice question"`, same 2 options with the same
    correct flag, same category, `status: active`, `created_by` = the acting
    admin (not the source's author).
  - **Multiple choice** (2 correct options): both correct flags preserved on
    the clone.
  - **Essay**: `sample_answer` and `grading_notes` both preserved.
  - **Image-only question** (`question_text: null`): clone also has
    `question_text: null` (no prefix applied, as designed) and the **same**
    `question_image_url` string as the source (confirms the "reuse the URL,
    don't copy the storage object" design).
  - **Quiz safety**: a quiz's `quiz_questions` row that referenced the
    single-choice source still pointed at the original question id,
    unchanged, after duplicating it.
  - **Double-click**: clicking Duplicate twice in quick succession produced
    exactly one clone — confirmed via a DB count, not just visually.
  - All test rows/categories/quiz cleaned up afterward (verified 0 leftover).

## Deviations from the plan

None. Implemented exactly as planned (client component, truncate-on-overflow,
no migration).

## Not done (by design, per the plan)

- No automated test for `duplicateQuestion` itself — no existing
  action-level test pattern for the question bank to extend (`createQuestion`/
  `updateQuestion` aren't tested at that layer either); verification here was
  manual, as planned.
- The pre-existing non-atomic insert pattern (`docs/IMPROVEMENT_BACKLOG.md`
  item 17) was not fixed — `duplicateQuestion` inherits it on purpose, to keep
  this change to one focused feature (Change Safety Rule 14: don't bundle a
  refactor with a feature).

## Next steps (per the Change Safety Rules this branch follows)

1. Push `feature/duplicate-question` → get a Vercel Preview URL.
2. Click-test the Preview: all 4 question types, plus the existing regression
   checklist (create quiz, edit quiz, start attempt, autosave, submit, result,
   admin/sales access).
3. Merge to `main` only after Preview passes — `main` auto-deploys to
   production on push (`docs/DEPLOYMENT.md`).
4. `npm run smoke` against production after deploy; add a row to
   `docs/reports/DEPLOY_LOG.md`.
