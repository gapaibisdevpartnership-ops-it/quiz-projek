# Domain Rules

These rules are non-negotiable unless the product owner explicitly changes them.

## Quiz

1. New quizzes start as `draft`.
2. Only published quizzes can be started by sales.
3. Archived quizzes cannot create new attempts.
4. Quiz editing must not mutate snapshots used by existing attempts.
5. Removing a question from a quiz does not delete the source question from the question bank.

## Questions

1. A question can be reused in multiple quizzes.
2. Question types are represented by stable machine values.
3. Dynamic answer options are supported.
4. Objective questions require valid correct-answer configuration.
5. Essay questions do not use objective correct-answer scoring.
6. Question and answer-option media are optional.

## Single Choice

- Minimum 2 answer options.
- Exactly 1 option marked correct.

## Multiple Choice

- Minimum 2 answer options.
- At least 1 option marked correct.
- V1 scoring is all-or-nothing.

## True / False

- Exactly two logical options.
- Exactly one correct answer.

## Essay

- No objective correct answer required.
- Must have positive maximum points.
- May have sample answer and grading notes visible only to authorized graders.

## Assignments

A quiz can be assigned to:

- an individual user;
- a team.

Starting a quiz requires an active assignment.

## Attempts

1. An attempt belongs to exactly one quiz and one user.
2. Attempt number is authoritative server-side.
3. Attempt count must not exceed quiz `max_attempts`.
4. Starting an attempt must be transaction-safe.
5. Active attempts can be resumed.
6. Submitted attempts cannot be edited by sales.
7. Attempts cannot be hard-deleted through normal UI.

## Quiz Availability

Before starting:

- quiz must be published;
- assignment must exist;
- current time must satisfy quiz schedule;
- attempt limit must allow another attempt.

Recommended deadline rule:

A user cannot start a quiz after `end_at`. An attempt started before the deadline may continue until its duration expires unless business rules are changed explicitly.

## Autosave

Choice answers save immediately after selection.

Essay answers use debounced autosave.

Refreshing or closing the browser must not reset existing server-side progress.

## Timer

Timer authority is based on server timestamps, not browser state.

## Submission

Submission must be idempotent.

A second submission request must not duplicate scoring or change a finalized attempt.

## Scoring

Objective score is calculated server-side.

Client payload cannot authoritatively provide:

- score;
- percentage;
- pass/fail;
- correct-answer flags.

## Essay Review

If any essay remains ungraded:

`attempt.status = pending_review`

When all required essays are graded, calculate final score and pass/fail.

## Historical Integrity

Existing attempts must remain readable even when:

- source question is edited;
- source question is archived;
- answer text changes;
- quiz is archived;
- source images are replaced.

Do not remove storage objects that are still referenced by historical snapshots.
