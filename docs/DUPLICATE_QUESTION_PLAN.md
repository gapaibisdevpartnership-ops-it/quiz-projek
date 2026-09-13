# Plan — Duplicate Question

**Status:** ✅ Implemented (2026-09-13) on `feature/duplicate-question`. See
`docs/reports/DUPLICATE_QUESTION_REPORT.md` for verification results. Kept
below for the design reasoning.

## Why

Trainers building the question bank often want a variant of an existing
question (same structure, different numbers/wording) without retyping options
and re-uploading images. Before this, `/admin/questions` only offered **Edit**
per row — there was no clone action anywhere in the app.

## Behavior

A **Duplicate** action next to **Edit** on each row in `/admin/questions`.
Clicking it:

1. Copies the question — all fields — plus every option, as new rows with new
   ids.
2. Prefixes the clone's `question_text` with **"Copy of "**, truncated to the
   schema's max length (4000 chars) if the combined string would overflow it
   — duplication always succeeds, it never silently fails just because the
   source was near the limit. An image-only question has no text to prefix,
   so it's left as-is (the list already shows `(image-only question)` for
   those).
3. Forces the clone to `status: "active"` (the DB default — not set
   explicitly) and `created_by` = the acting admin, regardless of the source
   question's status or original author.
4. Re-renders the same `/admin/questions` list (no navigation) — matching the
   existing create/update convention, which returns to the list rather than
   jumping into the editor. The admin opens **Edit** on the new row themselves
   to tweak it.

## Why this is safe

- `quiz_questions.question_id → questions(id)` (`supabase/migrations/20260907100000_quiz_builder.sql:53-60`)
  is a plain join row. A newly duplicated question starts attached to no quiz
  until an admin explicitly adds it via the Quiz Builder.
- Attempts never read `questions`/`question_options` live — starting an
  attempt **snapshots** their content into `attempt_questions` /
  `attempt_question_options` (`supabase/migrations/20260907120000_quiz_engine.sql`).
  So duplicating (like editing) the source question can never retroactively
  disturb an in-progress or already-completed attempt.
- Images: the `quiz-assets` storage bucket is public-read with no
  path-prefix policy tying an object to a specific question row
  (`supabase/migrations/20260907093000_question_bank.sql:106-149`). The clone
  safely **reuses the same image URL string** as the source — no storage
  object copy is needed.
- RLS on `questions`/`question_options` is admin-only for every operation
  (`... for all using (is_admin())`), same as every other question-bank
  mutation — duplication goes through the existing admin-only server-action
  path, never a sales-reachable one.

## Implementation

### Server action
`duplicateQuestion(sourceId: string): Promise<MutationResult>` in
`src/features/questions/actions.ts`, following the existing `createQuestion`
shape:

1. `requireAdmin()`.
2. `getQuestion(sourceId)` (`src/features/questions/service.ts`) — reused
   as-is.
3. Builds a `QuestionInput`-shaped payload from the fetched question +
   options (prefixed/truncated text, every other field copied as-is).
4. Validates through `questionSchema.safeParse` — defense in depth.
5. Inserts the new `questions` row, then the new `question_options` rows —
   same two-step pattern and manual-rollback-on-option-failure as
   `createQuestion`.
6. `revalidatePath("/admin/questions")`.

### UI
`src/features/questions/question-row-actions.tsx` — a small client component
(`useTransition`), replacing the bare "Edit" `<Link>` in the list row with
Edit + Duplicate. Shows an inline error on failure, disables the Duplicate
button while pending, `router.refresh()` on success. Chosen over a bare
`<form action={...}>` specifically so a failed duplicate is visible to the
admin and a fast double-click can't create two clones.

## Known trade-off (flagged, not fixed by this feature)

`createQuestion` and `updateQuestion` already perform
question-insert-then-options-insert as two separate calls, with manual
rollback on failure rather than one atomic transaction —
`docs/IMPROVEMENT_BACKLOG.md` item **17** already calls this out and
recommends a real RPC. `duplicateQuestion` follows that same existing pattern
for consistency rather than invent a third variant, so it inherits the same
(pre-existing, low-probability) non-atomicity risk.

## Verification

See `docs/reports/DUPLICATE_QUESTION_REPORT.md`.
