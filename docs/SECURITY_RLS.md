# Security and RLS

## Security Model

Supabase RLS is authoritative.

Frontend checks improve UX only.

## Authentication

Use Supabase Auth.

No public registration in V1.

Inactive users must not gain normal application access.

## Client Keys

Allowed in browser:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Forbidden in browser:

- `SUPABASE_SERVICE_ROLE_KEY`

Never prefix service-role credentials with `NEXT_PUBLIC_`.

## Sales Permissions

Sales may read:

- own profile;
- assigned published quizzes;
- own active/completed attempts;
- own permitted result data.

Sales may write:

- own active attempt answers through approved operations.

Sales must not:

- read other users' attempts;
- read hidden correct-answer data;
- read grading notes/sample answers before allowed;
- update score fields;
- update pass/fail;
- modify quiz configuration;
- modify questions;
- manually grade essays.

## Admin / Trainer Permissions

Authorized admins/trainers may:

- manage quizzes;
- manage questions;
- manage assignments;
- review attempts;
- grade essays;
- view analytics.

Authorization must still be enforced by RLS/server logic.

### User administration

- `profiles` has no direct client `UPDATE` policy. Name / role / status changes
  go only through `admin_update_user()` (`SECURITY DEFINER`), which re-checks
  authorization.
- Only a `super_admin` may grant or remove the `super_admin` role.
- An admin cannot demote or deactivate their own account; the system keeps at
  least one active `super_admin`.
- New accounts are always created as `sales` — `handle_new_user()` ignores any
  role supplied in auth user metadata.

### Passwords (Opsi A — no email/SMTP)

- No automated email reset. An admin sets a **temporary password** when creating
  a user, and can reset it later from the Users list (`resetUserPassword` →
  service-role Admin API). A plain admin cannot reset a `super_admin`'s
  password.
- `profiles.must_change_password` is set on both actions. While it is `true`,
  `(app)/layout.tsx` redirects the user to `/change-password`; they clear it by
  choosing their own password (`clear_must_change_password()`, keyed to
  `auth.uid()`), so the admin never holds a live credential.
- `/forgot-password` is informational only (directs the user to an admin).

## Answer-Key Protection

Before result disclosure is permitted, sales responses must not include:

- `is_correct`;
- `sample_answer`;
- `grading_notes`;
- raw answer-key data.

Do not fetch these and hide them in React.

They must be unavailable in the query/RPC result.

## Critical RPCs

Recommended:

```text
start_quiz_attempt(quiz_id)
submit_quiz_attempt(attempt_id)
grade_essay_answer(answer_id, score, feedback)
```

Each RPC must enforce authorization internally.

## Submitted Attempt Immutability

After status leaves `in_progress`, sales cannot:

- change selected options;
- change essay text;
- delete answers;
- restart the same attempt.

## Storage Security

Bucket: `quiz-assets`

Uploads:

- restricted to authorized admin/trainer flows;
- validate MIME type;
- validate size;
- generate paths server-side or safely;
- prevent arbitrary overwrite.

Public-vs-signed delivery should be selected intentionally.

If using public URLs, only store non-sensitive visual assets.

## Service Role Use

Service role should be rare.

Prefer RLS-safe authenticated operations.

If service role is required for a server-only administrative operation:

- execute only on trusted server;
- perform explicit authorization first;
- never expose the key;
- document why RLS cannot be used directly.

## Security Tests

Must verify:

- unauthenticated access denied;
- sales cannot access admin data;
- sales cannot inspect answer keys;
- sales cannot modify score;
- sales cannot modify submitted answers;
- user A cannot read user B attempts;
- graders cannot exceed allowed permissions;
- storage upload authorization works.
