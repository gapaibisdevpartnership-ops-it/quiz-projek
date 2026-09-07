# Sales Training Quiz Platform

Internal web app for sales training, assessment and performance analytics.

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS · shadcn/ui · Supabase
(Postgres / Auth / Storage / RLS) · TanStack Query · React Hook Form · Zod ·
Recharts · Vercel.

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in the Supabase values
npm run dev                  # http://localhost:3000
```

Required env vars (see `.env.example`):

| Variable                        | Scope       |
| ------------------------------- | ----------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | client      |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client      |
| `SUPABASE_SERVICE_ROLE_KEY`     | server only |

Readiness probe: `GET /api/health` returns `200 {"status":"ok"}` once all env
vars are set.

## Scripts

- `npm run dev` – dev server
- `npm run build` – production build
- `npm run lint` – ESLint

## Project layout

```
src/
  app/                 routes (App Router)
  components/ui/        shadcn/ui components
  features/            auth, users, teams, quizzes, questions, attempts, grading, analytics
  lib/
    env.ts             lazy, validated env access
    supabase/          client.ts (browser) · server.ts (RSC) · admin.ts (service role) · middleware.ts
    permissions/ validation/ errors/
  hooks/  types/
middleware.ts          session refresh + UX route guards
docs/                  product & engineering specs (source of truth)
```

## Roadmap

Phased plan lives in `docs/DEVELOPMENT_PLAN.md`. Current status: **Phase 0
(setup) complete**. Next: Phase 1 – auth, profiles, roles, RLS baseline.
