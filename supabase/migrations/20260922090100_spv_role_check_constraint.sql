-- Follow-up to 20260922090000_spv_role.sql: the admin_update_user() RPC's
-- role allow-list was widened to include 'spv', but the table itself still
-- has a `profiles_role_check` CHECK constraint from the original schema
-- (20260907090000_foundation.sql:20) that only allows
-- ('super_admin', 'admin', 'sales') — missed in the first pass, caught
-- immediately when creating the first spv account failed with a
-- constraint violation. Widen it to match.

alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('super_admin', 'admin', 'sales', 'spv'));
