# Test Accounts

Deterministic QA users on the Supabase project `fvymroovientdoixbhff`
(created via the Supabase Admin API; the `handle_new_user` trigger fills in
`profiles`). Do **not** use these for anything real.

Login: https://quiz-projek.vercel.app/login (or `npm run dev` → http://localhost:3000)

## Shared password

```
QuizQA!2026
```

These QA accounts are seeded with `must_change_password = false`, so they skip
the forced first-login password change. Real users created through the Users
screen get a temporary password from the admin and must change it on first
sign-in (Opsi A — there is no email reset; `/forgot-password` just points to an
admin).

## Accounts

| # | Name | Email | Role | Status | Can do |
| - | --- | --- | --- | --- | --- |
| 1 | Super Admin QA | `superadmin.qa@example.com` | `super_admin` | active | Everything: manage admins/trainers/sales, teams, quizzes, questions, assignments, all results, grading, analytics, settings |
| 2 | Trainer QA | `trainer.qa@example.com` | `admin` | active | Trainer workspace: question bank, quiz builder, assign quizzes, review results, grade essays, analytics. **No** user administration beyond what a trainer needs |
| 3 | Sales QA 01 | `sales.qa01@example.com` | `sales` | active | Sales app only: assigned quizzes, take/resume attempts, own history, leaderboard. Blocked from `/admin/*` and from reading answer keys |
| 4 | Sales QA 02 | `sales.qa02@example.com` | `sales` | active | Same as Sales QA 01 — the second sales user is for cross-user isolation testing (user A must not see user B's attempts) |

`super_admin` and `admin` are both "admin roles" in code
(`isAdminRole()` in `src/lib/constants.ts`) and currently share the same UI and
RLS access. A dedicated super-admin-only surface can be added later if a
requirement calls for it.

## What each role sees after login

- **`super_admin` / `admin`** → trainer dashboard; nav: Dashboard, Quizzes,
  Question Bank, Users, Teams, Results, Grading, Analytics. `/admin/*` allowed.
- **`sales`** → sales dashboard; nav: Dashboard, Quizzes, History, Leaderboard,
  Profile. Visiting any `/admin/*` route redirects to `/dashboard`.

## Recreating / adding accounts

There is no public sign-up (`docs/SECURITY_RLS.md`). Create users with the
Admin API (needs `SUPABASE_SERVICE_ROLE_KEY`):

```bash
curl -s -X POST "$NEXT_PUBLIC_SUPABASE_URL/auth/v1/admin/users" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
        "email": "someone.qa@example.com",
        "password": "QuizQA!2026",
        "email_confirm": true,
        "user_metadata": { "full_name": "Someone QA", "role": "sales" }
      }'
```

`user_metadata.role` must be one of `super_admin` | `admin` | `sales`. To
change a role afterwards, in the Supabase SQL editor:

```sql
update public.profiles set role = 'admin' where email = 'someone.qa@example.com';
```

To disable an account without deleting it:

```sql
update public.profiles set status = 'inactive' where email = 'someone.qa@example.com';
```

An inactive user is signed out at login and sent to `/inactive`.

## Where else this is referenced

- `tests/helpers/seed.ts` — the same list, used by integration and E2E tests.
- `docs/TESTING.md` — testing how-to.
- `docs/reports/TESTING_SETUP_REPORT.md` — when/how they were created.
