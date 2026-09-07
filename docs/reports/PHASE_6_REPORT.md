# Phase 6 Report — Scoring & Grading

**Date:** 2026-09-07
**Status:** 🟡 Code complete — migration `20260907130000_scoring_grading.sql` must be pushed

## Goal (`docs/DEVELOPMENT_PLAN.md`)

Server-side objective scoring; manual grading queue; trainer feedback; final
score calculation; pass/fail; result page. Exit: objective and mixed-essay
quizzes finalize correctly.

## Database — `supabase/migrations/20260907130000_scoring_grading.sql`

- **`score_attempt_objective(attempt_id) → numeric`** — sums points for
  correctly answered objective questions. Single choice / true-false: the one
  correct option and nothing else. Multiple choice: exact set match
  (all-or-nothing, `docs/QUESTION_TYPES.md`). Unanswered = 0.
- **`finalize_attempt(attempt_id)`** — `auto = score_attempt_objective`,
  `manual = Σ essay manual_score`, `final = auto + manual`,
  `percentage = round(final / total * 100, 2)`,
  `passed = percentage >= quiz.passing_score`; sets `status = 'submitted'`,
  `requires_manual_grading = false`. `FOR UPDATE` locked, idempotent.
- **`submit_quiz_attempt`** (replaces the Phase 5 stub) — now scores objective
  questions on submit. With essays → `pending_review` (auto_score stored,
  final left null). Without essays → `finalize_attempt`. Still idempotent /
  `FOR UPDATE`.
- **`grade_essay_answer(answer_id, score, feedback) → jsonb`** — `is_admin()`
  gate (`UNAUTHORIZED_GRADING`), essay-type check, `0 <= score <= question
  points` (`SCORE_OUT_OF_RANGE`). Records `manual_score`, `grader_feedback`,
  `graded_by`, `graded_at`; when every essay in the attempt is graded it calls
  `finalize_attempt`. Returns `{ status, graded, totalEssays }`.
- `EXECUTE` on `grade_essay_answer` granted to `authenticated`;
  `finalize_attempt` / `score_attempt_objective` are internal only.
- **Backfill** block: re-finalises any `submitted` attempt left with
  `final_score IS NULL` by the Phase 5 stub.

## Application code

- `src/lib/scoring.ts` — display helpers `percentage`, `isPass`, `scoreLabel`
  (mirror the SQL rounding). Unit-tested.
- `features/grading/service.ts` — `listGradingQueue()` (pending_review
  attempts with per-attempt essay counts, resolved quiz title + user name).
- `features/grading/actions.ts` — `gradeEssay(answerId, score, feedback,
  attemptId)` → `grade_essay_answer` RPC, error-mapped.
- `features/grading/essay-grade-form.tsx` — score + feedback form, client-side
  range check, "Graded" state.
- `features/results/service.ts` — `listAllAttempts()` (admin, last 200 with
  quiz/user labels) and `getAttemptDetail(attemptId)` — full per-question
  breakdown: options with `is_correct` + `selected`, objective points awarded
  (re-derived to match SQL), essay answer + sample answer + grading notes.
- Pages:
  - `/admin/results` — table of every attempt → detail link.
  - `/admin/results/[attemptId]` — score summary + per-question breakdown;
    inline `EssayGradeForm` for each essay.
  - `/admin/grading` — the pending-review queue.
  - `/history` — sales: their attempts with status / percentage / pass.
  - `/quizzes/[quizId]/result/[attemptId]` — real final score / percentage /
    pass-fail, hidden when `quiz.show_result` is false (admins always see).

## Verification

- `npm run lint` / `npm run typecheck` — clean
- `npm test` — 7 files, **50 tests** (added `scoring.test.ts`)
- `npm run build` — passes

## Blocked / follow-ups

1. **Push the migration:** `npx supabase db push` (also runs the backfill).
2. End-to-end: objective-only quiz → submit → immediate score & pass/fail;
   mixed quiz → submit → `pending_review`, grade each essay in
   `/admin/results/[id]`, last grade flips it to `submitted` with the combined
   final score; verify a sales user with `show_result = false` sees status
   only.
3. Multiple-choice partial credit is intentionally all-or-nothing for V1
   (`docs/DOMAIN_RULES.md`).
4. `/admin/analytics` is still a placeholder — Phase 7.

## Next: Phase 7 — Analytics

Admin KPI dashboard, quiz analytics, question analytics, sales performance,
leaderboard.
