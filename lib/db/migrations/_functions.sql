-- ----------------------------------------------------------------------------
-- Auth helper functions used by RLS policies.
-- Run AFTER the Drizzle-generated table migration so the `users` table exists.
-- Idempotent: every CREATE OR REPLACE / GRANT can be re-run safely.
-- ----------------------------------------------------------------------------

-- Returns the gym_id of the currently authenticated, active, non-deleted user.
create or replace function public.current_user_gym() returns uuid
language sql stable security definer set search_path = public as $$
  select gym_id
  from public.users
  where auth_user_id = auth.uid()
    and deleted_at is null
    and is_active = true
  limit 1;
$$;

create or replace function public.current_user_role() returns text
language sql stable security definer set search_path = public as $$
  select role::text
  from public.users
  where auth_user_id = auth.uid()
    and deleted_at is null
    and is_active = true
  limit 1;
$$;

create or replace function public.current_user_branch() returns uuid
language sql stable security definer set search_path = public as $$
  select branch_id
  from public.users
  where auth_user_id = auth.uid()
    and deleted_at is null
    and is_active = true
  limit 1;
$$;

revoke all on function public.current_user_gym()    from public;
revoke all on function public.current_user_role()   from public;
revoke all on function public.current_user_branch() from public;

grant execute on function public.current_user_gym()    to authenticated, anon, service_role;
grant execute on function public.current_user_role()   to authenticated, anon, service_role;
grant execute on function public.current_user_branch() to authenticated, anon, service_role;

-- Generic updated_at trigger function. Per-table triggers wired in _triggers.sql.
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
