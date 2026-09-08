-- Opsi A — admin-managed passwords, no email/SMTP.
--
-- An admin sets a temporary password when inviting a user (and can reset it
-- later from the Users list). The user is forced to choose their own password
-- on first login, so the admin never holds a live credential.

alter table public.profiles
  add column must_change_password boolean not null default false;

-- A signed-in user clears their own flag after changing the password. There is
-- no client UPDATE policy on `profiles`, so this SECURITY DEFINER helper — keyed
-- to auth.uid() — is the only path.
create or replace function public.clear_must_change_password()
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles
  set must_change_password = false
  where user_id = auth.uid();
$$;

revoke all on function public.clear_must_change_password() from public, anon;
grant execute on function public.clear_must_change_password() to authenticated;
