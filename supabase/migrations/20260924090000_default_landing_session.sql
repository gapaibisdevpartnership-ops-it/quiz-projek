-- Root domain (`/`) as the public quiz landing page
-- (docs/ROOT_DOMAIN_LANDING_PLAN.md). Trainer designates one session
-- link as "homepage"; `/` renders its candidate entry screen directly.

alter table public.assessment_sessions
  add column is_default_landing boolean not null default false;

-- At most one row can ever be true — enforced at the DB level, not just
-- by the RPC below's own logic.
create unique index assessment_sessions_default_landing_unique
  on public.assessment_sessions (is_default_landing)
  where is_default_landing;

-- ===========================================================================
-- set_default_landing_session — admin-only. Unsets every row first, then
-- (optionally) sets the target, all in one transaction so there's never a
-- moment with two true rows, and no race between two admins clicking at once.
-- ===========================================================================

create or replace function public.set_default_landing_session(
  target_session_id uuid,
  enabled boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'UNAUTHORIZED' using errcode = 'P0001';
  end if;

  update public.assessment_sessions
  set is_default_landing = false
  where is_default_landing = true;

  if enabled then
    update public.assessment_sessions
    set is_default_landing = true
    where id = target_session_id;
  end if;
end;
$$;

revoke all on function public.set_default_landing_session(uuid, boolean)
  from public, anon;
grant execute on function public.set_default_landing_session(uuid, boolean)
  to authenticated;

-- ===========================================================================
-- get_default_landing_session — public (anon-callable) read path for `/`,
-- near-verbatim copy of validate_session_token but looks up the one
-- is_default_landing row instead of a token, and also returns the token
-- itself (startGuestSession needs it, unchanged).
-- ===========================================================================

create or replace function public.get_default_landing_session()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_session public.assessment_sessions%rowtype;
  v_quiz    public.quizzes%rowtype;
begin
  select * into v_session from public.assessment_sessions where is_default_landing = true;
  if not found or v_session.status <> 'active' then
    raise exception 'NO_DEFAULT_LINK' using errcode = 'P0001';
  end if;
  if v_session.starts_at is not null and now() < v_session.starts_at then
    raise exception 'SESSION_NOT_STARTED' using errcode = 'P0001';
  end if;
  if v_session.expires_at is not null and now() > v_session.expires_at then
    raise exception 'SESSION_EXPIRED' using errcode = 'P0001';
  end if;

  select * into v_quiz from public.quizzes where id = v_session.quiz_id;
  if not found or v_quiz.status <> 'published' then
    raise exception 'QUIZ_NOT_AVAILABLE' using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'token', v_session.token,
    'quizId', v_quiz.id,
    'quizTitle', v_quiz.title,
    'instructions', v_quiz.instructions,
    'durationMinutes', v_quiz.duration_minutes,
    'showResult', v_quiz.show_result,
    'rosterRequired', v_session.candidate_roster is not null
  );
end;
$$;

revoke all on function public.get_default_landing_session() from public;
grant execute on function public.get_default_landing_session() to anon, authenticated;
