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

### Guest (public session link)

- no account required — enters via a shareable session link (Supabase
  Anonymous Auth);
- can start/resume/submit an attempt on the quiz that link is scoped to,
  subject to the link's capacity, schedule, and per-candidate attempt
  overrides set by the trainer;
- has no access to the account-based app shell (dashboard, history,
  leaderboard, admin) — scoped strictly to the assessment flow at
  `/assessment/[token]`.

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
