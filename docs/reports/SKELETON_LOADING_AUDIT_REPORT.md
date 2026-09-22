# Skeleton Loading Audit & Fix

Date: 2026-09-22

## Rules applied

1. Skeletons must only represent data whose value is not yet known.
2. Do not skeletonize static headings, labels, descriptions, buttons, card
   containers, page layout, or static navigation.
3. Prefer "label + skeleton value" over full-card skeletons.
4. Skeletonize only the specific piece of data that is loading — keep the
   surrounding shell rendered.
5. Skeleton dimensions should approximate final content size.

## Audit findings

Grep across `src/` found skeleton usage in exactly 4 places, all as
Next.js App Router route-level `loading.tsx` fallbacks. Each one violated the
rules by mimicking a full page/card (fake headings, buttons, and layout)
instead of skeletonizing only async values:

| File | Problem |
| --- | --- |
| `src/app/(auth)/loading.tsx` | Skeletonized a fully static client-rendered login/reset form with no async data. |
| `src/app/assessment/loading.tsx` | Full-card skeleton mimicking one specific page shape, shown for several structurally different routes (`/assessment`, `/assessment/[token]`, attempt, result). |
| `src/app/(app)/loading.tsx` | Skeletonized static heading/subheading and faked stat-card blocks, shown across unrelated pages (dashboard, quizzes, leaderboard, history, profile). |
| `src/app/(app)/admin/loading.tsx` | Skeletonized a static heading, subheading, and button that are known regardless of data state. |

## Fixes applied

- **`(auth)/loading.tsx`**: deleted. All three auth pages
  (`login`, `forgot-password`, `reset-password`) are static — no server
  fetch justifies a skeleton.
- **`assessment/loading.tsx`, `(app)/loading.tsx`, `(app)/admin/loading.tsx`**:
  replaced the fake full-page mimicry with a minimal centered spinner
  (`Loader2`). These segment-level fallbacks cover multiple, structurally
  different pages, so they can't honestly preview any specific page's
  layout — per rule 5, a shape that doesn't match the eventual content is
  worse than a neutral indicator.
- **Dashboard (`(app)/dashboard/page.tsx`)**: this was the one page with a
  real, well-defined "label + value" case (KPI stat cards), so it got a
  proper fix instead of a generic spinner:
  - `StatCard` now accepts a `loading` prop that renders a `Skeleton` in
    place of the value only — the label (`CardDescription`) always renders
    immediately.
  - The stat-card grid and "Recent activity" card are now each wrapped in
    their own `<Suspense>` boundary with a fallback that renders the real,
    static labels (`Active sales`, `Published quizzes`, etc.) immediately
    and skeletons only the values/rows, so the page shell, greeting, and
    quick-links section no longer wait on the KPI/activity fetch.

## Rollout to all list/stat pages

Following up, the same "static shell renders immediately, only the async
value/rows show a skeleton" pattern was applied across every page with a
genuine list or stat-card: **quizzes**, **leaderboard**, **history**,
**admin/questions** (question bank + categories), **admin/quizzes**
(management table), **admin/grading** (queue), **admin/analytics** (KPIs +
two tables), and **admin/results**. Each page now:

- Renders its literal heading (e.g. "Leaderboard", "Quiz Management")
  synchronously, not behind a fetch.
- Wraps only the data-fetching part in a nested `<Suspense>`, with a
  fallback shaped like the real content (right column count, right row
  count) via two new shared helpers: `TableRowsSkeleton` and
  `ListRowsSkeleton` (`src/components/table-rows-skeleton.tsx`).
- Where a count appears in a subheading (e.g. "12 questions"), that text is
  now its own `Suspense`-wrapped subcomponent so the page title above it
  isn't blocked on the fetch.

`StatCard` (`src/components/stat-card.tsx`) gained a `loading` prop that
renders a `Skeleton` in place of the value only, keeping the label
static — reused by both the dashboard and the analytics KPI row.

## Not changed (out of scope)

- **`admin/teams`**, **`admin/users`**: these pages have no static shell of
  their own — the entire page is a single client-side "manager" component
  fed by the fetched data as props (e.g. `TeamsManager`, `UsersManager`).
  There's nothing to render ahead of the data, so a skeleton wouldn't add
  value; they already comply by having nothing to fake.
- **Single-record detail/edit pages** (e.g. `admin/analytics/[quizId]`,
  `admin/results/[attemptId]`, quiz/question edit forms): the page's own
  heading is derived from the fetched record (e.g. `{quiz.title}`), so
  there's no literal static label to peel off from the data fetch. These
  still fall back to the minimal segment-level spinner while the record
  loads.
