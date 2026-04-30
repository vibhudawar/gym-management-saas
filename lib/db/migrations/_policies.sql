-- ----------------------------------------------------------------------------
-- RLS policies for Module 01 tables.
-- Run AFTER _functions.sql.
-- Idempotent: drops existing policies before recreating.
-- ----------------------------------------------------------------------------

alter table public.gyms        enable row level security;
alter table public.branches    enable row level security;
alter table public.users       enable row level security;
alter table public.audit_logs  enable row level security;

-- ----- gyms ------------------------------------------------------------------
drop policy if exists "gyms_tenant_select" on public.gyms;
drop policy if exists "gyms_tenant_update" on public.gyms;

create policy "gyms_tenant_select" on public.gyms
  for select to authenticated
  using (id = public.current_user_gym());

-- Only the owner can update gym-level settings.
create policy "gyms_tenant_update" on public.gyms
  for update to authenticated
  using (id = public.current_user_gym() and public.current_user_role() = 'owner')
  with check (id = public.current_user_gym() and public.current_user_role() = 'owner');

-- No INSERT or DELETE policies — gyms are provisioned server-side via the
-- service role and never hard-deleted.

-- ----- branches --------------------------------------------------------------
drop policy if exists "branches_tenant_select" on public.branches;
drop policy if exists "branches_tenant_insert" on public.branches;
drop policy if exists "branches_tenant_update" on public.branches;

create policy "branches_tenant_select" on public.branches
  for select to authenticated
  using (gym_id = public.current_user_gym());

create policy "branches_tenant_insert" on public.branches
  for insert to authenticated
  with check (
    gym_id = public.current_user_gym()
    and public.current_user_role() in ('owner', 'branch_manager')
  );

create policy "branches_tenant_update" on public.branches
  for update to authenticated
  using (gym_id = public.current_user_gym())
  with check (
    gym_id = public.current_user_gym()
    and public.current_user_role() in ('owner', 'branch_manager')
  );

-- ----- users -----------------------------------------------------------------
drop policy if exists "users_tenant_select" on public.users;
drop policy if exists "users_tenant_insert" on public.users;
drop policy if exists "users_tenant_update" on public.users;

create policy "users_tenant_select" on public.users
  for select to authenticated
  using (gym_id = public.current_user_gym());

-- Only owners can add staff. Staff creation also goes through the service-role
-- script, but this policy lets in-app onboarding flows work later.
create policy "users_tenant_insert" on public.users
  for insert to authenticated
  with check (
    gym_id = public.current_user_gym()
    and public.current_user_role() = 'owner'
  );

create policy "users_tenant_update" on public.users
  for update to authenticated
  using (gym_id = public.current_user_gym())
  with check (
    gym_id = public.current_user_gym()
    and (
      public.current_user_role() = 'owner'
      or auth_user_id = auth.uid() -- a user can update their own row
    )
  );

-- ----- audit_logs ------------------------------------------------------------
drop policy if exists "audit_logs_tenant_select" on public.audit_logs;
drop policy if exists "audit_logs_tenant_insert" on public.audit_logs;

-- Receptionists must NOT see the audit log.
create policy "audit_logs_tenant_select" on public.audit_logs
  for select to authenticated
  using (
    gym_id = public.current_user_gym()
    and public.current_user_role() in ('owner', 'branch_manager')
  );

create policy "audit_logs_tenant_insert" on public.audit_logs
  for insert to authenticated
  with check (gym_id = public.current_user_gym());

-- No UPDATE / DELETE policy — audit log is append-only.

-- ============================================================================
-- Module 02 — Plans & Add-ons
-- ============================================================================

alter table public.plans   enable row level security;
alter table public.add_ons enable row level security;

-- ----- plans -----------------------------------------------------------------
drop policy if exists "plans_tenant_select" on public.plans;
drop policy if exists "plans_tenant_insert" on public.plans;
drop policy if exists "plans_tenant_update" on public.plans;

create policy "plans_tenant_select" on public.plans
  for select to authenticated
  using (gym_id = public.current_user_gym());

create policy "plans_tenant_insert" on public.plans
  for insert to authenticated
  with check (
    gym_id = public.current_user_gym()
    and public.current_user_role() in ('owner', 'branch_manager')
  );

create policy "plans_tenant_update" on public.plans
  for update to authenticated
  using (gym_id = public.current_user_gym())
  with check (
    gym_id = public.current_user_gym()
    and public.current_user_role() in ('owner', 'branch_manager')
  );

-- ----- add_ons ---------------------------------------------------------------
drop policy if exists "add_ons_tenant_select" on public.add_ons;
drop policy if exists "add_ons_tenant_insert" on public.add_ons;
drop policy if exists "add_ons_tenant_update" on public.add_ons;

create policy "add_ons_tenant_select" on public.add_ons
  for select to authenticated
  using (gym_id = public.current_user_gym());

create policy "add_ons_tenant_insert" on public.add_ons
  for insert to authenticated
  with check (
    gym_id = public.current_user_gym()
    and public.current_user_role() in ('owner', 'branch_manager')
  );

create policy "add_ons_tenant_update" on public.add_ons
  for update to authenticated
  using (gym_id = public.current_user_gym())
  with check (
    gym_id = public.current_user_gym()
    and public.current_user_role() in ('owner', 'branch_manager')
  );

-- ============================================================================
-- Module 03 — Members (tenant isolation + branch scoping)
-- ============================================================================

