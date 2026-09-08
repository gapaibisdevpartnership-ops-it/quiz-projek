# UI / UX Specification

## Design Direction

- modern;
- professional;
- clean;
- friendly;
- training-oriented;
- low cognitive load.

## Branding & theme

- Product name: **GAPAI Mentorship**. Wordmark = a brand-yellow lightbulb +
  "GAPAI" (bold) + "mentorship" (`src/components/brand-mark.tsx`).
- Palette lives in `src/app/globals.css` as CSS variables (oklch):
  - **primary** — brand violet (hue ~300). Buttons, links, focus ring.
  - **brand** — the logo yellow (hue ~90). Accents only (the bulb; sidebar
    active/ring in some places). Never a large fill or body text.
  - neutrals carry a faint violet tint.
  - the left **sidebar** is a solid brand-violet panel in light mode.
- **Dark mode**: full `.dark` palette. `ThemeToggle`
  (`src/components/theme-toggle.tsx`) cycles light → dark → system and persists
  to `localStorage.theme`; an inline script in the root layout applies it before
  first paint (no flash). System is the default.

## Priority by Role

Sales:

- mobile-first.

Admin:

- desktop-first, responsive.

## Sales Dashboard

Show:

- Available Quiz
- In Progress
- Completed
- Average Score

Quiz card:

- title;
- category;
- question count;
- duration;
- passing score;
- deadline;
- status;
- primary CTA.

## Quiz Player

Header:

```text
Quiz Title
Question X of Y
Timer
```

Body:

```text
Question text
Question image
Answer input
```

Footer:

```text
Previous
Next
```

Navigator:

- answered;
- unanswered;
- current.

## Answer Option UX

Use large touch targets.

Options may display:

- text;
- image;
- both.

## Essay UX

- comfortable textarea height;
- save status;
- debounced autosave;
- character count when limits exist.

## Quiz Builder

Recommended layout:

```text
Quiz Header / Settings
----------------------
Question List
  Question 1
  Question 2
  Question 3

[ + Add Question ]
```

Question actions:

- edit;
- duplicate;
- reorder;
- remove from quiz.

## Question Editor

Fields:

- question type;
- question text;
- optional image;
- category;
- difficulty;
- points;
- answer options when relevant;
- explanation;
- essay grading fields when relevant.

## Dynamic Options

Admin can:

- add;
- remove;
- edit;
- reorder;
- upload option image;
- mark correct.

## Preview

Quiz preview must render the same question components used by Sales but must not create an attempt.

## Result States

Objective-only quiz:

- final score available immediately.

Quiz with essay:

- show `Pending Review`.

## Admin Dashboard

KPI suggestions:

- Total Sales
- Active Quiz
- Completed Attempts
- Pending Essay Reviews
- Average Score
- Pass Rate

## Required UI States

Every major async screen must distinguish:

- loading;
- empty;
- error;
- success.

Avoid blank screens.

## Error Messaging

Use user-readable messages:

- quiz not available;
- quiz expired;
- attempt limit reached;
- answer failed to save;
- session expired;
- grading failed.

Do not expose raw database errors directly to users.
