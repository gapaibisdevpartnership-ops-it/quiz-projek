-- Phase 5 — Quiz Engine: attempts, immutable snapshots, and the controlled
-- RPCs that start / answer / submit an attempt.
-- See docs/DATABASE_SCHEMA.md, docs/API_CONTRACTS.md, docs/DOMAIN_RULES.md,
-- docs/SECURITY_RLS.md, docs/STATE_AND_DATA_FLOW.md.

-- ===========================================================================
-- Tables
-- ===========================================================================

create table public.quiz_attempts (
  id                      uuid primary key default gen_random_uuid(),
  quiz_id                 uuid not null references public.quizzes (id) on delete restrict,
  user_id                 uuid not null references auth.users (id) on delete cascade,
  attempt_number          integer not null,
  status                  text not null default 'in_progress'
                            check (status in ('in_progress', 'pending_review', 'submitted', 'expired')),
  started_at              timestamptz not null default now(),
  submitted_at            timestamptz,
  auto_score              numeric,
  manual_score            numeric,
  final_score             numeric,
  total_points            numeric,
  percentage              numeric,
  passed                  boolean,
  requires_manual_grading boolean not null default false,
  time_spent_seconds      integer,
  created_at              timestamptz not null default now(),
  unique (quiz_id, user_id, attempt_number)
);

create index quiz_attempts_user_quiz_idx on public.quiz_attempts (user_id, quiz_id);
create index quiz_attempts_status_idx on public.quiz_attempts (status);

create table public.attempt_questions (
  id                 uuid primary key default gen_random_uuid(),
  attempt_id         uuid not null references public.quiz_attempts (id) on delete cascade,
  source_question_id uuid,
  question_type      text not null,
  question_text      text,
  question_image_url text,
  points             numeric not null,
  sort_order         integer not null,
  explanation        text,
  sample_answer      text,
  grading_notes      text
);

create index attempt_questions_attempt_idx
  on public.attempt_questions (attempt_id, sort_order);

create table public.attempt_question_options (
  id                  uuid primary key default gen_random_uuid(),
  attempt_question_id uuid not null references public.attempt_questions (id) on delete cascade,
  source_option_id    uuid,
  answer_text         text,
  image_url           text,
  is_correct          boolean not null,
  sort_order          integer not null
);

create index attempt_question_options_aq_idx
  on public.attempt_question_options (attempt_question_id, sort_order);

create table public.attempt_answers (
  id                  uuid primary key default gen_random_uuid(),
  attempt_id          uuid not null references public.quiz_attempts (id) on delete cascade,
  attempt_question_id uuid not null references public.attempt_questions (id) on delete cascade,
  essay_answer        text,
  manual_score        numeric,
  grader_feedback     text,
  graded_by           uuid references auth.users (id),
  graded_at           timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (attempt_id, attempt_question_id)
);

create index attempt_answers_attempt_idx on public.attempt_answers (attempt_id);

create trigger attempt_answers_set_updated_at
  before update on public.attempt_answers
  for each row execute function public.set_updated_at();

create table public.attempt_answer_options (
  id                         uuid primary key default gen_random_uuid(),
  attempt_answer_id          uuid not null references public.attempt_answers (id) on delete cascade,
  attempt_question_option_id uuid not null references public.attempt_question_options (id) on delete cascade,
  created_at                 timestamptz not null default now(),
  unique (attempt_answer_id, attempt_question_option_id)
);

-- ===========================================================================
-- RLS
--
-- Sales never SELECT the snapshot tables directly (they carry is_correct,
-- sample_answer, grading_notes). All reads for the player go through
-- get_attempt_for_player(), all writes through the RPCs below — every one
-- SECURITY DEFINER with its own authorization checks. Direct write policies
-- are intentionally absent for non-admins.
-- ===========================================================================

alter table public.quiz_attempts            enable row level security;
alter table public.attempt_questions        enable row level security;
alter table public.attempt_question_options enable row level security;
alter table public.attempt_answers          enable row level security;
alter table public.attempt_answer_options   enable row level security;

-- quiz_attempts: owner reads own, admin reads all.
create policy "quiz_attempts: owner reads own"
  on public.quiz_attempts for select
  to authenticated
  using (user_id = auth.uid());

create policy "quiz_attempts: admin reads all"
  on public.quiz_attempts for select
  to authenticated
  using (public.is_admin());

