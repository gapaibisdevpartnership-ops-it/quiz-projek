# Local Time Display — Plan

## Why

Every timestamp in the app currently renders as absolute UTC (e.g.
`2026-09-19 14:00 UTC`) via `formatDateTimeUTC()` in `src/lib/format.ts`.
That's deliberate, not an oversight: Next.js renders the page on the server
first, then React "hydrates" it in the browser, and if the formatted string
differs between the two (server is UTC, browser is the viewer's local
timezone) React throws a hydration mismatch error. Using a fixed UTC string
everywhere sidesteps that by making server and client output identical.

The trade-off is that everyone reads times in UTC regardless of where they
are, which is unnecessary friction for trainers/sales in Indonesia reading
"14:00 UTC" instead of the WIB time they think in.

## Fix: a small client component, not a blanket format change

The standard fix for this exact problem: render the UTC string on the
first paint (matches the server output exactly, so hydration is clean),
then swap to the browser's local time right after mount via
`useEffect` — React allows a post-mount state update to change rendered
text without triggering a hydration warning, since the warning only fires
on the *initial* render mismatch.

### `src/components/local-time.tsx` (new)

- `"use client"` component: `<LocalTime iso={string | null | undefined} />`.
- Initial render: `formatDateTimeUTC(iso)` (identical to SSR output).
- `useEffect`: reformats using the browser's local timezone via native
  `Date` getters (`getFullYear`/`getMonth`/... instead of the UTC
  variants), same `YYYY-MM-DD HH:mm` shape so it still reads consistently
  with the rest of the app — just local instead of UTC, no `UTC` suffix
  since the absence of a timezone label implies "your local time" the way
  most apps do.
- Renders inside a `<time dateTime={iso}>` element with `title={formatDateTimeUTC(iso)}`
  — hovering shows the exact UTC value, useful for support/debugging
  without cluttering the visible UI.
- `iso == null` renders `—`, matching `formatDateTimeUTC`'s own behavior.

`formatDateTimeUTC` itself stays in `lib/format.ts` unchanged — `LocalTime`
uses it internally for the SSR-matching first paint and the tooltip.

## Call sites to update (9 total)

Swap `formatDateTimeUTC(x)` → `<LocalTime iso={x} />` in:

1. `src/components/recent-activity.tsx` — submission time.
2. `src/app/(app)/admin/results/page.tsx` — Submitted column.
3. `src/app/(app)/history/page.tsx` — per-attempt submitted time.
4. `src/app/(app)/quizzes/[quizId]/page.tsx` — Opens/Closes.
5. `src/app/(app)/quizzes/page.tsx` — Closes (quiz card).
6. `src/app/(app)/admin/grading/page.tsx` — "submitted …" line.
7. `src/app/(app)/admin/quizzes/[quizId]/page.tsx` — the Window fact
   (`Opens → Closes`, or "Always open"); this one's already typed as
   `[string, ReactNode][]` from an earlier Badge change, so it's a
   same-shape swap.
8. `src/app/(app)/admin/users/[userId]/page.tsx` — "Joined" — the facts
   array here is currently `[string, string][]`; needs retyping to
   `[string, ReactNode][]` (same pattern used elsewhere already) to hold a
   `<LocalTime>` element instead of a string.
9. `src/features/sessions/session-links.tsx` — "Created … · opens … ·
   expires …" — currently one plain template-literal string; becomes a
   small JSX fragment so each date can be its own `<LocalTime>`.

Each of these is a tiny leaf Client Component inside a Server Component
page — normal Next.js composition, doesn't force the parent page to become
a Client Component.

## Verification

`tsc --noEmit`, `eslint` on touched files, `npm run build` (full route
list, no errors) — same checks used for every pass so far.

## Implemented

Done as planned, plus one addition found while touching
`admin/users/[userId]/page.tsx`: its Role/Status facts were still plain
text (missed in the earlier Badge pass that covered the users list and
profile page) — brought in line with a `Badge` while the tuple array was
already being retyped to `ReactNode` for the `LocalTime` swap.

One lint finding during implementation: `react-hooks/set-state-in-effect`
flagged the `useEffect` in `LocalTime` that calls `setText`. This is
intentional — it's React's own documented pattern for a client-only value
that must differ from the SSR render (no external system to subscribe to)
— so it's suppressed on that line with a comment explaining why, not
restructured.

Verified: `tsc --noEmit` clean, `eslint` clean on all touched files,
`npm run build` clean (all routes, no errors).
