-- Per-question time limit + answer lock, opt-in per quiz
-- (docs/PER_QUESTION_TIME_LIMIT_PLAN.md). Every existing quiz keeps
-- strict_timing_enabled = false, so this is a no-op for them.

-- ===========================================================================
-- 1. Schema
-- ===========================================================================

alter table public.quizzes
  add column strict_timing_enabled boolean not null default false;

alter table public.quiz_questions
  add column time_limit_seconds integer null
    check (time_limit_seconds is null or time_limit_seconds > 0);

alter table public.attempt_questions
  add column time_limit_seconds integer null,
  add column viewed_at timestamptz null,
  add column locked_at timestamptz null;

-- ===========================================================================
-- 2. start_quiz_attempt — snapshot time_limit_seconds like points already is.
-- ===========================================================================

create or replace function public.start_quiz_attempt(target_quiz_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_quiz      public.quizzes%rowtype;
  v_existing  uuid;
  v_count     integer;
  v_next      integer;
  v_attempt   uuid;
  v_now       timestamptz := now();
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;

  if not public.is_active() then
    raise exception 'ACCOUNT_INACTIVE' using errcode = 'P0001';
  end if;

  select * into v_quiz from public.quizzes where id = target_quiz_id;
  if not found or v_quiz.status <> 'published' then
    raise exception 'QUIZ_NOT_AVAILABLE' using errcode = 'P0001';
  end if;

  if not public.quiz_assigned_to_me(target_quiz_id) then
    raise exception 'QUIZ_NOT_ASSIGNED' using errcode = 'P0001';
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

  -- Snapshot questions.
  insert into public.attempt_questions (
    attempt_id, source_question_id, question_type, question_text,
    question_image_url, points, sort_order, explanation, sample_answer,
    grading_notes, time_limit_seconds
  )
  select
    v_attempt, q.id, q.question_type, q.question_text, q.question_image_url,
    qq.points, qq.sort_order, q.explanation, q.sample_answer, q.grading_notes,
    qq.time_limit_seconds
  from public.quiz_questions qq
  join public.questions q on q.id = qq.question_id
  where qq.quiz_id = target_quiz_id;

  -- Snapshot options.
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

-- ===========================================================================
-- 3. start_guest_quiz_attempt — same snapshot addition for the guest path.
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
    grading_notes, keywords, time_limit_seconds
  )
  select
    v_attempt, q.id, q.question_type, q.question_text, q.question_image_url,
    qq.points, qq.sort_order, q.explanation, q.sample_answer, q.grading_notes,
    q.keywords, qq.time_limit_seconds
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

-- ===========================================================================
-- 4. get_attempt_for_player — surface strictTimingEnabled + per-question
--    timing fields to the player payload.
-- ===========================================================================

create or replace function public.get_attempt_for_player(target_attempt_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_attempt public.quiz_attempts%rowtype;
  v_quiz    public.quizzes%rowtype;
  v_result  jsonb;
begin
  select * into v_attempt from public.quiz_attempts where id = target_attempt_id;
  if not found or v_attempt.user_id <> v_uid then
    raise exception 'ATTEMPT_NOT_FOUND' using errcode = 'P0001';
  end if;

  select * into v_quiz from public.quizzes where id = v_attempt.quiz_id;

  select jsonb_build_object(
    'attempt', jsonb_build_object(
      'id', v_attempt.id,
      'quizId', v_attempt.quiz_id,
      'status', v_attempt.status,
      'startedAt', v_attempt.started_at,
      'submittedAt', v_attempt.submitted_at,
      'serverNow', now(),
      'durationMinutes', v_quiz.duration_minutes,
      'shuffleQuestions', v_quiz.shuffle_questions,
      'shuffleAnswers', v_quiz.shuffle_answers
    ),
    'quiz', jsonb_build_object(
      'id', v_quiz.id, 'title', v_quiz.title, 'instructions', v_quiz.instructions,
      'strictTimingEnabled', v_quiz.strict_timing_enabled
    ),
    'questions', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', aq.id,
          'type', aq.question_type,
          'text', aq.question_text,
          'imageUrl', aq.question_image_url,
          'points', aq.points,
          'sortOrder', aq.sort_order,
          'timeLimitSeconds', aq.time_limit_seconds,
          'viewedAt', aq.viewed_at,
          'lockedAt', aq.locked_at,
          'options', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', o.id, 'text', o.answer_text, 'imageUrl', o.image_url, 'sortOrder', o.sort_order
              ) order by o.sort_order
            )
            from public.attempt_question_options o
            where o.attempt_question_id = aq.id
          ), '[]'::jsonb),
          'answer', (
            select jsonb_build_object(
              'essay', ans.essay_answer,
              'selectedOptionIds', coalesce((
                select jsonb_agg(ao.attempt_question_option_id)
                from public.attempt_answer_options ao
                where ao.attempt_answer_id = ans.id
              ), '[]'::jsonb)
            )
            from public.attempt_answers ans
            where ans.attempt_id = v_attempt.id and ans.attempt_question_id = aq.id
          )
        ) order by aq.sort_order
      )
      from public.attempt_questions aq
      where aq.attempt_id = v_attempt.id
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

-- ===========================================================================
-- 5. mark_question_viewed — idempotent, anchors a question's personal
--    countdown so it survives a page reload.
-- ===========================================================================

