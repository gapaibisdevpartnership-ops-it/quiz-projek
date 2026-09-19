# Plan — Extend super-admin-only hard-delete to Questions, Quizzes, Teams, Session links, Categories

**Status:** 📝 Implementing on `feature/hard-delete-entities`.

## Context

Following `docs/HARD_DELETE_USER_PLAN.md`, extend the same "hard-delete is
super_admin-exclusive, everyone else keeps only soft-delete" model to the
5 other deletable entities: questions, quizzes, teams, session links,
categories. Confirmed with you: **super_admin only** for all of these too
— not opened up to admin/trainer, matching how user deletion already
works, for consistency.

## Key finding: no migration needed for any of these 5

Checked every relevant FK's `on delete` behavior — this project's schema
was already built defensively enough that hard-delete is safe as-is:

- **`quiz_categories`**: both consumers (`questions.category_id`,
  `quizzes.category_id`) are `on delete set null`
  (`supabase/migrations/20260907093000_question_bank.sql:24`,
  `20260907100000_quiz_builder.sql:10`) — always safe.
- **`assessment_sessions`**: its only consumer
  (`quiz_attempts.session_id`) is already `on delete set null`
  (added in `20260920090000_session_link_capacity.sql`) — always safe,
  zero further changes needed.
- **`teams`**: both consumers (`team_members.team_id`,
  `quiz_assignments.team_id`) are `on delete cascade`
  (`20260907090000_foundation.sql:45`, `20260907110000_assignments.sql:14`)
  — safe: deleting a team only removes membership/visibility grants, never
  touches attempt/result data.
- **`questions`**: `quiz_questions.question_id` is `on delete restrict`
  (`20260907100000_quiz_builder.sql:56`) — Postgres already **blocks**
  deleting a question while it's attached to any quiz. Historical
  attempts are immune regardless —
  `attempt_questions.source_question_id` has **no FK at all** (a bare
  `uuid`, `20260907120000_quiz_engine.sql:37`), since attempts snapshot
  question text/options independently. The action just needs to catch the
  restrict error with a friendly message.
- **`quizzes`**: `quiz_attempts.quiz_id` is `on delete restrict`
  (`20260907120000_quiz_engine.sql:12`) — Postgres already blocks deleting
  a quiz that has **any** attempt (including guest/session-link ones).
  This is the guard that actually matters; the action just needs a
  friendly error catch. `quiz_questions`/`quiz_assignments`/
  `assessment_sessions` (by `quiz_id`) all cascade harmlessly (join rows /
  never-used links only).

## Design

### Server actions — 5 new, each `requireSuperAdmin()`-gated
Following the exact shape of `deleteUserPermanently()`
(`src/features/users/actions.ts`, from the prior plan) — no new RPCs,
plain `createClient().from(table).delete()` calls, since RLS already lets
admins write and the FK behavior above does the real safety work:
- `deleteCategoryPermanently(id)` — `src/features/questions/actions.ts`.
- `deleteQuestionPermanently(id)` — same file; on a `23503` (FK violation)
  error, return "This question is used in one or more quizzes — remove it
  from them first."
- `deleteQuizPermanently(id)` — `src/features/quizzes/actions.ts`; on
  `23503`, return "This quiz has attempt history and can't be deleted —
  archive it instead."
- `deleteTeamPermanently(id)` — `src/features/teams/actions.ts`.
- `deleteSessionPermanently(quizId, sessionId)` —
  `src/features/sessions/actions.ts`, mirroring `closeSession`'s shape
  (already `requireAdmin()`-based; swap to `requireSuperAdmin()` for this
  one new action only — `closeSession`/`reopenSession`/`createSession`
  stay exactly as they are, admin-manageable).

### UI — thread `viewerIsSuperAdmin` down, add a Delete button per entity
Each list page already has (or gets) `requireProfile()` to know the
viewer's role, passed to its existing client component:
- `src/app/(app)/admin/questions/page.tsx` → `QuestionRowActions`
  (delete a question) and `CategoryManager` (delete a category).
- `src/app/(app)/admin/quizzes/[quizId]/page.tsx` → `QuizStatusActions`
  (delete the quiz, alongside its existing Publish/Archive buttons) and
  `SessionLinks` (delete a specific link, alongside Close/Reopen).
- `src/app/(app)/admin/teams/page.tsx` → `TeamsManager` (delete a team).

**Confirmation UX**: a `window.confirm("Delete '<name>' permanently? This cannot be undone.")`
guard before calling the action — this project's existing convention for
a destructive-but-recoverable-risk action (already used for quiz submit
in `quiz-player.tsx`), proportionate here since the two entities with real
stakes (questions/quizzes with history) are already hard-blocked at the
database level regardless of what the UI does. This is deliberately
lighter than the type-the-email flow built for user deletion, which
existed because deleting a whole identity has no DB-level safety net once
confirmed.

### What does not change
- Every existing soft-delete/status action (`setQuestionStatus`,
  `setQuizStatus`, `updateTeam`'s `isActive` toggle, `closeSession`/
  `reopenSession`, `updateCategory`'s `isActive` toggle) — untouched,
  still admin-accessible exactly as today.
- `deleteUserPermanently()` and its UI — untouched, this plan only adds
  siblings for the other 5 entities.

## Verification
`npm run lint && npm run typecheck && npm test && npm run build`, then
manual with throwaway dummy content (cleaned up after):
1. Delete a category, a team, and a session link with real associated
   rows (a question referencing the category, a team member, a session
   with an attempt) as super_admin — confirm each succeeds and the
   dependent rows survive with the link set to null/removed as designed.
2. Try to delete a question that's currently attached to a quiz — confirm
   the friendly error, not a raw FK message.
3. Try to delete a quiz that has at least one attempt (even a guest one)
   — confirm the friendly error.
4. Delete a fully standalone question and a fully standalone
   (no-attempts-yet) quiz — confirm both succeed.
5. Confirm an `admin`/trainer-role viewer sees none of the 5 new Delete
   buttons anywhere.
