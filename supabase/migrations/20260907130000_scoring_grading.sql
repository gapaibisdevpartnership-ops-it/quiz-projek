-- Phase 6 — Scoring & Grading.
-- Adds server-side objective scoring, the manual essay-grading RPC, and final
-- score / pass-fail finalisation. Extends submit_quiz_attempt from Phase 5.
-- See docs/API_CONTRACTS.md, docs/DOMAIN_RULES.md, docs/QUESTION_TYPES.md,
-- docs/STATE_AND_DATA_FLOW.md.

-- ===========================================================================
-- score_attempt_objective — sum of points for correctly answered objective
-- questions. Single choice / true-false: the one correct option and nothing
-- else. Multiple choice: exact set match (all-or-nothing, docs/QUESTION_TYPES).
-- ===========================================================================

create or replace function public.score_attempt_objective(target_attempt_id uuid)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_aq          public.attempt_questions%rowtype;
  v_answer_id   uuid;
  v_correct     integer;
  v_sel_correct integer;
  v_sel_total   integer;
  v_score       numeric := 0;
begin
  for v_aq in
    select * from public.attempt_questions
    where attempt_id = target_attempt_id and question_type <> 'essay'
  loop
    select id into v_answer_id
    from public.attempt_answers
    where attempt_id = target_attempt_id and attempt_question_id = v_aq.id;

    if v_answer_id is null then
      continue; -- unanswered → 0
    end if;

    select count(*) into v_correct
    from public.attempt_question_options
    where attempt_question_id = v_aq.id and is_correct;

    select
      count(*) filter (where o.is_correct),
      count(*)
      into v_sel_correct, v_sel_total
    from public.attempt_answer_options ao
    join public.attempt_question_options o
      on o.id = ao.attempt_question_option_id
    where ao.attempt_answer_id = v_answer_id;

    if v_correct > 0
       and v_sel_correct = v_correct
       and v_sel_total = v_correct then
      v_score := v_score + v_aq.points;
    end if;
  end loop;

  return v_score;
end;
$$;

-- ===========================================================================
-- finalize_attempt — combine auto + manual score, compute %, pass/fail, and
-- mark the attempt submitted. Safe to call repeatedly.
-- ===========================================================================

