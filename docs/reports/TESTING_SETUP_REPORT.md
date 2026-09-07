# Report — Testing Infrastructure

**Date:** 2026-09-07
**Status:** ✅ In place — unit + integration suites green

## Goal

Stand up the test layers required by `docs/TESTING_QA.md` before Phase 3, so
every later phase ships with tests.

## What was added

### Tooling
- **Vitest 5** (`vitest.config.ts`) with two projects:
  - `unit` — `src/**/*.test.ts`, node env, no external deps.
  - `integration` — `tests/integration/**`, loads `.env.test` → `.env.local`,
    serial, 20 s timeout.
- **Playwright 1.63** (`playwright.config.ts`) — chromium, auto-starts
  `npm run dev`, `baseURL` `http://localhost:3000`.
- **pgTAP** starter (`supabase/tests/rls_test.sql`) for `supabase test db`.
- `@types/node` bumped `^20` → `^24` (Vitest 5 peer requirement).
- Added `vite-tsconfig-paths`, `dotenv`, `tsx`, `@vitest/coverage-v8`.

### Scripts (`package.json`)
`test`, `test:watch`, `test:integration`, `test:rls`, `test:e2e`, `test:all`,
`typecheck`.

### Tests written
| File | Covers (`docs/TESTING_QA.md`) |
| --- | --- |
| `src/lib/constants.test.ts` | role helper |
| `src/lib/validation/auth.test.ts` | login + reset-password validation |
| `src/lib/validation/question.test.ts` | question-type rules; dynamic option counts 2–6; presentation (text-or-image) |
| `tests/integration/rls.test.ts` | unauthenticated denied; sales sees only own profile; admin sees all; sales cannot self-escalate role; sales sees no teams; sales cannot read/insert question bank |
| `tests/e2e/auth.spec.ts` | route protection, invalid login, trainer nav, sales bounced from `/admin`, sign-out |
| `supabase/tests/rls_test.sql` | tables exist, RLS enabled, `is_admin()` is SECURITY DEFINER |

### Helpers
- `tests/helpers/seed.ts` — QA user list + shared password.
- `tests/helpers/supabase.ts` — `anonClient`, `serviceClient`, `signInAs`,
  `hasSupabaseEnv`, `isMissingTable`.
- `tests/setup/load-env.ts` — dotenv loader for the integration project.

### CI
`.github/workflows/ci.yml` — `quality` job (lint, typecheck, unit, build) on
every push/PR; `e2e` job (integration + Playwright) gated on repo variable
`RUN_E2E=true` with Supabase secrets.

### Docs
`docs/TESTING.md` — living how-to (commands, env, seed users, CI, conventions).
`.env.test.example` added.

### QA seed users created
Via the Supabase Admin API against project `fvymroovientdoixbhff`:
`superadmin.qa` / `trainer.qa` / `sales.qa01` / `sales.qa02` (password
`QuizQA!2026`), all `email_confirm`. The `handle_new_user` trigger populated
`profiles` with the right role and name — **this verifies Phase 1 end-to-end
at the database level.**

## Results

```
npm test                 → 3 files, 25 tests passing
npm run test:integration → 1 file, 8 tests passing (live Supabase)
npm run typecheck        → clean
npm run lint             → clean
npm run build            → passes
```

`tsconfig.json` now excludes `tests/` and `*.test.ts` so `next build` /
`tsc --noEmit` stay app-only; Vitest/Playwright compile them independently.

## Not done yet (later phases will add)

- Component tests (Testing Library) — deferred until there is interactive UI
  worth rendering in isolation.
- E2E for quiz builder / attempt / scoring / grading — added per phase.
- Historical-integrity and timer tests — Phase 5–6.
- Coverage thresholds — revisit once the domain layer is larger.

## Follow-ups

- Run `npm run test:e2e` once locally after `npx playwright install chromium`.
- Push the Phase 2 migration so the 3 skipped question-bank RLS assertions run.
- Set `RUN_E2E` + Supabase secrets in GitHub once the repo has write access.
