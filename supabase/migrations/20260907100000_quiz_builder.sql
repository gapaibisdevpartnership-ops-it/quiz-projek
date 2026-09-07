-- Phase 3 — Quiz Builder: quizzes and the quiz_questions join.
-- See docs/DATABASE_SCHEMA.md, docs/DOMAIN_RULES.md, docs/VALIDATION_RULES.md.

-- ---------------------------------------------------------------------------
-- quizzes
-- ---------------------------------------------------------------------------

create table public.quizzes (
  id                  uuid primary key default gen_random_uuid(),
  category_id         uuid references public.quiz_categories (id) on delete set null,
  title               text not null check (length(btrim(title)) > 0),
  description         text,
  instructions        text,
  cover_image_url     text,

  status              text not null default 'draft'
                        check (status in ('draft', 'published', 'archived')),

  duration_minutes    integer check (duration_minutes is null or duration_minutes > 0),
  passing_score       numeric not null default 0
                        check (passing_score >= 0 and passing_score <= 100),
  max_attempts        integer not null default 1 check (max_attempts >= 1),

  shuffle_questions   boolean not null default false,
  shuffle_answers     boolean not null default false,

  show_result         boolean not null default true,
  show_correct_answer boolean not null default false,

  start_at            timestamptz,
  end_at              timestamptz,

  created_by          uuid not null references auth.users (id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint quizzes_schedule_order check (
    start_at is null or end_at is null or end_at > start_at
  )
);

create index quizzes_status_idx on public.quizzes (status);
create index quizzes_category_idx on public.quizzes (category_id);

create trigger quizzes_set_updated_at
  before update on public.quizzes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- quiz_questions (which bank questions belong to a quiz, and their weight)
-- ---------------------------------------------------------------------------

create table public.quiz_questions (
  id          uuid primary key default gen_random_uuid(),
  quiz_id     uuid not null references public.quizzes (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete restrict,
  points      numeric not null default 1 check (points > 0),
  sort_order  integer not null default 0,
  unique (quiz_id, question_id)
);

create index quiz_questions_quiz_idx on public.quiz_questions (quiz_id, sort_order);

-- ---------------------------------------------------------------------------
-- RLS — admin/trainer only for now. Sales visibility of published quizzes
-- arrives with assignments in Phase 4 (docs/DOMAIN_RULES.md: starting a quiz
-- requires an active assignment).
-- ---------------------------------------------------------------------------

alter table public.quizzes        enable row level security;
alter table public.quiz_questions enable row level security;

create policy "quizzes: admin full access"
  on public.quizzes for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "quiz_questions: admin full access"
  on public.quiz_questions for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
