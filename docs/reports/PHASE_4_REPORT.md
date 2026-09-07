# Phase 4 Report — Users, Teams, Assignments

**Date:** 2026-09-07
**Status:** 🟡 Code complete — migration `20260907110000_assignments.sql` must be pushed

## Goal (`docs/DEVELOPMENT_PLAN.md`)

User management; teams; team membership; individual assignment; team
assignment. Exit: published quizzes can be correctly assigned.

## Database — `supabase/migrations/20260907110000_assignments.sql`

- **`quiz_assignments`** — `quiz_id` (FK cascade), nullable `user_id` **or**
  `team_id` (`CHECK quiz_assignments_one_target` — exactly one), `assigned_by`,
  `assigned_at`, `due_at`. Partial unique indexes: one assignment per
  `(quiz_id, user_id)` and per `(quiz_id, team_id)`. Indexes on `quiz_id`,
  `user_id`, `team_id`.
- **`quiz_assigned_to_me(uuid)`** — SECURITY DEFINER helper: is this quiz
  assigned to the current user directly or via a team they belong to.
- **RLS**
  - `quiz_assignments`: admin full access; a user may `SELECT` assignments
    that target them or one of their teams.
  - `quizzes`: **new sales-facing policy** — a user may `SELECT` a quiz that
    is `status = 'published'` **and** `quiz_assigned_to_me(id)`. Draft and
    archived quizzes stay invisible to sales.
  - `quiz_categories`: added an authenticated `SELECT` policy (names are not
    sensitive) so the sales quiz list can show categories.

## Application code

### Validation
- `src/lib/validation/team.ts` — `teamSchema`.
- `src/lib/validation/user.ts` — `inviteUserSchema`, `updateUserSchema`
  (role/status constrained to the `ROLES` / `USER_STATUSES` unions).
- `src/lib/validation/assignment.ts` — `assignmentSchema` (user- or team-mode,
  target required for the chosen mode).

### Types
`src/types/domain.ts` — `TeamRow`/`mapTeam`, `TeamMember`/`mapTeamMember`,
`Assignment`/`mapAssignment`, `AssignmentTarget`.

### Services / actions (all admin-gated)
- `features/users/service.ts` — `listUsers`, `getUser`.
- `features/users/actions.ts` — `inviteUser` (service-role Admin API
  `auth.admin.createUser`, `requireAdmin()` checked first, random password if
  none given), `updateUser` (name/role/status; refuses to let an admin
  deactivate or de-admin **themselves**).
- `features/teams/service.ts` — `listTeams` (with member counts via
  `team_members(count)` embed), `getTeam`, `listTeamMembers` (two-step:
  members then profiles, joined in JS — `team_members.user_id` FK is to
  `auth.users`, not `profiles`).
- `features/teams/actions.ts` — `createTeam`, `updateTeam` (name/desc/active),
  `addTeamMember`, `removeTeamMember`.
- `features/assignments/service.ts` — `listQuizAssignments` (with resolved
  user/team label), `listMyAssignedQuizzes` / `getMyAssignedQuiz` (rely on the
  new `quizzes` RLS policy — no extra join needed).
- `features/assignments/actions.ts` — `assignQuiz`, `unassignQuiz` (friendly
  duplicate message on the partial unique index).

### UI
- `/admin/users` — `UsersManager`: invite form + list with inline role
  `Select` and Activate/Deactivate.
- `/admin/users/[userId]` — read-only account detail with pointers.
- `/admin/teams` — `TeamsManager`: create team, list with expandable member
  management (add from a dropdown of non-members, remove, activate/deactivate).
- `/admin/quizzes/[quizId]` — new **Assignments** card (`QuizAssignments`):
  assign to a user or team, list current assignments, remove.
- `/quizzes` — replaced the placeholder: sales see their assigned published
  quizzes (admins see all published); quiz cards with score/duration/attempts/
  deadline.
- `/quizzes/[quizId]` — quiz detail for sales with a disabled "Start quiz
  (coming in Phase 5)" button.

## Verification

- `npm run lint` — clean
- `npm run typecheck` — clean
- `npm test` — 5 files, **40 tests** passing (added `assignment.test.ts`
  covering assignment/user/team schemas)
- `npm run build` — passes
- `tests/integration/rls.test.ts` — extended: sales sees no quizzes without an
  assignment, sales sees only their own assignments, sales cannot create an
  assignment (guarded by `isMissingTable` until the migration is pushed).

## Blocked / follow-ups

1. **Push the migration:** `npx supabase db push`.
2. After push, as an admin: create a team, add Sales QA 01 to it, publish a
   quiz, assign it to that team; then log in as Sales QA 01 and confirm the
   quiz appears under `/quizzes` and Sales QA 02 does **not** see it.
3. `inviteUser` sets a random password when none is given; the user must use
   "Forgot password". A proper invite-email flow can be added later.
4. `super_admin` vs `admin` still share one surface (see Phase 1 report).

## Next: Phase 5 — Quiz Engine

`quiz_attempts` + snapshot tables; `start_quiz_attempt` RPC; the quiz player
(objective + essay input, autosave, timer, resume); idempotent submit.
