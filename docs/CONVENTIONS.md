# Engineering Conventions

## TypeScript

Use strict typing.

Prefer domain unions over arbitrary strings.

Example:

```ts
type QuizStatus = "draft" | "published" | "archived";
type AttemptStatus =
  | "in_progress"
  | "pending_review"
  | "submitted"
  | "expired";
```

## Naming

Database:

- snake_case.

TypeScript:

- camelCase variables;
- PascalCase components/types.

## Business Constants

Centralize:

- roles;
- statuses;
- question types;
- supported asset MIME types.

Avoid scattered magic strings.

## Validation

Use shared Zod schemas for:

- forms;
- server inputs;
- reusable domain validation.

Database constraints remain the final integrity layer.

## Error Handling

Translate low-level failures into domain errors.

Examples:

- `QUIZ_NOT_AVAILABLE`
- `ATTEMPT_LIMIT_REACHED`
- `ATTEMPT_ALREADY_SUBMITTED`
- `ANSWER_SAVE_FAILED`
- `UNAUTHORIZED_GRADING`

## Components

Prefer focused components.

Do not place data access, scoring, authorization, and rendering in one component.

## Data Access

Centralize data access by feature.

Avoid arbitrary Supabase queries directly throughout UI components.

## Migrations

Migration files are immutable after application to shared environments.

Create a new migration for changes.

## Comments

Use comments for non-obvious reasoning, not to restate code.

## Scope

Do not introduce unrelated abstractions or features unless needed by current requirements.
