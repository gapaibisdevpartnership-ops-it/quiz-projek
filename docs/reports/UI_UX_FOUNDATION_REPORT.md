# UI/UX Foundation Pass

Date: 2026-09-19
Scope: foundation & consistency layer for UI/UX (per user request — "perbaiki UI UX
sesuai best practice"), keeping the existing GAPAI Mentorship brand tokens
(violet primary, yellow brand accent, OKLCH-based `globals.css`) unchanged.

## Why

A quick recon (`Explore` agent) of the ~34-page app found the brand tokens and
component foundation were solid, but several cross-cutting gaps meant every
page had to reinvent its own loading, error, and status/table UI:

- No `loading.tsx`, `error.tsx`, or `not-found.tsx` anywhere under `src/app` —
  navigation had no consistent in-flight state and errors/404s had no
  on-brand handling.
- `components/ui` only had 13 primitives; no `table`, `badge`, `tabs`,
  `dropdown-menu`, toast, or `progress` — admin CRUD pages (users, quizzes,
  results, teams) were hand-rolling `<table>` markup and ad hoc status pills.
- No toast/notification system wired up (`sonner` was unused), so CRUD
  actions across the admin panel had no consistent success/error feedback
  pattern to adopt.
- `Button` had no `asChild` support (the standard shadcn/Radix `Slot`
  pattern), so composing a link-as-button required style-only workarounds.

## What changed

- Added shadcn primitives: `table`, `badge`, `tabs`, `dropdown-menu`,
  `sonner` (toast), `progress` (`src/components/ui/*`).
- Fixed a shadcn-CLI inconsistency: the generated files imported `cn` from a
  newly-added `cn` npm package instead of the project's existing
  `@/lib/utils` helper. Normalized all 5 new files to the existing helper and
  removed the now-unused `cn` package so there's one `cn` implementation in
  the codebase, not two.
- Added `asChild` support to `Button` (`src/components/ui/button.tsx`) via
  `@radix-ui/react-slot`, matching standard shadcn behavior and letting
  `<Button asChild><Link>…</Link></Button>` work anywhere in the app.
- Wired `<Toaster />` into the root layout (`src/app/layout.tsx`) so
  `toast.success(...)` / `toast.error(...)` is available for CRUD feedback
  project-wide. Simplified `sonner.tsx` to not depend on `next-themes` (the
  app has no `ThemeProvider` — theming is class-based via an inline script —
  so color already tracks `.dark` through CSS variables).
- Added route-scoped `loading.tsx` skeletons matching each layout's actual
  shape, using the existing `Skeleton` component (previously imported but
  never used anywhere in the app):
  - `src/app/(auth)/loading.tsx` — form-shaped skeleton for the centered auth
    card.
  - `src/app/(app)/loading.tsx` — header + stat-grid + card skeleton,
    matching the dashboard's own layout.
  - `src/app/(app)/admin/loading.tsx` — header + row-list skeleton for admin
    CRUD list pages.
  - `src/app/assessment/loading.tsx` — quiz-shaped skeleton for the public
    token assessment flow.
- Added on-brand `src/app/not-found.tsx` and `src/app/error.tsx`, written in
  the interface's voice (plain explanation of what happened + a way forward,
  no apology, no vague copy), using `BrandMark` so they don't look like a
  generic Next.js error screen.
- Reworked `src/app/(app)/admin/results/page.tsx` as the reference pattern
  for other admin list pages: replaced the raw `<table>` / inline status
  text / `✓`/`✗` markers with `Table`/`TableRow`/`TableCell` and `Badge`
  (status label map, pass/fail badge, "via session link" badge for guest
  attempts).

## Verification

- `npx tsc --noEmit` — clean, no errors.
- `npm run dev` — compiled with no errors/warnings; `GET /login` → 200,
  `GET /nonexistent-page-xyz` → 404 (custom `not-found.tsx` served
  correctly).

## Second pass — toast feedback + status badges on admin CRUD

- Added `toast.success(...)` at the point of every successful admin
  mutation across the client "manager"/row-action islands, alongside the
  existing inline `Alert` (kept for errors — persistent and already
  accessible near the action, not replaced):
  - `src/features/questions/question-row-actions.tsx` — duplicate, delete.
  - `src/features/questions/category-manager.tsx` — add, activate/
    deactivate, delete.
  - `src/features/quizzes/quiz-status-actions.tsx` — publish/unpublish/
    archive/restore, delete.
  - `src/features/teams/teams-manager.tsx` — create team, activate/
    deactivate, delete, add/remove member (shared `run()` helper extended
    with an optional `successMessage` param).
  - `src/features/users/users-manager.tsx` — role/status change (this had
    *no* feedback before). Left `invite`/`resetPassword`/`deleteForever` on
    their existing persistent `Alert` since those carry a temporary
    password the admin needs to copy — a toast would auto-dismiss the one
    piece of information that must stay on screen.
  - `src/features/sessions/session-links.tsx` — create/close/reopen/delete
    session link.
  - `src/features/assignments/quiz-assignments.tsx` — assign/unassign
    (shared `run()` helper, same pattern as teams-manager).
