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

-- ----------------------------------------------------------------------------
-- Reports (Module 07): partial index for fast discount-leakage queries.
-- ----------------------------------------------------------------------------

create index if not exists memberships_discount_idx
  on public.memberships (gym_id, created_at)
  where discount_paise > 0 and deleted_at is null;

-- ----------------------------------------------------------------------------
-- Notifications (Module 11): partial index for the retry worker.
-- ----------------------------------------------------------------------------

create index if not exists notifications_retry_idx
  on public.notifications (status, next_retry_at)
  where status = 'pending';

-- ----------------------------------------------------------------------------
-- Audit log (Module 08): branch-scoped index + idempotent backfill.
-- Uses `where branch_id is null` guards so re-runs don't double-apply.
-- ----------------------------------------------------------------------------

create index if not exists audit_logs_branch_id_idx
  on public.audit_logs (gym_id, branch_id, created_at desc)
  where branch_id is not null;

create index if not exists audit_logs_user_id_idx
  on public.audit_logs (gym_id, user_id, created_at desc);

create index if not exists audit_logs_action_idx
  on public.audit_logs (gym_id, action, created_at desc);

update public.audit_logs al
  set branch_id = m.branch_id
  from public.members m
  where al.entity_type = 'member'
    and al.entity_id = m.id
    and al.branch_id is null;

update public.audit_logs al
  set branch_id = mb.branch_id
  from public.memberships mb
  where al.entity_type = 'membership'
    and al.entity_id = mb.id
    and al.branch_id is null;

update public.audit_logs al
  set branch_id = p.branch_id
  from public.payments p
  where al.entity_type = 'payment'
    and al.entity_id = p.id
    and al.branch_id is null;

update public.audit_logs al
  set branch_id = f.branch_id
  from public.freezes f
  where al.entity_type = 'freeze'
    and al.entity_id = f.id
    and al.branch_id is null;
