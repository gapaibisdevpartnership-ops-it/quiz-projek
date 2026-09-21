# PRD — Sales Training Quiz Platform

## Product Summary

Sales Training Quiz Platform is an internal web application for sales training, assessment, and performance monitoring.

Admin/Trainer users can create, edit, configure, publish, assign, and review quizzes. Sales users can complete assigned quizzes through a mobile-friendly experience.

## Goals

- Make sales training measurable.
- Give trainers a no-code Quiz Builder.
- Support reusable question banks.
- Support objective and essay questions.
- Support images in questions and answer options.
- Store reliable attempt history.
- Prevent answer-key leakage.
- Provide individual, team, quiz, and question analytics.
- Let anyone reach a live assessment with zero account-creation friction
  — either via a shareable session link, or via the plain domain root
  acting as a standing public entry point for one trainer-designated
  quiz.
- Give supervisors a results-only view, separate from the trainer's
  full create/manage capability.
- Optionally simulate real-time, no-take-backs response pressure
  (per-question time limits with an answer lock), for roles like sales
  where realistic timing matters.

## Roles

### Super Admin

- manage admins/trainers/sales;
- manage teams;
- manage quizzes;
- manage questions;
- manage assignments;
- view all results;
- manual grading;
- analytics;
- system configuration;
- **permanently (hard-)delete** users, questions, quizzes, teams, session
  links, and categories — a distinct, super-admin-only action separate from
  the soft-delete/status toggles available to Admin/Trainer.

### Admin / Trainer

- create/edit/duplicate/archive quizzes;
- manage question bank;
- upload quiz assets;
- configure answer options;
- publish quizzes;
- assign quizzes;
- review results;
- manually grade essays;
- view analytics.

### Sales

- login;
- view assigned quizzes;
- start and resume attempts;
- answer questions;
- submit;
- view result when permitted;
- view history;
- view leaderboard when enabled.

Sales must not have access to admin features or answer keys before permitted.

### Supervisor (SPV)

- login, results-only: lands directly on `/admin/results` after sign-in,
  sidebar shows only "Results";
- read-only access to every attempt's full breakdown (score, per-question
  answers, the schedule-validity indicator);
- cannot create, edit, publish, assign, or grade anything — no access to
  Quiz Builder, Question Bank, Users, Teams, or Grading; an essay's
  manual score/feedback is shown as static text, never the grading form;
- enforced at the database level (RLS), not just hidden in the UI.

### Guest (public session link or root-domain landing)

- no account required — enters either via a shareable session link
  (`/assessment/[token]`, Supabase Anonymous Auth) or via the plain
  domain root (`/`), which always shows the entry screen for whichever
  one session link a trainer has marked "homepage" (at most one at a
  time);
- can start/resume/submit an attempt on the quiz that link is scoped to,
  subject to the link's capacity, schedule, and per-candidate attempt
  overrides set by the trainer;
- has no access to the account-based app shell (dashboard, history,
  leaderboard, admin) — scoped strictly to the assessment flow at
  `/assessment/[token]/...`; a small "Staff login" link on the entry
  screen only (never during an in-progress attempt or on the result
  page) points staff back to `/login`.

## V1 Question Types

- Single Choice
- Multiple Choice
- True / False
- Essay

Architecture must remain extensible for future question types.

## Media Support

Questions may contain an image.

Answer options may contain:

- text;
- image;
- both.

Supported formats:

- JPG
- JPEG
- PNG
- WEBP

Recommended max upload size: 5 MB.

## Dynamic Answer Options

Answer options are not limited to four choices.

Admin can:

- add;
- edit;
- remove;
- reorder;
- mark correct options.

## Scoring

Objective question types are scored automatically on the server.

Essay questions require manual grading.

A quiz containing essays remains `pending_review` until all required essay answers are graded.

## Public Session Links

A trainer generates a shareable, token-based link scoped to one quiz.
Anyone with the link types their full name and starts an attempt — no
account, no invite. Per link, a trainer can optionally set:

- a candidate-name allowlist (roster), or leave it open to anyone;
- a max-candidates cap and/or a per-candidate attempt-count override
  (falls back to the quiz's own `max_attempts` when unset);
- a scheduled open time and/or expiry.

Exactly one session link, across the whole app, can additionally be
marked the **homepage** — the plain domain root (`/`) always renders
that link's entry screen, so a candidate never needs the full
`/assessment/[token]` URL at all. Marking a different link as homepage
automatically un-marks the previous one.

## Realistic Timed Mode

Opt-in per quiz (off by default, zero effect on existing quizzes). When
enabled:

- a trainer may set a time limit (seconds) on any individual question in
  the builder;
- once a candidate leaves a question — clicking Next, its own timer
  expiring, or final submit — that question's answer locks and can never
  be changed again, enforced server-side, not just in the UI;
- stepping back to glance at an earlier (already-locked) question never
  locks whatever the candidate is still actively working on; only moving
  forward past a question, or that question's own timeout, locks it;
- a question with no time limit set simply has no countdown — it locks
  only when left.

This simulates a realistic no-take-backs response window (e.g. "you
can't unsend a reply to a customer").

## Schedule Validity

Every result on `/admin/results` shows a computed **On schedule** /
**Outside schedule** / — badge, comparing when the attempt was started
against its session link's (or, for account-based assignments, the
quiz's own) opens/expires window. Purely informational — it never
changes `passed`, the score, or any stored data; a trainer/SPV decides
by eye whether an out-of-window attempt should count. Most commonly
surfaces when a trainer edits a session's schedule after candidates have
already used it.

## Quiz Lifecycle

Quiz statuses:

- draft
- published
- archived

Attempts already started use immutable snapshots.

## Attempt Lifecycle

Attempt statuses:

- in_progress
- pending_review
- submitted
- expired

## Core Admin Flow

Login → Dashboard → Quiz Management → Quiz Builder → Configure Questions → Preview → Assign → Publish → Review Results → Grade Essays → Analytics

## Core Sales Flow

Login → Dashboard → Assigned Quiz → Start / Resume → Answer → Review → Submit → Result or Pending Review → History

## Core Supervisor Flow

Login → Results (only) → Open an attempt → Review score/answers/schedule-validity badge

## Core Guest Flow

Open a session link (or the plain domain root, if it's the marked
homepage) → Type full name → Start → Answer → Submit → Result (visible
only if the trainer enabled it for that quiz)

## Non-Goals V1

- AI question generation
- AI essay grading
- live multiplayer
- LMS course engine
- certificates
- video/audio question types
- native mobile application
- CRM
- HRIS
- payroll
- WhatsApp automation
- public registration
