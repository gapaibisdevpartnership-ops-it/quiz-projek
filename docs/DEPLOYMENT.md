# Deployment

/ Hosting: **Vercel** (`gapaibisdevpartnership-ops-it/quiz-projek`,
production `https://quiz-projek.vercel.app`, region `sin1`).
Database: **Supabase** (project `fvymroovientdoixbhff`).

This project deploys with the **Vercel CLI** (`vercel deploy --prod`), which
uploads the local build context. A `git push` does **not** deploy — the Vercel
project has no GitHub auto-deploy connected. Database migrations are applied
separately with `supabase db push`.

Every production deployment must be recorded in
[`reports/DEPLOY_LOG.md`](reports/DEPLOY_LOG.md).

---

## Runbook

### 0. Pre-flight

- Working tree committed; you are on `main`.
- `.env.local` has the three Supabase vars.
- A Vercel token: `export VERCEL_TOKEN=…` (create at
  <https://vercel.com/account/tokens>; revoke it when done). Or `vercel login`.

### 1. Apply database migrations (if any new ones)

```bash
npx supabase migration list            # local vs remote
npx supabase db push                   # apply pending migrations
```

Review RLS / policy / function changes first. Never push an irreversible
destructive schema change without a rollback plan.

If a migration schedules a `pg_cron` job (e.g.
`20260908170000_attempt_expiry_pgcron.sql`), confirm it registered:
the `expire-stale-attempts` job should appear in `cron.job`.

### 2. Pre-deploy gate

```bash
npm run predeploy      # lint → typecheck → unit tests → next build
```

Must be fully green. For a security- or attempt-model change also run
`npm run test:integration` and `npm run test:e2e`.

### 3. Deploy

```bash
npx vercel --prod --yes --token="$VERCEL_TOKEN"
```

Note the returned `dpl_…` id and the deployment URL. It is auto-aliased to
`https://quiz-projek.vercel.app`.

### 4. Smoke test

```bash
npm run smoke https://quiz-projek.vercel.app
```

Checks (session-less): `GET /api/health` → `200 {"status":"ok"}` (all env vars
wired), `GET /login` renders the form, `GET /dashboard` redirects to `/login`.

For a UI or auth change, also do a quick logged-in check (Trainer QA /
`docs/TEST_ACCOUNTS.md`) — e.g. a Playwright screenshot of `/dashboard`.

### 5. Record it

Append a row to [`reports/DEPLOY_LOG.md`](reports/DEPLOY_LOG.md): date, commit,
`dpl_…` id, what shipped, migrations applied, smoke result.

---

## Vercel environment variables

Set for **Production** (and Preview/Development if used):

| Variable | Type | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | config | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | config | public by design; CLI needs `--type config` for a `NEXT_PUBLIC_`-prefixed credential-looking value |
| `SUPABASE_SERVICE_ROLE_KEY` | secret | **never** prefix with `NEXT_PUBLIC_` |
| `CRON_SECRET` | secret | optional — guards `GET /api/cron/expire-attempts`; unset disables that route (503) |

```bash
vercel env add <NAME> production --token="$VERCEL_TOKEN"
```

## Scheduled jobs

- `expire_stale_attempts()` runs from **`pg_cron`** in Supabase every 5 min
  (`expire-stale-attempts`). The Vercel plan is Hobby (daily crons only), so
  `vercel.json` declares **no** cron and a sub-daily entry would make
  `vercel --prod` fail. `GET /api/cron/expire-attempts` stays as a manual /
  backup trigger. See `docs/RELEASE_CHECKLIST.md` "Attempt expiry".

## Recommended flow

```text
feature branch → local predeploy gate → main → supabase db push → vercel --prod → smoke
```

## Pre-Deploy Checklist

- typecheck passes;
- lint passes;
- tests pass (unit always; integration + e2e for security / attempt-model
  changes);
- migration reviewed;
- migration applied to the target environment (`supabase db push`);
- RLS reviewed;
- environment variables configured on Vercel;
- production build passes (`npm run predeploy`).

## Post-Deploy Smoke Test

Automated by `npm run smoke <url>` (checks 1–3). The rest are manual, with a
seeded quiz:

1. login;
2. admin creates draft quiz;
3. admin can open question bank;
4. image upload works;
5. quiz assignment loads;
6. sales can start attempt;
7. autosave works;
8. refresh resumes;
9. submission works;
10. result or pending review is correct;
11. answer key not leaked;
12. admin grading works for essay;
13. final score recalculates.

## Rollback Mindset

- Vercel: `vercel rollback <previous dpl_… or url>` (or re-alias a prior
  deployment in the dashboard) — instant, code only.
- Supabase: migrations are forward-only here. Do not deploy an irreversible
  destructive schema change without a rollback / data-preservation plan; write
  the down-path into the migration report first.
