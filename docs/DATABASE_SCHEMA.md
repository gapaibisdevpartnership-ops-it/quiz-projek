# Database Schema

This file defines the recommended logical schema. Exact SQL migrations remain authoritative.

## Core Tables

```text
profiles
teams
team_members

quiz_categories
quizzes

questions
question_options
quiz_questions

quiz_assignments

quiz_attempts
attempt_questions
attempt_question_options
attempt_answers
attempt_answer_options
```

## profiles

```text
id uuid primary key
user_id uuid unique not null
full_name text not null
email text not null
role text not null
status text not null
created_at timestamptz not null
updated_at timestamptz not null
```

Recommended role values:

- super_admin
- admin
- sales

Recommended status:

- active
- inactive

## teams

```text
id uuid primary key
name text not null
description text
is_active boolean not null default true
created_at timestamptz not null
updated_at timestamptz not null
```

## team_members

```text
id uuid primary key
team_id uuid not null
user_id uuid not null
joined_at timestamptz not null
```

Recommended unique constraint:

```text
unique(team_id, user_id)
```

## quiz_categories

```text
id uuid primary key
name text not null
description text
is_active boolean not null default true
created_at timestamptz not null
```

## quizzes

```text
id uuid primary key
category_id uuid
title text not null
description text
instructions text
cover_image_url text

status text not null

duration_minutes integer
passing_score numeric not null
max_attempts integer not null

shuffle_questions boolean not null default false
shuffle_answers boolean not null default false

show_result boolean not null default true
show_correct_answer boolean not null default false

start_at timestamptz
end_at timestamptz

created_by uuid not null
created_at timestamptz not null
updated_at timestamptz not null
```

Constraints should enforce:

- passing_score between 0 and 100;
- max_attempts >= 1;
- duration_minutes > 0 when not null;
- end_at > start_at when both exist.

## questions

```text
id uuid primary key
category_id uuid
question_type text not null

question_text text
question_image_url text

difficulty text
explanation text

sample_answer text
grading_notes text
keywords text -- comma-separated, advisory grading hint only (docs/ESSAY_KEYWORD_HINT_PLAN.md); answer-key-adjacent

status text not null

created_by uuid not null
created_at timestamptz not null
updated_at timestamptz not null
```

Recommended question statuses:

- active
- archived

## question_options

```text
id uuid primary key
question_id uuid not null
answer_text text
image_url text
is_correct boolean not null default false
sort_order integer not null
created_at timestamptz not null
updated_at timestamptz not null
```

Constraint:

At least `answer_text` or `image_url` must be non-null.

## quiz_questions

```text
id uuid primary key
quiz_id uuid not null
question_id uuid not null
points numeric not null
sort_order integer not null
```

Recommended constraints:

```text
unique(quiz_id, question_id)
points > 0
```

## quiz_assignments

```text
id uuid primary key
quiz_id uuid not null
user_id uuid
team_id uuid
assigned_by uuid not null
assigned_at timestamptz not null
due_at timestamptz
```

Constraint should ensure exactly one target mode is used:

- user assignment; or
- team assignment.

## quiz_attempts

```text
id uuid primary key
quiz_id uuid not null
user_id uuid not null
attempt_number integer not null
status text not null

started_at timestamptz not null
submitted_at timestamptz

auto_score numeric
manual_score numeric
final_score numeric
total_points numeric

percentage numeric
passed boolean

requires_manual_grading boolean not null default false
time_spent_seconds integer

created_at timestamptz not null
```

Recommended unique:

```text
unique(quiz_id, user_id, attempt_number)
```

`status` values: `in_progress`, `pending_review`, `submitted`, `expired`.
(`expired` is reserved; the current sweep finalises to `submitted` /
`pending_review` — see below.)

### Functions — attempt lifecycle

- `attempt_deadline(attempt) -> timestamptz` — the earlier of
  `started_at + quiz.duration_minutes` and `quiz.end_at`; `null` when the quiz
  sets neither.
- `expire_stale_attempts() -> integer` — `service_role` only. Finalises every
  `in_progress` attempt past its `attempt_deadline` using the Submit Quiz
  Attempt scoring path, stamping `submitted_at` at the deadline. See
  `supabase/migrations/20260907150000_attempt_expiry.sql` and
  `docs/API_CONTRACTS.md` ("Expire Stale Attempts").

## attempt_questions

```text
id uuid primary key
attempt_id uuid not null
source_question_id uuid

question_type text not null
question_text text
question_image_url text

points numeric not null
sort_order integer not null

explanation text
sample_answer text
grading_notes text
keywords text
```

Sensitive fields such as correct-answer metadata and grading notes must not be selectable by unauthorized sales queries. `keywords` is answer-key-adjacent for the same reason and must not be selectable by sales either.

## attempt_question_options

```text
id uuid primary key
attempt_question_id uuid not null
source_option_id uuid

answer_text text
image_url text

is_correct boolean not null
sort_order integer not null
```

## attempt_answers

```text
id uuid primary key
attempt_id uuid not null
attempt_question_id uuid not null

essay_answer text

manual_score numeric
grader_feedback text
graded_by uuid
graded_at timestamptz

created_at timestamptz not null
updated_at timestamptz not null
```

Recommended:

```text
unique(attempt_id, attempt_question_id)
```

## attempt_answer_options

```text
id uuid primary key
attempt_answer_id uuid not null
attempt_question_option_id uuid not null
created_at timestamptz not null
```

Recommended unique:

```text
unique(attempt_answer_id, attempt_question_option_id)
```

## Index Recommendations

At minimum review indexes for:

- quizzes(status);
- quiz_assignments(quiz_id);
- quiz_assignments(user_id);
- quiz_assignments(team_id);
- quiz_attempts(user_id, quiz_id);
- quiz_attempts(status);
- attempt_questions(attempt_id, sort_order);
- attempt_answers(attempt_id);
- question_options(question_id, sort_order);
- quiz_questions(quiz_id, sort_order).

## Delete Policy

Prefer restrictive foreign keys and archive states.

Historical attempt data should not cascade-delete because a source quiz/question is removed from active use.
