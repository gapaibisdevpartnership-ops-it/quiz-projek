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
assessment_sessions

quiz_attempts
attempt_questions
attempt_question_options
attempt_answers
attempt_answer_options
```

## profiles

```text
id uuid primary key
user_id uuid unique not null references auth.users(id) on delete cascade
full_name text not null
email text not null
role text not null
status text not null
must_change_password boolean not null default false
is_guest boolean not null default false
can_manage_sessions boolean not null default false -- legacy, unused by the current UI
created_at timestamptz not null
updated_at timestamptz not null
```

Role values (`profiles_role_check`):

- super_admin — full access, plus permanent (hard-)delete of users,
  questions, quizzes, teams, session links, categories.
- admin (Trainer) — create/manage everything except hard-delete and user
  role/status changes below super_admin's own guardrails.
- sales — quiz-taker.
- spv (Supervisor) — read-only results, no create/manage access
  anywhere; enforced via a dedicated `is_results_viewer()` RLS path, not
  `is_admin()`.

`is_guest = true` marks a row created via Supabase Anonymous Auth for
the public session-link flow — excluded from the sales leaderboard and
from the account-based app shell.

Status values:

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
strict_timing_enabled boolean not null default false -- "Realistic timed mode" opt-in

start_at timestamptz
end_at timestamptz

created_by uuid references auth.users(id) on delete set null
created_at timestamptz not null
updated_at timestamptz not null
```

Constraints should enforce:

- passing_score between 0 and 100;
- max_attempts >= 1;
- duration_minutes > 0 when not null;
- end_at > start_at when both exist.

`created_by` is `on delete set null` — deleting the authoring
admin/trainer (super-admin-only) leaves the quiz intact, unattributed.

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

created_by uuid references auth.users(id) on delete set null
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
quiz_id uuid not null references quizzes(id) on delete cascade
question_id uuid not null references questions(id) on delete restrict
points numeric not null
sort_order integer not null
time_limit_seconds integer -- "Realistic timed mode"; null = no per-question limit
```

Recommended constraints:

```text
unique(quiz_id, question_id)
points > 0
time_limit_seconds is null or time_limit_seconds > 0
```

`question_id` is `on delete restrict` — a question attached to any quiz
cannot be hard-deleted from the bank until removed from every quiz first
(the app surfaces this as a friendly error, not a raw FK message).

## quiz_assignments

```text
id uuid primary key
quiz_id uuid not null references quizzes(id) on delete cascade
user_id uuid
team_id uuid references teams(id) on delete cascade
assigned_by uuid references auth.users(id) on delete set null
assigned_at timestamptz not null
due_at timestamptz
```

Constraint should ensure exactly one target mode is used:

- user assignment; or
- team assignment.

## assessment_sessions

Public, token-based, no-account entry points into one quiz — the
"session link" feature (`docs/PUBLIC_SESSION_LINK_PLAN.md`,
`docs/SESSION_LINK_CAPACITY_PLAN.md`, `docs/ROOT_DOMAIN_LANDING_PLAN.md`).

```text
id uuid primary key
quiz_id uuid not null references quizzes(id) on delete cascade
token text not null unique
label text
candidate_roster text[] -- null = open to anyone with the link
status text not null default 'active' -- 'active' | 'closed'
max_candidates integer
max_attempts_override integer -- falls back to quizzes.max_attempts when null
starts_at timestamptz
expires_at timestamptz
is_default_landing boolean not null default false -- the "homepage" link
created_by uuid not null references auth.users(id) on delete cascade
created_at timestamptz not null
```

At most one row across the whole table can have
`is_default_landing = true` — enforced by a partial unique index
(`create unique index ... on assessment_sessions (is_default_landing)
where is_default_landing`), not just application logic. All public
reads/writes go through `SECURITY DEFINER` RPCs
(`validate_session_token`, `get_default_landing_session`,
`start_guest_quiz_attempt`, `set_default_landing_session`) — there is no
direct anon-facing RLS policy on this table.

## quiz_attempts

```text
id uuid primary key
quiz_id uuid not null references quizzes(id) on delete restrict
user_id uuid not null
session_id uuid references assessment_sessions(id) on delete set null -- set only for guest/session-link attempts
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

`quiz_id` is `on delete restrict` — a quiz with any attempt (including a
guest one) cannot be hard-deleted, only archived; the app surfaces this
as a friendly error. `session_id` is `on delete set null` — deleting a
session link never touches the attempts made through it, only the
attribution.

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
source_question_id uuid -- bare uuid, no FK: snapshot is independent of the live question

question_type text not null
question_text text
question_image_url text

points numeric not null
sort_order integer not null

explanation text
sample_answer text
grading_notes text
keywords text

time_limit_seconds integer -- snapshotted from quiz_questions at attempt-start
viewed_at timestamptz -- when the candidate first reached this question (anchors its countdown)
locked_at timestamptz -- set once left/timed-out/submitted; save_objective_answer/save_essay_answer reject writes once set
```

Sensitive fields such as correct-answer metadata and grading notes must not be selectable by unauthorized sales queries. `keywords` is answer-key-adjacent for the same reason and must not be selectable by sales either.

`source_question_id` deliberately has no foreign key — historical
attempts stay fully readable even if the source question is later
hard-deleted (see "Delete Policy").

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

Prefer restrictive foreign keys and archive states — implemented, not
just recommended: `quiz_questions.question_id` and
`quiz_attempts.quiz_id` are `on delete restrict`, so a question in use
or a quiz with any attempt history cannot be hard-deleted at all
(the app surfaces a friendly error, never a raw FK message).

Historical attempt data does not cascade-delete because a source
quiz/question is removed from active use — `attempt_questions` snapshots
question content independently (no FK on `source_question_id`), and
authorship columns (`created_by`, `assigned_by`, `graded_by`,
`assessment_sessions.created_by`) are `on delete set null`/`cascade`
appropriately, not `restrict`, so deleting the *user* who authored
something never blocks that deletion or destroys the content.

**Super-admin-only hard delete** (`docs/HARD_DELETE_USER_PLAN.md`,
`docs/HARD_DELETE_ENTITIES_PLAN.md`) exists for: users, questions,
quizzes, teams, session links (`assessment_sessions`), and categories.
Every other role keeps only the pre-existing soft-delete/status toggles
(`profiles.status`, `quizzes.status`, `questions.status`,
`teams.is_active`, `assessment_sessions.status`).
