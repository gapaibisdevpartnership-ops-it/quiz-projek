# Environment Configuration

## Required Variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## Optional Variables

```env
CRON_SECRET=
```

`CRON_SECRET`:

- server-only shared secret for the scheduled sweep at
  `/api/cron/expire-attempts` (Vercel Cron, see `vercel.json`);
- the route requires `Authorization: Bearer $CRON_SECRET` and returns 503 when
  the variable is unset, so the endpoint is inert until it is configured;
- set it on Vercel for the production environment when the in-database pg_cron
  schedule is not used instead.

## Rules

`SUPABASE_SERVICE_ROLE_KEY`:

- server-only;
- never available to browser bundles;
- never prefixed with `NEXT_PUBLIC_`.

## Recommended Environments

- local development;
- Vercel Preview;
- production.

Use separate Supabase projects or controlled environments when operationally feasible.

## Local Development

Recommended workflow:

1. install dependencies;
2. configure `.env.local`;
3. run local application;
4. apply migrations;
5. seed development data;
6. run tests.

## Secret Handling

Do not:

- commit secrets;
- put secrets in documentation examples;
- paste production service keys into frontend code.

Use Vercel Environment Variables for deployment secrets.
