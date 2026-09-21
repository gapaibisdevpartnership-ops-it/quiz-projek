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
7. A question can be **duplicated** into a brand-new, independent question
   (`duplicateQuestion` — `docs/DUPLICATE_QUESTION_PLAN.md`): all fields and
   options are copied, the clone's text is prefixed `"Copy of "`, it always
   starts `status: active` and owned by the duplicating admin regardless of
   the source's status/owner, and it reuses the source's image URLs (no
   storage copy). The clone starts attached to no quiz. Duplicating a
   question never mutates the source, and — like editing it — can never
   affect any attempt, past or in progress (see "Historical Integrity").

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
- May have an optional comma-separated `keywords` hint
  (`docs/ESSAY_KEYWORD_HINT_PLAN.md`): shown to the grader as an advisory
  "Likely Correct / Partial match / Likely Incorrect" badge with a match
  count, plus "Mark Correct"/"Mark Wrong" shortcuts that pre-fill the score.
  This never writes a score by itself — the grader's own submission through
  `grade_essay_answer` is always the final and only authority.

## Assignments

A quiz can be assigned to:

- an individual user;
- a team.

Starting a quiz requires an active assignment (account-based flow only —
a session-link/guest attempt is authorized by the link's token instead,
not an assignment row).

## Session Links (guest, no-account access)

1. A session link is always scoped to exactly one quiz.
2. A candidate is identified only by the full name they type — no
   account, no password (backed by Supabase Anonymous Auth).
3. A link may restrict who can use it (a name roster), cap total
   distinct candidates, and/or override the quiz's own `max_attempts`
   per candidate — all optional, unset means unrestricted/inherit.
4. A link may have a scheduled open time and/or expiry; starting outside
   that window is rejected server-side, not just hidden in the UI.
5. Exactly one session link app-wide may be the **homepage** — the plain
   domain root always serves that link's entry screen. Marking a new one
   homepage automatically un-marks the previous one (enforced by a
   partial unique index, not just application logic).
6. Deleting a session link never deletes the attempts made through
   it — they keep their full result, just lose the "which link"
   attribution.

## Realistic Timed Mode (per-question time limit + lock)

Opt-in per quiz (`quizzes.strict_timing_enabled`, default off — every
quiz not explicitly enabling this behaves exactly as before).

1. A trainer may set an optional time limit (seconds) on each question
   within a quiz (`quiz_questions.time_limit_seconds`), snapshotted onto
   `attempt_questions` at attempt-start so a later edit never changes an
   attempt already in progress.
2. A question's countdown starts from when the candidate first reaches
   it (`attempt_questions.viewed_at`), not from attempt start — it
   survives a page reload.
3. A question locks (`attempt_questions.locked_at`) the moment the
   candidate moves *forward* past it (Next, or jumping ahead) or its own
   timer expires, or the whole attempt is submitted. Stepping *back* to
   glance at an earlier, already-locked question never locks whatever
   the candidate is still actively on.
4. Once locked, `save_objective_answer`/`save_essay_answer` reject
   further writes to that question server-side (`QUESTION_LOCKED`) —
   this is the real guarantee; the UI disabling inputs is just a
   reflection of it.
5. A locked question's answer stays visible (read-only) if the candidate
   navigates back to it — never hidden.
6. If a question's own timer expires, the player auto-advances to the
   next question (or auto-submits, if it was the last one).

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

## Schedule Validity (results indicator)

Every attempt on `/admin/results` shows a computed status — **within**,
**outside**, or **unknown** (no comparable window) — from comparing
`quiz_attempts.started_at` against its session link's
`starts_at`/`expires_at` (falling back to the quiz's own
`start_at`/`end_at` for account-based, non-session attempts, or when the
session was deleted — `on delete set null`). This is purely
informational: it never mutates `passed`, the score, or any stored
column. A trainer/SPV decides by eye whether an out-of-window result
should count.

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
