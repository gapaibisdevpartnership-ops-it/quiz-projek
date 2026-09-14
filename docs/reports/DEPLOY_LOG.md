# Production Deploy Log

Chronological record of production deployments to
`https://quiz-projek.vercel.app`. Newest first. Append a row after every deploy
(see `docs/DEPLOYMENT.md`).

Since 2026-09-08 the Vercel project auto-deploys on push to `main` (GitHub
integration, Production Branch = `main`); the `dpl_…` id comes from the Vercel
Deployments tab.

| Date | Commit | Deployment id | Shipped | Migrations applied | Smoke |
| --- | --- | --- | --- | --- | --- |
| 2026-09-14 | `e948506` (merge of `fix/quiz-player-setstate-in-render`, `main`) | Git auto-deploy (see Deployments tab) | Question Bank Edit/Duplicate row actions using shadcn `Button`/`buttonVariants` with icons (`0a8b084`, `5b8a981`); essay grading keyword hint + Mark Correct/Wrong shortcuts (`1399bfe`); Invite User moved from an always-open form to a button + modal, new shared `ui/dialog.tsx` (`bbf1db7`, `30b2258`); fix for the `QuizPlayer` `setState`-in-render warning that was silently sending an empty `selectedOptionIds` array on multiple-choice toggles under React Strict Mode double-invoke (`c956da2`, `docs/reports/CHAOS_TESTING_REPORT.md` #49). | none this deploy — the `essay_keywords` migration this depends on was already applied ahead of time on 2026-09-13 (see the row below). | ✅ `npm run predeploy` (lint+typecheck+build) green before push; post-deploy `GET /api/health` → `200 {"status":"ok"}`. |
| 2026-09-13 | `1399bfe` (branch `feature/essay-keyword-hint`, not merged to `main`) | — (migration-only; no `vercel --prod` run) | Nothing shipped to the app yet — this is **only** the DB migration for the essay-keyword-hint feature (`docs/ESSAY_KEYWORD_HINT_PLAN.md`), applied ahead of merging so the app code isn't blocked on it. `main`/production frontend is unchanged. | `20260913090000_essay_keywords` — additive: `keywords text` (nullable) on `questions` + `attempt_questions`, `start_quiz_attempt()` re-created to snapshot it. Manual `pg_dump` backup taken first (`backup-pre-keywords-20260913-151212.sql`, verified non-empty and contains `CREATE TABLE public.questions`). Post-apply check: `keywords` column readable on both tables, existing row data/count on `questions` unchanged (15 rows, sample checked). | ✅ column-existence + data-integrity check green; `start_quiz_attempt()` **not** exercised live (no QA sales account currently has a quiz assignment, and the only published quizzes appear to be real ones — avoided creating a real attempt row or a new test assignment against production data). Push success itself (migration runs as one script) is treated as sufficient evidence the function body replaced cleanly. |
| 2026-09-08 | `4c0cca2` | Git auto-deploy (see Deployments tab) | GAPAI Mentorship rebrand: brand-violet + logo-yellow palette, dark mode (theme toggle + no-flash script), "GAPAI mentorship" wordmark; contrast fix for bare headings | none (frontend only) | pending |
| 2026-09-08 | `d5fd3ff` | Git auto-deploy (see Deployments tab) | Opsi A — admin-managed passwords, no SMTP: temp password on invite, admin "Reset password", forced first-login change (`/change-password`), `/forgot-password` informational | `20260908180000_must_change_password` (already applied) | pending |
| 2026-09-08 | `4c846ae` | `dpl_H1KfWhNdzh1et8eX9u81MhMnayan` | Left shadcn/Radix sidebar; P0 user-admin hardening (`admin_update_user` RPC, `requireSuperAdmin`, `handle_new_user` forced `sales`); attempt-expiry moved to `pg_cron`; UAT test-data cleanup script | `20260908160000_admin_user_rpc`, `20260908170000_attempt_expiry_pgcron` | ✅ green |
| 2026-09-07 → 09-08 | Phases 3–8 | not recorded | Per-phase deploys (quiz builder → analytics → hardening → follow-ups). `dpl` ids were not captured at the time. | `20260907093000` … `20260907150000` | ✅ green each phase |
| 2026-09-07 | (Vercel setup) | `dpl_8ZazL9jWbp2Ud4kfq4RZWRjHcWCt` | Initial production deploy: `vercel.json`, `.vercelignore`, `predeploy` + `smoke` scripts, env vars wired (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) | through `20260907140000` | ✅ green |

## Notes / incidents

- **2026-09-08** — first `vercel --prod` attempt failed:
  `Hobby accounts are limited to daily cron jobs` because `vercel.json` had
  `crons: [{ schedule: "*/5 * * * *" }]`. Fixed by removing the Vercel cron and
  scheduling the sweep with `pg_cron` instead (`20260908170000`), then
  redeployed successfully.
- Auth for the CLI deploy is a personal `VERCEL_TOKEN` passed on the command
  line; there is no CI/CD deploy. Revoke the token after use.
