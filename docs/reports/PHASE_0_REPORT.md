# Phase 0 Report — Project Setup

**Date:** 2026-09-07
**Status:** ✅ Complete

## Goal

Scaffold the application and wire up external services (Supabase, GitHub) so
Phase 1 can start on a working foundation.

## What was built

### Application scaffold
- Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS v4 + ESLint
- `src/` directory layout, import alias `@/*`
- Folder skeleton per `docs/ARCHITECTURE.md`: `src/features/*`, `src/lib/*`,
  `src/components/ui`, `src/hooks`, `src/types`
- Product/engineering specs moved from repo root into `docs/`

### Dependencies
`@supabase/supabase-js`, `@supabase/ssr`, `@tanstack/react-query`,
`react-hook-form` + `@hookform/resolvers`, `zod`, `recharts`,
`class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`,
`tailwindcss-animate`, `server-only`.

### Supabase integration
| File | Purpose |
| --- | --- |
| `src/lib/env.ts` | Lazy, Zod-validated env access (build works before `.env.local` is filled) |
| `src/lib/supabase/client.ts` | Browser client (Client Components) |
| `src/lib/supabase/server.ts` | Server client (RSC / Route Handlers / Server Actions), RLS as the user |
| `src/lib/supabase/admin.ts` | Service-role client, `server-only`, bypasses RLS |
| `src/lib/supabase/middleware.ts` | Session refresh + UX route guards |
| `middleware.ts` | Root middleware entrypoint |
| `supabase/config.toml` | `supabase init` output, project linked to ref `fvymroovientdoixbhff` |

### Other
- `src/app/providers.tsx` — TanStack Query provider, wired into root layout
- `src/app/api/health/route.ts` — readiness probe for required env vars
- `components.json` + `src/lib/utils.ts` (`cn`) — shadcn/ui ready
- `src/app/globals.css` — shadcn "neutral" theme tokens (light/dark)
- `.env.example`, `.env.local` (gitignored), `README.md`

## Environment / services

| Item | Value |
| --- | --- |
| Supabase org | `gapaibisdevpartnership-ops-it org` |
| Supabase project ref | `fvymroovientdoixbhff` (region `ap-southeast-1`, Postgres 17.6) |
| Project URL | `https://fvymroovientdoixbhff.supabase.co` |
| GitHub remote | `https://github.com/gapaibisdevpartnership-ops-it/quiz-projek.git` |

## Verification

- `npm run lint` — clean
- `npm run build` — passes
- `npm run dev` — boots, `GET /api/health` → `{"status":"ok"}`
- Live Supabase checks with the anon key:
  - `POST /auth/v1/signup` → `422` (key accepted, email auth enabled)
  - `GET /auth/v1/settings` → returns config

## Blocked / follow-ups

- **GitHub push** — the authenticated account `gapaicoding` has only READ
  access to `gapaibisdevpartnership-ops-it/quiz-projek`. Needs Write access (or
  auth as an org member) before `git push`.
- **Revoke the Supabase personal access token** used for setup once no longer
  needed.
