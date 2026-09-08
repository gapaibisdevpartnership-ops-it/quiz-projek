-- P0 hardening — user administration (docs/IMPROVEMENT_BACKLOG.md P0 #1–3).
--
-- Before this migration:
--   * the "profiles: admin updates" RLS policy let ANY admin UPDATE ANY column
--     of ANY profile from the browser anon key, bypassing every check in
--     src/features/users/actions.ts (self-lockout, role rules);
--   * there was no super_admin-only gate, so any admin could grant or revoke
--     super_admin and nothing kept at least one active super_admin;
--   * handle_new_user() copied the role verbatim from auth user metadata.
--
-- After: profile role/status changes go only through admin_update_user(), which
-- re-checks authorization server-side; the client keeps a narrow UPDATE policy
-- for full_name only; new accounts are always 'sales'.

-- ===========================================================================
-- 3. handle_new_user — never trust the metadata role.
-- ===========================================================================

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
    'sales',          -- elevated roles are granted only via admin_update_user()
    'active'
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

-- ===========================================================================
-- 1. Lock down direct writes to profiles.
--
-- Drop the blanket admin UPDATE policy entirely — there is no supported direct
-- client write to a profile. Every mutation (name, role, status) goes through
-- admin_update_user(), which is SECURITY DEFINER and re-checks authorization.
-- A PostgREST `update profiles ...` from an admin's anon key now affects zero
-- rows.
-- ===========================================================================

drop policy if exists "profiles: admin updates" on public.profiles;

-- ===========================================================================
-- 2. admin_update_user — the only supported way to change role / status.
-- ===========================================================================

create or replace function public.admin_update_user(
  target_user_id uuid,
  new_full_name  text,
  new_role       text,
  new_status     text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor        uuid := auth.uid();
  v_actor_role   text;
  v_target_role  text;
  v_target_status text;
  v_others       integer;
begin
  if not public.is_admin() then
    raise exception 'UNAUTHORIZED' using errcode = 'P0001';
  end if;

  if new_role not in ('super_admin', 'admin', 'sales') then
    raise exception 'INVALID_ROLE' using errcode = 'P0001';
  end if;
  if new_status not in ('active', 'inactive') then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;
  if new_full_name is null or length(btrim(new_full_name)) = 0 then
    raise exception 'INVALID_NAME' using errcode = 'P0001';
  end if;

  select role into v_actor_role from public.profiles where user_id = v_actor;

  select role, status into v_target_role, v_target_status
  from public.profiles where user_id = target_user_id;
  if not found then
    raise exception 'USER_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Only a super_admin may grant or remove super_admin.
  if (new_role = 'super_admin' or v_target_role = 'super_admin')
     and v_actor_role <> 'super_admin' then
    raise exception 'SUPER_ADMIN_REQUIRED' using errcode = 'P0001';
  end if;

  -- No self-lockout.
  if target_user_id = v_actor then
    if new_role = 'sales' then
      raise exception 'CANNOT_DEMOTE_SELF' using errcode = 'P0001';
    end if;
    if new_status <> 'active' then
      raise exception 'CANNOT_DEACTIVATE_SELF' using errcode = 'P0001';
    end if;
  end if;

  -- Keep at least one active super_admin.
  if v_target_role = 'super_admin' and v_target_status = 'active'
     and (new_role <> 'super_admin' or new_status <> 'active') then
    select count(*) into v_others
    from public.profiles
    where role = 'super_admin' and status = 'active'
      and user_id <> target_user_id;
    if v_others = 0 then
      raise exception 'LAST_SUPER_ADMIN' using errcode = 'P0001';
    end if;
  end if;

  update public.profiles
  set full_name = new_full_name,
      role = new_role,
      status = new_status
  where user_id = target_user_id;
end;
$$;

revoke all on function public.admin_update_user(uuid, text, text, text)
  from public, anon;
grant execute on function public.admin_update_user(uuid, text, text, text)
  to authenticated;
