# Production Deploy Log

Chronological record of production deployments to
`https://quiz-projek.vercel.app`. Newest first. Append a row after every
`vercel --prod` (see `docs/DEPLOYMENT.md` step 5).

| Date | Commit | Deployment id | Shipped | Migrations applied | Smoke |
| --- | --- | --- | --- | --- | --- |
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
