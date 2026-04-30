-- ----------------------------------------------------------------------------
-- Per-table triggers. Run AFTER the Drizzle table migrations so the tables
-- exist, and AFTER _functions.sql so set_updated_at() is defined.
-- Idempotent: drop existing trigger before recreating.
-- ----------------------------------------------------------------------------

drop trigger if exists members_set_updated_at on public.members;
create trigger members_set_updated_at
  before update on public.members
  for each row execute function public.set_updated_at();
