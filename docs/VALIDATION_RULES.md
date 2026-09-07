# Validation Rules

Use shared Zod schemas where possible.

## Quiz

Required:

- title;
- status-compatible configuration;
- passing score;
- max attempts.

Rules:

```text
title: non-empty
passing_score: 0..100
max_attempts: integer >= 1
duration_minutes: integer > 0 when provided
end_at > start_at when both provided
```

## Question Base

At least one meaningful presentation element:

- question text; or
- question image.

## Single Choice

- minimum 2 answer options;
- exactly 1 correct option;
- every option has text or image;
- positive question points.

## Multiple Choice

- minimum 2 options;
- at least 1 correct;
- every option has text or image;
- positive points.

## True / False

- exactly two semantic options;
- exactly one correct;
- positive points.

## Essay

- positive points;
- optional minimum characters >= 0;
- optional maximum characters > minimum;
- no objective answer-option requirement.

## Answer Option

At least one:

- `answer_text`;
- `image_url`.

## Asset Upload

Allowed types:

- image/jpeg
- image/png
- image/webp

Recommended maximum:

5 MB.

## Manual Grade

```text
score >= 0
score <= question.points
```

## Autosave

Reject writes when:

- attempt is not active;
- caller is not owner;
- question is not part of attempt;
- option is not part of question.

## Server vs Client

Client validation is for usability.

Server/database validation is authoritative.
