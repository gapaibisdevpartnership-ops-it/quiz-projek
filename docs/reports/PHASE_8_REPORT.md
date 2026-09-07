# Phase 8 Report — Hardening

**Date:** 2026-09-07
**Status:** ✅ Complete — audit automated; one item (Playwright run) deferred to CI

## Goal (`docs/DEVELOPMENT_PLAN.md`)

RLS audit; answer-key security audit; attempt-integrity tests; image-storage
tests; responsive QA; production smoke testing; Vercel deployment validation.

## What was done

### RLS + answer-key + attempt-integrity audit (automated)

`tests/integration/attempt-security.test.ts` — seeds a throwaway published quiz
(one single-choice + one essay, `max_attempts = 2`) with the service client,
assigns it to Sales QA 01, then asserts, as the real QA users:

| Check (`docs/SECURITY_RLS.md` / `docs/TESTING_QA.md`) | Result |
| --- | --- |
| Assigned sales user sees the published quiz | ✅ |
| Unassigned sales user does **not** see it | ✅ |
| `start_quiz_attempt` creates an attempt | ✅ |
| Player payload contains **no** `is_correct` / `sample_answer` / `grading_notes` | ✅ |
| Sales cannot `SELECT attempt_question_options` directly | ✅ |
| Sales cannot `UPDATE` their own `percentage` / `passed` / `final_score` | ✅ |
| User A cannot read User B's attempt (table **and** RPC) | ✅ |
| Sales can save answers while `in_progress` | ✅ |
| `submit_quiz_attempt` is idempotent; essay → `pending_review` | ✅ |
| Submitted attempt rejects further answers (`ATTEMPT_NOT_ACTIVE`) | ✅ |
| Sales cannot call `grade_essay_answer` (`UNAUTHORIZED_GRADING`) | ✅ |
| Editing the source question does **not** change the snapshot | ✅ |
| Attempt numbers increment; `max_attempts` enforced (`ATTEMPT_LIMIT_REACHED`) | ✅ |
| Archived quiz keeps attempt history readable | ✅ |

`tests/integration/rls.test.ts` (from earlier phases) also covers:
unauthenticated denied, own-profile-only for sales, admin-all, no self role
escalation, no team / question-bank / assignment access.

### Image-storage audit (automated)

`tests/integration/storage.test.ts`:
- a sales user cannot `upload` to `quiz-assets` → ✅ denied
- a trainer can `upload`, and the object is publicly readable (200) → ✅
- cleans up the uploaded object.

### Route-guard audit (E2E)

`tests/e2e/security.spec.ts` — a sales user is redirected from **every**
`/admin/*` route; a trainer can open them all; the leaderboard is reachable by
sales. Written and wired into CI; not run in this environment because the
Playwright Chromium download failed here (`npx playwright install chromium`
network failure). Run locally / in CI.

### Production smoke + Vercel validation

- `npm run predeploy` gate (lint + typecheck + unit + build) green.
- Each phase deployed to `https://quiz-projek.vercel.app` with
  `node scripts/smoke.mjs` green (health = ok → all env vars incl. service
  role wired; `/login` renders; `/dashboard` redirects).
- `docs/RELEASE_CHECKLIST.md` added — the `docs/DEPLOYMENT.md` gate plus the
  manual smoke steps that need a seeded quiz.

### Responsive QA

Manual. Layouts use flex/grid with `max-w-*` containers and the tables sit in
their cards; the quiz player is a single `max-w-2xl` column with large touch
targets. A formal device pass on the player and the admin builder is listed in
`docs/RELEASE_CHECKLIST.md` as a pre-release manual step.

## Verification

- `npm run lint` / `npm run typecheck` — clean
- `npm test` — 8 files, **55** unit tests
- `npm run test:integration` — 3 files, **30** tests, all green against the
  live project (24 of them added for this audit)
- `npm run build` — passes

## Follow-ups / known limitations

1. Playwright specs need `npx playwright install chromium` + a run (CI or a
   machine that can download the browser).
2. No auto-expire sweep for abandoned `in_progress` attempts past their
   deadline (client auto-submits if the tab is open).
3. Multiple-choice scoring is all-or-nothing for V1 by design.
4. Analytics use table scans — fine at current volume.
5. Charts (Recharts) not added — tables satisfy V1.

## Status vs `docs/DEPLOYMENT.md` Release Gate

- [x] migrations applied (through Phase 7; **push Phase 8 has no migration**)
- [x] RLS verified (automated suite above)
- [x] no answer-key leakage (explicit test)
- [~] critical E2E flows pass (integration suite green; Playwright pending a run)
- [x] no unresolved critical/high data-integrity defects

## Development plan

All eight phases of `docs/DEVELOPMENT_PLAN.md` are now implemented.
