# Module 04 — Enrollment & Payment (the Revenue Loop)

> The single most important module in the entire app. Every rupee that flows through the gym flows through this code. Bugs here are not "annoyances," they are revenue loss, audit failures, and lost customer trust. Build slowly. Test obsessively.

**Estimated time:** 3–4 days.
**Outcome:** Receptionist can enroll a new member in <60 seconds. Owner can renew expired members with the right start date. Refunds are recorded cleanly. Every payment is traceable, audited, and respects branch + role boundaries.

---

## 4.1 Scope

In:

- `memberships` schema with strict status lifecycle.
- `payments` schema with refund support.
- Per-gym sequential `invoice_number` generator.
- Enrollment flow: select/create member → pick plan → add add-ons → adjust price → record payment → confirm. All atomic.
- Renewal flow: pre-fills last plan, lets Owner pick start date (default: end of previous membership).
- Refund flow: Owner-only, records negative-amount payment with reason. Audited.
- Edit-payment flow: Owner-only, requires reason, fully audited.
- Daily background job (or generated column) that transitions `active` → `expired` based on `end_date`.
- Member detail page integration: live "Current membership" + "Payment history" cards (replacing Module 03 placeholders).
- Status-aware UI everywhere a member appears (badges, sort, filter).

Out:

- Partial payments / balance tracking (deferred per product decision).
- Multiple simultaneous active memberships per member (one active membership rule).
- Auto-charging stored payment methods (no payment gateway integration in v1).
- Payment links via WhatsApp (Module 10, Pro tier).
- PDF invoice (Module 09).
- Plan switching mid-cycle (post-v1).
- Membership transfer between members (post-v1; rare and abusable).

---

## 4.2 Data Model

### `memberships`


| column                 | type                               | notes                                                                                            |
| ---------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------ |
| id                     | uuid PK                            |                                                                                                  |
| gym_id                 | uuid not null                      | FK → gyms                                                                                        |
| branch_id              | uuid not null                      | FK → branches; the branch where enrolled                                                         |
| member_id              | uuid not null                      | FK → members                                                                                     |
| plan_id                | uuid not null                      | FK → plans                                                                                       |
| start_date             | date not null                      | inclusive                                                                                        |
| end_date               | date not null                      | inclusive; auto-calculated from start + plan.duration_days, but stored (snapshot)                |
| original_end_date      | date not null                      | initial end_date before any freeze; preserves history when freezes extend                        |
| plan_price_paise       | integer not null                   | snapshot of plan.default_price_paise at enrollment time                                          |
| addons_total_paise     | integer not null default 0         | sum of add-ons applied to this membership (line items in `membership_addons`)                    |
| discount_paise         | integer not null default 0         | always >= 0; difference between (plan_price + addons_total) and final_amount                     |
| discount_reason        | text                               | nullable; required IF discount_paise > 0 (enforced server-side, not DB constraint — flexibility) |
| final_amount_paise     | integer not null                   | what the member actually owes for this membership = plan_price + addons_total - discount         |
| status                 | text not null                      | `active` | `expired` | `frozen` | `cancelled`                                                    |
| previous_membership_id | uuid                               | FK → memberships (self); null for first enrollment, set for renewals                             |
| enrolled_by_user_id    | uuid not null                      | FK → users; receptionist or owner who enrolled                                                   |
| created_at             | timestamptz not null default now() |                                                                                                  |
| updated_at             | timestamptz not null default now() |                                                                                                  |
| deleted_at             | timestamptz                        | soft delete (cancellation flow uses `cancelled` status; deletion is rare)                        |


**Indexes:**

- `(gym_id, member_id, status)` — find active membership for a member (most common query)
- `(gym_id, end_date) where status = 'active' and deleted_at is null` — partial; powers "expiring soon" queries
- `(gym_id, branch_id, status)` — list views
- `(member_id, created_at desc)` — membership history on detail page

**Constraints:**

- `end_date >= start_date`
- `final_amount_paise >= 0`
- `discount_paise >= 0`
- `plan_price_paise >= 0`
- `addons_total_paise >= 0`
- `status in ('active','expired','frozen','cancelled')`

**Critical business rule (enforced server-side, not DB):**

> A member can have at most ONE membership in `active` or `frozen` status at any time.

Don't enforce via partial unique index — it makes legitimate transitions (renewal exactly on expiry day) racy. Instead, the enrollment service checks before insert.

### `membership_addons`

Join table: which add-ons were applied to a membership, with snapshot pricing.


| column        | type                               | notes                                            |
| ------------- | ---------------------------------- | ------------------------------------------------ |
| id            | uuid PK                            |                                                  |
| membership_id | uuid not null                      | FK → memberships                                 |
| add_on_id     | uuid not null                      | FK → add_ons                                     |
| amount_paise  | integer not null                   | snapshot of `add_ons.amount_paise` at enrollment |
| created_at    | timestamptz not null default now() |                                                  |


Index: `(membership_id)`.

Why store snapshots? If the owner edits an add-on price later (Locker ₹500 → ₹600), past memberships still show what was actually charged.

### `payments`


| column               | type                               | notes                                                              |
| -------------------- | ---------------------------------- | ------------------------------------------------------------------ |
| id                   | uuid PK                            |                                                                    |
| gym_id               | uuid not null                      | FK → gyms (denormalized for RLS)                                   |
| branch_id            | uuid not null                      | FK → branches                                                      |
| membership_id        | uuid not null                      | FK → memberships; every payment ties to one membership             |
| member_id            | uuid not null                      | FK → members (denormalized for fast filtering)                     |
| amount_paise         | integer not null                   | **can be negative** (refund); positive otherwise                   |
| payment_mode         | text not null                      | `cash` | `upi` | `card` | `bank_transfer`                          |
| payment_date         | date not null                      | when money changed hands; defaults today                           |
| invoice_number       | text not null                      | per-gym unique; format `{prefix}{year}-{seq}` e.g. `ZEN-2026-0042` |
| kind                 | text not null                      | `payment` | `refund`                                               |
| refund_of_payment_id | uuid                               | FK → payments; required when kind='refund', else null              |
| reason               | text                               | nullable; **required when kind='refund' or when amount edited**    |
| notes                | text                               | nullable; receptionist's free-text                                 |
| received_by_user_id  | uuid not null                      | FK → users                                                         |
| created_at           | timestamptz not null default now() |                                                                    |
| updated_at           | timestamptz not null default now() |                                                                    |
| deleted_at           | timestamptz                        | soft delete (rare; voided payments use refund flow instead)        |


**Indexes:**

- `(gym_id, payment_date desc)` — daily revenue queries
- `(gym_id, branch_id, payment_date desc)` — branch revenue
- `(membership_id)` — payment history per membership
- `(member_id, payment_date desc)` — payment history on member detail
- Unique partial: `(gym_id, invoice_number) where deleted_at is null`

**Constraints:**

- `payment_mode in ('cash','upi','card','bank_transfer')`
- `kind in ('payment','refund')`
- `(kind = 'payment' and amount_paise > 0) or (kind = 'refund' and amount_paise < 0)` — refunds are always negative-signed; payments are always positive. Enforces invariant at DB level. **This is critical** — it makes "total revenue" SUM(amount_paise) correct without any kind-aware logic.
- `(kind = 'refund') = (refund_of_payment_id is not null)` — a refund must reference its parent payment.

### `invoice_sequences`

Per-gym, per-year (if `gyms.invoice_year_reset = true`) running sequence.


| column     | type                               | notes                  |
| ---------- | ---------------------------------- | ---------------------- |
| gym_id     | uuid not null                      | FK → gyms              |
| year       | integer not null                   | e.g., 2026             |
| last_seq   | integer not null default 0         | last issued seq number |
| updated_at | timestamptz not null default now() |                        |


Primary key: `(gym_id, year)`.

Don't use Postgres SEQUENCE — RLS makes it awkward, and we want per-gym numbering anyway. Use this table with `SELECT ... FOR UPDATE` inside the enrollment transaction.

---

## 4.3 RLS Policies

Standard tenant + branch policies for all three new tables. Branch scoping for receptionists/managers; owners see all.

