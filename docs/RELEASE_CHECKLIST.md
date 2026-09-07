# Release Checklist

Run before every production release (`docs/DEPLOYMENT.md`).

## Automated gate

```bash
npm run predeploy          # lint + typecheck + unit tests + build
npm run test:integration   # RLS + attempt security + storage (needs a non-prod Supabase project + seed users)
npm run test:e2e           # route guards, auth flows (needs: npx playwright install chromium)
npx supabase db push       # apply pending migrations to the target project
npm run test:rls           # pgTAP (optional, needs supabase CLI + local db)
```

Then deploy and smoke:

```bash
vercel deploy --prod
npm run smoke https://<deployment-url>
```

## Manual smoke (needs a seeded published quiz assigned to a sales user)

1. Sales logs in and sees the assigned quiz on `/quizzes`.
2. Admin creates a draft quiz, adds questions, previews — no attempt created.
3. Image upload works on a question and an answer option.
4. Sales starts an attempt; objective answers save on select; essay autosaves.
5. Refresh mid-attempt — answers and the timer are preserved.
6. Submit works; a second submit is a no-op.
7. Objective-only quiz → score and pass/fail immediately.
8. Mixed quiz → `pending_review`; grading each essay finalises the attempt.
9. Result page shows the right numbers (or only status when `show_result` is off).
10. Network/DB inspection: a sales response never carries `is_correct`,
    `sample_answer`, `grading_notes`.
11. `/admin/analytics` totals reconcile with `/admin/results`.
12. `/leaderboard` ranks sales by average.

## Responsive pass

- `tests/e2e/responsive.spec.ts` asserts no horizontal overflow on the sales
  screens and the admin sections at 375px and 1280px — runs with `test:e2e`.
- Manual, still needed: quiz player on a phone — question text, image scaling,
  answer touch targets, essay textarea, the question navigator.

## Attempt expiry

- `expire_stale_attempts()` finalises abandoned `in_progress` attempts past
  their deadline. It runs either from Vercel Cron (`/api/cron/expire-attempts`,
  needs `CRON_SECRET`) or from an in-database `pg_cron` schedule — confirm
  exactly one is active for the target environment.

## Release gate (all must hold)

- [ ] migrations applied to the target environment
- [ ] RLS verified (`npm run test:integration` green)
- [ ] no answer-key leakage (explicit test green + manual step 10)
- [ ] critical E2E flows pass
- [ ] no unresolved critical/high data-integrity defects
- [ ] environment variables set on Vercel (URL, anon key, service-role key)
