-- ----------------------------------------------------------------------------
-- Extensions and specialised indexes that Drizzle's schema DSL can't express.
-- Run AFTER the Drizzle table migrations.
-- Idempotent.
-- ----------------------------------------------------------------------------

create extension if not exists pg_trgm;

-- Trigram indexes for fast fuzzy search on members.
-- "rohit" → matches "Rohit Sharma", "Rohitash"; "9876" → matches "+919876543210".
create index if not exists members_name_trgm
  on public.members using gin (name gin_trgm_ops);

create index if not exists members_phone_trgm
  on public.members using gin (phone gin_trgm_ops);

-- ----------------------------------------------------------------------------
-- Freezes — partial index for "ending soon" queries (Today's View).
-- ----------------------------------------------------------------------------

create index if not exists freezes_gym_end_active_idx
  on public.freezes (gym_id, freeze_end_date)
  where status in ('active', 'scheduled') and deleted_at is null;

-- ----------------------------------------------------------------------------
-- View: freezes_with_status — derive the live status from dates.
-- The base table's `status` only holds `scheduled | active | cancelled_early`.
-- `completed` is computed on read so we don't need a daily transition cron.
-- ----------------------------------------------------------------------------

create or replace view public.freezes_with_status as
select
  f.*,
  case
    when f.status = 'cancelled_early' then 'cancelled_early'
    when f.freeze_start_date > ((now() at time zone 'Asia/Kolkata')::date) then 'scheduled'
    when f.freeze_end_date < ((now() at time zone 'Asia/Kolkata')::date) then 'completed'
    else 'active'
  end as effective_status,
  coalesce(f.actual_end_date, f.freeze_end_date) as effective_end_date
from public.freezes f
where f.deleted_at is null;
