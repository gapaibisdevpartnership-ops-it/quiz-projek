# Application Routes

## Public / Unauthenticated

```text
/                                    -- always the public quiz landing for whichever
                                         session link is marked "homepage" (docs/ROOT_DOMAIN_LANDING_PLAN.md);
                                         never redirects to /dashboard, regardless of login state
/login
/forgot-password
/reset-password
```

## Guest / Public Session Link (no account, Supabase Anonymous Auth)

```text
/assessment/[token]                              -- name-entry
/assessment/[token]/attempt/[attemptId]
/assessment/[token]/result/[attemptId]
```

Deliberately outside the `(app)` route group and the middleware's
protected-path list — no auth gate, no sidebar. A small "Staff login"
link appears only on the entry screens (`/`, `/assessment/[token]`),
never on the in-progress attempt or result pages.

## Sales

```text
/dashboard
/quizzes
/quizzes/:quizId
/quizzes/:quizId/start
/quizzes/:quizId/attempt/:attemptId
/quizzes/:quizId/result/:attemptId
/history
/leaderboard
/profile
/change-password
```

## Supervisor (spv) — read-only

```text
/admin/results
/admin/results/:attemptId          -- read-only: no grading form, static score/feedback text instead
```

spv lands on `/admin/results` immediately after login and cannot reach
any other `/admin/*` route (redirected to `/dashboard`, same as sales).

## Admin / Trainer (+ super_admin)

`/admin/*` is split into two gates: the outer `admin/layout.tsx` allows
admin/super_admin/spv through (so spv can reach `/admin/results`), and
everything below lives inside a nested `admin/(full-access)/` route
group with its own, stricter admin-only layout — the group segment does
not appear in the URL.

```text
/admin                                            -- redirects to /admin/quizzes (admin) or /admin/results (spv)

/admin/(full-access)/quizzes                      -- URL: /admin/quizzes
/admin/(full-access)/quizzes/new
/admin/(full-access)/quizzes/:quizId
/admin/(full-access)/quizzes/:quizId/edit
/admin/(full-access)/quizzes/:quizId/questions
/admin/(full-access)/quizzes/:quizId/preview

/admin/(full-access)/questions                    -- URL: /admin/questions
/admin/(full-access)/questions/new
/admin/(full-access)/questions/:questionId/edit

/admin/(full-access)/users                        -- URL: /admin/users
/admin/(full-access)/users/:userId

/admin/(full-access)/teams                        -- URL: /admin/teams

/admin/(full-access)/grading                      -- URL: /admin/grading
/admin/(full-access)/analytics                    -- URL: /admin/analytics
/admin/(full-access)/analytics/:quizId

/admin/results
/admin/results/:attemptId
```

## Other

```text
/inactive           -- shown instead of the app shell when profile.status = 'inactive'
/auth/callback
/api/health
/api/cron/expire-attempts
```

## Route Protection

Unauthenticated users:

- redirected to `/login` from every protected path prefix
  (`/dashboard`, `/quizzes`, `/history`, `/leaderboard`, `/profile`,
  `/admin`) — `src/lib/supabase/middleware.ts`.
- `/` and `/assessment/*` are never in that protected list; they're
  public by design and middleware never touches them.

Sales users:

- denied access to `/admin/*` entirely (bounced to `/dashboard`).

Supervisor (spv):

- denied access to every `/admin/*` route except `/admin/results` (same
  bounce-to-`/dashboard` behavior as sales for anything else).

Admin/Trainer/Super Admin:

- full access to `/admin/(full-access)/*` and `/admin/results`.
- only super_admin sees the permanent-delete actions (users, questions,
  quizzes, teams, session links, categories) — admin/trainer keeps only
  soft-delete/status toggles for the same entities.

Route guards are UX protections only. Database/server authorization
(RLS + `requireAdmin()`/`requireSuperAdmin()`/`requireResultsViewer()`
server-side checks) remains mandatory and is the real boundary.
