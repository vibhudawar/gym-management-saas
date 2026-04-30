-- ----------------------------------------------------------------------------
-- Per-table triggers. Run AFTER the Drizzle table migrations so the tables
-- exist, and AFTER _functions.sql so set_updated_at() is defined.
-- Idempotent: drop existing trigger before recreating.
-- ----------------------------------------------------------------------------

drop trigger if exists members_set_updated_at on public.members;
create trigger members_set_updated_at
  before update on public.members
  for each row execute function public.set_updated_at();

drop trigger if exists memberships_set_updated_at on public.memberships;
create trigger memberships_set_updated_at
  before update on public.memberships
  for each row execute function public.set_updated_at();

drop trigger if exists payments_set_updated_at on public.payments;
create trigger payments_set_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

drop trigger if exists invoice_sequences_set_updated_at on public.invoice_sequences;
create trigger invoice_sequences_set_updated_at
  before update on public.invoice_sequences
  for each row execute function public.set_updated_at();
