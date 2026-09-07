# Environment Configuration

## Required Variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

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
