-- Public "Session Link" entry flow (docs/PUBLIC_SESSION_LINK_PLAN.md).
-- A second, PARALLEL path for taking a quiz — a trainer generates a link
-- for a quiz, shares it, and any candidate who opens it types their name
-- and starts an attempt via a Supabase Anonymous Auth session, with no
-- admin-provisioned account. The existing login-based flow
-- (start_quiz_attempt, save_objective_answer, save_essay_answer,
-- submit_quiz_attempt, get_attempt_for_player) is NOT modified anywhere in
-- this file — every one of those functions keys off `quiz_attempts.user_id
-- = auth.uid()`, and an anonymous session has a real, unique auth.uid(),
-- so they all keep working for a guest attempt completely unchanged.

-- ===========================================================================
-- 1. assessment_sessions — one row per generated link
-- ===========================================================================

create table public.assessment_sessions (
  id                uuid primary key default gen_random_uuid(),
  quiz_id           uuid not null references public.quizzes (id) on delete cascade,
  token             text not null unique default encode(gen_random_bytes(24), 'base64url'),
  label             text,
  candidate_roster  text[],  -- null = open to anyone with the link
  expires_at        timestamptz,
  status            text not null default 'active' check (status in ('active', 'closed')),
  created_by        uuid not null references auth.users (id) on delete cascade,
  created_at        timestamptz not null default now()
);

create index assessment_sessions_token_idx on public.assessment_sessions (token);
create index assessment_sessions_quiz_idx on public.assessment_sessions (quiz_id);

alter table public.assessment_sessions enable row level security;

-- Admins manage sessions directly (create/list/close) — same shape as every
-- other admin-owned table in this app.
create policy "assessment_sessions: admin manages"
  on public.assessment_sessions for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- No policy for anon/authenticated non-admins: the table is never read
-- directly by a candidate. The only public read path is the narrow RPC
-- below, which returns just the fields a candidate needs to see.

-- ===========================================================================
-- 2. profiles.is_guest — set once at account creation, cheap to filter on
--    everywhere (leaderboard, analytics, results labeling) instead of
--    re-querying auth.users.is_anonymous from every function.
-- ===========================================================================

alter table public.profiles add column is_guest boolean not null default false;
create index profiles_is_guest_idx on public.profiles (is_guest) where is_guest;

-- ===========================================================================
-- 3. handle_new_user — also handle anonymous sign-ins.
--    Anonymous auth.users rows have email = NULL, but profiles.email is
--    NOT NULL — without this fix, an anonymous sign-in's profile insert
--    (and therefore the whole sign-in) would fail outright. Confirmed via
--    a live test against this project: anonymous sign-in currently returns
--    "Anonymous sign-ins are disabled" until enabled in the Supabase
--    dashboard (Authentication -> Sign In / Providers) — a manual,
--    one-time step outside what a migration can do.
-- ===========================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, email, full_name, role, status, is_guest)
  values (
    new.id,
    coalesce(new.email, 'guest+' || new.id::text || '@guest.local'),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'sales',          -- elevated roles are granted only via admin_update_user()
    'active',
    coalesce(new.is_anonymous, false)
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

-- ===========================================================================
-- 4. validate_session_token — public (anon-callable) read path for the
--    name-entry screen. Returns only what's needed to render that screen;
--    never exposes answer-key data (it doesn't touch attempt/question
--    tables at all).
-- ===========================================================================

create or replace function public.validate_session_token(target_token text)
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
  select * into v_session from public.assessment_sessions where token = target_token;
  if not found or v_session.status <> 'active' then
    raise exception 'SESSION_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_session.expires_at is not null and now() > v_session.expires_at then
    raise exception 'SESSION_EXPIRED' using errcode = 'P0001';
  end if;

  select * into v_quiz from public.quizzes where id = v_session.quiz_id;
  if not found or v_quiz.status <> 'published' then
    raise exception 'QUIZ_NOT_AVAILABLE' using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'quizId', v_quiz.id,
    'quizTitle', v_quiz.title,
    'instructions', v_quiz.instructions,
    'durationMinutes', v_quiz.duration_minutes,
    'showResult', v_quiz.show_result,
    'rosterRequired', v_session.candidate_roster is not null
  );
end;
$$;

revoke all on function public.validate_session_token(text) from public;
grant execute on function public.validate_session_token(text) to anon, authenticated;

-- ===========================================================================
-- 5. set_my_guest_display_name — a guest names themself. Guarded so it can
--    NEVER be used by a real account to rename itself or anyone else: only
--    the caller's own row, only when their session is anonymous.
-- ===========================================================================

create or replace function public.set_my_guest_display_name(display_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := trim(display_name);
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) is not true then
    raise exception 'GUEST_ONLY' using errcode = 'P0001';
  end if;
  if v_name = '' or char_length(v_name) > 120 then
    raise exception 'INVALID_NAME' using errcode = 'P0001';
  end if;

  update public.profiles set full_name = v_name, updated_at = now() where user_id = v_uid;
end;
$$;

revoke all on function public.set_my_guest_display_name(text) from public, anon;
grant execute on function public.set_my_guest_display_name(text) to authenticated;

