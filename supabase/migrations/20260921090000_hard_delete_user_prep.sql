-- Preparation for super-admin-only permanent user deletion
-- (docs/HARD_DELETE_USER_PLAN.md). None of these tables ever get their
-- rows deleted by this migration — this only changes what happens to
-- them if the user who created/assigned/graded them is later
-- hard-deleted, so business data always survives a user's removal and
-- only loses its "who did this" attribution.
--
-- Before this migration: deleting a user who ever created a question or
-- quiz, assigned a quiz, or graded an essay was IMPOSSIBLE — Postgres
-- blocked it outright (no ON DELETE action = NO ACTION, the default) —
-- meaning hard-delete could never actually work for almost any real
-- trainer/admin account. And a trainer's session links were ON DELETE
-- CASCADE, so deleting them would have silently broken every live
-- assessment link real candidates might be using right now.

alter table public.questions alter column created_by drop not null;
alter table public.questions drop constraint questions_created_by_fkey;
alter table public.questions add constraint questions_created_by_fkey
  foreign key (created_by) references auth.users (id) on delete set null;

alter table public.quizzes alter column created_by drop not null;
alter table public.quizzes drop constraint quizzes_created_by_fkey;
alter table public.quizzes add constraint quizzes_created_by_fkey
  foreign key (created_by) references auth.users (id) on delete set null;

alter table public.quiz_assignments alter column assigned_by drop not null;
alter table public.quiz_assignments drop constraint quiz_assignments_assigned_by_fkey;
alter table public.quiz_assignments add constraint quiz_assignments_assigned_by_fkey
  foreign key (assigned_by) references auth.users (id) on delete set null;

-- attempt_answers.graded_by is already nullable — only the FK action changes.
alter table public.attempt_answers drop constraint attempt_answers_graded_by_fkey;
alter table public.attempt_answers add constraint attempt_answers_graded_by_fkey
  foreign key (graded_by) references auth.users (id) on delete set null;

-- assessment_sessions.created_by was ON DELETE CASCADE — a live link must
-- outlive the trainer account that generated it.
alter table public.assessment_sessions alter column created_by drop not null;
alter table public.assessment_sessions drop constraint assessment_sessions_created_by_fkey;
alter table public.assessment_sessions add constraint assessment_sessions_created_by_fkey
  foreign key (created_by) references auth.users (id) on delete set null;

-- quiz_attempts.user_id deliberately stays ON DELETE CASCADE (unchanged,
-- not touched here) — a hard-deleted user's OWN attempt history
-- disappearing with them is the intended meaning of "permanent delete",
-- unlike content they authored for other people.