```sql
alter table memberships enable row level security;
alter table membership_addons enable row level security;
alter table payments enable row level security;
alter table invoice_sequences enable row level security;

-- Tenant isolation (all tables)
create policy "tenant_isolation" on memberships
  for all
  using (gym_id = current_user_gym())
  with check (gym_id = current_user_gym());

create policy "tenant_isolation" on payments
  for all
  using (gym_id = current_user_gym())
  with check (gym_id = current_user_gym());

create policy "tenant_isolation" on invoice_sequences
  for all
  using (gym_id = current_user_gym())
  with check (gym_id = current_user_gym());

-- membership_addons: tenant isolation via parent membership
create policy "tenant_isolation" on membership_addons
  for all
  using (
    exists (
      select 1 from memberships m
      where m.id = membership_addons.membership_id
        and m.gym_id = current_user_gym()
    )
  );

-- Branch scoping for memberships and payments (read)
create policy "branch_scoping_select" on memberships
  for select using (
    current_user_role() = 'owner'
    or branch_id = current_user_branch()
  );

create policy "branch_scoping_select" on payments
  for select using (
    current_user_role() = 'owner'
    or branch_id = current_user_branch()
  );

-- Branch scoping for INSERT (receptionist/manager can only insert in their branch)
create policy "branch_scoping_insert" on memberships
  for insert with check (
    current_user_role() = 'owner'
    or branch_id = current_user_branch()
  );

create policy "branch_scoping_insert" on payments
  for insert with check (
    current_user_role() = 'owner'
    or branch_id = current_user_branch()
  );

-- Receptionist cannot UPDATE payments (only Owner/Manager)
create policy "payment_update_role" on payments
  for update using (current_user_role() in ('owner','branch_manager'))
  with check (current_user_role() in ('owner','branch_manager'));
```

**Extend `scripts/test-rls.ts` with these scenarios:**

1. Tenant A cannot SELECT Tenant B's memberships, payments.
2. Branch Manager B cannot SELECT Branch A's memberships.
3. Receptionist cannot UPDATE a payment (should fail with RLS error).
4. Owner can UPDATE a payment.
5. Tenant A's INSERT into payments with `gym_id = TenantB` fails.

---

## 4.4 Postgres Triggers

### Updated_at trigger (reuse pattern from Module 03)

```sql
create trigger memberships_updated_at before update on memberships
  for each row execute function set_updated_at();
create trigger payments_updated_at before update on payments
  for each row execute function set_updated_at();
```

### Status auto-update (the daily expiry job)

We have two options. Pick **one** (the spec recommends Option B for v1):

**Option A: Background cron**
A scheduled function (Vercel Cron or Supabase pg_cron) runs daily at 1am IST and updates `status = 'expired'` where `end_date < CURRENT_DATE AND status = 'active'`.

Pros: simple SQL, easy to debug.
Cons: requires scheduler setup, status is stale until cron runs.

**Option B: Computed-on-read with stored override (recommended for v1)**

Store `status` as written ('active', 'frozen', 'cancelled') but treat `end_date < today` as `expired` at query time via a Drizzle helper or a Postgres view. Avoids the cron dependency.

Implementation:

- Memberships are inserted with `status = 'active'`.
- The application uses an `effective_status` derivation:
  ```ts
  function effectiveStatus(m: Membership, today: Date): MembershipStatus {
    if (m.status === 'cancelled') return 'cancelled';
    if (m.status === 'frozen') return 'frozen';
    if (m.end_date < today) return 'expired';
    return 'active';
  }
  ```
- All queries that filter by status filter on the derived value, computed in SQL: `case when status in ('cancelled','frozen') then status when end_date < current_date then 'expired' else 'active' end`.
- A weekly cleanup cron (post-v1) physically updates the column for old expired ones.

**Decision: Option B for v1.** Simpler, no infra, status always correct. Add a SQL view `memberships_with_effective_status` for convenience.

```sql
create view memberships_with_status as
select
  *,
  case
    when status = 'cancelled' then 'cancelled'
    when status = 'frozen' then 'frozen'
    when end_date < current_date then 'expired'
    else 'active'
  end as effective_status
from memberships
where deleted_at is null;
```

Use this view in all read queries that need status. Writes still go through the base table.

---

## 4.5 Service Layer (Business Logic)

### `server/services/enrollment.ts`

The heart of the module. Single transaction, no exceptions.

```ts
type EnrollmentInput = {
  member_id: string;
  branch_id: string;
  plan_id: string;
  start_date: string;             // YYYY-MM-DD; ignored for "renew" mode if start_mode is given
  applied_addon_ids: string[];    // snapshot prices fetched server-side
  discount_paise: number;
  discount_reason?: string;       // required if discount > 0
  final_amount_paise: number;     // computed client-side, validated server-side
  payment_mode: PaymentMode;
  payment_date: string;           // YYYY-MM-DD; defaults today
  payment_notes?: string;

  // For renewals only:
  previous_membership_id?: string;
  start_mode?: 'from_today' | 'from_previous_end';
};

type EnrollmentResult =
  | { ok: true; membership_id: string; payment_id: string; invoice_number: string }
  | { ok: false; code: ErrorCode; message: string };
```

**Algorithm:**

```
BEGIN TRANSACTION
  1. Lock the member's existing memberships (FOR UPDATE) to prevent race.
  2. Verify no active or frozen membership exists for this member.
       IF exists -> ROLLBACK, return ACTIVE_MEMBERSHIP_EXISTS.
  3. Fetch plan; verify is_active and gym_id matches.
       IF inactive or wrong gym -> ROLLBACK, return INVALID_PLAN.
  4. Fetch each applied_addon_id; verify is_active and gym_id matches.
       Compute addons_total_paise from snapshots.
  5. Recompute final_amount server-side:
       expected = plan.default_price_paise + addons_total_paise - discount_paise
       IF expected != input.final_amount_paise -> ROLLBACK, return AMOUNT_MISMATCH.
  6. Validate discount_paise <= plan_price + addons_total. (No negative final_amount.)
  7. IF discount_paise > 0 AND !discount_reason -> ROLLBACK, return DISCOUNT_REASON_REQUIRED.
  8. Compute end_date = start_date + plan.duration_days days.
  9. INSERT memberships (status='active').
  10. INSERT membership_addons rows.
  11. Get next invoice_number:
        SELECT last_seq FROM invoice_sequences
        WHERE gym_id = ? AND year = ? FOR UPDATE.
        If no row, INSERT with last_seq=1; else UPDATE last_seq = last_seq + 1.
        Format as `${prefix}${year}-${seq.toString().padStart(4, '0')}`.
  12. INSERT payments (kind='payment', amount=final_amount_paise).
  13. recordAudit('membership.create'), recordAudit('payment.create').
COMMIT
```

**Key invariants:**

- Steps 9–12 must be in the same transaction. A membership without its payment, or a payment without its invoice number, is a fatal data integrity bug.
- Invoice number generation MUST be inside the transaction with `FOR UPDATE` lock. Two concurrent enrollments on the same gym would otherwise issue the same invoice number.
- `final_amount_paise` is recomputed server-side. **Never trust client math.**

### `server/services/renewal.ts`

Lighter wrapper over `enrollment.ts`:

```ts
async function renewMembership(input: RenewalInput): Promise<EnrollmentResult> {
  // 1. Fetch previous membership for this member.
  // 2. Determine start_date based on start_mode:
  //    - 'from_today': today
  //    - 'from_previous_end': previous.end_date + 1 day (so no overlap)
  //    - For first enrollment, use input.start_date (no previous).
  // 3. Allow renewal even if previous status is 'active' — but only if new start_date
  //    is on or after previous.end_date. (Pre-renewal: paid 5 days before expiry,
  //    new membership starts on the day after current expiry.)
  //    BLOCK if requested start_date overlaps the active period.
  // 4. Call enroll() with computed values.
}
```

Key edge case: a member renews 5 days BEFORE their current membership expires. The current one stays active until its end_date, the new one is queued to start the day after. Enforce one-active-at-a-time: when querying "active membership," return the one with `start_date <= today <= end_date`. The "queued" one has `start_date > today` — we'll call it status `active` but not "current."

Hmm — this introduces "queued" as a hidden state. For v1, **simplify**: do NOT allow renewal before expiry day. If member wants to pre-renew, owner records it on the day of expiry, or they wait. This is what most Indian gyms do informally anyway. Document this constraint and revisit post-v1.

**v1 rule, hard-enforced:** New membership's `start_date` must be `>=` than the current active membership's `end_date + 1`. If member tries to enroll while still active, block with clear error.

### `server/services/refund.ts`

```ts
type RefundInput = {
  payment_id: string;
  amount_paise: number;          // POSITIVE input — service negates internally
  reason: string;                // required, min 10 chars
  refund_date: string;
  payment_mode: PaymentMode;     // how the refund was paid out
};
```

Algorithm:

