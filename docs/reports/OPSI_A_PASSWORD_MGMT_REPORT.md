# Report — Opsi A: admin-managed passwords, no SMTP

**Date:** 2026-09-08
**Migration:** `supabase/migrations/20260908180000_must_change_password.sql`
(applied to the linked project)

## Goal

Let super admins / trainers run the quiz platform without any email/SMTP
dependency for account onboarding or recovery, while still forcing users to own
their own password.

## Decision

"Ya — versi aman": include the forced first-login password change so an admin
never holds a live user credential.

## Changes

### Database
- `profiles.must_change_password boolean not null default false`.
- `clear_must_change_password()` — `SECURITY DEFINER`, `search_path = public`,
  `EXECUTE` revoked from `public`/`anon`, granted to `authenticated`. Clears the
  flag for `auth.uid()` only (there is no client `UPDATE` policy on `profiles`).

### Server
- `src/features/users/actions.ts`
  - `inviteUser` — the temporary password is now **required** (min 8, entered by
    the admin); the generated-random fallback is gone. The new profile gets
    `must_change_password = true`.
  - `resetUserPassword(userId, { password })` — new action. `requireAdmin()`,
    then `admin.auth.admin.updateUserById` + `must_change_password = true`. A
    plain admin cannot reset a `super_admin`'s password.
- `src/features/auth/actions.ts` — `changeOwnPasswordAction`: `updateUser` +
  `clear_must_change_password()` RPC → `/dashboard`.
- `src/app/(app)/layout.tsx` — redirects to `/change-password` while
  `profile.mustChangePassword` (reuses the cached `requireProfile()` fetch — no
  extra query; the guard is deliberately in the layout, not middleware).
- `src/lib/validation/user.ts` — `password` required on `inviteUserSchema`;
  new `adminResetPasswordSchema`.
- `src/types/domain.ts` — `Profile.mustChangePassword` / `ProfileRow`.

### UI
- `src/app/change-password/page.tsx` + `src/features/auth/change-password-form.tsx`
  — a focused screen outside the app shell, with a "Sign out" escape.
- `src/features/users/users-manager.tsx` — invite form gains a "Temporary
  password" field; each user row gains a "Reset password" inline control; the
  "must change password" state is shown next to the email.
- `src/app/(auth)/forgot-password/page.tsx` — now informational ("ask an admin");
  the login link keeps a short hint. `forgotPasswordAction` /
  `resetPasswordAction` are left in place, dormant, for a future SMTP re-enable.

## Verification

- `npm run lint` / `npm run typecheck` — clean
- `npm test` — 56 unit pass (invite-schema test updated for the required password)
- `npm run build` — passes
- `npm run test:integration` — 43 pass, incl. a new case:
  `clear_must_change_password` clears only the caller's own flag
- `npm run test:e2e` — 12 pass
- Manual (Playwright, local): a user with a temp password + the flag is forced to
  `/change-password`, cannot reach `/dashboard` until they set a password, the
  flag then clears and they land on `/dashboard`. The Users screen shows the
  temp-password field and per-row reset control.

## Follow-ups

- QA seed users keep `must_change_password = false`; the seeding script in
  `docs/reports/TESTING_SETUP_REPORT.md` needs no change.
- If SMTP is configured later, re-wire `/forgot-password` to
  `forgotPasswordAction` (still present).
