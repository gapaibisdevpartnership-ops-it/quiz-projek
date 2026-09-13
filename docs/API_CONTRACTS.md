# API and Server Operation Contracts

Exact implementation may use Next.js server actions, route handlers, or Supabase RPC. Domain behavior must follow these contracts.

## Start Quiz Attempt

### Input

```ts
{
  quizId: string
}
```

### Server Validations

- authenticated user;
- user active;
- quiz exists;
- quiz published;
- assignment exists;
- schedule valid;
- attempt count below max;
- no incompatible state.

### Operation

Transactionally:

1. determine next attempt number;
2. create attempt;
3. snapshot quiz questions;
4. snapshot answer options;
5. persist start timestamp;
6. return safe attempt payload.

### Must Not Return

- correct answer flags;
- sample answer;
- grading notes.

## Save Objective Answer

### Input

```ts
{
  attemptId: string;
  attemptQuestionId: string;
  selectedOptionIds: string[];
}
```

### Server Validations

- authenticated owner;
- attempt `in_progress`;
- question belongs to attempt;
- selected options belong to attempt question;
- question type compatible.

### Behavior

Replace current selected-option state atomically.

## Save Essay Answer

### Input

```ts
{
  attemptId: string;
  attemptQuestionId: string;
  essayAnswer: string;
}
```

### Server Validations

- authenticated owner;
- attempt active;
- question belongs to attempt;
- type is essay;
- length rules valid.

## Submit Quiz Attempt

### Input

```ts
{
  attemptId: string
}
```

### Behavior

1. authenticate;
2. validate ownership;
3. lock attempt;
4. verify `in_progress`;
5. enforce timer/server deadline rules;
6. calculate objective score;
7. detect essays;
8. set status:
   - `pending_review`, or
   - `submitted`;
9. calculate final score if possible;
10. persist submitted timestamp;
11. prevent duplicate mutation.

### Output

Safe result summary only.

## Grade Essay Answer

### Input

```ts
{
  answerId: string;
  score: number;
  feedback?: string;
}
```

### Validations

- authorized admin/trainer;
- answer exists;
- question type essay;
- score >= 0;
- score <= question points.

### Behavior

1. save manual score;
2. save feedback;
3. record grader;
4. record graded timestamp;
5. check remaining ungraded essays;
6. finalize attempt if all are graded.

## Update User (role / status / name)

`public.admin_update_user(target_user_id uuid, new_full_name text, new_role text, new_status text)`
— `SECURITY DEFINER`, `EXECUTE` granted to `authenticated`. The **only** supported
way to change a profile's role or status; there is no direct client `UPDATE`
policy on `profiles` any more.

### Validations (raised as `P0001`)

- `UNAUTHORIZED` — caller is not an active admin/super_admin;
- `INVALID_ROLE` / `INVALID_STATUS` / `INVALID_NAME`;
- `USER_NOT_FOUND`;
- `SUPER_ADMIN_REQUIRED` — only a super_admin may grant or remove `super_admin`
  (i.e. when the new role or the target's current role is `super_admin`);
- `CANNOT_DEMOTE_SELF` / `CANNOT_DEACTIVATE_SELF`;
- `LAST_SUPER_ADMIN` — the change would leave zero active super_admins.

### Behavior

Updates `full_name`, `role`, `status` on the target profile in one statement.
New accounts are always created as `sales` (`handle_new_user` ignores any role in
auth metadata); `inviteUser` then applies the chosen role with the service role.

## Reset User Password (admin)

`resetUserPassword(userId, { password })` server action — `requireAdmin()`.
Sets a new temporary password via the service-role Admin API and sets
`profiles.must_change_password = true`. A plain admin cannot reset a
`super_admin`'s password. No email is sent; the admin communicates the password
out of band.

## Change Own Password

`changeOwnPasswordAction` (form on `/change-password`) — the signed-in user sets
their own password (`supabase.auth.updateUser`) and the flag is cleared via
`clear_must_change_password()` (`SECURITY DEFINER`, `auth.uid()` only,
`EXECUTE` granted to `authenticated`). Used both for the forced first-login
change and voluntary changes. On success → `/dashboard`.

## Upload Quiz Asset

### Input

- file;
- logical owner type;
- owner ID.

### Validations

- authorized admin/trainer;
- accepted MIME;
- max size;
- safe generated path.

### Output

Asset location/reference.

## Duplicate Question (admin)

`duplicateQuestion(sourceId)` server action
(`src/features/questions/actions.ts`) — `requireAdmin()`. Not exposed as a
Supabase RPC; runs entirely server-side under the caller's own session, same
authorization boundary as `createQuestion`/`updateQuestion` (no dedicated
contract previously existed for those either — this is the first documented
question-bank action here).

### Input

- `sourceId` — id of an existing question.

### Behavior

1. Reads the source question + its options (admin-only RLS).
2. Builds a new question: every field copied, `question_text` prefixed
   `"Copy of "` and truncated to the schema's max length if needed, options
   copied with new ids, image URLs reused verbatim (no storage copy).
3. Validates the copy through the same `questionSchema` used by
   create/update.
4. Inserts the new `questions` row (`status` defaults to `active`,
   `created_by` = the acting admin) then its `question_options`, rolling back
   the question row if the options insert fails (same non-atomic pattern as
   `createQuestion` — `docs/IMPROVEMENT_BACKLOG.md` item 17).

### Output

`{ ok: true, id }` (the new question's id) or `{ ok: false, error }`.

### Must Not

- Mutate the source question or its options.
- Affect any `quiz_questions` row, or any past/in-progress attempt (attempts
  read a frozen snapshot, never the live question — see
  `docs/DOMAIN_RULES.md` "Historical Integrity").

## Expire Stale Attempts

System job, not a user-facing endpoint. `public.expire_stale_attempts()` —
scheduled in-database by `pg_cron` (`expire-stale-attempts`, every 5 min). The
`GET /api/cron/expire-attempts` route (`Authorization: Bearer $CRON_SECRET`,
service-role) remains as a manual / backup trigger. Vercel Cron is not used
(Hobby plan = daily only).

### Behavior

- Selects every `in_progress` attempt whose `attempt_deadline` — the earlier of
  `started_at + quiz.duration_minutes` and `quiz.end_at` — is in the past.
- Scores objective questions with the same rules as Submit Quiz Attempt.
- Stamps `submitted_at` at the deadline (not the sweep time) so
  `time_spent_seconds` reflects the allotted duration.
- Attempts containing an essay move to `pending_review`; the rest are finalised
  to `submitted` via `finalize_attempt`.
- Idempotent: only `in_progress` rows are touched. Attempts on quizzes with no
  duration and no `end_at` have no deadline and are never swept.

### Output

Count of attempts finalised.