```
BEGIN
  1. Owner role check (gate at action layer).
  2. Fetch original payment; verify gym_id, kind='payment'.
  3. Sum existing refunds for this payment.
  4. Verify input.amount_paise <= (original.amount_paise - already_refunded).
       Else INVALID_REFUND_AMOUNT.
  5. Generate next invoice_number (same flow as enrollment).
  6. INSERT payments (kind='refund', amount = -input.amount_paise, refund_of_payment_id = original.id).
  7. recordAudit('payment.refund').
COMMIT
```

UI: "Refund" button on a payment row → AlertDialog with amount, reason, mode → confirm.

### `server/services/edit-payment.ts`

For typo corrections (wrong amount entered, wrong mode):

- Owner only.
- Editable fields: `amount_paise` (within reason — block if it would make total go negative), `payment_mode`, `payment_date`, `notes`.
- NOT editable: `invoice_number`, `member_id`, `membership_id`, `kind`.
- Requires `reason` field on every edit.
- Audit log captures full before/after.
- **Edits to amount also adjust the related membership's `final_amount_paise`** if and only if it's the only payment for that membership (single-payment world in v1; this gets complex in partial-payment world).

---

## 4.6 Server Layer

### Queries — `server/queries/memberships/`

- `getCurrentMembership(memberId)` — returns the membership active today (or null).
- `getMembershipHistory(memberId)` — all memberships ordered by start_date desc, with effective_status.
- `listExpiringMemberships({ daysAhead, branchId? })` — used by Today's View (Module 05).
- `listExpiredMemberships({ daysSinceExpiry, branchId? })` — same.

### Queries — `server/queries/payments/`

- `getPaymentsByMember(memberId)` — for member detail page.
- `getPaymentsByMembership(membershipId)`.
- `listPayments({ branchId?, dateFrom, dateTo, mode?, kind? })` — used in Module 07 reports.
- `getPayment(id)` — for refund flow.

### Actions — `server/actions/enrollment/`

- `enrollNewMember(input)` — wraps `enrollment.ts` service.
- `renewMembership(input)` — wraps `renewal.ts`.

### Actions — `server/actions/payments/`

- `recordRefund(input)` — wraps `refund.ts`. Owner-gated.
- `editPayment(id, input)` — wraps `edit-payment.ts`. Owner-gated.
- `softDeletePayment(id)` — DO NOT add this. Use refund flow instead. Hard rule.

### Permissions

- Enrollment / renewal: receptionist + manager + owner (within their branch scope).
- Refund: owner only.
- Edit payment: owner only.
- View payments: all roles (RLS handles branch scoping).

---

## 4.7 UI

### Sidebar update

"Enrollments" already present (placeholder in Module 01). Activate now. Wait — "Enrollments" doesn't really exist as a standalone page. Reconsider IA:

**Sidebar, revised:**

1. Today
2. Members
3. Plans
4. **Payments** ← new in this module (list of all payments, filterable)
5. Reports (Module 07)
6. Audit log
7. Settings

Remove "Enrollments" from sidebar. Enrollment is an *action*, not a destination. It's launched from member detail or from Today's View, not as a top-level nav item.

If you've already shipped a sidebar entry for "Enrollments," delete it now.

### Enrollment flow — Sheet from member detail

