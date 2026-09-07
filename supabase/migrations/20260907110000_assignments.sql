-- Phase 4 — Users, Teams, Assignments.
-- Adds quiz_assignments and the first sales-facing RLS: a sales user may read a
-- PUBLISHED quiz that is assigned to them (directly or via a team).
-- See docs/DATABASE_SCHEMA.md, docs/DOMAIN_RULES.md, docs/SECURITY_RLS.md.

-- ---------------------------------------------------------------------------
-- quiz_assignments
-- ---------------------------------------------------------------------------

create table public.quiz_assignments (
  id          uuid primary key default gen_random_uuid(),
  quiz_id     uuid not null references public.quizzes (id) on delete cascade,
  user_id     uuid references auth.users (id) on delete cascade,
  team_id     uuid references public.teams (id) on delete cascade,
  assigned_by uuid not null references auth.users (id),
  assigned_at timestamptz not null default now(),
  due_at      timestamptz,
  -- Exactly one target mode (docs/DATABASE_SCHEMA.md).
  constraint quiz_assignments_one_target check (
    (user_id is not null and team_id is null)
    or (user_id is null and team_id is not null)
  )
);

create unique index quiz_assignments_quiz_user_unique
  on public.quiz_assignments (quiz_id, user_id)
  where user_id is not null;
create unique index quiz_assignments_quiz_team_unique
  on public.quiz_assignments (quiz_id, team_id)
  where team_id is not null;

create index quiz_assignments_quiz_idx on public.quiz_assignments (quiz_id);
create index quiz_assignments_user_idx on public.quiz_assignments (user_id);
create index quiz_assignments_team_idx on public.quiz_assignments (team_id);

-- ---------------------------------------------------------------------------
-- Helper: is a given quiz assigned to the current user (directly or by team)?
-- SECURITY DEFINER so it can see quiz_assignments / team_members regardless of
-- the caller's own policies.
-- ---------------------------------------------------------------------------

create or replace function public.quiz_assigned_to_me(target_quiz_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.quiz_assignments a
    where a.quiz_id = target_quiz_id
      and (
        a.user_id = auth.uid()
        or a.team_id in (
          select tm.team_id from public.team_members tm
          where tm.user_id = auth.uid()
        )
      )
  )
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.quiz_assignments enable row level security;

create policy "quiz_assignments: admin full access"
  on public.quiz_assignments for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "quiz_assignments: read my own"
  on public.quiz_assignments for select
  to authenticated
  using (
    user_id = auth.uid()
    or team_id in (
      select tm.team_id from public.team_members tm
      where tm.user_id = auth.uid()
    )
  );

-- Sales can now see the quizzes assigned to them, but only once published.
create policy "quizzes: assignee reads published"
  on public.quizzes for select
  to authenticated
  using (status = 'published' and public.quiz_assigned_to_me(id));

-- Category names are not sensitive; let any signed-in user read them so the
-- sales quiz list can show them.
create policy "quiz_categories: authenticated read"
  on public.quiz_categories for select
  to authenticated
  using (true);