- Replaced remaining hand-rolled status pills with `Badge`:
  `src/app/(app)/admin/quizzes/page.tsx` (draft/published/archived) and
  `src/features/sessions/session-links.tsx` (active/closed, "not open yet",
  "full" — previously raw `bg-emerald-100`/`bg-amber-100`/`bg-rose-100`
  spans, now `Badge` variants so status color language is consistent with
  `admin/results`).
- Used the new `Button asChild` on `question-row-actions.tsx`'s Edit link
  (previously `buttonVariants()` as a raw className on `<Link>`, called out
  in a comment as a workaround for Button not supporting `asChild` — that
  workaround is now removed since `asChild` exists).

Verified: `tsc --noEmit` clean, `eslint` clean on all touched files, `npm
run dev` compiles with no errors and `/login` returns 200.

## Third pass — quiz detail, analytics, grading

- `src/app/(app)/admin/quizzes/[quizId]/page.tsx` — status fact now a
  `Badge`; the three header action links switched from `buttonVariants()`
  className-on-`<Link>` to `Button asChild`.
- `src/app/(app)/admin/analytics/page.tsx` and
  `admin/analytics/[quizId]/page.tsx` — both hand-rolled `<table>`s
  (quiz-level and per-question stats) migrated to `Table`/`TableRow`/
  `TableCell`, status column now a `Badge`.
- `src/app/(app)/admin/grading/page.tsx` — the "3/5 essays graded" ratio was
  plain text; now a `Progress` bar + label, so reviewers can scan queue
  depth at a glance instead of reading fractions.
- `src/app/(app)/admin/results/[attemptId]/page.tsx` — "Result" fact now a
  pass/fail `Badge` instead of plain text, consistent with `admin/results`.
- `src/features/grading/essay-grade-form.tsx` — the keyword-match
  suggestion pill and the "Graded" indicator were hand-rolled
  `bg-emerald-100`/`bg-amber-100`/`bg-rose-100` spans; both now `Badge`.
  Added `toast.success` on save (previously silent beyond a page refresh).

Verified: `tsc --noEmit` clean, `eslint` clean on all touched files, `npm
run dev` compiles with no errors and `/login` returns 200.

## Fourth pass — form/editor pages

- Added the shadcn `checkbox` primitive (same `cn`-package import bug as
  before — fixed the same way, and the transient `cn` npm package removed
  again afterward).
- `src/features/quizzes/quiz-settings-form.tsx` (used by both
  `admin/quizzes/new` and `admin/quizzes/[quizId]/edit`) — the 4 behaviour
  toggles (shuffle questions/answers, show result, reveal correct answer)
  were raw unstyled `<input type="checkbox">`; now the shadcn `Checkbox`.
  Added `toast.success` on save (create vs. update wording).
- `src/features/questions/question-editor.tsx` — added `toast.success` on
  save; removed a leftover no-op (`{isChoice ? null : null}`) and its now
  unused `isChoice` variable. Left the per-option "Correct" toggle as a
  native `checkbox`/`radio` input (not converted to shadcn `Checkbox`) since
  it switches semantics between multi-select and single-select depending on
  question type — a native radio group is the more correct a11y primitive
  there, not a simplification target.
- `src/features/quizzes/quiz-questions-builder.tsx` — `toast.success` on
  add/remove question (not on reorder or point-value edits, which happen
  too frequently for a toast to stay useful — see frontend-design guidance
  on using motion/feedback deliberately, not on every interaction). Swapped
  the raw `▲`/`▼` text glyphs for the same `lucide-react` icon language
  used everywhere else in the admin panel (`ChevronUp`/`ChevronDown`).

Verified: `tsc --noEmit` clean, `eslint` clean on all touched files, `npm
run dev` compiles with no errors and `/login` returns 200.

## Fifth pass — quiz-taking flow (student-facing)

