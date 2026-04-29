# Module 01 — Auth, Multi-Tenancy & RBAC

> Build the foundation that makes every other module safe by default. Two tenants must be perfectly isolated. Three roles must be enforced at both the API and the database layer.

**Estimated time:** 1–2 days.
**Outcome:** Two test gyms, with their own owners and staff, can each log in and see only their own data. RLS verified.

---

## 1.1 Scope

In:
- Supabase Auth (email + password) integration.
- `gyms`, `branches`, `users`, `audit_logs` schemas.
- Postgres functions: `current_user_gym()`, `current_user_role()`, `current_user_branch()`.
- RLS policies templated for all current and future tables.
- `recordAudit()` helper.
- Login, logout, forgot-password pages.
- Auth middleware in Next.js.
- Onboarding flow (server-side only): when a new gym is created, auto-create "Main Branch" and link the owner.
- CLI script `scripts/create-tenant.ts` to manually onboard a gym + owner (no public signup yet).
- Layout shell: sidebar + topbar + branch selector + user menu.
- Role-aware sidebar rendering (Receptionist hides Reports, Audit Log).

Out:
- Public signup (post-MVP).
- Password change UI (use Supabase email recovery for v1).
- 2FA, social logins.
- Member-facing accounts.

---

## 1.2 Data Model

### `gyms`
| column | type | notes |
|---|---|---|
| id | uuid PK | `gen_random_uuid()` default |
| name | text not null | |
| owner_user_id | uuid | FK → `users.id` (nullable initially; set after first user created) |
| gst_number | text | nullable |
| invoice_prefix | text not null | e.g., `ZEN-` |
| invoice_year_reset | boolean not null default true | sequence resets each Jan 1 |
| currency | text not null default `'INR'` | |
| subscription_tier | text not null default `'basic'` | `basic` \| `pro` |
| whatsapp_api_enabled | boolean not null default false | gated by tier + provisioning |
| created_at | timestamptz not null default now() | |
| deleted_at | timestamptz | |

### `branches`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| gym_id | uuid not null | FK → gyms |
| name | text not null | default "Main Branch" |
| address | text | |
| phone | text | E.164 |
| is_active | boolean not null default true | |
| created_at | timestamptz not null default now() | |
| deleted_at | timestamptz | |

Index: `(gym_id, is_active)`.

### `users`
> Internal users (staff). Members are NOT here.

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| auth_user_id | uuid not null unique | matches `auth.users.id` from Supabase |
| gym_id | uuid not null | FK → gyms |
| branch_id | uuid | FK → branches; null for owners (sees all branches) |
| name | text not null | |
| email | text not null | |
| phone | text | E.164 |
| role | text not null | `owner` \| `branch_manager` \| `receptionist` |
| is_active | boolean not null default true | |
| created_at | timestamptz not null default now() | |
| deleted_at | timestamptz | |

Indexes: `(gym_id)`, `(auth_user_id)` unique.
Constraint: `branch_id` NOT NULL when `role IN ('branch_manager','receptionist')`.

### `audit_logs`
| column | type | notes |
|---|---|---|
| id | bigserial PK | |
| gym_id | uuid not null | |
| user_id | uuid not null | FK → users |
| entity_type | text not null | `member` \| `payment` \| `membership` \| `plan` \| `addon` \| `freeze` \| `user` \| `gym` |
| entity_id | uuid not null | |
| action | text not null | `create` \| `update` \| `delete` |
| before_json | jsonb | null for create |
| after_json | jsonb | null for delete |
| created_at | timestamptz not null default now() | |

Index: `(gym_id, created_at desc)`, `(entity_type, entity_id)`.

---

## 1.3 Postgres Helper Functions

Place in `lib/db/migrations/_functions.sql` and run as part of migration.

```sql
-- Returns the gym_id of the currently authenticated user.
create or replace function current_user_gym() returns uuid
language sql stable security definer set search_path = public as $$
  select gym_id from users
  where auth_user_id = auth.uid() and deleted_at is null and is_active = true
  limit 1;
$$;

create or replace function current_user_role() returns text
language sql stable security definer set search_path = public as $$
  select role from users
  where auth_user_id = auth.uid() and deleted_at is null and is_active = true
  limit 1;
$$;

create or replace function current_user_branch() returns uuid
language sql stable security definer set search_path = public as $$
  select branch_id from users
  where auth_user_id = auth.uid() and deleted_at is null and is_active = true
  limit 1;
$$;
```

