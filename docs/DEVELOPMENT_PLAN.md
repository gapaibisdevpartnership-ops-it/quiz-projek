# Development Plan

## Phase 1 — Foundation

Build:

- Next.js application;
- Supabase integration;
- authentication;
- profiles;
- roles;
- route protection;
- base RLS;
- layout/navigation.

Exit criteria:

- authenticated app works;
- role routing works;
- RLS baseline verified.

## Phase 2 — Question Bank

Build:

- categories;
- question CRUD;
- single choice;
- multiple choice;
- true/false;
- essay;
- dynamic answer options;
- question image upload;
- option image upload;
- question validation.

Exit criteria:

- admin can build valid reusable questions without database access.

## Phase 3 — Quiz Builder

Build:

- quiz CRUD;
- settings;
- attach questions;
- reorder;
- points;
- preview;
- publish/archive.

Exit criteria:

- admin can produce a complete publishable quiz.

## Phase 4 — Users, Teams, Assignments

Build:

- user management;
- teams;
- team membership;
- individual assignment;
- team assignment.

Exit criteria:

- published quizzes can be correctly assigned.

## Phase 5 — Quiz Engine

Build:

- start attempt RPC;
- snapshots;
- quiz player;
- objective input;
- essay input;
- autosave;
- timer;
- resume;
- submit.

Exit criteria:

- sales can complete a quiz reliably.

## Phase 6 — Scoring and Grading

Build:

- server-side objective scoring;
- manual grading queue;
- trainer feedback;
- final score calculation;
- pass/fail;
- result page.

Exit criteria:

- objective and mixed essay quizzes finalize correctly.

## Phase 7 — Analytics

Build:

- admin KPI dashboard;
- quiz analytics;
- question analytics;
- sales performance;
- leaderboard.

## Phase 8 — Hardening

Perform:

- RLS audit;
- answer-key security audit;
- attempt-integrity tests;
- image-storage tests;
- responsive QA;
- production smoke testing;
- Vercel deployment validation.

## Implementation Rule

Do not jump to later phases if earlier-phase integrity is incomplete.

In particular, do not build analytics on top of unstable scoring or attempt models.