Trigger: "Enroll in plan" button on member detail card (replaces Module 03's placeholder).

**Sheet width: `sm:max-w-2xl` (wider than other sheets — there's a lot to fit).**

**Single-screen form (no multi-step wizard — receptionists hate clicking Next):**

Sections, top to bottom:

**Section 1: Plan**

- Plan combobox (searchable, shadcn Combobox). Shows: Plan name, duration, price.
- On select: a summary line below shows "₹4,500 · 90 days · ends 03 Aug 2026" (computed from today + duration).

**Section 2: Add-ons**

- List of all active add-ons as Checkbox rows.
- Each row: checkbox, name, type badge ("One-time" / "Recurring"), amount.
- Add-ons with `auto_apply_on_first_enrollment = true` AND this is member's first enrollment → pre-checked.
- For renewals: only `recurring` add-ons pre-checked from the previous membership.

**Section 3: Pricing summary**
A bordered card showing:

```
Plan price                      ₹ 4,500
Registration Fee                ₹   500
Locker (3 months)               ₹   300
                              ────────
Subtotal                        ₹ 5,300
Discount [   editable input  ]  - ₹   ___
Reason for discount (required if discount > 0)
[ textarea ]
                              ════════
Total                           ₹ 5,300
```

The discount input is a `MoneyInput` (paise-aware). If discount > 0, the reason textarea becomes required and shows a red asterisk.

**Section 4: Start date**

- Date picker.
- For new members: defaults to today.
- For renewals: see "Renewal-specific UI" below.

**Section 5: Payment**

- Payment mode segmented buttons: Cash / UPI / Card / Bank Transfer.
- Payment date: date picker, defaults to today, allows backdating up to 30 days (typo correction).
- Notes (optional textarea, 1 line by default).

**Footer:**

- Right: secondary "Cancel" + primary "Confirm enrollment & payment".
- Left: small "Total" reminder: "Will charge ₹5,300 to John Doe in cash."

**Confirm dialog (AlertDialog before submit):**

> "Enroll John Doe in 3 Months Gym + Cardio for ₹5,300 (cash)? This creates an invoice and cannot be undone except via refund."

**On success:**

- Toast: "Enrollment complete. Invoice ZEN-2026-0042."
- Sheet closes.
- Member detail page refreshes (revalidatePath); current membership card now populated.

**On failure:**

- Toast with the specific error code's message.
- Sheet stays open with values preserved.
- Re-enable submit after a brief delay.

### Renewal-specific UI

Triggered by "Renew membership" button on member detail when current membership is expiring or expired.

The form is identical EXCEPT:

- Plan combobox pre-fills with previous plan.
- Add-ons section pre-fills recurring add-ons from previous.
- **Section 4 (Start date) shows two side-by-side options as a ToggleGroup:**

```
( ) From end of previous (04 Aug 2026)    ← default selected if previous still active
( ) From today (29 Apr 2026)              ← default selected if previous already expired

  Custom start date: [date picker]   ← only shown if "Custom" toggle clicked
```

Actually simpler: 3 toggle options — "From end of previous", "From today", "Custom" — with the date picker shown only when Custom is selected.

The pre-selected default depends on whether previous is still active (default: from end of previous) or already expired (default: from today).

### Refund flow

On member detail's "Recent payments" card, each payment row has a `⋯` menu (Owner only):

- "Record refund" → opens RefundSheet.
- "Edit payment" → opens EditPaymentSheet.

**RefundSheet** (width `sm:max-w-md`):

- Original payment summary card at top (read-only): invoice, amount, date, mode.
- Already refunded amount: shown if any prior refunds exist: "Already refunded: ₹500".
- Refund amount: MoneyInput. Pre-fills with remaining refundable amount. Cannot exceed it.
- Refund mode: segmented (Cash / UPI / Card / Bank Transfer).
- Refund date: date picker, defaults today.
- Reason (textarea, required, min 10 chars).
- Footer: "Cancel" + "Issue refund of ₹X" (destructive variant — outline red).
- Confirm dialog: "Refund ₹500 to John Doe via UPI? This creates a refund invoice and is permanent."

**EditPaymentSheet:**

- Inline alert at top: ⚠ "Editing a payment is logged in the audit trail. Use 'Record refund' to reverse a payment instead."
- Editable fields: amount, mode, date, notes.
- Reason field (required, textarea, min 10 chars).
- Confirm dialog.

### Member detail integration (replaces Module 03 placeholders)

**Card: Current membership**
States:

- **No membership ever**: empty state with "Enroll in plan" CTA.
- **Active**: card shows Plan name, status badge (green "Active"), start–end dates, ends-in countdown ("Ends in 47 days"), final_amount, "Renew" button (visible if ends in <= 14 days).
- **Frozen**: amber badge, freeze-period dates, "Unfreeze" button (Module 06 builds the action).
- **Expired**: red badge, expired-N-days-ago, "Renew membership" CTA (primary).
- **Cancelled**: gray badge, "Enroll in new plan" CTA.

**Card: Membership history**
Compact list of past memberships:

- Date range
- Plan name
- Final amount
- Status badge
- Click expands to show line items (add-ons, discount, payments)

**Card: Recent payments** (last 5)

- Invoice number (click to expand for full details)
- Amount (negative shown red with `-` prefix)
- Mode badge
- Payment date
- Received by (user name)
- `⋯` menu (Owner: Refund, Edit; everyone else: only View)

"View all payments →" link → navigates to `/members/[id]/payments` (a simple paginated page).

### `/payments` — global payments list

Owner / Branch Manager view. Receptionist sees the same but only their branch.

Layout:

- Page header: "Payments" + subtitle "412 payments this month, ₹4.2L total"
- Filter bar: Date range (default: this month), Branch filter (Owner only), Payment mode filter, Kind filter (Payment / Refund / All), Search by member name or invoice number.
- DataTable:

  | Col         | Notes                                           |
  | ----------- | ----------------------------------------------- |
  | Invoice     | Click to expand modal with full payment details |
  | Date        | Sortable                                        |
  | Member      | Click → member detail                           |
  | Plan        | from joined membership                          |
  | Amount      | Right-aligned, refunds shown red with - prefix  |
  | Mode        | Badge                                           |
  | Branch      | Hidden if single branch view                    |
  | Received by | User who recorded                               |
  | Actions     | `⋯` menu, Owner-only                            |

- Bottom: total of currently-filtered results: "Showing 73 payments · Net ₹1,84,500"
- Excel export button.

---

## 4.8 The Money Display Pattern

A single helper used everywhere:

```ts
// lib/utils/money.ts
export function formatMoney(paise: number): string {
  // ₹4,500 (no decimals if whole rupees)
  // ₹4,500.50 (decimals only if non-zero)
  // -₹500 (negative for refunds)
}

export function formatMoneyShort(paise: number): string {
  // For dashboard tiles: ₹4.2L, ₹47K, ₹1.5Cr
  // Indian numbering system, not US
}
```

Tests for both, please. The Indian numbering format (lakhs/crores) is the kind of thing Claude Code might quietly get wrong. Verify:

- 47000 paise = ₹470
- 470000 paise = ₹4,700
- 4700000 paise = ₹47,000
- 47000000 paise = ₹4,70,000 (note Indian comma placement)
- 470000000 paise = ₹47,00,000
- short format: 470000000 paise → ₹4.7L

---

## 4.9 Acceptance Criteria

**Schema & RLS:**

- Migrations run cleanly. `memberships_with_status` view created.
- RLS verified via extended `scripts/test-rls.ts`:
  - Cross-tenant SELECT blocked for memberships, payments.
  - Branch scoping works for Branch Managers.
  - Receptionist UPDATE on payments fails.
  - Owner UPDATE on payments succeeds.
- Constraints enforce sign invariant: cannot insert payment with kind='payment' and negative amount.

**Enrollment:**

- Receptionist enrolls a brand-new member: full flow from "Enroll in plan" button to "Invoice ZEN-2026-0001" toast in <60 seconds.
- Discount > 0 with empty reason → blocked with inline error.
- Plan price + add-ons math is recomputed server-side (test by tampering with the network request — should return AMOUNT_MISMATCH).
- Two concurrent enrollments on the same gym produce sequential invoice numbers, not duplicates (hard to test manually; trust the FOR UPDATE lock and write one integration test).
- Attempting to enroll a member with an active membership → blocked with clear message.

**Renewal:**

- Member with active membership ending in 5 days → "Renew" button appears on detail card.
- Renewing pre-fills previous plan and recurring add-ons.
- Default start date for active member: from end of previous (= prev.end_date + 1).
- Default start date for expired member: from today.
- Custom start date allowed.
- Cannot start new membership before current active end_date.

**Refund:**

- Owner can refund a payment with reason; refund row created with negative amount and proper invoice.
- Refund amount cannot exceed (original − prior refunds).
- Receptionist does not see "Refund" option.
- Refund appears in payments list with red negative amount.

**Edit payment:**

- Owner can correct payment amount with reason; audit log shows before/after.
- Receptionist cannot.
- Cannot edit invoice_number, member_id, membership_id.

**Status:**

- Member with end_date < today is shown as "Expired" everywhere (badge, filters, search) without any cron job running.
- Frozen status preserved (Module 06 will cover writes).

**UI integration:**

- Member detail page shows current membership card correctly for all states (none / active / frozen / expired / cancelled).
- Recent payments card shows last 5; refunds rendered with `-` prefix and red.
- `/payments` page filters work; Excel export downloads valid .xlsx.

**Audit:**

- Every enrollment writes 2 audit rows (membership.create + payment.create).
- Every refund writes 1 row.
- Every edit writes 1 row with before/after.

**General:**

- Lighthouse perf ≥ 90 on member detail with 50 historical memberships.
- Mobile: enrollment sheet usable on phone (long form, but scrollable; sticky footer).
- No `any` types, no console.logs, no TODOs.

---

## 4.10 Files Created in This Module

```
lib/db/schema/memberships.ts
lib/db/schema/membership-addons.ts
lib/db/schema/payments.ts
lib/db/schema/invoice-sequences.ts
lib/db/migrations/0003_revenue_loop.sql

lib/utils/money.ts                              (extended; Indian numbering helpers + tests)

server/queries/memberships/get-current-membership.ts
server/queries/memberships/get-membership-history.ts
server/queries/memberships/list-expiring-memberships.ts
server/queries/memberships/list-expired-memberships.ts
server/queries/payments/get-payments-by-member.ts
server/queries/payments/get-payments-by-membership.ts
server/queries/payments/list-payments.ts
server/queries/payments/get-payment.ts

server/actions/enrollment/enroll-new-member.ts
server/actions/enrollment/renew-membership.ts
server/actions/payments/record-refund.ts
server/actions/payments/edit-payment.ts

server/services/enrollment.ts                   (the core transaction)
server/services/renewal.ts
server/services/refund.ts
server/services/edit-payment.ts
server/services/invoice-numbering.ts            (the FOR UPDATE generator)

app/(app)/members/[id]/_components/current-membership-card.tsx       (replaces placeholder)
app/(app)/members/[id]/_components/membership-history-card.tsx
app/(app)/members/[id]/_components/recent-payments-card.tsx          (replaces placeholder)
app/(app)/members/[id]/_components/enrollment-sheet.tsx
app/(app)/members/[id]/_components/renewal-sheet.tsx
app/(app)/members/[id]/_components/refund-sheet.tsx
app/(app)/members/[id]/_components/edit-payment-sheet.tsx

app/(app)/members/[id]/payments/page.tsx                             (full payment history)

app/(app)/payments/page.tsx                                          (global payments list)
app/(app)/payments/_components/payments-table.tsx
app/(app)/payments/_components/payments-filters.tsx
app/(app)/payments/_components/payment-detail-modal.tsx

components/shared/payment-mode-selector.tsx                          (segmented buttons)
components/shared/membership-status-badge.tsx                        (effective_status aware)

scripts/test-rls.ts                                                  (extended)
```

---

## 4.11 Common Pitfalls — READ TWICE

1. **The transaction is sacred.** Steps 9–12 of `enrollment.ts` MUST be in one DB transaction. If you split them, a network blip between membership insert and payment insert leaves a membership without a payment — silent revenue loss. Drizzle: use `db.transaction(async (tx) => {...})`.
2. **Server-side amount recomputation.** The client computes a total for display, but the server recomputes it from `plan.default_price_paise + sum(addons) - discount_paise` and rejects if the client-supplied `final_amount_paise` doesn't match. This protects against client-side tampering AND off-by-one rounding bugs.
3. `**FOR UPDATE` on `invoice_sequences`.** Without it, two concurrent enrollments race and produce duplicate invoice numbers. Drizzle syntax: `tx.select().from(invoiceSequences).where(...).for("update")`. Test this with a deliberate concurrency test if possible (spawn two server actions in parallel via `Promise.all`).
4. **Snapshot prices, don't reference them.** `memberships.plan_price_paise` and `membership_addons.amount_paise` are SNAPSHOTS. If owner edits plan price tomorrow, past memberships still show what was actually charged. Never JOIN to `plans` or `add_ons` to display historical prices — read the snapshot.
5. **Negative refunds, positive payments.** Enforced by DB CHECK constraint. Code that calculates "total revenue" can simply do `SUM(amount_paise)` because refunds subtract automatically. Don't add kind-aware logic in queries.
6. **Effective status is computed, not stored as 'expired'.** The view does the work. Don't add a cron in v1 — it's another moving part to manage and debug. Computed-on-read is correct and simple.
7. **One active membership per member.** Enforced in the service layer (step 2 of enrollment) with `FOR UPDATE` lock. Don't try to use a partial unique index — it makes legitimate transitions racy.
8. **Renewal start date logic is subtle.** Pre-renewal (renewing while current is still active) is BLOCKED in v1. Document this in the UI: when receptionist tries to renew an active membership before its end_date, show "Cannot renew until current membership ends on 03 Aug 2026." Reconsider in v1.1 with a "queued renewal" feature.
9. **Discount validation:** discount_paise must be `>= 0` (never negative, that's price inflation, not a discount) and `<= plan_price + addons_total` (cannot make total negative). Both checked in service layer.
10. **Backdating payments.** Allowed up to 30 days. Why? Receptionist forgets to record a Friday payment, enters it Monday. Why limit to 30? Beyond that it's almost certainly fraud or a typo. Hard-coded for v1, configurable post-v1.
11. **Refund of refund: not allowed.** A refund row has `kind = 'refund'`. Cannot refund a refund. Service-level check.
12. **Member soft-delete with active membership: blocked** (already mentioned in Module 03; now actually enforceable since `memberships` table exists). Wire up the check in `softDeleteMember` action.
13. **Payment edit + member's membership total: stay in sync.** If owner edits a payment from ₹5000 → ₹4500, the membership's `final_amount_paise` should also become ₹4500 (single-payment world). Otherwise reports are wrong. Update both inside the same transaction.
14. **Invoice prefix has trailing dash, year follows: `ZEN-2026-0042`.** If owner's prefix is "ZEN" (no dash), produce "ZEN-2026-0042" anyway — server adds the dash. Document in the UI tooltip on `gyms.invoice_prefix` field.
15. **Don't expose `payments.deleted_at` UI.** Soft-deleting payments is a footgun. Use refund flow always. The column exists for emergencies (data import errors, etc.), not as a normal user action.
16. **Audit log volume:** every enrollment writes 2 rows, refunds write 1, edits write 1. For a busy gym (50 enrollments/day), that's ~3000 audit rows/month. Fine. Don't over-engineer retention now.
17. **Branch_id on payments is denormalized.** It must match the membership's branch_id. If member moves branches mid-cycle (post-v1), payments stay associated with the branch where collected. Document.

# Module 04 — Amendment

> Patch to Module 04 covering three UX gaps surfaced after initial implementation. Apply this on top of an already-shipped Module 04. Estimated time: 0.5–1 day.

---

## A1. Combined "Add member + Enroll" flow

**Problem:** Receptionist has to add a member, then click into the new member, then enroll them in a plan, then take payment. Three separate flows for one walk-in.

**Solution:** Extend the "Add member" sheet (Module 03) with an optional Membership section. Keep the API/data model unchanged — under the hood, it's still two operations (`createMember` then `enrollNewMember`), wrapped in a single transaction at the service layer.

### Updated Add Member sheet structure

Existing sections (unchanged):

1. Personal details
2. Branch & membership info
3. Emergency contact (collapsible)
4. Address & notes (collapsible)

**New section, between #2 and #3:**

#### 5. Plan & payment (collapsible, default OPEN for new walk-ins)

A collapsible section header: "Plan & payment" with a subtitle "Optional — you can also enroll later."

When expanded, contains:

- **Enroll now toggle** (Switch component, default ON)
  - Helper text: "Skip if this member is just being registered without payment yet."
  - When OFF: rest of the section greyed out / hidden.
- **Plan** (Combobox, required if enrolling)
- **Add-ons** (Checkboxes; auto-apply ones pre-checked)
- **Pricing summary** (read-only computed display: plan + addons − discount = total)
- **Discount** (MoneyInput, optional)
- **Discount reason** (textarea, required if discount > 0)
- **Start date** (date picker, default today)
- **Payment mode** (segmented buttons)
- **Payment date** (date picker, default today)
- **Payment notes** (optional)

The "Plan & payment" section uses the SAME components as the standalone Enrollment sheet — extract them into reusable form sections:

- `<PlanSelector />`
- `<AddOnsChecklist />`
- `<PricingSummary />`
- `<PaymentDetails />`

These get reused in the standalone enrollment sheet and the renewal sheet. Build once, use thrice.

### Footer behavior

Submit button text adapts to state:

- Enroll toggle ON: "Add member & enroll"
- Enroll toggle OFF: "Add member"

The "Add another" checkbox still works — when checked + enrolled, after success the form resets but keeps branch + start_date + payment_mode (not plan, not amounts).

### Server flow

Add a new service function:

```ts
// server/services/create-and-enroll.ts
async function createMemberAndEnroll(input: {
  member: MemberCreateInput;
  enrollment?: EnrollmentInput;
}): Promise<
  | { ok: true; member_id: string; membership_id?: string; payment_id?: string; invoice_number?: string }
  | { ok: false; code: string; message: string }
>;
```

Single transaction:

```
BEGIN
  1. Validate member input.
  2. Insert member.
  3. recordAudit('member.create').
  4. If input.enrollment is present:
       a. Patch enrollment.member_id with the new member.id.
       b. Run the enrollment service (steps from Module 04 §4.5).
  5. Return success with all generated IDs.
COMMIT
```

If enrollment fails partway, the entire transaction rolls back — no orphan member, no orphan payment.

### Important: Edit member sheet stays focused

**Do NOT** add membership/payment fields to the Edit Member sheet. Editing a payment is a financially sensitive operation that needs different gates (Owner-only, requires reason, audited differently). Keep Edit member purely for profile fields.

The Current Membership card on the member detail page IS the membership-management interface. Make it obvious — see A3 below.

---

## A2. Members table — wire up the Membership column

**Problem:** Module 03 defined a "Membership status" column that shows `—` for everyone because Module 04 didn't connect it.

**Solution:** Update `listMembers` to LEFT JOIN the latest membership and render properly.

### Query change

`server/queries/members/list-members.ts`:

For each member, also fetch their **most recent** membership using a lateral join (Drizzle supports this) or a correlated subquery:

```sql
select m.*,
       latest.id              as latest_membership_id,
       latest.plan_id         as latest_plan_id,
       latest.start_date      as latest_start_date,
       latest.end_date        as latest_end_date,
       latest.effective_status as latest_status,
       p.name                 as latest_plan_name
from members m
left join lateral (
  select * from memberships_with_status
  where member_id = m.id
  order by start_date desc, created_at desc
  limit 1
) latest on true
left join plans p on p.id = latest.plan_id
where m.gym_id = $1 and m.deleted_at is null
order by ...
```

This is **one query** for the entire page, not N+1. Critical.

Cap on performance: with 1000 members and lateral join + index on `(member_id, start_date desc)`, this should run in <50ms. If slower, ask Claude Code to explain the query plan before optimizing further.

### Membership column rendering

Replace the placeholder `—` with a `<MemberMembershipCell />` component:

```
States and rendering:

No membership ever:
  ┌──────────────┐
  │ — No plan    │   (muted, gray)
  └──────────────┘

Active:
  ┌─────────────────────────────────────┐
  │ ● Active · Half Yearly              │  (green dot, regular text)
  │ Ends in 47 days · 27 Oct 2026       │  (small, muted)
  └─────────────────────────────────────┘

Expiring soon (<= 14 days):
  ┌─────────────────────────────────────┐
  │ ● Expiring · Half Yearly            │  (amber dot)
  │ Ends in 6 days · 06 May 2026        │
  └─────────────────────────────────────┘

Expired:
  ┌─────────────────────────────────────┐
  │ ● Expired · Half Yearly             │  (red dot)
  │ Expired 12 days ago · 19 Apr 2026   │
  └─────────────────────────────────────┘

Frozen:
  ┌─────────────────────────────────────┐
  │ ● Frozen · Half Yearly              │  (amber dot)
  │ Resumes 12 May 2026                 │
  └─────────────────────────────────────┘

Cancelled:
  ┌──────────────┐
  │ ● Cancelled  │  (gray dot)
  └──────────────┘
```

Why dots instead of badges? Less visual weight per row. With 50 rows on screen, badges turn the whole table into a christmas tree. Dots let the eye scan quickly.

In **Dense** mode, collapse to single line: `● Active · Ends in 47 days`.

### Sortability

Add membership status as a sortable column. Sort order should be intuitive:

1. Expiring soon (most urgent first)
2. Active
3. Expired
4. Frozen
5. Cancelled
6. No membership

Use a `case` expression in SQL for the sort key.

### New filter chip

In the filter bar above the table, add a Status filter:

- All (default)
- Active
- Expiring soon (next 14 days)
- Expired
- Frozen
- No membership

This is the **#1 most-used filter** for an owner: "show me everyone whose membership is about to expire so I can chase them." Make this filter prominent — possibly as quick-pill buttons in addition to the dropdown:

```
[All]  [Active]  [Expiring soon ⚠ 12]  [Expired ✕ 4]  [No membership]
```

The number badges are counts. They make the page feel alive and answer the receptionist's first question without any clicks.

---

## A3. Make Current Membership card the management hub

**Problem:** Once a membership is created, it's not obvious how to manage it. The Edit button on the page only edits profile, not membership.

**Solution:** The Current Membership card itself should expose all membership actions clearly.

### Updated Current Membership card

For an active membership:

```
┌────────────────────────────────────────────────────────────┐
│ Current membership                          ● Active       │
│                                                            │
│ Half Yearly                                                │
│ 30 Apr 2026 → 27 Oct 2026 · Ends in 180 days              │
│ ₹10,000                                                    │
│                                                            │
│ [Renew] [Freeze]                              [⋯ menu]    │
└────────────────────────────────────────────────────────────┘
```

Where:

- `[Renew]` — primary button. Visible always (not just when expiring); receptionist has the option to renew early. (Note: the underlying renewal logic still blocks pre-renewal in v1 — clicking Renew when current is still active shows: "Cannot renew until 27 Oct 2026. Renew button enabled 14 days before expiry.")
  **Reconsider:** make the Renew button enabled only when ends_in_days <= 14. Otherwise, disabled with a tooltip "Renew available 14 days before expiry."
- `[Freeze]` — secondary button. Visible if active (Module 06).
- `[⋯ menu]` — Owner-only options:
  - View invoice (Module 09)
  - Cancel membership (Owner-only; sets status to 'cancelled', refunds via separate refund flow)

For expired membership:

```
┌────────────────────────────────────────────────────────────┐
│ Current membership                          ● Expired      │
│                                                            │
│ Half Yearly                                                │
│ Expired 12 days ago · was 30 Apr 2026 → 27 Oct 2026       │
│                                                            │
│ [Renew membership]                                         │
└────────────────────────────────────────────────────────────┘
```

Renew button is large and primary. The card visually emphasizes "this needs action."

For no membership:

```
┌────────────────────────────────────────────────────────────┐
│ Current membership                                         │
│                                                            │
│ This member has no active membership.                      │
│                                                            │
│ [Enroll in plan]                                           │
└────────────────────────────────────────────────────────────┘
```

For frozen:

```
┌────────────────────────────────────────────────────────────┐
│ Current membership                          ● Frozen       │
│                                                            │
│ Half Yearly                                                │
│ Frozen 28 Apr 2026 → 12 May 2026 (14 days)                 │
│ Will resume 12 May 2026 · End date extended to 10 Nov 2026 │
│                                                            │
│ [Unfreeze now]                                [⋯ menu]    │
└────────────────────────────────────────────────────────────┘
```

### Recent payments card

Already specced in Module 04. One small addition — make the "View all" link more visible and add a small info row:

```
┌────────────────────────────────────────────────────────────┐
│ Recent payments                              View all →   │
│                                                            │
│ ZEN-2026-0001                          ₹10,000   [⋯]      │
│ 30 Apr 2026 · Cash · by Vibhu Dawar                        │
│                                                            │
│ Total paid: ₹10,000 · Net (after refunds): ₹10,000        │
└────────────────────────────────────────────────────────────┘
```

The "Total paid / Net" line at the bottom is small but valuable. Owners ask "how much has this member paid in total" all the time.

---

## Acceptance Criteria for Amendment

- Add Member sheet has a "Plan & payment" section, default expanded, with Enroll Now toggle.
- Submitting Add Member with enrollment ON creates member + membership + payment in one atomic transaction.
- Submitting Add Member with enrollment OFF creates only member (existing behavior).
- If enrollment fails, member is NOT created (full rollback). Verified by deliberately submitting invalid plan_id.
- Members table shows correct membership status with dot indicators.
- Quick-pill filters (Active / Expiring / Expired / No membership) work and show counts.
- Sorting by membership status works correctly.
- Current Membership card on member detail page exposes Renew/Freeze/cancel actions appropriately based on status and role.
- Renew button disabled (with tooltip) for active memberships ending > 14 days away.
- Recent payments card shows Total paid + Net after refunds.

---

## Files Touched

```
server/services/create-and-enroll.ts                  (NEW — combined transaction)
server/queries/members/list-members.ts                (MODIFIED — lateral join)
server/actions/members/create-member.ts               (MODIFIED — accepts optional enrollment)

app/(app)/members/_components/member-form-sheet.tsx   (MODIFIED — adds Plan & payment section)
app/(app)/members/_components/members-table.tsx       (MODIFIED — Membership column)
app/(app)/members/_components/members-filters.tsx     (MODIFIED — status pills)
app/(app)/members/_components/member-membership-cell.tsx (NEW — dot+text rendering)
app/(app)/members/[id]/_components/current-membership-card.tsx (MODIFIED — action buttons + states)
app/(app)/members/[id]/_components/recent-payments-card.tsx    (MODIFIED — net total row)

components/forms/plan-selector.tsx                    (NEW — extracted)
components/forms/add-ons-checklist.tsx                (NEW — extracted)
components/forms/pricing-summary.tsx                  (NEW — extracted)
components/forms/payment-details.tsx                  (NEW — extracted)
```

---

## What you should NOT do

1. **Don't add membership/payment editing to the Edit Member sheet.** Keep that sheet focused on profile fields. Membership management lives in the Current Membership card. Mixing these creates dangerous UX (accidentally modifying financial records while fixing a typo in a name).
2. **Don't merge the Add Member sheet and Renewal sheet.** Renewal has different defaults, different start-date logic, different pre-fills. Tempting to DRY them, but the conditional logic gets ugly fast. Keep them as separate sheets that share form section components.
3. **Don't auto-enroll without an explicit toggle.** Some members really do walk in, register, and decide later. Forcing enrollment at creation is the opposite mistake. The toggle (default ON) gives the receptionist agency without adding clicks.

---

## A4. Membership correction system (role-based + time-windowed)

**Problem:** Receptionists make mistakes (wrong plan dropdown). Members change their mind ("I wanted Quarterly, not Half Yearly"). Without a correction mechanism, the only options are (a) live with wrong data, (b) full refund + re-enroll cycle for trivial fixes. Both are wrong.

**Solution:** A constrained correction system with role-based access and time-bound permissions. Designed so that fixing a typo is fast, but rewriting financial history is impossible.

### Permission matrix


| Time since enrollment | Receptionist (same user only) | Branch Manager (same branch) | Owner                            |
| --------------------- | ----------------------------- | ---------------------------- | -------------------------------- |
| < 60 minutes          | ✅ Correct                     | ✅ Correct                    | ✅ Correct                        |
| Same day, > 60 min    | ❌                             | ✅ Correct                    | ✅ Correct                        |
| < 90 days             | ❌                             | ❌                            | ✅ Correct (reason required)      |
| > 90 days             | ❌                             | ❌                            | ❌ Use refund + re-enroll instead |


**Why these constraints?**

- **60-minute receptionist window:** long enough to catch desk typos when member checks the receipt, short enough that nobody can rewrite yesterday's revenue.
- **Same-user rule for receptionists:** prevents one receptionist from "fixing" a transaction they weren't part of, which prevents collusion.
- **Same-day cap for branch managers:** they're the floor supervisor; they catch mistakes within hours, not weeks. Beyond the day, escalate to owner.
- **90-day owner cap:** after a quarter, the CA has reconciled the books. Going back further isn't "correction," it's accounting fraud. For >90 days, owner uses refund + re-enroll, which generates new traceable records instead of silent rewrites.

### Implementation

#### Permission helper — `lib/auth/membership-permissions.ts`

```ts
type CorrectionPermission =
  | { ok: true; level: 'receptionist' | 'manager' | 'owner' }
  | { ok: false; reason: string };

export function canCorrectMembership(
  user: User,
  membership: Membership,
  now: Date = new Date(),
): CorrectionPermission {
  const minutesSinceCreation = (now.getTime() - membership.created_at.getTime()) / 60000;
  const isSameDay = sameDayIST(now, membership.created_at);
  const daysSinceCreation = (now.getTime() - membership.created_at.getTime()) / 86_400_000;

  // Owner: 90-day window
  if (user.role === 'owner') {
    if (daysSinceCreation > 90) {
      return { ok: false, reason: 'Membership older than 90 days. Use refund + re-enroll.' };
    }
    return { ok: true, level: 'owner' };
  }

  // Branch manager: same day, same branch
  if (user.role === 'branch_manager') {
    if (user.branch_id !== membership.branch_id) {
      return { ok: false, reason: 'Membership is in a different branch.' };
    }
    if (!isSameDay) {
      return { ok: false, reason: 'Membership not from today. Ask owner to correct.' };
    }
    return { ok: true, level: 'manager' };
  }

  // Receptionist: 60 min, same user
  if (user.role === 'receptionist') {
    if (membership.enrolled_by_user_id !== user.id) {
      return { ok: false, reason: 'You did not enroll this member.' };
    }
    if (minutesSinceCreation > 60) {
      return { ok: false, reason: 'Correction window (60 min) has expired. Ask manager or owner.' };
    }
    return { ok: true, level: 'receptionist' };
  }

  return { ok: false, reason: 'Insufficient permissions.' };
}

```

This single function is the source of truth. Both UI (button visibility) and server (action gate) use it. Don't duplicate the logic.

#### Service — `server/services/correct-membership.ts`

```ts
type CorrectionInput = {
  membership_id: string;
  plan_id?: string;                  // changed plan
  applied_addon_ids?: string[];      // changed add-ons
  discount_paise?: number;           // changed discount
  discount_reason?: string;          // required if discount > 0
  payment_mode?: PaymentMode;        // changed payment mode
  reason: string;                    // ALWAYS required, min 10 chars
};

```

What's editable:

- `plan_id`
- `applied_addon_ids` (full set replacement)
- `discount_paise` + `discount_reason`
- `payment_mode`

What's NOT editable (ever):

- `member_id` (use refund + re-enroll if wrong member)
- `start_date`, `end_date` (correcting these is essentially time-traveling history)
- `branch_id`
- `payment_date`
- `invoice_number`
- `created_at`, `created_by_user_id` (immutable forever)

Algorithm:

```
BEGIN TRANSACTION
  1. Fetch user, membership, related payment (single payment in v1).
  2. Run canCorrectMembership(user, membership).
       If ok=false, ROLLBACK and return PERMISSION_DENIED with reason.
  3. Validate reason (min 10 chars). Reject if missing or empty.
  4. Capture before-state of membership + payment for audit.
  5. If plan_id changed: fetch new plan, verify is_active and gym_id.
  6. If applied_addon_ids changed: fetch each, verify is_active and gym_id.
  7. Recompute final_amount_paise server-side from new values.
       Validate discount logic (>= 0, <= plan + addons).
  8. UPDATE memberships row with new plan_id, end_date (recompute from
        start_date + new_plan.duration_days), plan_price_paise (snapshot
        of new plan), addons_total_paise, discount, final_amount.
        Update updated_at via trigger.
  9. DELETE existing membership_addons rows; INSERT new ones with snapshots.
  10. UPDATE payments row: amount_paise = new final_amount_paise,
         payment_mode = new mode if changed. updated_at via trigger.
  11. recordAudit({
        entity_type: 'membership',
        entity_id: membership.id,
        action: 'correction',
        before: {membership, addons, payment},
        after: {membership, addons, payment},
        meta: { level: permission.level, reason: input.reason }
      })
COMMIT

```

**Critical:**

- The membership and the payment are updated **together, atomically**. If correction changes amount, both must reflect the new amount.
- `original_end_date` is NOT changed by correction. It still reflects the very first end_date (Freezes use it for math). The `end_date` IS recomputed from the new plan's duration.
- The corrected payment keeps its original `invoice_number`. The invoice is being amended, not reissued.

#### Action — `server/actions/memberships/correct-membership.ts`

Standard server action wrapper. Returns `{ ok: true } | { ok: false, code, message }`.

#### UI: "Correct entry" button

On the Current Membership card (member detail page), and also accessible from the past memberships list:

- Button visible **only** when `canCorrectMembership()` returns `ok: true`.
- If user has correction permission but membership is older than the user's window, button is hidden (not greyed) — no need to surface what they can't do.
- Owner sees the button on virtually every membership in the last 90 days.
- The button's label adapts:
  - Within 60 min, by same receptionist: "Fix entry" (light, friendly)
  - By manager same day: "Correct entry"
  - By owner anytime: "Correct entry"

#### UI: Correction sheet

Sheet width: `sm:max-w-2xl` (same as enrollment).

**Layout:**

Top alert banner (always visible):

```
⚠ Corrections are logged in the audit trail.
   Original entry: 30 Apr 2026, 10:42 AM by Vibhu Dawar
   Correcting as: Owner

```

Section 1: **Original (read-only summary)** A muted card showing what's currently saved:

- Plan name, duration
- Add-ons applied
- Final amount
- Payment mode
- Date enrolled

Section 2: **Corrected values** (editable) Same fields as enrollment sheet, pre-filled with current values:

- Plan combobox
- Add-ons checklist
- Pricing summary
- Discount + reason
- Payment mode

Notice: **NO start date field, NO payment date field.** These are not editable.

Section 3: **Reason for correction** (always required)

- Textarea, 3 rows, min 10 chars.
- Helper: "Examples: Wrong plan selected at desk · Member changed to quarterly · Discount missing"

**Footer:**

- Right: secondary "Cancel" + primary "Save correction" (use destructive variant `outline-warning` styling — amber border — to signal weight without being scary).
- AlertDialog confirmation: "Save correction? The membership and payment record will be updated. This action is logged."

#### UI: Correction marker on the membership

After a correction, the affected membership and payment must visibly show "this was corrected":

On the Current Membership card:

```
┌────────────────────────────────────────────────────────────┐
│ Current membership                          ● Active       │
│                                                            │
│ Quarterly                                                  │
│ 30 Apr 2026 → 29 Jul 2026 · Ends in 90 days               │
│ ₹6,000                                                     │
│                                                            │
│ ⓘ Corrected by Owner on 02 May 2026                       │  ← new
│                                                            │
│ [Renew] [Freeze]                              [⋯ menu]    │
└────────────────────────────────────────────────────────────┘

```

The "Corrected by..." line is small, italic, gray. Click → opens a popover showing:

```
Corrected on 02 May 2026 at 11:15 AM
By: Vibhu Dawar (Owner)
Reason: Wrong plan selected at desk — should have been Quarterly

Original values:
- Plan: Half Yearly
- Final amount: ₹10,000

[View full audit history]

```

On the Recent Payments card, the corrected payment shows a small "✏ Corrected" badge next to the invoice number.

#### Database — schema additions

Add fields to `memberships`:


| column               | type                       | notes                                                             |
| -------------------- | -------------------------- | ----------------------------------------------------------------- |
| corrected_at         | timestamptz                | nullable; null = never corrected; non-null = last correction time |
| corrected_by_user_id | uuid                       | FK → users; nullable                                              |
| correction_count     | integer not null default 0 | how many times this membership has been corrected                 |


Add same to `payments`: | corrected_at | timestamptz | nullable | | corrected_by_user_id | uuid | nullable | | correction_count | integer not null default 0 | |

Why store these denormalized fields? Two reasons:

1. The "Corrected by ... on ..." UI marker would otherwise require querying audit_logs for every membership row in a list. That's expensive.
2. The `correction_count` lets the owner spot pattern abuse: "this membership was corrected 5 times — what's going on?"

These are updated atomically inside the correction service.

### Acceptance criteria for A4

- [ ] `canCorrectMembership()` returns correct verdict for all 9 cells of the permission matrix.
- [ ] Receptionist sees Fix button only on memberships they enrolled, only within 60 min.
- [ ] Branch manager sees Correct button on same-branch memberships, only same day.
- [ ] Owner sees Correct button on all memberships <= 90 days old.
- [ ] Beyond 90 days, no one can correct; owner sees "Use refund + re-enroll" guidance.
- [ ] Correcting a plan recomputes end_date from new plan's duration_days (start_date unchanged).
- [ ] Correcting a plan or add-on recomputes the linked payment's amount in the same transaction.
- [ ] Discount > 0 without reason → blocked.
- [ ] Reason field < 10 chars → blocked.
- [ ] Audit log entry has `action: 'correction'`, full before/after, level, reason.
- [ ] Corrected membership shows "Corrected by X on Y" marker; clicking shows popover with original values.
- [ ] Corrected payment shows "✏ Corrected" badge.
- [ ] `correction_count` increments on each correction.
- [ ] Two consecutive corrections work without breaking audit chain (each captures the prior state).
- [ ] Original `created_at` and `created_by_user_id` never change.
- [ ] Receptionist trying to correct via direct API call (bypassing UI) is blocked at the action layer with PERMISSION_DENIED.

### Files for A4

```
lib/auth/membership-permissions.ts                     (NEW)
lib/db/schema/memberships.ts                           (MODIFIED — add correction columns)
lib/db/schema/payments.ts                              (MODIFIED — add correction columns)
lib/db/migrations/0004_corrections.sql                 (NEW)

server/services/correct-membership.ts                  (NEW)
server/actions/memberships/correct-membership.ts       (NEW)

app/(app)/members/[id]/_components/correction-sheet.tsx           (NEW)
app/(app)/members/[id]/_components/correction-marker.tsx          (NEW)
app/(app)/members/[id]/_components/current-membership-card.tsx    (MODIFIED — add Correct button)
app/(app)/members/[id]/_components/recent-payments-card.tsx       (MODIFIED — add Corrected badge)

scripts/test-rls.ts                                    (extend with correction tests)

```

### Common pitfalls for A4

1. **Don't allow editing dates.** Tempting to add "fix wrong start_date" — refuse. Date corrections are time-travel and undermine the entire integrity model. If the start_date is genuinely wrong, the right answer is refund + re-enroll.
2. **The single payment must be updated in the same transaction.** If correction changes amount but payment row isn't updated, your reports show wrong revenue. Test this explicitly.
3. **Don't reset** `original_end_date`**.** That field is for Freeze math (Module 06). Corrections recompute `end_date` only.
4. **Audit log diff can be huge** if correction changes plan + 5 add-ons + discount. Don't truncate — store the full before/after JSON. Disk is cheap; truth is precious.
5. **Concurrent corrections race condition.** Two managers correct the same membership at the same time → second overwrites first silently. Mitigation: SELECT ... FOR UPDATE on the membership row in the correction transaction. Document this in the service.
6. **The button's "absence" is meaningful.** If a receptionist's 60 min has passed, the button just disappears. Don't show a greyed-out button with "permission denied" — it makes them feel restricted. Silent absence is the kinder pattern.
7. **Correction does NOT generate a new invoice number.** The corrected payment keeps its original invoice. This matters for accounting — you don't want gaps in your invoice sequence from "voids."

---

## A5. Cancel membership flow

**Problem:** Module 04 defines `status = 'cancelled'` as a possible state, but provides no UI or service to actually cancel a membership. Real scenarios this leaves stranded:

- Member moves cities mid-membership.
- Doctor advises 6-month rest after injury.
- Owner blacklists a problematic member.
- Member demands exit + refund.

Without a cancel flow, owner has to soft-delete the entire member (loses history) or wait for natural expiry (member is still "active" in reports for weeks).

**Solution:** Owner-only Cancel Membership action with optional refund integration.

### Service — `server/services/cancel-membership.ts`

```ts
type CancelInput = {
  membership_id: string;
  effective_date: string;          // YYYY-MM-DD; defaults today
  reason: string;                  // required, min 10 chars
  refund?: {
    amount_paise: number;          // positive; service negates
    payment_mode: PaymentMode;
    payment_id_to_refund: string;  // which original payment
    refund_notes?: string;
  };
};

```

Algorithm:

```
BEGIN TRANSACTION
  1. Owner role check (gate at action layer).
  2. Fetch membership; verify status in ('active', 'frozen').
       If 'expired' or 'cancelled' → INVALID_STATE.
  3. Validate effective_date >= start_date.
  4. Validate effective_date <= end_date (cannot cancel into the future).
  5. UPDATE memberships SET
       status = 'cancelled',
       end_date = effective_date,
       updated_at via trigger.
  6. recordAudit('membership.cancel', { reason, effective_date }).
  7. If input.refund is present:
       a. Run refund service (existing from Module 04 §4.5).
       b. Refund row created with kind='refund', linked to original payment.
       c. Audit captured by refund service.
COMMIT

```

**Why refund is optional:** Many cancellations are mid-cycle with no refund (member just stops coming). Some have refunds. Some have partial refunds. Don't force the receptionist into a refund decision they don't have authority to make. Owner picks at cancellation time.

### UI — Cancel button on Current Membership card

Visible only to Owner. Inside the `⋯` menu on the active/frozen membership card:

- "Cancel membership"

Click → opens CancelMembershipDialog (use AlertDialog because the action is destructive).

### Dialog layout

```
┌─────────────────────────────────────────────────────────┐
│ Cancel membership                                       │
│                                                         │
│ This will end the member's current membership.          │
│ Membership history is preserved.                        │
│                                                         │
│ ─────────────────────────────────────────               │
│                                                         │
│ Member: Vibhu Dawar                                     │
│ Plan: Half Yearly · 30 Apr 2026 → 27 Oct 2026          │
│ Days remaining: 175                                     │
│ Total paid: ₹10,000                                     │
│                                                         │
│ Effective date *                                        │
│ [   02/05/2026   📅]                                    │
│                                                         │
│ Reason for cancellation *                               │
│ [textarea, min 10 chars                              ]  │
│                                                         │
│ ─────────────────────────────────────────               │
│                                                         │
│ ☐ Issue a refund as part of this cancellation         │
│                                                         │
│   (When checked, expand into:)                          │
│   Refund amount: [   ₹___  ] of ₹10,000                │
│   Refund mode:   [Cash] [UPI] [Card] [Transfer]        │
│   Suggested:     ₹9,580 (175 of 180 unused days)       │
│                                                         │
│                                                         │
│              [Cancel]      [Cancel membership]          │
└─────────────────────────────────────────────────────────┘

```

The "Suggested" amount is a simple proration:

```
suggested_refund_paise = floor(
  final_amount_paise * (days_unused / total_days)
)

```

The owner can accept or override. We don't auto-fill the input — owner must explicitly type or click the suggested chip ("Use ₹9,580").

### After cancellation

- Toast: "Membership cancelled."
- Current Membership card now shows:

```
┌────────────────────────────────────────────────────────────┐
│ Current membership                       ● Cancelled       │
│                                                            │
│ Half Yearly · cancelled on 02 May 2026                     │
│ Was 30 Apr 2026 → 02 May 2026                              │
│ Reason: Member moving to Bangalore                         │
│                                                            │
│ Refunded: ₹9,580 (UPI) · Net paid: ₹420                    │
│                                                            │
│ [Enroll in new plan]                                       │
└────────────────────────────────────────────────────────────┘

```

The "Enroll in new plan" button lets the member rejoin later (e.g., they moved back) without having to first un-cancel anything.

### Acceptance criteria for A5

- [ ] Owner sees "Cancel membership" in `⋯` menu of active or frozen membership card.
- [ ] Receptionist and Branch Manager do NOT see this option.
- [ ] Cancel dialog requires reason (min 10 chars).
- [ ] Effective date defaults today, can be set earlier (back to start_date) but not into the future.
- [ ] Cancelling sets status = 'cancelled' and end_date = effective_date.
- [ ] Optional refund flow integrates with existing refund service.
- [ ] Refund amount cannot exceed remaining refundable amount on linked payment.
- [ ] Suggested refund proration computes correctly (verify with edge cases: cancelled on day 1, on last day).
- [ ] Cancelled member appears as "Cancelled" status in members list with proper badge.
- [ ] Audit log captures cancellation with reason.
- [ ] If refund issued, separate audit entry for the refund.
- [ ] Cancelled member can be enrolled in a new plan (no constraint blocking it — the old membership is `cancelled`, not `active`).
- [ ] Cancelling a membership with multiple payments (post-v1 partial payments) — for v1, single payment, no concern.

### Files for A5

```
server/services/cancel-membership.ts                   (NEW)
server/actions/memberships/cancel-membership.ts        (NEW)

app/(app)/members/[id]/_components/cancel-membership-dialog.tsx   (NEW)
app/(app)/members/[id]/_components/current-membership-card.tsx    (MODIFIED — add menu item + cancelled state)

```

### Common pitfalls for A5

1. **"Cancel" is not "delete."** A cancelled membership stays in the database, in the member's history, in audit logs. It's just terminated. Don't soft-delete it.
2. **The end_date becomes effective_date.** This matters: reports filtered "memberships ending in May" should now include this cancelled one (it ended on May 2). Consistent date semantics across statuses.
3. **One active enforcement still applies.** After cancelling, member can be re-enrolled — the old one is no longer 'active'.
4. **Don't auto-suggest 100% refund.** Suggest the prorated amount. A member who used the gym for a week shouldn't get a full refund; that's a freebie. Owner can override but the default protects revenue.
5. **Refund mode independent of original.** Member paid in cash, owner refunds via UPI: allowed. Reflects real-world flexibility.
6. **A cancelled-then-re-enrolled member's history is messy by design.** The detail page will show: Membership 1 (cancelled), Refund, Membership 2 (active). That's the truth. Don't try to "tidy" it by linking them — they're separate transactions.
7. **The cancellation dialog should not allow date in the past beyond start_date.** A cancellation effective before the membership started is nonsense — that's actually a "this should have never been created" case, which is what corrections (A4) or refund + delete handles.

## 4.12 What's Next

**Module 05 — Today's View.** The home dashboard. Surfaces the data this module just unlocked: expiring members, expired members, today's revenue, new enrollments. The most-visible screen in the app. Should feel snappy, actionable, and worth ₹5k/month at a glance.

After Module 05 ships, you have the **sellable MVP**. Demo it. Get feedback. Iterate before sinking more time into Modules 06+.