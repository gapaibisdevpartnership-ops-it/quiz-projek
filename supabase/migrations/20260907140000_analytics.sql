-- Phase 7 — Analytics.
-- Admin dashboards aggregate over tables their RLS already exposes, so they are
-- built in the app layer. The one thing that needs a privileged path is the
-- sales-visible leaderboard: a sales user cannot read other users' attempts,
-- so expose a SECURITY DEFINER function that returns only aggregate rows.
-- See docs/DEVELOPMENT_PLAN.md, docs/UI_UX_SPEC.md, docs/SECURITY_RLS.md.

create or replace function public.leaderboard(row_limit integer default 20)
returns table (
  user_id        uuid,
  full_name      text,
  attempts       bigint,
  avg_percentage numeric,
  passed_count   bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.user_id,
    coalesce(nullif(p.full_name, ''), p.email) as full_name,
    count(a.id)                                as attempts,
    round(avg(a.percentage), 1)               as avg_percentage,
    count(*) filter (where a.passed)           as passed_count
  from public.profiles p
  join public.quiz_attempts a
    on a.user_id = p.user_id
   and a.status = 'submitted'
   and a.percentage is not null
  where p.role = 'sales' and p.status = 'active'
  group by p.user_id, coalesce(nullif(p.full_name, ''), p.email)
  order by avg_percentage desc nulls last, attempts desc
  limit greatest(1, least(row_limit, 100));
$$;

revoke all on function public.leaderboard(integer) from public, anon;
grant execute on function public.leaderboard(integer) to authenticated;
