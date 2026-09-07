# Architecture

## System Overview

```text
Browser
  |
  v
Next.js Application on Vercel
  |
  +--> Supabase Auth
  |
  +--> Supabase PostgreSQL
  |
  +--> Supabase Storage
```

## Frontend

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- shadcn/ui

Recommended data and form stack:

- TanStack Query
- React Hook Form
- Zod

## Backend Responsibilities

Backend behavior is split across:

1. Next.js server-side code where application orchestration is appropriate.
2. Supabase PostgreSQL for data integrity.
3. Supabase RLS for authorization.
4. PostgreSQL functions/RPC for transactional quiz operations.

## Recommended Source Structure

```text
src/
  app/
    (auth)/
    (sales)/
    admin/

  components/
    ui/

  features/
    auth/
    users/
    teams/
    quizzes/
    questions/
    attempts/
    grading/
    analytics/

  lib/
    supabase/
    auth/
    permissions/
    validation/
    errors/

  types/
```

## Architecture Principles

### Domain logic must not live only in UI

Examples:

- attempt limit enforcement;
- quiz availability;
- scoring;
- submitted-attempt immutability.

These must be protected server-side/database-side.

### Snapshot historical data

Quiz attempts must not read mutable question content as historical truth.

At attempt creation, snapshot:

- question text;
- question type;
- question image;
- question points;
- answer options;
- answer-option images;
- correct-answer metadata used by server scoring.

### Controlled operations

Use dedicated RPC/server operations for:

- starting attempts;
- submitting attempts;
- manual essay grading;
- final score recalculation.

### Storage

Use Supabase Storage bucket:

`quiz-assets`

Suggested paths:

```text
quiz-covers/{quiz_id}/{uuid}.webp
questions/{question_id}/{uuid}.webp
question-options/{option_id}/{uuid}.webp
```

Do not treat original filenames as unique identifiers.