alter table public.members enable row level security;

drop policy if exists "members_tenant_select" on public.members;
drop policy if exists "members_tenant_insert" on public.members;
drop policy if exists "members_tenant_update" on public.members;

-- Owner sees all branches in the gym; branch_manager / receptionist see
-- only their own branch.
create policy "members_tenant_select" on public.members
  for select to authenticated
  using (
    gym_id = public.current_user_gym()
    and (
      public.current_user_role() = 'owner'
      or branch_id = public.current_user_branch()
    )
  );

create policy "members_tenant_insert" on public.members
  for insert to authenticated
  with check (
    gym_id = public.current_user_gym()
    and (
      public.current_user_role() = 'owner'
      or branch_id = public.current_user_branch()
    )
  );

create policy "members_tenant_update" on public.members
  for update to authenticated
  using (
    gym_id = public.current_user_gym()
    and (
      public.current_user_role() = 'owner'
      or branch_id = public.current_user_branch()
    )
  )
  with check (
    gym_id = public.current_user_gym()
    and (
      public.current_user_role() = 'owner'
      or branch_id = public.current_user_branch()
    )
  );

-- No DELETE policy — soft delete via UPDATE only.

-- ============================================================================
-- Module 04 — Memberships, payments, invoice sequences
-- ============================================================================

alter table public.memberships         enable row level security;
alter table public.membership_addons   enable row level security;
alter table public.payments            enable row level security;
alter table public.invoice_sequences   enable row level security;

-- ----- memberships ----------------------------------------------------------
drop policy if exists "memberships_tenant_select" on public.memberships;
drop policy if exists "memberships_tenant_insert" on public.memberships;
drop policy if exists "memberships_tenant_update" on public.memberships;

create policy "memberships_tenant_select" on public.memberships
  for select to authenticated
  using (
    gym_id = public.current_user_gym()
    and (
      public.current_user_role() = 'owner'
      or branch_id = public.current_user_branch()
    )
  );

create policy "memberships_tenant_insert" on public.memberships
  for insert to authenticated
  with check (
    gym_id = public.current_user_gym()
    and (
      public.current_user_role() = 'owner'
      or branch_id = public.current_user_branch()
    )
  );

create policy "memberships_tenant_update" on public.memberships
  for update to authenticated
  using (
    gym_id = public.current_user_gym()
    and (
      public.current_user_role() = 'owner'
      or branch_id = public.current_user_branch()
    )
  )
  with check (
    gym_id = public.current_user_gym()
    and (
      public.current_user_role() = 'owner'
      or branch_id = public.current_user_branch()
    )
  );

-- ----- membership_addons ----------------------------------------------------
-- Tenant isolation via parent membership; no branch scoping needed at this
-- level because the parent already enforces it.
drop policy if exists "membership_addons_tenant_select" on public.membership_addons;
drop policy if exists "membership_addons_tenant_insert" on public.membership_addons;

create policy "membership_addons_tenant_select" on public.membership_addons
  for select to authenticated
  using (
    exists (
      select 1 from public.memberships m
      where m.id = membership_addons.membership_id
        and m.gym_id = public.current_user_gym()
        and (
          public.current_user_role() = 'owner'
          or m.branch_id = public.current_user_branch()
        )
    )
  );

create policy "membership_addons_tenant_insert" on public.membership_addons
  for insert to authenticated
  with check (
    exists (
      select 1 from public.memberships m
      where m.id = membership_addons.membership_id
        and m.gym_id = public.current_user_gym()
        and (
          public.current_user_role() = 'owner'
          or m.branch_id = public.current_user_branch()
        )
    )
  );

-- ----- payments -------------------------------------------------------------
drop policy if exists "payments_tenant_select" on public.payments;
drop policy if exists "payments_tenant_insert" on public.payments;
drop policy if exists "payments_tenant_update" on public.payments;

create policy "payments_tenant_select" on public.payments
  for select to authenticated
  using (
    gym_id = public.current_user_gym()
    and (
      public.current_user_role() = 'owner'
      or branch_id = public.current_user_branch()
    )
  );

create policy "payments_tenant_insert" on public.payments
  for insert to authenticated
  with check (
    gym_id = public.current_user_gym()
    and (
      public.current_user_role() = 'owner'
      or branch_id = public.current_user_branch()
    )
  );

-- Owner / branch_manager only; receptionists cannot edit payments.
create policy "payments_tenant_update" on public.payments
  for update to authenticated
  using (
    gym_id = public.current_user_gym()
    and public.current_user_role() in ('owner', 'branch_manager')
  )
  with check (
    gym_id = public.current_user_gym()
    and public.current_user_role() in ('owner', 'branch_manager')
  );

-- ----- invoice_sequences ----------------------------------------------------
drop policy if exists "invoice_sequences_tenant_select" on public.invoice_sequences;
drop policy if exists "invoice_sequences_tenant_insert" on public.invoice_sequences;
drop policy if exists "invoice_sequences_tenant_update" on public.invoice_sequences;

create policy "invoice_sequences_tenant_select" on public.invoice_sequences
  for select to authenticated
  using (gym_id = public.current_user_gym());

create policy "invoice_sequences_tenant_insert" on public.invoice_sequences
  for insert to authenticated
  with check (gym_id = public.current_user_gym());

create policy "invoice_sequences_tenant_update" on public.invoice_sequences
  for update to authenticated
  using (gym_id = public.current_user_gym())
  with check (gym_id = public.current_user_gym());