Moved to the second priority the user named earlier ("halaman quiz-taking
siswa"): the sales/trainee-facing side of the app, not just the admin
panel.

- `src/app/(app)/quizzes/page.tsx` — the "Open" link on each quiz card was a
  plain underlined text link; now a `Button asChild` for a clearer primary
  action per card.
- `src/app/(app)/quizzes/[quizId]/page.tsx` — "Resume attempt"/"Start quiz"
  now `Button asChild` (was `buttonVariants()` on a raw `<Link>`). Attempt
  usage ("2 of 3 attempts used") gets a `Progress` bar alongside the text.
  Past attempts list now shows status as a `Badge` instead of plain text.
- `src/features/attempts/quiz-player.tsx` — the live quiz-taking screen.
  Treated as the highest-risk file touched this pass (a timed, autosaving
  attempt in progress), so **only additive, non-logic changes**: added a
  `Progress` bar next to the existing "3 of 10 answered" text, and gave the
  question-navigator buttons proper `aria-label`/`aria-current` (previously
  just a bare number, unreadable by screen readers). Autosave feedback,
  the timer, and the submit-confirmation dialog were left untouched — they
  already follow good patterns (inline per-question save state, not toast
  spam; a native `confirm()` before the irreversible submit).
- `src/app/(app)/quizzes/[quizId]/result/[attemptId]/page.tsx` and its
  guest counterpart `src/app/assessment/[token]/result/[attemptId]/page.tsx`
  — the pass/fail result was previously one row in a details table, no
  different from "Status" or "Attempt number". This is the single most
  important thing on the page (this is the "did I pass?" moment), so both
  pages now open with a large percentage + Passed/Not passed treatment
  (colored by outcome, using the existing `primary`/`destructive` tokens —
  no new colors introduced), with the details table below it for the rest.
- `src/app/(app)/history/page.tsx` — the per-attempt status text (a
  string-concatenation of percentage/passed/status) replaced with a
  percentage number + `Badge`, matching the pattern now used on
  `admin/results` and the quiz detail page.
- `src/app/(app)/leaderboard/page.tsx` reviewed, left unchanged — the
  numbered ranking is a genuine sequence (unlike the numbered-marker
  anti-pattern called out in the frontend-design skill), and the page is
  already minimal and legible.

Verified: `tsc --noEmit` clean, `eslint` clean on all touched files, `npm
run dev` compiles with no errors; `/login` → 200, `/quizzes` → 307
(expected — auth-gated, redirects to login).

## Sixth pass — auth pages & profile

Covered the third option the user named at the start ("Auth & onboarding").

- Reviewed `login`, `forgot-password`, `reset-password`,
  `change-password`/`ChangePasswordForm`, and `inactive` — all already use
  `Card`/`Alert`/`SubmitButton` and Server Actions with `useActionState`
  consistently. No changes needed; these were already the reference pattern
  the rest of the app should arguably follow, not the other way around.
- `src/app/(app)/profile/page.tsx` — Role and Status were plain text in the
  details `dl`, unlike every other place in the app that now shows role/
  status as a `Badge` (users list, quizzes, results, sessions). Brought in
  line: Role shows the same human label used in the app shell
  (`Super Admin`/`Trainer`/`Sales`, from `(app)/layout.tsx`'s
  `ROLE_LABELS`) as a `Badge`, Status as a `Badge` (default when active,
  outline when inactive).

Verified: `tsc --noEmit` clean, `eslint` clean on `profile/page.tsx`, `npm
run dev` compiles with no errors and `/login` returns 200.

## Final validation — production build

`npm run build` (Next.js 16.3.4, Turbopack): compiled successfully in 8.9s,
TypeScript checked clean, all 28 routes generated (static + dynamic) with no
errors or warnings. This is on top of the per-pass `tsc --noEmit`, `eslint`,
and `npm run dev` smoke tests already run after each change above.

## Seventh pass — Users page redesign (requested cleanup)

The user flagged `admin/users` specifically as messy. Root cause: every row
crammed name, an inline role `Select`, and three separate buttons
(Activate/Deactivate, Reset password, Delete) into one `flex-wrap` line, and
reset-password/delete confirmation rendered as inline panels that expanded
*within the row*, pushing every row below it down and reflowing the whole
list — different rows were in different layout states at once, which reads
as chaotic no matter the screen width.

Redesign (`src/features/users/users-manager.tsx`, full rewrite):

- **Table, not a wrapping flex row.** Columns: User (avatar initial circle +
  name + email + "must change password" badge), Role (inline `Select`,
  kept — quick role change is a real, frequent admin action and a natural
  fit for an editable table cell), Status (`Badge`), and a single actions
  column.
- **One action affordance per row**, not three: a kebab (`MoreHorizontal`)
  button opens a `DropdownMenu` with Activate/Deactivate, Reset password,
  and (super admin, not-self only) a destructive Delete permanently item
  with a separator before it. This is the actual fix for the clutter — row
  height is now constant regardless of what's available for that user.
- **Reset password and Delete moved to `Dialog` modals** instead of inline
  expanding panels. Each opens centered over the page, has its own error
  state, and closing it cannot leave the table in a half-expanded state.
  The delete dialog keeps the existing type-the-email-to-confirm safeguard.
- Role select values now show the human label (`Super Admin`/`Trainer`/
  `Sales`) instead of the raw enum string, matching `ROLE_LABELS` already
  used in the app shell and now the profile page.
- Toasts (added in an earlier pass) now fire consistently for every
  destructive/state-changing action reachable from the menu, including
  reset password and delete, which previously only showed a persistent
  inline `Alert` (kept as the on-dialog error state for validation errors,
  which is the correct persistent-vs-transient split: form errors stay
  visible in the dialog, success is transient).
- Page header now shows an account count subtitle, matching the pattern
  used on `admin/quizzes`/`admin/questions`.

Not verified visually in a browser — no QA login credentials were available
in this session to sign in as an admin and see the rendered page. Verified
instead via `tsc --noEmit` (clean), `eslint` (clean), and `npm run build`
(clean, all 28 routes). If something still looks off once you view it
signed in, tell me what's wrong and I'll fix it directly rather than
guessing.

## Eighth pass — same table + dropdown-menu pattern on Quizzes, Question
Bank, Teams

User liked the Users redesign and asked for the same treatment on the other
three admin CRUD screens using lists/wrapping rows.

- **`admin/quizzes`** (`src/app/(app)/admin/quizzes/page.tsx`) — the
  `<ul>`/`<li>` list became a `Table`: Quiz (title link), Category, Passing
  score, Attempts, Status (`Badge`), each its own column instead of one
  crammed subtext line. Header now shows a count subtitle and `Button
  asChild` for "+ New quiz" (was `buttonVariants()` on a raw `<Link>`). No
  actions column — the row's only action (open the quiz) is the title link
  itself, so a menu would be one redundant click for zero-choice rows.
- **`admin/questions`** (Question Bank) — same treatment:
  - `src/app/(app)/admin/questions/page.tsx`: questions list is now a
    `Table` (Question / Type + difficulty badge / Category / actions).
  - `src/features/questions/question-row-actions.tsx`: the 2–3 separate
    ghost buttons (Edit, Duplicate, Delete) per row collapsed into one
    kebab `DropdownMenu` (Edit as a link item, Duplicate, then a separator
    before the destructive Delete for super admins) — same shape as the
    Users row menu.
  - `src/features/questions/category-manager.tsx`: the category list is now
    a borderless `Table` inside its card with a `Badge` for active/inactive
    and a kebab menu for Activate/Deactivate + Delete, instead of two ghost
    buttons per row.
- **`admin/teams`** (`src/features/teams/teams-manager.tsx`, full rewrite)
  — this was the messiest of the three: each team row expanded in place to
  show its member list and an add-member row, which (like the old Users
  page) shifted every row below it whenever one was opened. Redesigned as:
  - A `Table` of teams (Name, member count as a clickable link, Status
    `Badge`, kebab actions: Manage members / Activate-Deactivate / Delete).
  - "Manage members" opens a `Dialog` (same pattern as Users' reset-password
    dialog) showing the member list, remove buttons, and the add-member
    picker — instead of expanding inline. `admin/teams/page.tsx`'s own
    `<h1>` was removed since `TeamsManager` now renders its own header (it
    was duplicating what `UsersManager` does), matching the page-owns-its-
    header pattern used elsewhere.
- All three `run()`/action helpers now report errors via `toast.error(...)`
  (previously a persistent inline `Alert` fed by local `error` state, which
  is now unused and removed) — consistent with the Users redesign, where
  transient toasts are for state-changing actions and dialogs keep their
  own local error state only for form validation.

Verified: `tsc --noEmit` clean, `eslint` clean on all touched files, `npm
run build` clean (all 28 routes, no errors/warnings). Not verified visually
in a browser for the same reason as the Users pass — no QA login available
in this session.

## Not done in this pass (follow-up candidates)

- `admin/questions`, `admin/users`, `admin/teams` list pages still render as
  `<ul>`/`<li>` rather than `Table` — left as-is since they're
  card-in-list layouts with inline expand/edit rows, not really tabular
  data, so forcing `Table` may not be a genuine improvement; worth a
  deliberate design look rather than a blanket conversion.
- `admin/quizzes/[quizId]/preview` (the read-only quiz preview) reviewed,
  left as-is — already simple and consistent.

All four scope options the user named at the start of this effort
(foundation, quiz-taking, admin CRUD, auth) have now had at least one pass.
Remaining candidates are narrower, optional polish:
