-- Phase 8 follow-up — auto-expire abandoned in_progress attempts.
--
-- The quiz player auto-submits while the browser tab is open. If the tab is
-- closed (crash, lost connection, walked away) the attempt otherwise sits in
-- 'in_progress' forever: it keeps counting against max_attempts, shows up as
-- active on the dashboard, and never scores. This sweep finalises any attempt
-- whose server-side deadline has passed, using the same scoring path as a real
-- user submission.
--
-- See docs/DOMAIN_RULES.md ("Timer", "Quiz Availability"),
-- docs/STATE_AND_DATA_FLOW.md, docs/API_CONTRACTS.md.

-- ===========================================================================
-- attempt_deadline(attempt) -> timestamptz | null
--
-- The moment an in-progress attempt must stop accepting answers: the earlier of
--   * started_at + quiz.duration_minutes   (per-attempt timer), and
--   * quiz.end_at                          (quiz window close).
-- NULL when the quiz has neither a duration nor an end_at — such attempts have
-- no timer and are never swept (docs/DOMAIN_RULES.md "Timer").
-- LEAST() ignores NULL operands, so a quiz with only one of the two still
-- yields that one.
-- ===========================================================================

create or replace function public.attempt_deadline(target_attempt_id uuid)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select least(
    case
      when q.duration_minutes is not null
      then a.started_at + make_interval(mins => q.duration_minutes)
    end,
    q.end_at
  )
  from public.quiz_attempts a
  join public.quizzes q on q.id = a.quiz_id
  where a.id = target_attempt_id;
$$;

-- ===========================================================================
-- expire_stale_attempts() -> integer
--
-- Finalises every 'in_progress' attempt whose deadline has passed. For each:
--   * submitted_at is stamped at the deadline (not now) so time_spent_seconds
--     reflects the allotted time, not how long the row was abandoned;
--   * objective questions are scored exactly as submit_quiz_attempt does;
--   * attempts with an essay move to 'pending_review' (a trainer still grades);
--   * attempts without an essay are finalised to 'submitted' via
--     finalize_attempt (percentage / passed computed).
--
-- Idempotent by construction: only 'in_progress' rows are touched, and each is
-- moved out of that state. SKIP LOCKED lets concurrent sweeps coexist.
-- Service-role only — invoke from a scheduler (see the pg_cron block below or
-- the /api/cron/expire-attempts route).
-- ===========================================================================

create or replace function public.expire_stale_attempts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r           record;
  v_deadline  timestamptz;
  v_has_essay boolean;
  v_auto      numeric;
  v_total     numeric;
  v_count     integer := 0;
begin
  for r in
    select a.id, a.started_at
    from public.quiz_attempts a
    where a.status = 'in_progress'
      and public.attempt_deadline(a.id) is not null
      and public.attempt_deadline(a.id) < now()
    for update of a skip locked
  loop
    v_deadline := public.attempt_deadline(r.id);

    select exists (
      select 1 from public.attempt_questions
      where attempt_id = r.id and question_type = 'essay'
    ) into v_has_essay;

    select coalesce(sum(points), 0) into v_total
    from public.attempt_questions where attempt_id = r.id;

    v_auto := public.score_attempt_objective(r.id);

    update public.quiz_attempts
    set submitted_at = v_deadline,
        time_spent_seconds =
          greatest(0, extract(epoch from (v_deadline - r.started_at))::int),
        auto_score = v_auto,
        total_points = coalesce(total_points, v_total),
        requires_manual_grading = v_has_essay
    where id = r.id;

    if v_has_essay then
      update public.quiz_attempts
      set status = 'pending_review'
      where id = r.id;
    else
      perform public.finalize_attempt(r.id);
    end if;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- ===========================================================================
-- Grants — service-role only; both functions run SECURITY DEFINER.
-- ===========================================================================

revoke all on function public.attempt_deadline(uuid)  from public, anon, authenticated;
revoke all on function public.expire_stale_attempts() from public, anon, authenticated;
grant execute on function public.attempt_deadline(uuid)  to service_role;
grant execute on function public.expire_stale_attempts() to service_role;

-- ===========================================================================
-- Optional in-database schedule.
--
-- If the project has pg_cron enabled, uncomment to run the sweep every minute
-- with no external scheduler. Otherwise the Vercel cron route
-- (/api/cron/expire-attempts) drives it. Keep exactly one scheduler active.
--
--   create extension if not exists pg_cron;
--   select cron.schedule(
--     'expire-stale-attempts',
--     '* * * * *',
--     $cron$ select public.expire_stale_attempts() $cron$
--   );
-- ===========================================================================
