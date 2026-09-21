# Plan — Root domain (`/`) as the public quiz landing page

**Status:** ✅ Implemented and fully verified on `feature/root-domain-landing`.

## Context

Today the app's root URL (`/`) just does `redirect("/dashboard")`
(`src/app/page.tsx`) — a bare visitor gets bounced toward the staff
login. You want the opposite for candidates: anyone who opens the plain
domain (no `/assessment/<token>` path) should land directly on a
name-entry screen for one trainer-designated quiz, type their name,
click Start, answer, and submit — exactly today's guest/session-link
flow, just entered from `/` instead of a shared token link. Staff keep
using `/login` explicitly; per your choice, `/` always shows the quiz
landing regardless of login state — it never auto-redirects to
`/dashboard` anymore.

Confirmed with you: the trainer designates **one session link as
"homepage"** via a toggle (switchable anytime, no redeploy needed), and
`/` always shows the landing screen even for already-logged-in staff.

## Design

### 1. Migration `supabase/migrations/20260924090000_default_landing_session.sql`
- `assessment_sessions.is_default_landing boolean not null default false`.
- `create unique index assessment_sessions_default_landing_unique on
  public.assessment_sessions (is_default_landing) where
  is_default_landing;` — a partial unique index, so at most one row can
  ever be `true` at the database level. Directly precedented in this
  schema (`quiz_attempts_session_idx ... where session_id is not null`,
  `20260920090000_session_link_capacity.sql:31`).
- New `set_default_landing_session(target_session_id uuid, enabled
  boolean) returns void` — SECURITY DEFINER, `is_admin()`-gated. When
  `enabled`: unsets every row's flag, then sets the target's, inside one
  transaction (avoids ever having two `true` rows even momentarily, and
  sidesteps a race between two admins clicking at once). When not
  `enabled`: just clears the target's own flag.
- New `get_default_landing_session() returns jsonb` — a near-verbatim
  copy of `validate_session_token` (`20260920090000_session_link_capacity.sql:185-225`):
  same status/`starts_at`/`expires_at`/quiz-published checks, same
  `jsonb_build_object` payload (`quizId`, `quizTitle`, `instructions`,
  `durationMinutes`, `showResult`, `rosterRequired`), **plus `token`** in
  the payload (the client needs the real token to call
  `startGuestSession`, which is fully token-driven and needs no other
  changes — confirmed in `src/features/assessment/actions.ts:38-81`).
  Looks up `where is_default_landing = true` instead of `where token =
  target_token`; raises a new `NO_DEFAULT_LINK` when no row matches.
  `grant execute ... to anon, authenticated` — must be publicly callable,
  same as `validate_session_token`.

### 2. `src/features/assessment/service.ts`
New `getDefaultLandingSession(): Promise<ValidateResult & { token?: string }>`
(or a small sibling type extending `SessionInfo`/`ValidateResult` with
`token`), calling the new RPC — same shape/error-mapping pattern as the
existing `validateSessionToken` (`:24-54`), plus one new entry in
`ERROR_COPY` for `NO_DEFAULT_LINK` → something like "No assessment is
open here right now. Check back later."

### 3. `src/app/page.tsx` — replace the blind redirect
```tsx
export const dynamic = "force-dynamic";

export default async function RootPage() {
  const result = await getDefaultLandingSession();
  return (
    <div className="min-h-dvh bg-muted/40">
      <header>...BrandMark + ThemeToggle, same chrome as assessment/layout.tsx...</header>
      <div className="mx-auto w-full max-w-2xl p-4 sm:p-6">
        {result.ok ? (
          <CandidateEntryForm token={result.token} session={result.session} />
        ) : (
          <Alert>{result.error}</Alert>
        )}
      </div>
    </div>
  );
}
```
`<CandidateEntryForm>` needs **zero changes** — confirmed it only takes
`{ token, session }` props and its internal `startGuestSession`/
`router.push` calls are already fully token-driven
(`src/features/assessment/candidate-entry-form.tsx:13-32`); after
"Start", the browser naturally moves to
`/assessment/<token>/attempt/<attemptId>`, which already has its own
working layout/pages — only the *entry* screen moves to `/`, not the
whole in-progress-quiz flow. The header chrome is duplicated inline from
`src/app/assessment/layout.tsx:1-25` (a few lines — not worth a route
group restructure for this).
No middleware change needed — confirmed `src/lib/supabase/middleware.ts:48-58`
never special-cases `/` at all; it already falls through untouched to
whatever `page.tsx` does.

### 4. Admin UI — "Set as homepage" toggle
- `src/features/sessions/actions.ts` — new `setAsHomepage(quizId,
  sessionId, enabled: boolean)`, identical shape to `closeSession`/
  `reopenSession` (`:48-62`, `:87-101`) but calling the new RPC instead
  of a plain `.update(...)`.
