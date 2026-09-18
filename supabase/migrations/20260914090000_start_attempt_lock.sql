-- Fix docs/IMPROVEMENT_BACKLOG.md P1 #6: start_quiz_attempt had no lock
-- serializing concurrent calls for the same (user, quiz) pair. Its
-- "resume an in-progress attempt?" select, "count(*) >= max_attempts?"
-- check, and "next attempt_number" computation were three separate
-- unlocked reads — a burst of concurrent RPC calls (double-click, two open
-- tabs) could each read the same "count so far" before any of them
-- committed, each pass the max_attempts check, and each insert a distinct
-- attempt (different attempt_number, so no unique-constraint collision) —
-- exceeding the configured attempt limit.
--
-- Confirmed reproducible live: tests/chaos/start-attempt-race.test.ts,
-- docs/reports/CHAOS_TESTING_REPORT.md.
--
-- Fix: take a transaction-scoped Postgres advisory lock keyed on
-- (target_quiz_id, caller) as the first thing the function does. This
-- blocks any other concurrent call for the same (user, quiz) pair until the
-- first transaction commits or rolls back, and releases automatically — no
-- explicit unlock, no new table/column/index. It serializes the entire
-- resume-check / count-check / attempt_number-computation / insert sequence
-- per (user, quiz) pair, closing the race completely — unlike a partial
-- unique index on status = 'in_progress' alone, which only prevents
-- duplicate in-progress rows and would not stop two concurrent calls from
-- each independently passing the max_attempts count check with different
-- attempt_numbers.
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

  -- Serialize concurrent starts for the same (user, quiz) — see comment above.
  perform pg_advisory_xact_lock(hashtext(target_quiz_id::text || v_uid::text));

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
    grading_notes, keywords
  )
  select
    v_attempt, q.id, q.question_type, q.question_text, q.question_image_url,
    qq.points, qq.sort_order, q.explanation, q.sample_answer, q.grading_notes,
    q.keywords
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