create or replace function public.mark_question_viewed(target_attempt_question_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_attempt public.quiz_attempts%rowtype;
  v_aq      public.attempt_questions%rowtype;
begin
  select aq.* into v_aq from public.attempt_questions aq where aq.id = target_attempt_question_id;
  if not found then
    raise exception 'QUESTION_NOT_IN_ATTEMPT' using errcode = 'P0001';
  end if;

  select * into v_attempt from public.quiz_attempts where id = v_aq.attempt_id;
  if v_attempt.user_id <> v_uid then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  if v_attempt.status <> 'in_progress' then
    raise exception 'ATTEMPT_NOT_ACTIVE' using errcode = 'P0001';
  end if;

  update public.attempt_questions
  set viewed_at = coalesce(viewed_at, now())
  where id = target_attempt_question_id
  returning viewed_at into v_aq.viewed_at;

  return v_aq.viewed_at;
end;
$$;

-- ===========================================================================
-- 6. lock_attempt_question — the actual lock. Idempotent.
-- ===========================================================================

create or replace function public.lock_attempt_question(target_attempt_question_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_attempt public.quiz_attempts%rowtype;
  v_aq      public.attempt_questions%rowtype;
begin
  select aq.* into v_aq from public.attempt_questions aq where aq.id = target_attempt_question_id;
  if not found then
    raise exception 'QUESTION_NOT_IN_ATTEMPT' using errcode = 'P0001';
  end if;

  select * into v_attempt from public.quiz_attempts where id = v_aq.attempt_id;
  if v_attempt.user_id <> v_uid then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  if v_attempt.status <> 'in_progress' then
    raise exception 'ATTEMPT_NOT_ACTIVE' using errcode = 'P0001';
  end if;

  update public.attempt_questions
  set locked_at = coalesce(locked_at, now())
  where id = target_attempt_question_id;
end;
$$;

revoke all on function public.mark_question_viewed(uuid) from public, anon;
grant execute on function public.mark_question_viewed(uuid) to authenticated;
revoke all on function public.lock_attempt_question(uuid) from public, anon;
grant execute on function public.lock_attempt_question(uuid) to authenticated;

-- ===========================================================================
-- 7. save_objective_answer / save_essay_answer — reject writes to a locked
--    question. This is the real guarantee; everything client-side is UX.
-- ===========================================================================

create or replace function public.save_objective_answer(
  target_attempt_question_id uuid,
  selected_option_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_attempt   public.quiz_attempts%rowtype;
  v_aq        public.attempt_questions%rowtype;
  v_answer_id uuid;
  v_valid     integer;
begin
  select aq.* into v_aq from public.attempt_questions aq where aq.id = target_attempt_question_id;
  if not found then
    raise exception 'QUESTION_NOT_IN_ATTEMPT' using errcode = 'P0001';
  end if;

  select * into v_attempt from public.quiz_attempts where id = v_aq.attempt_id;
  if v_attempt.user_id <> v_uid then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  if v_attempt.status <> 'in_progress' then
    raise exception 'ATTEMPT_NOT_ACTIVE' using errcode = 'P0001';
  end if;
  if v_aq.locked_at is not null then
    raise exception 'QUESTION_LOCKED' using errcode = 'P0001';
  end if;
  if v_aq.question_type = 'essay' then
    raise exception 'WRONG_QUESTION_TYPE' using errcode = 'P0001';
  end if;

  if array_length(selected_option_ids, 1) is not null then
    select count(*) into v_valid
    from public.attempt_question_options
    where attempt_question_id = target_attempt_question_id
      and id = any (selected_option_ids);
    if v_valid <> array_length(selected_option_ids, 1) then
      raise exception 'OPTION_NOT_IN_QUESTION' using errcode = 'P0001';
    end if;
  end if;

  insert into public.attempt_answers (attempt_id, attempt_question_id)
  values (v_attempt.id, target_attempt_question_id)
  on conflict (attempt_id, attempt_question_id) do update set updated_at = now()
  returning id into v_answer_id;

  delete from public.attempt_answer_options where attempt_answer_id = v_answer_id;
  if array_length(selected_option_ids, 1) is not null then
    insert into public.attempt_answer_options (attempt_answer_id, attempt_question_option_id)
    select v_answer_id, unnest(selected_option_ids);
  end if;
end;
$$;

create or replace function public.save_essay_answer(
  target_attempt_question_id uuid,
  essay text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_attempt public.quiz_attempts%rowtype;
  v_aq      public.attempt_questions%rowtype;
begin
  select aq.* into v_aq from public.attempt_questions aq where aq.id = target_attempt_question_id;
  if not found then
    raise exception 'QUESTION_NOT_IN_ATTEMPT' using errcode = 'P0001';
  end if;

  select * into v_attempt from public.quiz_attempts where id = v_aq.attempt_id;
  if v_attempt.user_id <> v_uid then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  if v_attempt.status <> 'in_progress' then
    raise exception 'ATTEMPT_NOT_ACTIVE' using errcode = 'P0001';
  end if;
  if v_aq.locked_at is not null then
    raise exception 'QUESTION_LOCKED' using errcode = 'P0001';
  end if;
  if v_aq.question_type <> 'essay' then
    raise exception 'WRONG_QUESTION_TYPE' using errcode = 'P0001';
  end if;

  insert into public.attempt_answers (attempt_id, attempt_question_id, essay_answer)
  values (v_attempt.id, target_attempt_question_id, essay)
  on conflict (attempt_id, attempt_question_id)
  do update set essay_answer = excluded.essay_answer, updated_at = now();
end;
$$;
