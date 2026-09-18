-- Session link capacity / attempt-override / scheduled-open settings
-- (docs/SESSION_LINK_CAPACITY_PLAN.md). Owner decision: no more
-- per-trainee accounts (including the just-built, now-superseded
-- delegated-sales-account approach) — trainer runs everything through one
-- reusable link, so that link needs real capacity controls to be safe at
-- scale. Name-only candidate identification stays as-is; no new candidate
-- fields here.

-- ===========================================================================
-- 1. New settings on assessment_sessions. All nullable = today's behavior
--    (unlimited candidates, quiz's own max_attempts, opens immediately).
-- ===========================================================================

alter table public.assessment_sessions
  add column max_candidates       integer check (max_candidates is null or max_candidates > 0),
  add column max_attempts_override integer check (max_attempts_override is null or max_attempts_override > 0),
  add column starts_at            timestamptz;

-- ===========================================================================
-- 2. quiz_attempts.session_id — the missing link back to which
--    assessment_sessions row produced a guest attempt. Without this,
--    "how many distinct candidates has this link served" can't be computed
--    at all. Nullable/on delete set null: ordinary account-based attempts
--    never set it, and closing/removing a session must never touch
--    historical attempt data.
-- ===========================================================================

alter table public.quiz_attempts
  add column session_id uuid references public.assessment_sessions (id) on delete set null;

create index quiz_attempts_session_idx on public.quiz_attempts (session_id) where session_id is not null;

-- ===========================================================================
-- 3. start_guest_quiz_attempt — add starts_at + capacity + attempts-
--    override checks, and stamp session_id on the new attempt. Every other
--    line (advisory lock, roster check, snapshot inserts) is unchanged
--    from supabase/migrations/20260918090000_public_session_link.sql.
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
  v_uid            uuid := auth.uid();
  v_session        public.assessment_sessions%rowtype;
  v_quiz           public.quizzes%rowtype;
  v_name           text;
  v_existing       uuid;
  v_count          integer;
  v_next           integer;
  v_attempt        uuid;
  v_now            timestamptz := now();
  v_candidates     integer;
  v_max_attempts   integer;
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
  if v_session.starts_at is not null and v_now < v_session.starts_at then
    raise exception 'SESSION_NOT_STARTED' using errcode = 'P0001';
  end if;
  if v_session.expires_at is not null and v_now > v_session.expires_at then
    raise exception 'SESSION_EXPIRED' using errcode = 'P0001';
  end if;

  select full_name into v_name from public.profiles where user_id = v_uid;
  if v_session.candidate_roster is not null and not (v_name = any (v_session.candidate_roster)) then
    raise exception 'NOT_ON_ROSTER' using errcode = 'P0001';
  end if;

  -- Capacity: only a genuinely new candidate (no attempt via this session
  -- yet) can be turned away once the cap is reached — a candidate already
  -- counted may still resume/retake within their own attempt limit below.
  if v_session.max_candidates is not null
     and not exists (
       select 1 from public.quiz_attempts where session_id = v_session.id and user_id = v_uid
     )
  then
    select count(distinct user_id) into v_candidates
    from public.quiz_attempts
    where session_id = v_session.id;
    if v_candidates >= v_session.max_candidates then
      raise exception 'SESSION_FULL' using errcode = 'P0001';
    end if;
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

  v_max_attempts := coalesce(v_session.max_attempts_override, v_quiz.max_attempts);

  select count(*) into v_count
  from public.quiz_attempts
  where quiz_id = target_quiz_id and user_id = v_uid;
  if v_count >= v_max_attempts then
    raise exception 'ATTEMPT_LIMIT_REACHED' using errcode = 'P0001';
  end if;

  select coalesce(max(attempt_number), 0) + 1 into v_next
  from public.quiz_attempts
  where quiz_id = target_quiz_id and user_id = v_uid;

  insert into public.quiz_attempts (quiz_id, user_id, attempt_number, status, started_at, session_id)
  values (target_quiz_id, v_uid, v_next, 'in_progress', v_now, v_session.id)
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
-- 4. validate_session_token — add the same starts_at check, so the
--    name-entry screen rejects up front instead of only failing at submit.
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
