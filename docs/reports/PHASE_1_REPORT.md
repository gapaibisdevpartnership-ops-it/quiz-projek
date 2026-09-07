# Phase 1 Report — Foundation (Auth, Profiles, Roles, RLS Baseline)

**Date:** 2026-09-07
**Status:** 🟡 Code complete — database migration not yet applied (blocked, see below)

## Goal (from `docs/DEVELOPMENT_PLAN.md`)

Authenticated app, role-based routing, and a verified RLS baseline:
Next.js app, Supabase integration, authentication, profiles, roles, route
protection, base RLS, layout/navigation.

## Database

### Migration `supabase/migrations/20260907090000_foundation.sql`

Tables (per `docs/DATABASE_SCHEMA.md`):
- `public.profiles` — `user_id` unique → `auth.users`, `role`
  (`super_admin|admin|sales`), `status` (`active|inactive`), `full_name`,
  `email`, timestamps. Indexes on `role`, `status`.
- `public.teams` — `name`, `description`, `is_active`, timestamps.
- `public.team_members` — `unique(team_id, user_id)`, indexes on `user_id`
  and `team_id`.

Functions / triggers:
- `set_updated_at()` — `BEFORE UPDATE` trigger on `profiles` and `teams`.
- `handle_new_user()` — `SECURITY DEFINER`; `AFTER INSERT ON auth.users`
  creates the matching profile (`sales` / `active` by default, `full_name` /
  `role` read from `raw_user_meta_data`). No public registration — admins
  provision users via the Supabase dashboard/invite.
- `current_role()`, `is_admin()`, `is_active()` — `SECURITY DEFINER` helpers
  used by policies so they can read `profiles` without RLS recursion.

### RLS policies

| Table | Policy |
| --- | --- |
| `profiles` | user reads own row; admin reads all; admin insert/update |
| `teams` | admin full access; team member can read their own team |
| `team_members` | admin full access; user reads own membership |

Sales cannot see other users' profiles, cannot change roles/status, cannot
touch teams. Matches `docs/SECURITY_RLS.md`.

## Application code

### Domain / shared
- `src/lib/constants.ts` — `ROLES`, `USER_STATUSES`, `QUIZ_STATUSES`,
  `ATTEMPT_STATUSES`, `QUESTION_TYPES`, `ASSET_MIME_TYPES`, `MAX_ASSET_BYTES`,
  `STORAGE_BUCKET`, `isAdminRole()`.
- `src/types/domain.ts` — `Profile`, `Team`, `ProfileRow`, `mapProfile()`.
- `src/lib/errors/domain.ts` — `DomainError` + readable messages.
- `src/lib/validation/auth.ts` — Zod schemas: `signInSchema`,
  `forgotPasswordSchema`, `resetPasswordSchema`.

### Auth feature (`src/features/auth/`)
- `service.ts` — `getCurrentProfile()` (request-cached), `requireProfile()`
  (→ `/login` or `/inactive`), `requireAdmin()` (→ `/dashboard`).
- `actions.ts` — server actions: `signInAction` (rejects inactive accounts),
  `signOutAction`, `forgotPasswordAction` (no account enumeration),
  `resetPasswordAction`.
- `nav.ts` — role-based navigation model.

### Routing
- `src/middleware.ts` (via `src/lib/supabase/middleware.ts`) — refreshes the
  session, redirects unauthenticated users away from protected paths, and
  authenticated users away from auth paths. No-ops until `.env.local` is set.
- `(auth)` route group: `/login`, `/forgot-password`, `/reset-password` +
  centered layout.
- `src/app/auth/callback/route.ts` — PKCE code exchange for recovery/invite.
- `(app)` route group: shared layout calls `requireProfile()` and renders
  `AppShell` (role nav + sign out). Pages: `/dashboard` (role-aware KPIs
  placeholder), `/profile` (real profile view), plus placeholder pages for
  `/quizzes`, `/history`, `/leaderboard`.
- `(app)/admin` layout calls `requireAdmin()`; placeholder pages for
  `quizzes`, `questions`, `users`, `teams`, `results`, `grading`,
  `analytics`; `/admin` redirects to `/admin/quizzes`.
- `/inactive` — shown to signed-in users whose profile is not `active`.
- `/` redirects to `/dashboard`.

### UI primitives (`src/components/ui/`)
Hand-written shadcn-style `button`, `input`, `label`, `card`, `alert`, plus
`submit-button.tsx` (uses `useFormStatus`), `app-shell.tsx`, `placeholder.tsx`.

## Verification

- `npm run lint` — clean
- `npm run build` — passes; 23 routes compiled, middleware active
- Runtime auth flow not yet exercised end-to-end because the migration is not
  applied (no `profiles` table in the remote DB yet).

## Blocked / follow-ups

1. **Apply the migration.** `supabase db push` is blocked by the Claude Code
   auto-mode classifier and also needs the database password. Run locally:
   ```bash
   export SUPABASE_ACCESS_TOKEN=<token>
   npx supabase db push --linked
   ```
   or allow `Bash(npx supabase db push:*)` in Claude Code settings.
2. **Create the first user.** Supabase dashboard → Authentication → Add user
   (the `handle_new_user` trigger creates the profile). To make them an admin,
   update `profiles.role` to `admin` / `super_admin`.
3. **Manual RLS check** once data exists: sales user cannot read another
   profile; cannot read `teams`; admin can.
4. **GitHub push** still blocked on repo write access (see Phase 0 report).

## Next: Phase 2 — Question Bank

`quiz_categories`, `questions`, `question_options`, dynamic answer options,
image upload to `quiz-assets`, per-type validation.
