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