create or replace function public.finalize_attempt(target_attempt_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.quiz_attempts%rowtype;
  v_quiz    public.quizzes%rowtype;
  v_auto    numeric;
  v_manual  numeric;
  v_total   numeric;
  v_final   numeric;
  v_pct     numeric;
begin
  select * into v_attempt from public.quiz_attempts where id = target_attempt_id for update;
  select * into v_quiz from public.quizzes where id = v_attempt.quiz_id;

  v_auto := public.score_attempt_objective(target_attempt_id);

  select coalesce(sum(coalesce(ans.manual_score, 0)), 0) into v_manual
  from public.attempt_answers ans
  join public.attempt_questions aq on aq.id = ans.attempt_question_id
  where ans.attempt_id = target_attempt_id and aq.question_type = 'essay';

  v_total := coalesce(v_attempt.total_points, (
    select coalesce(sum(points), 0) from public.attempt_questions where attempt_id = target_attempt_id
  ));
  v_final := coalesce(v_auto, 0) + coalesce(v_manual, 0);
  v_pct := case when v_total > 0 then round(v_final / v_total * 100, 2) else 0 end;

  update public.quiz_attempts
  set auto_score = v_auto,
      manual_score = v_manual,
      final_score = v_final,
      total_points = v_total,
      percentage = v_pct,
      passed = v_pct >= v_quiz.passing_score,
      status = 'submitted',
      requires_manual_grading = false
  where id = target_attempt_id;
end;
$$;

-- ===========================================================================
-- submit_quiz_attempt — now scores objective questions immediately. If the
-- attempt has essays it waits in pending_review; otherwise it is finalised.
-- Still idempotent and still FOR UPDATE locked.
-- ===========================================================================

create or replace function public.submit_quiz_attempt(target_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_attempt   public.quiz_attempts%rowtype;
  v_has_essay boolean;
  v_auto      numeric;
  v_total     numeric;
begin
  select * into v_attempt from public.quiz_attempts where id = target_attempt_id for update;

  if not found or v_attempt.user_id <> v_uid then
    raise exception 'ATTEMPT_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_attempt.status <> 'in_progress' then
    return jsonb_build_object('status', v_attempt.status, 'alreadyFinalized', true);
  end if;

  select exists (
    select 1 from public.attempt_questions
    where attempt_id = target_attempt_id and question_type = 'essay'
  ) into v_has_essay;

  v_total := coalesce(v_attempt.total_points, (
    select coalesce(sum(points), 0) from public.attempt_questions where attempt_id = target_attempt_id
  ));
  v_auto := public.score_attempt_objective(target_attempt_id);

  update public.quiz_attempts
  set submitted_at = now(),
      time_spent_seconds = greatest(0, extract(epoch from (now() - started_at))::int),
      auto_score = v_auto,
      total_points = v_total,
      requires_manual_grading = v_has_essay
  where id = target_attempt_id;

  if v_has_essay then
    update public.quiz_attempts set status = 'pending_review' where id = target_attempt_id;
    return jsonb_build_object('status', 'pending_review', 'alreadyFinalized', false);
  end if;

  perform public.finalize_attempt(target_attempt_id);
  return jsonb_build_object('status', 'submitted', 'alreadyFinalized', false);
end;
$$;

-- ===========================================================================
-- grade_essay_answer — admin/trainer only. Records the score + feedback and
-- finalises the attempt once every essay is graded.
-- ===========================================================================

create or replace function public.grade_essay_answer(
  target_answer_id uuid,
  score numeric,
  feedback text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid        uuid := auth.uid();
  v_answer     public.attempt_answers%rowtype;
  v_aq         public.attempt_questions%rowtype;
  v_essay_cnt  integer;
  v_graded_cnt integer;
  v_status     text;
begin
  if not public.is_admin() then
    raise exception 'UNAUTHORIZED_GRADING' using errcode = 'P0001';
  end if;

  select * into v_answer from public.attempt_answers where id = target_answer_id;
  if not found then
    raise exception 'ANSWER_NOT_FOUND' using errcode = 'P0001';
  end if;

  select * into v_aq from public.attempt_questions where id = v_answer.attempt_question_id;
  if v_aq.question_type <> 'essay' then
    raise exception 'NOT_AN_ESSAY' using errcode = 'P0001';
  end if;
  if score < 0 or score > v_aq.points then
    raise exception 'SCORE_OUT_OF_RANGE' using errcode = 'P0001';
  end if;

  update public.attempt_answers
  set manual_score = score,
      grader_feedback = feedback,
      graded_by = v_uid,
      graded_at = now()
  where id = target_answer_id;

  -- All essays in this attempt graded?
  select count(*) into v_essay_cnt
  from public.attempt_questions
  where attempt_id = v_answer.attempt_id and question_type = 'essay';

  select count(*) into v_graded_cnt
  from public.attempt_answers ans
  join public.attempt_questions aq on aq.id = ans.attempt_question_id
  where ans.attempt_id = v_answer.attempt_id
    and aq.question_type = 'essay'
    and ans.manual_score is not null;

  if v_graded_cnt >= v_essay_cnt then
    perform public.finalize_attempt(v_answer.attempt_id);
    v_status := 'submitted';
  else
    v_status := 'pending_review';
  end if;

  return jsonb_build_object(
    'status', v_status,
    'graded', v_graded_cnt,
    'totalEssays', v_essay_cnt
  );
end;
$$;

revoke all on function public.score_attempt_objective(uuid) from public, anon;
revoke all on function public.finalize_attempt(uuid) from public, anon, authenticated;
revoke all on function public.grade_essay_answer(uuid, numeric, text) from public, anon;
grant execute on function public.grade_essay_answer(uuid, numeric, text) to authenticated;

-- ===========================================================================
-- Backfill: score attempts that were submitted under the Phase 5 stub.
-- ===========================================================================

do $$
declare r record;
begin
  for r in
    select id from public.quiz_attempts
    where status = 'submitted' and final_score is null
  loop
    perform public.finalize_attempt(r.id);
  end loop;
end $$;
