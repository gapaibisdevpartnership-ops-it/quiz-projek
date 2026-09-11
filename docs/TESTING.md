# Testing — How To

Test layers map to `docs/TESTING_QA.md`.

| Layer | Tool | Location | Command |
| --- | --- | --- | --- |
| Unit / domain | Vitest | `src/**/*.test.ts` | `npm test` |
| Integration (RLS, real Supabase) | Vitest | `tests/integration/**` | `npm run test:integration` |
| Database (pgTAP) | Supabase CLI | `supabase/tests/*.sql` | `npm run test:rls` |
| End-to-end | Playwright | `tests/e2e/**` | `npm run test:e2e` |
| Chaos — server (RPC race/fault injection) | Vitest | `tests/chaos/**` | `npm run test:chaos` |
| Chaos — client (network fault injection) | Playwright | `tests/e2e/chaos/**` | `npm run test:chaos:e2e` |

`npm run test:all` runs unit + integration + e2e (chaos is **not** included —
see below).
`npm run typecheck` runs `tsc --noEmit`.

## Environment

- **Unit tests** need nothing.
- **Integration + E2E** talk to a real Supabase project and sign in as the QA
  seed users. They read `.env.test` if present, else `.env.local`. Point them
  at a **non-production** project.
- **First E2E run locally:** `npx playwright install chromium`.

## QA seed users

Password for all: `QuizQA!2026` (`tests/helpers/seed.ts`).

| Email | Role |
| --- | --- |
| `superadmin.qa@example.com` | `super_admin` |
| `trainer.qa@example.com` | `admin` |
| `sales.qa01@example.com` | `sales` |
| `sales.qa02@example.com` | `sales` |

Recreate them with the Supabase Admin API (service-role key):

```bash
curl -s -X POST "$NEXT_PUBLIC_SUPABASE_URL/auth/v1/admin/users" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"trainer.qa@example.com","password":"QuizQA!2026","email_confirm":true,"user_metadata":{"full_name":"Trainer QA","role":"admin"}}'
```

The `handle_new_user` trigger creates the matching `profiles` row from
`user_metadata` (`full_name`, `role`).

## Chaos testing

See `docs/CHAOS_TESTING_PLAN.md` for the full plan. Short version:

- **Not part of `test:all` or the CI gate.** These tests fire concurrent /
  failing / adversarial requests on purpose — some are designed to fail until
  a known gap (`docs/IMPROVEMENT_BACKLOG.md` P1 #6, P2 #11) is fixed, and race
  scenarios don't reproduce on every single run by nature. Run manually, or in
  a separate non-blocking CI job.
- `tests/chaos/*.test.ts` hits RPCs directly (concurrency, idempotency,
  adversarial input) — same pattern as `tests/integration/`.
- `tests/e2e/chaos/*.spec.ts` drives the real quiz player in a browser and
  injects network failures via Playwright `page.route()` (delay / abort every
  server-action call). `tests/e2e/chaos/fixture.ts` seeds a throwaway quiz per
  test — don't share a quiz across chaos e2e tests, `start_quiz_attempt`
  resumes an in-progress attempt for the same user+quiz, so an earlier test's
  answers would leak into a later one.
- Clean up leftover data (a crashed chaos run, or manual debugging) with
  `node scripts/cleanup-uat.mjs --apply` — it sweeps both `"UAT "` and
  `"CHAOS "` prefixes.

## CI

`.github/workflows/ci.yml`:
- **quality** (every push/PR): lint, typecheck, unit tests, build.
- **e2e** (only when repo variable `RUN_E2E=true`): integration + Playwright,
  using `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY` secrets.

## Conventions

- Co-locate unit tests with the code (`foo.ts` → `foo.test.ts`).
- Integration tests must clean up after themselves (sign out, delete rows they
  create) and tolerate not-yet-migrated tables via `isMissingTable(error)`.
- Never hard-code answer keys or scores in tests; assert them through the
  server/RPC path once those exist.
