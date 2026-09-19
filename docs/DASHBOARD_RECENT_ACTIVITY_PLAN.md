# Dashboard: Recent Activity (Trainer) — Plan

## Why

Asked from the trainer's point of view: what does the dashboard need to be
useful for, day to day? The most frequent need is knowing **who just
submitted a quiz**, without navigating to `/admin/results` and scanning the
full attempts table. Grading-queue visibility and draft/unpublished-quiz
visibility were also named as candidates but are out of scope for this pass
— this plan covers only the "recent activity" piece.

## Scope

Trainer/admin dashboard only. Sales users can't see other people's
attempts (RLS), so this widget has nothing to show them and is not added to
their view.

## 1. Data layer — `src/features/results/service.ts`

- Add `listRecentAttempts(limit = 6): Promise<AttemptListRow[]>`:
  - Query `quiz_attempts` where `status != 'in_progress'` (i.e. finalized:
    submitted / pending_review / expired).
  - Order by `submitted_at desc`.
  - `limit(limit)`.
- Refactor: extract the existing join logic in `listAllAttempts` (quiz
  title lookup, user name/guest lookup from `profiles`) into a shared
  private helper, e.g. `hydrateAttempts(rows)`, reused by both
  `listAllAttempts` and the new `listRecentAttempts` — avoids duplicating
  the two extra queries and the row-mapping logic.

## 2. New component — `src/components/recent-activity.tsx`

- A `Card` titled "Recent activity" with a "View all" link to
  `/admin/results` in the header.
- A compact list (not a full `Table` — this is a glance widget, not a data
  grid): each row shows the quiz title (linking to
  `/admin/results/[attemptId]`) with the user's name as subtext, and on the
  right a status/pass-fail `Badge` plus the submission time.
- Time is rendered with the existing `formatDateTimeUTC` (absolute UTC),
  matching every other timestamp in the app — deliberately not a relative
  "2 minutes ago" format, since that needs a client component to avoid
  server/client hydration mismatches and no other part of the app does
  that today.
- Empty state: "No submissions yet."

## 3. Dashboard layout — `src/app/(app)/dashboard/page.tsx`

- Admin view only. Place **above** "Quick links" (per the trainer's own
  answer: this is what's checked most often, so it gets top billing).
- Two-column layout at `lg:`: Recent activity on the left (`2fr`, more
  space for the list), Quick links on the right (`1fr`, stays a compact nav
  grid) — the same `[minmax(0,2fr)_minmax(0,1fr)]` split already used on
  the Quiz form, Question editor, and Quiz overview pages, so the layout
  language stays consistent across the app.
- Stacks vertically on narrow screens, same as everywhere else this split
  is used.

## Out of scope (not part of this plan)

- Grading-queue preview and draft/unpublished-quiz callouts — named as
  other candidates in the trainer-dashboard discussion, left for a
  possible separate pass.
- Any per-user "assigned to me" activity feed for sales — not applicable,
  see Scope above.
