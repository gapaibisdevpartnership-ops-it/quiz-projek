# Plan — Essay keyword hint + quick Correct/Wrong grading

**Status:** ✅ Code complete on `feature/essay-keyword-hint`, migration
applied to production (2026-09-13, after a manual `pg_dump` backup — see
`docs/reports/DEPLOY_LOG.md`). Branch not merged to `main`, not deployed via
`vercel --prod` yet — that's a separate step. Kept below for the design
reasoning.

## Why

Grading essays today is 100% manual: trainer reads the trainee's answer,
optionally reads `sample_answer`/`grading_notes` for reference
(`src/app/(app)/admin/results/[attemptId]/page.tsx:69-92`), then types a
numeric score (`src/features/grading/essay-grade-form.tsx`). There is no
assist at all.

Per discussion, we're adding the **cheapest** assist — keyword matching, not
embeddings/LLM — as a **hint only**: it never writes a score itself. The
trainer still makes the final call, via the existing `grade_essay_answer`
RPC, exactly as today; keyword matching only pre-fills a suggestion badge
and two convenience buttons ("Mark Correct" / "Mark Wrong") that set the
score field to full points / 0 and submit through the same code path as
typing a number manually.

New field: **`keywords`** (plain nullable `text` column, comma-separated,
free-form on the trainer's side) — kept separate from `sample_answer`
because that field is prose meant for a human's eyes (confirmed: it's just
displayed as text today, never parsed). Storing as `text` (not `text[]`)
mirrors `sample_answer`/`grading_notes` exactly — no array marshaling
through Postgres/Supabase-js/Zod/React state; all parsing happens in one
small pure function at grading time.

## Progress so far

Already done, on `feature/essay-keyword-hint`, not yet committed:
- `supabase/migrations/20260913090000_essay_keywords.sql` — `keywords text`
  added to both `questions` and `attempt_questions`, plus
  `start_quiz_attempt()` re-created to snapshot it.
- `src/types/domain.ts` — `keywords` added to `Question`/`QuestionRow` +
  `mapQuestion`.
- `src/lib/validation/question.ts` — `essaySchema.keywords` added.
- `src/features/questions/actions.ts` — `questionRowFromInput` and
  `duplicateQuestion`'s essay branch both carry `keywords` through.
- `src/features/questions/question-editor.tsx` — `keywords` state, included
  in the essay payload, and a new "Keywords for grading hint" field rendered
  in the Grading card.

Not started yet:
- `src/features/results/service.ts` — `BreakdownQuestion.keywords` +
  mapping in `getAttemptDetail`.
- `src/features/grading/keyword-match.ts` — the pure matching function
  (below) + its unit test.
- `src/features/grading/essay-grade-form.tsx` — the suggestion badge +
  "Mark Correct"/"Mark Wrong" buttons.
- `src/app/(app)/admin/results/[attemptId]/page.tsx` — pass the new props
  through.
- Docs updates (list below) and full verification pass.

## Data model

Migration (already written): `supabase/migrations/20260913090000_essay_keywords.sql`.

1. `alter table public.questions add column keywords text;`
2. `alter table public.attempt_questions add column keywords text;` — the
   snapshot table needs its own copy so a later edit to the source
   question's keywords never changes what a past grading session saw (same
   historical-integrity guarantee `sample_answer`/`grading_notes` already
   have).
3. `create or replace function public.start_quiz_attempt(...)` — same body
   as before, with `keywords` added to the snapshot INSERT's column list and
   `q.keywords` added to its SELECT list, alongside the existing
   `explanation, sample_answer, grading_notes`.

Both columns nullable, no backfill, no default — additive, matches Change
Safety Rule 4 (additive DB changes only). Altering the RPC via
`create or replace function` is the same mechanism every prior migration in
`20260907120000_quiz_engine.sql` already uses to evolve it.

**No RLS change needed** — verified two things directly in that file:
- `attempt_questions` RLS is already table-level admin-only for SELECT
  (`"attempt_questions: admin reads"`) — a new column inherits that
  automatically.
- `get_attempt_for_player()` (what sales/trainees actually call) builds its
  JSON response with an explicit `jsonb_build_object(...)` field list — it
  does **not** `select *`, so `keywords` is invisible to the player unless
  someone deliberately adds it there later.

## Application code (remaining)

- `src/features/results/service.ts` — `BreakdownQuestion` gets
  `keywords: string | null`; map it in `getAttemptDetail` next to the
  existing `sampleAnswer: q.sample_answer, gradingNotes: q.grading_notes`
  line — same untyped-row access pattern already used there.

## The matching logic (new, small, pure)

New file `src/features/grading/keyword-match.ts`:

```ts
export type MatchLabel = "likely_correct" | "partial" | "likely_incorrect";

export function matchKeywords(
  keywords: string | null,
  answerText: string | null,
): { label: MatchLabel; matched: number; total: number } | null {
  const list = (keywords ?? "")
    .split(",")
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean);
  if (list.length === 0) return null; // no keywords set -> no badge at all

  const haystack = (answerText ?? "").toLowerCase();
  const matched = list.filter((k) => haystack.includes(k)).length;
  const ratio = matched / list.length;
  const label: MatchLabel =
    ratio >= 0.6 ? "likely_correct" : ratio > 0 ? "partial" : "likely_incorrect";
  return { label, matched, total: list.length };
}
```

Thresholds: ≥60% → "Likely Correct", 1–59% → "Partial match", 0% → "Likely
Incorrect". No keywords set → function returns `null` → UI shows no badge
(never claims "incorrect" for a soal the trainer didn't bother to add hints
to).

New co-located unit test `src/features/grading/keyword-match.test.ts` (no
Supabase needed — pure function, same convention as
`src/lib/validation/question.test.ts`): covers empty keywords → `null`,
case-insensitivity, partial match ratio boundaries, empty answer text.

## UI: grading screen

- `src/features/grading/essay-grade-form.tsx` — new props `keywords: string
  | null` and `answerText: string | null`. Computes
  `matchKeywords(keywords, answerText)` once, and if non-null:
  - Renders a small badge — "Likely Correct (3/4 keywords)" / "Partial match
    (1/4)" / "Likely Incorrect (0/4)" — placed above the score input,
    clearly labeled as a suggestion, not a verdict.
  - Two new buttons next to the existing score input: **"Mark Correct"**
    (sets score to full points) and **"Mark Wrong"** (sets score to 0), both
    immediately submitting through the same `gradeEssay(...)` call the
    manual path already uses — no new server logic, no new RPC. Trainer can
    still type a custom score and hit "Save grade" as before; these are
    additive shortcuts, not a replacement path.
- `src/app/(app)/admin/results/[attemptId]/page.tsx` — pass
  `keywords={q.keywords}` and `answerText={q.essay?.text ?? null}` into
  `<EssayGradeForm>` alongside its existing props.

## Known trade-off (flagged, not fixed by this feature)

Keyword matching is a substring check on lowercase text — it does not
understand synonyms or paraphrasing. A correct answer phrased differently
from the trainer's keyword list will show "Likely Incorrect" even though
it's right. The badge is explicitly labeled as a suggestion, and the
trainer's own reading of the answer is always the final word; the Mark
Correct/Wrong buttons are optional shortcuts, not required.

## Docs to update (matches this repo's existing convention)

- `docs/DATABASE_SCHEMA.md` — add `keywords text` to both the `questions`
  and `attempt_questions` blocks; note it's answer-key-adjacent (same
  caveat already there for `sample_answer`/`grading_notes`).
- `docs/SECURITY_RLS.md` "Answer-Key Protection" list — add `keywords` to
  the bullet list of fields that must never reach a sales response.
- `docs/DOMAIN_RULES.md` "Essay" section — one line: keyword-based grading
  hint exists, is advisory only, trainer always makes the final call.
- `docs/RELEASE_CHECKLIST.md`, `docs/TESTING_QA.md`,
  `docs/UAT_PLAYWRIGHT_PROMPT.md` answer-key-protection bullets — add
  `keywords` alongside the existing `is_correct`/`sample_answer`/
  `grading_notes` "must never appear in a sales response" checks.
- New `docs/reports/ESSAY_KEYWORD_HINT_REPORT.md` after implementation,
  following the same report convention as
  `docs/reports/DUPLICATE_QUESTION_REPORT.md`.

## Change Safety Rules — quick pass

Additive only (nullable column × 2, one RPC body replaced via the same
`create or replace function` mechanism this migration file already uses,
zero breaking renames). No RLS change (verified above). The actual
score-writing authority is untouched — `grade_essay_answer` RPC and
`gradeEssay()` action are called exactly as before; keyword matching only
pre-fills the UI. This preserves "don't trust the frontend for critical
data" — the suggestion is computed from data the trainer typed (the
keywords) and is never itself written back as a score without the trainer's
click.

## Verification

- `npm run lint && npm run typecheck && npm test` (new
  `keyword-match.test.ts` included) `&& npm run build`.
- Manual: create an essay question with keywords, duplicate it (confirm
  `duplicateQuestion` carries `keywords` through), take the quiz as a sales
  user, submit an answer that partially matches, open
  `/admin/results/[attemptId]` as trainer and confirm the right badge + that
  "Mark Correct"/"Mark Wrong" produce the expected score via the existing
  grade flow.
- Confirm via a direct Supabase query (service role) that a sales-signed-in
  client still cannot read `attempt_questions.keywords` directly, and that
  `get_attempt_for_player()`'s JSON response has no `keywords` key — same
  verification style as the existing "Answer-Key Protection" RLS test.