### RLS template (apply to every business table)

```sql
alter table <table> enable row level security;

create policy "tenant_isolation_select" on <table>
  for select using (gym_id = current_user_gym());

create policy "tenant_isolation_insert" on <table>
  for insert with check (gym_id = current_user_gym());

create policy "tenant_isolation_update" on <table>
  for update using (gym_id = current_user_gym())
  with check (gym_id = current_user_gym());

-- No DELETE policy — soft delete only via UPDATE.
```

For tables where Receptionist must NOT see (e.g., revenue reports later), add additional `using (current_user_role() in ('owner','branch_manager'))` clauses on SELECT.

For branch-scoped visibility (e.g., a Branch Manager seeing only their branch's data), add:
```sql
create policy "branch_scoping_select" on <table>
  for select using (
    current_user_role() = 'owner'
    or branch_id = current_user_branch()
  );
```
Apply this only on tables that have `branch_id` AND should be branch-scoped (members, memberships, payments, freezes — applied in their respective modules).

---

## 1.4 Server Code

### `lib/auth/supabase-server.ts`
SSR-safe Supabase client using `@supabase/ssr` with Next.js cookies. Returns a server client that respects RLS.

### `lib/auth/get-session.ts`
```ts
export async function requireUser() { /* throws redirect to /login if no session */ }
export async function getCurrentUser() { /* returns users row joined with auth */ }
export async function requireRole(...roles: Role[]) { /* throws if mismatch */ }
```

### `lib/auth/audit.ts`
```ts
export async function recordAudit(input: {
  entityType: string;
  entityId: string;
  action: "create" | "update" | "delete";
  before?: unknown;
  after?: unknown;
}): Promise<void>;
```
Uses current session to fill `gym_id` and `user_id`. All mutations call this.

### Middleware
`middleware.ts` at root: refreshes Supabase session cookies on every request. Standard pattern from `@supabase/ssr` docs.

### Route guards
- `/(app)/layout.tsx` calls `requireUser()` server-side.
- Receptionist-blocked routes (`/reports`, `/audit-log`) call `requireRole("owner","branch_manager")` in their layouts.

---

## 1.5 UI

### Auth pages

#### `/login`
- Centered card, ~400px wide.
- Inputs: Email, Password.
- Primary button "Sign in".
- "Forgot password?" link below.
- Logo/wordmark above the card. Light blue gradient background, very subtle.
- Error messages inline below the form (not toast — they need persistence).
- After login → redirect to `/` (Today's View).

#### `/forgot-password`
- Single email input.
- "Send reset link" button.
- Success state: "Check your email for reset instructions."

#### `/reset-password` (handles Supabase recovery link)
- Two password fields.
- "Update password" button.
- Redirects to `/login` after success.

### App shell (`/(app)/layout.tsx`)

Use shadcn's **Sidebar** block as the base. Layout:

```
+-----------------------------------------------+
| [Sidebar]      | [Top bar: gym + branch | 🔔 | 👤] |
|                |---------------------------------|
| Today          |                                 |
| Members        |                                 |
| Enrollments    |   {children}                    |
| Plans          |                                 |
| Payments       |                                 |
| Reports*       |                                 |
| Audit log*     |                                 |
| Settings       |                                 |
|                |                                 |
| [Tier badge]   |                                 |
| [User menu]    |                                 |
+-----------------------------------------------+
```
*Hidden for Receptionist.

### Sidebar contents
- Top: gym name (small, muted) + branch selector (dropdown if multi-branch, plain text if single).
- Middle: nav items with lucide icons. Active state: `bg-accent text-accent-foreground`.
- Sticky bottom: subscription tier badge ("Basic" / "Pro") + user avatar with name + role + caret to user menu (settings, sign out).
- Collapsible to icon-only on `<lg` screens.

### Top bar
- Left: hamburger to toggle sidebar (mobile).
- Center: a global search bar (`Cmd+K` shortcut) — wired but disabled in Module 01; activated in Module 03 (members search).
- Right: notifications icon (badge count, no functionality yet — placeholder only — comment out the icon if you don't want a dead button; recommend: leave the icon, click does nothing yet, no badge).

### Empty/loading/error states
- Auth pages handle their own states.
- App shell shows a full-page skeleton on initial load (sidebar items fade in).
- If `getCurrentUser()` returns nothing → redirect to login (handled in middleware, not UI).

---

## 1.6 CLI Tenant Provisioning

`scripts/create-tenant.ts`:

```bash
pnpm tsx scripts/create-tenant.ts \
  --gym-name "Zenith Fitness" \
  --invoice-prefix "ZEN-" \
  --owner-email "owner@zenith.in" \
  --owner-name "Vibhu Dawar" \
  --owner-phone "+919876543210"
```

Script flow:
1. Validate input via Zod.
2. Use Supabase `service_role` to create auth user with a random temp password.
3. Insert row into `gyms`, then `branches` ("Main Branch"), then `users` (role=owner).
4. Update `gyms.owner_user_id` to point to the user.
5. Trigger Supabase password recovery email so owner sets their own password.
6. Print summary to console.

Wrap in a single Drizzle transaction. On error, attempt to delete the auth user too.

---

## 1.7 Acceptance Criteria

- [ ] Migrations run on a fresh Supabase project without errors.
- [ ] RLS enabled on `gyms`, `branches`, `users`, `audit_logs`.
- [ ] Two tenants created via CLI script. Each owner can log in.
- [ ] Tenant A's owner runs `select * from users` — sees only Tenant A's users (test via Drizzle Studio with auth context).
- [ ] Logged-in user sees correct gym name + branch in sidebar.
- [ ] Receptionist (created manually) does NOT see "Reports" or "Audit log" in sidebar; visiting `/reports` redirects to home.
- [ ] Branch Manager sees only their branch in branch selector (single-branch view).
- [ ] Logout clears session and returns to `/login`.
- [ ] Forgot password flow sends a real email and the link works end-to-end.
- [ ] `recordAudit()` writes a row when test mutations run.
- [ ] Sidebar collapses on screens < 1024px.
- [ ] Lighthouse perf ≥ 90 on `/login`.

---

## 1.8 Files Created in This Module

```
lib/db/schema/gyms.ts
lib/db/schema/branches.ts
lib/db/schema/users.ts
lib/db/schema/audit-logs.ts
lib/db/schema/index.ts                    (updated barrel)
lib/db/migrations/_functions.sql
lib/db/migrations/0000_init.sql           (generated)

lib/auth/supabase-server.ts
lib/auth/supabase-client.ts
lib/auth/get-session.ts
lib/auth/audit.ts
lib/auth/roles.ts                         (Role type, helpers)

middleware.ts

app/(auth)/login/page.tsx
app/(auth)/forgot-password/page.tsx
app/(auth)/reset-password/page.tsx
app/(auth)/layout.tsx                     (centered card layout)
app/(app)/layout.tsx                      (sidebar shell)
app/(app)/page.tsx                        (placeholder Today's View)

components/layout/app-sidebar.tsx
components/layout/top-bar.tsx
components/layout/branch-selector.tsx
components/layout/user-menu.tsx
components/layout/page-header.tsx

server/actions/auth/sign-in.ts
server/actions/auth/sign-out.ts
server/actions/auth/forgot-password.ts
server/actions/auth/reset-password.ts

scripts/create-tenant.ts
scripts/test-rls.ts                       (manual RLS verifier)
```

---

## 1.9 Common Pitfalls (read before coding)

1. **Don't use the service role key in user-facing code.** It bypasses RLS. Reserve it for `scripts/` only.
2. **`auth.uid()` returns null for unauthenticated requests.** RLS policies must handle that gracefully (they will, because `gym_id = null` matches nothing).
3. **Postgres functions marked `security definer` run with elevated privileges.** Set `search_path = public` to prevent search-path attacks (template above does this).
4. **Cookies must be set/refreshed on every request.** Don't try to cache the Supabase session; the SSR client handles refresh transparently.
5. **Schema barrel imports.** `lib/db/schema/index.ts` must re-export every schema, or Drizzle queries can't resolve relations.
6. **The `users` table is separate from `auth.users`.** Always join via `auth_user_id`. Don't try to extend `auth.users` directly — Supabase manages it.
7. **Soft delete in queries.** Every query in this module and beyond must filter `deleted_at IS NULL` for `users`, `gyms`, `branches`. Build a Drizzle helper or use a view if it gets repetitive.

---

## 1.10 What's Next

Module 02 — Plans & Add-ons. Owner configures membership offerings before any member is enrolled. Builds on the auth foundation laid here. RLS template from this module is reused.
