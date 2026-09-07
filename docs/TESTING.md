# Testing — How To

Test layers map to `docs/TESTING_QA.md`.

| Layer | Tool | Location | Command |
| --- | --- | --- | --- |
| Unit / domain | Vitest | `src/**/*.test.ts` | `npm test` |
| Integration (RLS, real Supabase) | Vitest | `tests/integration/**` | `npm run test:integration` |
| Database (pgTAP) | Supabase CLI | `supabase/tests/*.sql` | `npm run test:rls` |
| End-to-end | Playwright | `tests/e2e/**` | `npm run test:e2e` |

`npm run test:all` runs unit + integration + e2e.
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
