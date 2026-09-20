-- Read-only "spv" (supervisor) role — can only view results, no create/write
-- access anywhere (docs/SPV_ROLE_AND_SCHEDULE_VALIDITY_PLAN.md).

-- ===========================================================================
-- 1. admin_update_user — allow granting the new role; generalize the
--    self-lockout check to cover any non-admin-capable role, not just
--    'sales'.
-- ===========================================================================

create or replace function public.admin_update_user(
  target_user_id uuid,
  new_full_name  text,
  new_role       text,
  new_status     text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor        uuid := auth.uid();
  v_actor_role   text;
  v_target_role  text;
  v_target_status text;
  v_others       integer;
begin
  if not public.is_admin() then
    raise exception 'UNAUTHORIZED' using errcode = 'P0001';
  end if;

  if new_role not in ('super_admin', 'admin', 'sales', 'spv') then
    raise exception 'INVALID_ROLE' using errcode = 'P0001';
  end if;
  if new_status not in ('active', 'inactive') then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;
  if new_full_name is null or length(btrim(new_full_name)) = 0 then
    raise exception 'INVALID_NAME' using errcode = 'P0001';
  end if;

  select role into v_actor_role from public.profiles where user_id = v_actor;

  select role, status into v_target_role, v_target_status
  from public.profiles where user_id = target_user_id;
  if not found then
    raise exception 'USER_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Only a super_admin may grant or remove super_admin.
  if (new_role = 'super_admin' or v_target_role = 'super_admin')
     and v_actor_role <> 'super_admin' then
    raise exception 'SUPER_ADMIN_REQUIRED' using errcode = 'P0001';
  end if;

  -- No self-lockout: a caller cannot demote themself out of admin
  -- capability (previously only checked against 'sales'; 'spv' is just as
  -- much a lockout since it can't manage users either).
  if target_user_id = v_actor then
    if new_role not in ('admin', 'super_admin') then
      raise exception 'CANNOT_DEMOTE_SELF' using errcode = 'P0001';
    end if;
    if new_status <> 'active' then
      raise exception 'CANNOT_DEACTIVATE_SELF' using errcode = 'P0001';
    end if;
  end if;

  -- Keep at least one active super_admin.
  if v_target_role = 'super_admin' and v_target_status = 'active'
     and (new_role <> 'super_admin' or new_status <> 'active') then
    select count(*) into v_others
    from public.profiles
    where role = 'super_admin' and status = 'active'
      and user_id <> target_user_id;
    if v_others = 0 then
      raise exception 'LAST_SUPER_ADMIN' using errcode = 'P0001';
    end if;
  end if;

  update public.profiles
  set full_name = new_full_name,
      role = new_role,
      status = new_status
  where user_id = target_user_id;
end;
$$;

-- ===========================================================================
-- 2. is_results_viewer() — admin/super_admin/spv, for new read-only
--    policies below. Deliberately separate from is_admin(), which also
--    authorizes writes across ~10+ existing policies/RPCs — spv must never
--    be added to is_admin() itself.
-- ===========================================================================

create or replace function public.is_results_viewer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role in ('admin', 'super_admin', 'spv')
       from public.profiles
      where user_id = auth.uid()
        and status = 'active'),
    false
  )
$$;

-- ===========================================================================
-- 3. New additive, SELECT-only policies for spv on the tables the results
--    pages read. Every existing policy touched here for reference is a
--    separate `for select` (or `for all`) policy; these are brand-new
--    policies layered on top, so they cannot widen any existing write
--    access — Postgres OR's multiple permissive policies per command.
-- ===========================================================================

create policy "profiles: results viewer reads all"
  on public.profiles for select
  to authenticated
  using (public.is_results_viewer());

create policy "quizzes: results viewer reads"
  on public.quizzes for select
  to authenticated
  using (public.is_results_viewer());

create policy "assessment_sessions: results viewer reads"
  on public.assessment_sessions for select
  to authenticated
  using (public.is_results_viewer());

create policy "quiz_attempts: results viewer reads"
  on public.quiz_attempts for select
  to authenticated
  using (public.is_results_viewer());

create policy "attempt_questions: results viewer reads"
  on public.attempt_questions for select
  to authenticated
  using (public.is_results_viewer());

create policy "attempt_question_options: results viewer reads"
  on public.attempt_question_options for select
  to authenticated
  using (public.is_results_viewer());

create policy "attempt_answers: results viewer reads"
  on public.attempt_answers for select
  to authenticated
  using (public.is_results_viewer());

create policy "attempt_answer_options: results viewer reads"
  on public.attempt_answer_options for select
  to authenticated
  using (public.is_results_viewer());