-- Snapshot tables + answers: admin-only direct access. (Owner data reaches the
-- player via the RPC, which strips the sensitive columns.)
create policy "attempt_questions: admin reads"
  on public.attempt_questions for select
  to authenticated using (public.is_admin());

create policy "attempt_question_options: admin reads"
  on public.attempt_question_options for select
  to authenticated using (public.is_admin());

create policy "attempt_answers: admin reads"
  on public.attempt_answers for select
  to authenticated using (public.is_admin());

create policy "attempt_answers: owner reads own"
  on public.attempt_answers for select
  to authenticated
  using (
    exists (
      select 1 from public.quiz_attempts a
      where a.id = attempt_answers.attempt_id and a.user_id = auth.uid()
    )
  );

create policy "attempt_answer_options: admin reads"
  on public.attempt_answer_options for select
  to authenticated using (public.is_admin());

-- ===========================================================================
-- start_quiz_attempt
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
    question_image_url, points, sort_order, explanation, sample_answer, grading_notes
  )
  select
    v_attempt, q.id, q.question_type, q.question_text, q.question_image_url,
    qq.points, qq.sort_order, q.explanation, q.sample_answer, q.grading_notes
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
-- get_attempt_for_player  — safe payload, no answer keys
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
    'quiz', jsonb_build_object('id', v_quiz.id, 'title', v_quiz.title, 'instructions', v_quiz.instructions),
    'questions', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', aq.id,
          'type', aq.question_type,
          'text', aq.question_text,
          'imageUrl', aq.question_image_url,
          'points', aq.points,
          'sortOrder', aq.sort_order,
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
-- save_objective_answer
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

-- ===========================================================================
-- save_essay_answer
-- ===========================================================================

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
  if v_aq.question_type <> 'essay' then
    raise exception 'WRONG_QUESTION_TYPE' using errcode = 'P0001';
  end if;

  insert into public.attempt_answers (attempt_id, attempt_question_id, essay_answer)
  values (v_attempt.id, target_attempt_question_id, essay)
  on conflict (attempt_id, attempt_question_id)
  do update set essay_answer = excluded.essay_answer, updated_at = now();
end;
$$;

-- ===========================================================================
-- submit_quiz_attempt
--
-- Phase 5: transition state, stamp timestamps, flag manual grading, record
-- total points. Objective scoring is added to this RPC in Phase 6.
-- Idempotent: a second call on a finalized attempt is a no-op.
-- ===========================================================================

create or replace function public.submit_quiz_attempt(target_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_attempt  public.quiz_attempts%rowtype;
  v_has_essay boolean;
  v_status   text;
begin
  select * into v_attempt from public.quiz_attempts
  where id = target_attempt_id
  for update;

  if not found or v_attempt.user_id <> v_uid then
    raise exception 'ATTEMPT_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_attempt.status <> 'in_progress' then
    -- Idempotent: already finalized.
    return jsonb_build_object('status', v_attempt.status, 'alreadyFinalized', true);
  end if;

  select exists (
    select 1 from public.attempt_questions
    where attempt_id = target_attempt_id and question_type = 'essay'
  ) into v_has_essay;

  v_status := case when v_has_essay then 'pending_review' else 'submitted' end;

  update public.quiz_attempts
  set status = v_status,
      submitted_at = now(),
      time_spent_seconds = greatest(0, extract(epoch from (now() - started_at))::int),
      requires_manual_grading = v_has_essay,
      total_points = coalesce(total_points, (
        select coalesce(sum(points), 0) from public.attempt_questions where attempt_id = target_attempt_id
      ))
  where id = target_attempt_id;

  return jsonb_build_object('status', v_status, 'alreadyFinalized', false);
end;
$$;

-- Lock down execution to signed-in users (RPCs check authorization internally).
revoke all on function public.start_quiz_attempt(uuid) from public, anon;
revoke all on function public.get_attempt_for_player(uuid) from public, anon;
revoke all on function public.save_objective_answer(uuid, uuid[]) from public, anon;
revoke all on function public.save_essay_answer(uuid, text) from public, anon;
revoke all on function public.submit_quiz_attempt(uuid) from public, anon;
grant execute on function public.start_quiz_attempt(uuid) to authenticated;
grant execute on function public.get_attempt_for_player(uuid) to authenticated;
grant execute on function public.save_objective_answer(uuid, uuid[]) to authenticated;
grant execute on function public.save_essay_answer(uuid, text) to authenticated;
grant execute on function public.submit_quiz_attempt(uuid) to authenticated;