-- ===========================================================================
-- 6. start_guest_quiz_attempt — the guest counterpart to start_quiz_attempt.
--    Deliberately a DIFFERENT function (not an overload of
--    start_quiz_attempt): a 2-arg overload with a default on the 2nd
--    parameter would be ambiguous with the existing 1-arg function for any
--    1-argument call, which Postgres rejects at call time. A distinct name
--    keeps the existing function 100% untouched and removes that risk
--    entirely. Body mirrors start_quiz_attempt (including the advisory
--    lock from docs/START_ATTEMPT_RACE_FIX_PLAN.md, built in from the
--    start rather than retrofitted), with quiz_assigned_to_me() replaced
--    by a session-token + roster check.
-- ===========================================================================

create or replace function public.start_guest_quiz_attempt(
  target_quiz_id uuid,
  session_token text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_session   public.assessment_sessions%rowtype;
  v_quiz      public.quizzes%rowtype;
  v_name      text;
  v_existing  uuid;
  v_count     integer;
  v_next      integer;
  v_attempt   uuid;
  v_now       timestamptz := now();
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) is not true then
    raise exception 'GUEST_ONLY' using errcode = 'P0001';
  end if;
  if not public.is_active() then
    raise exception 'ACCOUNT_INACTIVE' using errcode = 'P0001';
  end if;

  -- Serialize concurrent starts for the same (guest, quiz) pair — same
  -- treatment as the account-based path (docs/START_ATTEMPT_RACE_FIX_PLAN.md).
  perform pg_advisory_xact_lock(hashtext(target_quiz_id::text || v_uid::text));

  select * into v_session from public.assessment_sessions where token = session_token;
  if not found or v_session.status <> 'active' or v_session.quiz_id <> target_quiz_id then
    raise exception 'SESSION_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_session.expires_at is not null and v_now > v_session.expires_at then
    raise exception 'SESSION_EXPIRED' using errcode = 'P0001';
  end if;

  select full_name into v_name from public.profiles where user_id = v_uid;
  if v_session.candidate_roster is not null and not (v_name = any (v_session.candidate_roster)) then
    raise exception 'NOT_ON_ROSTER' using errcode = 'P0001';
  end if;

  select * into v_quiz from public.quizzes where id = target_quiz_id;
  if not found or v_quiz.status <> 'published' then
    raise exception 'QUIZ_NOT_AVAILABLE' using errcode = 'P0001';
  end if;
  if v_quiz.start_at is not null and v_now < v_quiz.start_at then
    raise exception 'QUIZ_NOT_OPEN_YET' using errcode = 'P0001';
  end if;
  if v_quiz.end_at is not null and v_now > v_quiz.end_at then
    raise exception 'QUIZ_CLOSED' using errcode = 'P0001';
  end if;

  -- Resume an in-progress attempt instead of starting a new one.
  select id into v_existing
  from public.quiz_attempts
  where quiz_id = target_quiz_id and user_id = v_uid and status = 'in_progress'
  order by attempt_number desc
  limit 1;
  if v_existing is not null then
    return v_existing;
  end if;

  select count(*) into v_count
  from public.quiz_attempts
  where quiz_id = target_quiz_id and user_id = v_uid;
  if v_count >= v_quiz.max_attempts then
    raise exception 'ATTEMPT_LIMIT_REACHED' using errcode = 'P0001';
  end if;

  select coalesce(max(attempt_number), 0) + 1 into v_next
  from public.quiz_attempts
  where quiz_id = target_quiz_id and user_id = v_uid;

  insert into public.quiz_attempts (quiz_id, user_id, attempt_number, status, started_at)
  values (target_quiz_id, v_uid, v_next, 'in_progress', v_now)
  returning id into v_attempt;

  insert into public.attempt_questions (
    attempt_id, source_question_id, question_type, question_text,
    question_image_url, points, sort_order, explanation, sample_answer,
    grading_notes, keywords
  )
  select
    v_attempt, q.id, q.question_type, q.question_text, q.question_image_url,
    qq.points, qq.sort_order, q.explanation, q.sample_answer, q.grading_notes,
    q.keywords
  from public.quiz_questions qq
  join public.questions q on q.id = qq.question_id
  where qq.quiz_id = target_quiz_id;

  insert into public.attempt_question_options (
    attempt_question_id, source_option_id, answer_text, image_url, is_correct, sort_order
  )
  select
    aq.id, o.id, o.answer_text, o.image_url, o.is_correct, o.sort_order
  from public.attempt_questions aq
  join public.question_options o on o.question_id = aq.source_question_id
  where aq.attempt_id = v_attempt;

  update public.quiz_attempts
  set total_points = (
    select coalesce(sum(points), 0) from public.attempt_questions where attempt_id = v_attempt
  )
  where id = v_attempt;

  return v_attempt;
end;
$$;

revoke all on function public.start_guest_quiz_attempt(uuid, text) from public, anon;
grant execute on function public.start_guest_quiz_attempt(uuid, text) to authenticated;

-- ===========================================================================
-- 7. leaderboard — exclude guests from the internal sales leaderboard.
--    Everything else about this function is unchanged; only the WHERE
--    clause gains one condition.
-- ===========================================================================

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
  where p.role = 'sales' and p.status = 'active' and p.is_guest = false
  group by p.user_id, coalesce(nullif(p.full_name, ''), p.email)
  order by avg_percentage desc nulls last, attempts desc
  limit greatest(1, least(row_limit, 100));
$$;

revoke all on function public.leaderboard(integer) from public, anon;
grant execute on function public.leaderboard(integer) to authenticated;
