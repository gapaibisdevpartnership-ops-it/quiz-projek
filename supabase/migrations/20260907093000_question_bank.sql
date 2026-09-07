-- Phase 2 — Question Bank: categories, questions, dynamic answer options,
-- and the quiz-assets storage bucket.
-- See docs/DATABASE_SCHEMA.md, docs/QUESTION_TYPES.md, docs/VALIDATION_RULES.md,
-- docs/SECURITY_RLS.md.

-- ---------------------------------------------------------------------------
-- quiz_categories
-- ---------------------------------------------------------------------------

create table public.quiz_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- questions
-- ---------------------------------------------------------------------------

create table public.questions (
  id                 uuid primary key default gen_random_uuid(),
  category_id        uuid references public.quiz_categories (id) on delete set null,
  question_type      text not null
                       check (question_type in
                         ('single_choice', 'multiple_choice', 'true_false', 'essay')),
  question_text      text,
  question_image_url text,
  difficulty         text check (difficulty in ('easy', 'medium', 'hard')),
  explanation        text,
  sample_answer      text,
  grading_notes      text,
  status             text not null default 'active'
                       check (status in ('active', 'archived')),
  created_by         uuid not null references auth.users (id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  -- A question needs at least meaningful text or an image (VALIDATION_RULES.md).
  constraint questions_has_content check (
    (question_text is not null and length(btrim(question_text)) > 0)
    or question_image_url is not null
  )
);

create index questions_category_idx on public.questions (category_id);
create index questions_type_idx on public.questions (question_type);
create index questions_status_idx on public.questions (status);

create trigger questions_set_updated_at
  before update on public.questions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- question_options (dynamic; never assume A-D)
-- ---------------------------------------------------------------------------

create table public.question_options (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  answer_text text,
  image_url   text,
  is_correct  boolean not null default false,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint question_options_has_content check (
    (answer_text is not null and length(btrim(answer_text)) > 0)
    or image_url is not null
  )
);

create index question_options_question_idx
  on public.question_options (question_id, sort_order);

create trigger question_options_set_updated_at
  before update on public.question_options
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
--
-- The question bank holds answer keys (is_correct), sample answers and grading
-- notes. Sales must never read it directly (docs/SECURITY_RLS.md); they only
-- ever see per-attempt snapshots built later. So: admin/trainer only.
-- ---------------------------------------------------------------------------

alter table public.quiz_categories  enable row level security;
alter table public.questions        enable row level security;
alter table public.question_options enable row level security;

create policy "quiz_categories: admin full access"
  on public.quiz_categories for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "questions: admin full access"
  on public.questions for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "question_options: admin full access"
  on public.question_options for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Storage: quiz-assets bucket
--
-- Public read (visual assets only, per SECURITY_RLS.md). Writes restricted to
-- admins. Paths are generated server-side, e.g.
--   questions/{question_id}/{uuid}.webp
--   question-options/{option_id}/{uuid}.webp
--   quiz-covers/{quiz_id}/{uuid}.webp
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'quiz-assets',
  'quiz-assets',
  true,
  5242880, -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy "quiz-assets: public read"
  on storage.objects for select
  to public
  using (bucket_id = 'quiz-assets');

create policy "quiz-assets: admin insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'quiz-assets' and public.is_admin());

create policy "quiz-assets: admin update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'quiz-assets' and public.is_admin())
  with check (bucket_id = 'quiz-assets' and public.is_admin());

create policy "quiz-assets: admin delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'quiz-assets' and public.is_admin());
