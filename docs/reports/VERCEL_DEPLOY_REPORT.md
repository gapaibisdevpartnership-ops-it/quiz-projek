# Report — Vercel Deployment Setup

**Date:** 2026-09-07
**Status:** 🟡 Ready to deploy — needs a Vercel token or a manual `vercel` run

## What was added

| File | Purpose |
| --- | --- |
| `vercel.json` | Pin framework `nextjs`, region `sin1` (near Supabase `ap-southeast-1`) |
| `.vercelignore` | Keep tests/docs/`supabase/.temp` out of the upload |
| `scripts/predeploy.mjs` | Runs lint → typecheck → unit tests → build (the `docs/DEPLOYMENT.md` gate). `npm run predeploy` |
| `scripts/smoke.mjs` | Post-deploy checks against a live URL. `npm run smoke <url>` |
| `package.json` | scripts `predeploy`, `smoke` |

`npm run predeploy` — **passing** locally right now.

## Required Vercel environment variables

Set for **Production** (and Preview if used):

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://fvymroovientdoixbhff.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key (same as `.env.local`) |
| `SUPABASE_SERVICE_ROLE_KEY` | service-role key — **do not** prefix with `NEXT_PUBLIC_` |

## Deploy — Option A: Vercel CLI (no GitHub needed)

```bash
npm i -g vercel            # or use npx vercel
vercel login              # or export VERCEL_TOKEN=…

# from the repo root:
vercel link               # create/select the project
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production

npm run predeploy         # gate
vercel deploy --prod      # uploads the local build context
```

Then verify:

```bash
npm run smoke https://<your-app>.vercel.app
```

## Deploy — Option B: Git integration

Requires the GitHub repo (`gapaibisdevpartnership-ops-it/quiz-projek`) to have
the code pushed. Import it in the Vercel dashboard, set the three env vars,
every push to `main` then deploys. Blocked until the push-access issue is
resolved.

## Post-deploy smoke test

`npm run smoke <url>` automates the session-less checks:
1. `GET /api/health` → `200 {"status":"ok"}` (proves all env vars are wired)
2. `GET /login` → renders the sign-in form
3. `GET /dashboard` (no session) → redirects to `/login` (middleware works)

The remaining `docs/DEPLOYMENT.md` steps (login, draft quiz, question bank,
image upload, attempt, autosave, submit, grading) are manual and depend on
later phases — they will be added to `scripts/smoke.mjs` / e2e as those phases
land.

## Pre-deploy checklist status (`docs/DEPLOYMENT.md`)

- [x] typecheck passes
- [x] lint passes
- [x] unit tests pass
- [x] production build passes
- [ ] migration applied to target env — **Phase 2 migration still needs `supabase db push`**
- [x] RLS reviewed (Phase 1 verified via integration tests; Phase 2 admin-only)
- [ ] environment variables configured on Vercel
- [x] storage bucket + policies defined (in Phase 2 migration)

## Blockers

1. No `VERCEL_TOKEN` available to the assistant — provide one
   (https://vercel.com/account/tokens) or run Option A manually.
2. Phase 2 migration not pushed — deploy will still work, but
   `/admin/questions` will error until it is.
