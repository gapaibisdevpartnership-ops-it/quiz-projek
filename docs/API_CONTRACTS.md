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

## Expire Stale Attempts

System job, not a user-facing endpoint. Runs as `service_role` via
`public.expire_stale_attempts()` — driven by Vercel Cron
(`GET /api/cron/expire-attempts`, `Authorization: Bearer $CRON_SECRET`) or an
in-database `pg_cron` schedule.

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
