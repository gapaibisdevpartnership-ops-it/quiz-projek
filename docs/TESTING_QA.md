# Testing and QA

## Required Test Layers

- unit tests;
- integration/domain tests;
- database/RLS tests;
- end-to-end critical flows;
- production smoke test.

## Authentication

Verify:

- valid login;
- invalid login;
- logout;
- session refresh;
- inactive user handling;
- unauthenticated route protection.

## Role Authorization

Verify:

- sales denied admin routes;
- sales denied admin data at database level;
- admin can access expected features;
- cross-user attempt isolation.

## Quiz Builder

Verify admin can:

- create quiz;
- edit quiz;
- archive quiz;
- add questions;
- reorder questions;
- remove question from quiz;
- preview;
- publish.

## Dynamic Answer Options

Test:

- 2 options;
- 3 options;
- 4 options;
- 5 options;
- 6+ options;
- add;
- edit;
- remove;
- reorder.

## Question Types

### Single Choice

- rejects fewer than 2 options;
- rejects zero correct;
- rejects multiple correct;
- valid question saves.

### Multiple Choice

- multiple correct answers;
- all-or-nothing scoring;
- extra incorrect selection fails.

### True / False

- one correct value;
- correct scoring.

### Essay

- autosave;
- submit;
- pending review;
- manual grade;
- feedback;
- final recalculation.

## Images

Verify:

- valid upload;
- preview;
- replace;
- remove;
- invalid MIME rejected;
- oversized file rejected;
- image rendered in quiz player;
- answer-option images rendered.

## Quiz Attempts

Verify:

- create attempt;
- resume attempt;
- refresh preserves progress;
- attempt number increments;
- max attempts enforced;
- concurrent start does not create invalid duplicate numbering;
- submitted attempt immutable.

## Timer

Verify:

- refresh does not reset;
- client clock manipulation does not bypass server enforcement;
- timeout behavior matches domain rule.

## Answer Security

Inspect network/database access.

Before allowed result disclosure, sales must not receive:

- `is_correct`;
- `sample_answer`;
- `grading_notes`;
- correct-answer payload.

## Submission

Verify:

- objective scoring correct;
- duplicate submit idempotent;
- server calculates score;
- client cannot submit arbitrary score;
- final pass/fail correct.

## Historical Integrity

Create attempt, then edit source question.

Verify existing attempt still shows original snapshot.

Also verify source archive does not destroy history.

## RLS Tests

At minimum:

- user A cannot read user B attempt;
- user A cannot update user B answer;
- sales cannot read hidden answer keys;
- sales cannot modify scoring;
- sales cannot grade essays;
- unauthenticated access denied.

## Responsive QA

Test:

- mobile quiz player;
- image scaling;
- answer touch targets;
- essay textarea;
- admin builder at common desktop widths;
- tables do not become unusable on smaller screens.

## Release Gate

Production release requires:

- migrations applied;
- RLS verified;
- no answer-key leakage;
- critical E2E flows pass;
- no unresolved critical/high data-integrity defects.
