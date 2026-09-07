# Deployment

## Target

Application hosting:

- Vercel

Backend/database:

- Supabase

## Recommended Flow

```text
feature branch
  ↓
staging / preview
  ↓
QA
  ↓
main
  ↓
production
```

## Pre-Deploy Checklist

- typecheck passes;
- lint passes;
- tests pass;
- migration reviewed;
- migration applied to target environment;
- RLS reviewed;
- environment variables configured;
- production build passes.

## Vercel

Configure:

- Supabase URL;
- anon key;
- server-only secrets;
- production domain.

## Supabase

Review:

- migrations;
- RLS;
- storage bucket;
- storage policies;
- database functions;
- indexes.

## Post-Deploy Smoke Test

Verify:

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

Do not deploy irreversible destructive schema changes without a rollback/data-preservation plan.