- `src/features/sessions/session-links.tsx` — one more button next to
  Close/Reopen/Delete (`toggle` pattern at `:86-99`, button at
  `:268-275`), label "Set as homepage" / "Remove as homepage" depending
  on `s.isDefaultLanding`, plus a `Badge` (e.g. "Homepage") next to the
  existing status badge when true, so it's obvious at a glance which
  link is live at `/`. Add `isDefaultLanding: boolean` to the
  `AssessmentSession` type/mapping in `src/features/sessions/service.ts`
  (plain `select("*")` already returns the new column, just needs
  surfacing in the TS type).

### What does not change
- `showResult` (hide-score-from-candidate) — already fully wired
  end-to-end via the existing quiz-level toggle; confirmed no changes
  needed there.
- Everything about `/assessment/[token]/...` (entry via a real shared
  link) — untouched, keeps working exactly as today; `/` is an
  additional entry point for the one designated session, not a
  replacement.
- Staff login/dashboard flow — `/login` and post-login redirects are
  unaffected; only the bare `/` URL's behavior changes.

## Verification
`npm run lint && npm run typecheck && npm test && npm run build`, then
manual with disposable dummy data:
1. With no session marked as homepage, visit `/` — confirm the graceful
   "No assessment is open here right now" message, not an error page.
2. Mark a dummy published quiz's session link as homepage from
   `/admin/quizzes/[id]` — visit `/` — confirm the exact same landing
   (title/instructions/duration) a normal `/assessment/<token>` visit
   would show, type a name, submit an answer, confirm the URL moves to
   `/assessment/<token>/attempt/<id>` and the attempt completes exactly
   like the existing guest flow.
3. Confirm the result stays hidden if the quiz's "Show result" is off,
   and that only admin/trainer/spv sees it in `/admin/results`.
4. Confirm an already-logged-in staff account visiting `/` **also** sees
   the quiz landing, not a dashboard redirect (per your explicit choice)
   — and that `/login` still reaches the real staff login normally.
5. Mark a second session as homepage — confirm the first one's flag
   automatically clears (only one `true` ever, verified via a direct DB
   query) and `/` now serves the second quiz.
6. Clean up all dummy data afterward, same discipline as every prior
   feature.

## Verification results

`npm run lint`, `npm run typecheck`, `npm test` (78 tests), `npm run
test:integration` (47 tests), `npm run test:chaos` (15 tests), and
`npm run build` (`/` now shows as `ƒ` dynamic, server-rendered on demand
— confirmed no accidental static caching) all green.

**Migration**: `20260924090000_default_landing_session.sql` applied to
production after a confirmed backup, `supabase migration list`
re-checked for drift immediately before push (clean both times).
Confirmed post-apply every existing session defaulted to
`is_default_landing: false` — no existing data touched.

Manual verification via Playwright against the real UI, using a
disposable `DUMMY Root Landing Quiz` (one single-choice question,
`show_result: false`) and its session link, both cleaned up afterward
(including the 3 guest profiles created while taking the quiz — final
`ilike '%DUMMY%'` sweep confirmed clean, and confirmed no session was
left with `is_default_landing: true` after cleanup):

1. **No default configured** — `/` showed the graceful "No assessment is
   open here right now. Check back later." message, not an error page or
   404.
2. **Toggling homepage from the real admin UI** — note: the quiz detail
   page was restructured into tabs by earlier, unrelated work
   (`/admin/quizzes/[id]`'s "Session links" is now a tab, not a stacked
   card) — clicking that tab then "Set as homepage" correctly set the
   flag; the row immediately showed a "Homepage" badge and the button
   flipped to "Remove as homepage".
3. **`/` serves the designated quiz** — visiting `/` rendered the exact
   same landing (`DUMMY Root Landing Quiz`, its instructions) a normal
   `/assessment/<token>` visit would show; `<CandidateEntryForm>` worked
   completely unchanged.
4. **Full candidate flow from `/`** — typed a name, clicked Start,
   answered the question, submitted — the browser correctly moved to
   `/assessment/<token>/attempt/<id>` then
   `/assessment/<token>/result/<id>` (only the entry step is at `/`, the
   rest of the flow is the pre-existing guest pages, untouched).
5. **Result hidden as designed** — the result page showed only
   `Status: submitted`, no score, with "The trainer has not enabled
   score display for this assessment." — confirming the existing
   quiz-level `show_result` toggle (no new code needed there, as
   explained earlier) works identically when entered via `/`.
6. **Admin sees the result** — `/admin/results` showed the quiz title
   and the candidate's name, full score data included.
7. **Logged-in staff at `/`** — a trainer account already signed in and
   visiting `/` still saw the quiz landing (not a dashboard redirect,
   and no admin sidebar rendered), exactly per your explicit choice;
   `/login` remained reachable normally.
8. **Single-default enforcement** — marking a second session as homepage
   (via a direct RPC call, mirroring what the UI button does)
   automatically cleared the first — confirmed via a direct DB query
   that only one row across the whole table had `is_default_landing:
   true` at any point, matching the partial unique index's guarantee.
