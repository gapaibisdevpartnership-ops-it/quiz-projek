# P0 Security Report — user administration hardening

**Date:** 2026-09-08
**Backlog:** `docs/IMPROVEMENT_BACKLOG.md` P0 #1–3
**Migration:** `supabase/migrations/20260908160000_admin_user_rpc.sql` (applied to
the linked project)

## Findings addressed

1. **Any admin could rewrite any role via a direct PostgREST write.** The
   `profiles: admin updates` RLS policy allowed `UPDATE` of any column on any
   profile for any admin holding the browser anon key, bypassing every guard in
   `src/features/users/actions.ts`.
2. **No `super_admin`-only gate.** Any admin could grant/revoke `super_admin`,
   demote another super_admin, or deactivate admins; nothing kept an active
   super_admin around.
3. **`handle_new_user` trusted `raw_user_meta_data->>'role'`.** Any account
   provisioning path that set that metadata could self-assign `super_admin`.

## Changes

### Database

- `handle_new_user()` now always inserts `role = 'sales'` (metadata role
  ignored).
- The `profiles: admin updates` policy is **dropped**. There is no direct client
  `UPDATE` on `profiles`; an admin's `update profiles ...` now affects zero rows.
- New `admin_update_user(target_user_id, new_full_name, new_role, new_status)`
  — `SECURITY DEFINER`, `search_path = public`, `EXECUTE` revoked from
  `public`/`anon`, granted to `authenticated`. Enforces, raising `P0001`:
  `UNAUTHORIZED`, `INVALID_ROLE` / `INVALID_STATUS` / `INVALID_NAME`,
  `USER_NOT_FOUND`, `SUPER_ADMIN_REQUIRED` (grant/remove super_admin, or touch an
  existing super_admin, requires a super_admin actor), `CANNOT_DEMOTE_SELF`,
  `CANNOT_DEACTIVATE_SELF`, `LAST_SUPER_ADMIN` (blocks removing the last active
  super_admin).

### App

- `src/features/auth/service.ts` — added `requireSuperAdmin()`.
- `src/features/users/actions.ts`:
  - `updateUser` now calls `admin_update_user` via the caller's session client;
    RPC error codes are mapped to friendly copy; raw DB messages no longer
    surface.
  - `inviteUser` blocks a non-super_admin from creating a `super_admin`, creates
    the account with no role in metadata, then sets name + role with the service
    role (new account, so the RPC's self / last-super-admin guards don't apply).

## Verification

- `npm run lint` / `npm run typecheck` — clean
- `npm test` — 55 unit pass
- `npm run build` — passes
- `npm run test:integration` — `tests/integration/admin-user-security.test.ts`
  **9/9 pass** (metadata role ignored; direct PostgREST role write denied;
  admin blocked from granting super_admin / touching a super_admin / self-
  deactivate; admin can edit a normal user; super_admin can promote/demote;
  super_admin cannot self-demote).
- `npm run test:e2e` — auth + security specs pass (8).

## Known unrelated failure

`tests/integration/rls.test.ts` — "a sales user sees no quizzes without an
assignment" / "sees only their own assignments" now fail because the
`sales.qa01` QA account has three leftover quiz assignments from earlier manual
and UAT sessions ("quiz 1", "UAT 20260907 Quiz", "UAT 20260908-0550 Quiz").
These tests assume a pristine zero-assignment account; they touch only
`quizzes` / `quiz_assignments`, which this change does not modify. Fix by
clearing those stray assignments or by having the tests seed their own state
(backlog P3 #41).
