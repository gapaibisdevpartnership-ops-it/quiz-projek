-- pgTAP RLS tests. Run with:  npx supabase test db
-- Docs: https://supabase.com/docs/guides/local-development/testing/pgtap-extended

begin;
select plan(6);

-- Extensions / objects exist ------------------------------------------------

select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'teams', 'teams table exists');
select has_table('public', 'team_members', 'team_members table exists');

select ok(
  (select rowsecurity from pg_tables where schemaname = 'public' and tablename = 'profiles'),
  'RLS is enabled on profiles'
);
select ok(
  (select rowsecurity from pg_tables where schemaname = 'public' and tablename = 'teams'),
  'RLS is enabled on teams'
);

-- is_admin() helper is SECURITY DEFINER (needed to avoid RLS recursion) -----

select ok(
  (select prosecdef from pg_proc where proname = 'is_admin' limit 1),
  'is_admin() is SECURITY DEFINER'
);

select * from finish();
rollback;
