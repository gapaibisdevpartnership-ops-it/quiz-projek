-- Phase 1 — Foundation: profiles, teams, team_members, roles, RLS baseline.
-- See docs/DATABASE_SCHEMA.md, docs/SECURITY_RLS.md, docs/DOMAIN_RULES.md.

-- ---------------------------------------------------------------------------
-- Enums (kept as text + CHECK per DATABASE_SCHEMA.md "recommended values")
-- ---------------------------------------------------------------------------

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null unique references auth.users (id) on delete cascade,
  full_name   text not null default '',
  email       text not null,
  role        text not null default 'sales'
                check (role in ('super_admin', 'admin', 'sales')),
  status      text not null default 'active'
                check (status in ('active', 'inactive')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index profiles_role_idx on public.profiles (role);
create index profiles_status_idx on public.profiles (status);

-- ---------------------------------------------------------------------------
-- teams / team_members
-- ---------------------------------------------------------------------------

create table public.teams (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.team_members (
  id        uuid primary key default gen_random_uuid(),
  team_id   uuid not null references public.teams (id) on delete cascade,
  user_id   uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (team_id, user_id)
);

create index team_members_user_idx on public.team_members (user_id);
create index team_members_team_idx on public.team_members (team_id);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger teams_set_updated_at
  before update on public.teams
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Auto-create a profile when an auth user is created.
-- No public registration (docs/SECURITY_RLS.md): users are provisioned by an
-- admin via the Supabase dashboard / invite, and land here as 'sales'/'active'.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, email, full_name, role, status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'role', 'sales'),
    'active'
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Authorization helpers. SECURITY DEFINER so they can read profiles without
-- tripping the profiles RLS policy (avoids recursion).
-- ---------------------------------------------------------------------------

create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where user_id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role in ('admin', 'super_admin')
       from public.profiles
      where user_id = auth.uid()
        and status = 'active'),
    false
  )
$$;

create or replace function public.is_active()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select status = 'active' from public.profiles where user_id = auth.uid()),
    false
  )
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.profiles     enable row level security;
alter table public.teams        enable row level security;
alter table public.team_members enable row level security;

-- profiles ------------------------------------------------------------------

create policy "profiles: read own"
  on public.profiles for select
  to authenticated
  using (user_id = auth.uid());

create policy "profiles: admin reads all"
  on public.profiles for select
  to authenticated
  using (public.is_admin());

create policy "profiles: admin inserts"
  on public.profiles for insert
  to authenticated
  with check (public.is_admin());

create policy "profiles: admin updates"
  on public.profiles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- teams -------------------------------------------------------------------

create policy "teams: admin full access"
  on public.teams for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "teams: member reads own team"
  on public.teams for select
  to authenticated
  using (
    exists (
      select 1 from public.team_members m
      where m.team_id = teams.id and m.user_id = auth.uid()
    )
  );

-- team_members ----------------------------------------------------------

create policy "team_members: admin full access"
  on public.team_members for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "team_members: read own membership"
  on public.team_members for select
  to authenticated
  using (user_id = auth.uid());
