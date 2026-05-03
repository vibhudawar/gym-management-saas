# Module 08 — Audit Log Viewer

> Surface the audit entries we've been writing since Module 01. Read-only forensic view used during disputes, member complaints, accountability reviews. No new business logic — just clean filtering and presentation of the audit trail that already exists.

**Estimated time:** 1 day.
**Outcome:** Owner can answer "who edited this payment yesterday?" or "show me everything Vibhu did last week" in under 30 seconds. Branch Manager has the same view, scoped to their branch.

---

## 8.1 Scope

In:
- `/audit-log` page accessible to Owner and Branch Manager.
- Filterable, paginated list of audit entries.
- Filters: date range, entity type, action, user.
- Click entry → expand to show before/after JSON diff.
- "Related entries" — for any entity, see all audit history for it.
- Entity-scoped audit views accessible from member detail (existing Activity card already uses this data; this module adds a "View full history" link).
- Excel export of filtered audit entries.

Out:
- Audit log search by free text (over JSON content). Defer — useful but expensive without proper full-text search setup.
- Audit log retention policies / archival. Defer until DB pressure is real.
- Diff visualization for non-JSON fields (we'll show raw JSON in v1; pretty diff is post-v1).
- Restoring/reverting from an audit entry. Never. Audit is read-only forensic, not a time machine.
- Notifications on suspicious activity ("alert me when X happens"). Different feature; defer.
- Audit logs of audit log views (meta-audit). Over-engineering.

---

## 8.2 Data Model

**No new tables.** The `audit_logs` table from Module 01 is the entire data source. This module only adds queries and UI.

Confirm the existing schema has these fields (from Module 01 § 1.2):

| column | type | notes |
|---|---|---|
| id | bigserial PK | |
| gym_id | uuid not null | |
| user_id | uuid not null | FK → users; NULL not allowed (no system events in Module 06+) |
| entity_type | text not null | `member` \| `payment` \| `membership` \| `plan` \| `addon` \| `freeze` \| `user` \| `gym` \| `notification` (added by Module 11 if it writes audits) |
| entity_id | uuid not null | |
| action | text not null | `create` \| `update` \| `delete` \| `correction` \| `cancel` \| `refund` \| `freeze.create` \| `freeze.cancel_early` etc. |
| before_json | jsonb | |
| after_json | jsonb | |
| created_at | timestamptz not null default now() | |

If the schema has drifted (e.g., `meta_json` was added for context info), document it but don't refactor. Use what's there.

### Indexes — add if missing

```sql
-- Already from Module 01:
-- (gym_id, created_at desc)
-- (entity_type, entity_id)

-- Add for filter performance:
create index if not exists audit_logs_user_id_idx
  on audit_logs(gym_id, user_id, created_at desc);

create index if not exists audit_logs_action_idx
  on audit_logs(gym_id, action, created_at desc);
```

These are partial-utility indexes — only needed if filter combos get slow. With a fresh tenant, you don't need them yet. Add them via the Module 08 migration so the cost is paid once.

### Branch scoping — important architectural note

The `audit_logs` table doesn't have a `branch_id` column. This is by design — audit is gym-wide. But Branch Manager scoping requires *deriving* the branch from the audited entity.

Two approaches:

**Approach A: Add branch_id to audit_logs.** Denormalized. Easy to filter. Requires migrating existing rows + updating `recordAudit()` to capture branch_id at write time.

**Approach B: Compute branch at query time.** Join from `audit_logs` to the entity's table to get branch_id, then filter.

**Decision: Approach A.** Reasons:
1. Audit log queries are already lightweight (small page sizes, tight filters). Adding a JOIN per query is wasteful.
2. Branch_id may need to come from different source tables depending on entity_type — a JOIN strategy would need a CASE statement that's brittle.
3. Most entities already have branch_id denormalized (members, memberships, payments, freezes, notifications). Capturing it at audit-write time is one line.
4. Schema cost is one column + one index. Migration is cheap.

So this module **adds a branch_id column to audit_logs**, populates it for new entries, and backfills existing rows by joining to entity tables.

#### Migration

```sql
alter table audit_logs add column branch_id uuid;

-- Backfill from each entity type
update audit_logs al set branch_id = m.branch_id
  from members m where al.entity_type = 'member' and al.entity_id = m.id and al.branch_id is null;

update audit_logs al set branch_id = m.branch_id
  from memberships m where al.entity_type = 'membership' and al.entity_id = m.id and al.branch_id is null;

update audit_logs al set branch_id = p.branch_id
  from payments p where al.entity_type = 'payment' and al.entity_id = p.id and al.branch_id is null;

update audit_logs al set branch_id = f.branch_id
  from freezes f where al.entity_type = 'freeze' and al.entity_id = f.id and al.branch_id is null;

update audit_logs al set branch_id = n.branch_id
  from notifications n where al.entity_type = 'notification' and al.entity_id = n.id and al.branch_id is null;

-- For entity types without branch (plan, addon, gym, user-gym-level), branch_id stays null.
-- These show only to Owner. RLS policies handle this case.

create index audit_logs_branch_id_idx on audit_logs(gym_id, branch_id, created_at desc) where branch_id is not null;
```

#### Update `recordAudit()` helper

The existing helper from Module 01 needs to capture branch_id. Update it to accept (or derive) branch_id from the input entity. Most calls have it on the entity already; passing it explicitly is cleanest:

```ts
export async function recordAudit(input: {
  entityType: string;
  entityId: string;
  branchId: string | null;     // NEW; null for gym-level entities
  action: string;
  before?: unknown;
  after?: unknown;
}): Promise<void>;
```

Every existing caller needs a small update to pass `branchId`. Minor refactor across services. Document in module's "Files Touched" section.

### RLS update

Replace existing audit_logs RLS policy with branch-aware version:

```sql
drop policy if exists "tenant_isolation" on audit_logs;

create policy "audit_logs_tenant_isolation" on audit_logs
  for select using (gym_id = current_user_gym());

create policy "audit_logs_branch_scoping" on audit_logs
  for select using (
    current_user_role() = 'owner'
    or branch_id is null              -- gym-level entries only Owner needs, but allow read; UI hides.
    or branch_id = current_user_branch()
  );

-- INSERT policy: any authenticated user in the gym can write (services do this)
create policy "audit_logs_insert" on audit_logs
  for insert with check (gym_id = current_user_gym());

-- No UPDATE or DELETE policies — audit log is append-only.
```

Note the subtle decision: gym-level entries (plan changes, gym profile edits) have `branch_id = null`. Branch Manager's RLS allows reading them, but the **UI filters them out** for Branch Manager (because they don't need to see "Owner edited the gym name"). Two layers, both intentional.

---

## 8.3 Server Layer

### `server/queries/audit-log/list-audit-entries.ts`

```ts
type ListAuditInput = {
  gymId: string;
  branchId?: string | null;          // null → all branches (Owner only)
  fromDate?: string;                 // YYYY-MM-DD inclusive
  toDate?: string;                   // YYYY-MM-DD inclusive
  entityType?: string;               // filter by member / payment / etc.
  action?: string;                   // filter by create / update / correction etc.
  userId?: string;                   // filter by who did it
  page?: number;                     // 1-based
  pageSize?: number;                 // default 50, max 100
};

type AuditEntry = {
  id: string;
  createdAt: Date;
  user: { id: string; name: string; role: string };
  entityType: string;
  entityId: string;
  entityLabel: string;               // e.g., "Vibhu Dawar" for member, "ZEN-2026-0042" for payment
  action: string;
  branchId: string | null;
  branchName: string | null;
  beforeJson: unknown;
  afterJson: unknown;
};

async function listAuditEntries(input): Promise<{
  rows: AuditEntry[];
  total: number;
  page: number;
  pageSize: number;
}>;
```

Single query with filters and pagination. JOIN to `users` for user name. JOIN to `branches` for branch name. For `entityLabel`, do entity-aware joins:

```sql
-- Pseudo-SQL showing the entityLabel resolution
select
  al.*,
  u.name as user_name,
  u.role as user_role,
  b.name as branch_name,
  case al.entity_type
    when 'member' then m.name
    when 'payment' then p.invoice_number
    when 'membership' then concat(mp.name, ' for ', mb.name)
    when 'plan' then pl.name
    when 'addon' then a.name
    when 'freeze' then concat('Freeze for ', fmb.name)
    when 'user' then us.name
    when 'gym' then g.name
    when 'notification' then concat(n.event_type, ' to ', nm.name)
    else al.entity_type || ' #' || left(al.entity_id::text, 8)
  end as entity_label
from audit_logs al
left join users u on u.id = al.user_id
left join branches b on b.id = al.branch_id
-- ... entity-specific joins ...
where al.gym_id = $1
  and ($2::uuid is null or al.branch_id = $2 or al.branch_id is null)
  and ...
order by al.created_at desc
limit $page_size offset $offset;
```

This is a CASE expression with ~9 LEFT JOINs. Looks heavy but each JOIN is by primary key on a denormalized table — Postgres handles it well. Test with EXPLAIN ANALYZE on a realistic dataset; if slow, consider materializing entityLabel into the `audit_logs` table at write time (post-v1 optimization).

### `server/queries/audit-log/get-entity-history.ts`

For "show me everything that happened to this member" use case.

```ts
async function getEntityAuditHistory(
  entityType: string,
  entityId: string,
): Promise<AuditEntry[]>;
```

Reuses the same row shape. No filters needed beyond entity scope. Used by Module 03's Activity card and the new "View full history" link from member detail.

### `server/queries/audit-log/list-distinct-users.ts`

Powers the "User" filter dropdown. Returns list of staff who have ANY audit entries in the current gym.

```ts
async function listAuditUsers(gymId: string, branchId?: string | null): Promise<{
  id: string;
  name: string;
  role: string;
  entryCount: number;
}[]>;
```

Used to populate the filter dropdown without hitting the entire `users` table.

### Excel export

Same pattern as Module 07 reports:

```ts
async function exportAuditEntries(input: ListAuditInput): Promise<{
  rows: Array<{
    Date: string;
    Time: string;
    User: string;
    Role: string;
    Entity: string;
    Action: string;
    Branch: string;
    'Before (JSON)': string;
    'After (JSON)': string;
  }>;
  filename: string;
}>;
```

JSON columns are pretty-printed strings (not native JSON, since Excel doesn't support nested JSON cells). Use `JSON.stringify(value, null, 2)`.

---

## 8.4 UI

### Sidebar
"Audit log" already in sidebar from Module 01. Activate the route now (currently probably a placeholder).

### Page header (CPO note)

Audit log is a forensic tool, not a daily operations screen. The header should reflect that — not aggressive, no exclamation marks. Calm, professional, slightly weighty.

```
┌────────────────────────────────────────────────────────────────┐
│ Audit log                                          [Export →] │
│ Every change made in your gym, with full history.             │
└────────────────────────────────────────────────────────────────┘
```

### Filter bar

```
┌────────────────────────────────────────────────────────────────┐
│ [Last 7 days ▾]  [All entities ▾]  [All actions ▾]  [All staff ▾] │
│                                                                 │
│ Showing 142 entries · 12 today                                 │
└────────────────────────────────────────────────────────────────┘
```

Filters:
- **Date range:** Same date preset dropdown as Reports (Module 07). Default: "Last 7 days" (audit is forensic — recent matters most).
- **Entity type:** "All entities" + each unique type (Member, Payment, Membership, Plan, Add-on, Freeze, User, Gym, Notification).
- **Action:** "All actions" + each unique action (Create, Update, Delete, Correction, Refund, Cancel, Freeze created, Freeze cancelled early, etc.). Group with section headers in dropdown if list gets long.
- **User:** "All staff" + each user who has entries. Show name + role badge in dropdown ("Vibhu Dawar — Owner").

URL state: all filters in `searchParams`. Refresh preserves view.

Branch filter (Owner only with multi-branch gym): added next to user filter. For Branch Manager, no branch filter (auto-scoped, hidden).

### Audit entry row

Each entry renders as a card-style row:

```
┌────────────────────────────────────────────────────────────────┐
│ ● Payment edited                              2 hr ago         │
│ ZEN-2026-0042 · ₹10,000 → ₹9,500                               │
│ Vibhu Dawar (Owner) · Main Branch                              │
│ ▾ Show details                                                 │
└────────────────────────────────────────────────────────────────┘
```

**Visual elements:**

- **Status dot color:**
  - Gray for `create` actions (everyday)
  - Blue (primary) for `update` actions (modifications)
  - Amber for `correction`, `freeze.cancel_early`, `cancel` (special interventions)
  - Red for `delete`, `refund` (destructive/financial reversals)

- **Headline:** Action verb + entity type. "Payment edited", "Member created", "Freeze cancelled early", "Membership corrected".

- **Subtitle:** entity-specific summary. The most important difference from a generic audit viewer:
  - For payments: show invoice + before→after amount if amount changed
  - For members: show name + what changed (e.g., "Phone updated")
  - For memberships: show plan name + what changed
  - For corrections: show the before/after value briefly inline ("Plan: Half Yearly → Quarterly")
  - For freezes: show date range and reason snippet
  - For notifications: show event type + recipient

  This subtitle is what makes the audit log scannable. Without it, every entry says "entity X was updated" and the user has to expand each one.

- **Attribution:** "Vibhu Dawar (Owner) · Main Branch" or "(System)" for null user_id (none in current build, but defensive).

- **Timestamp:** Relative on display ("2 hr ago", "Yesterday", "12 days ago"), absolute on hover (tooltip).

- **Show details:** Click to expand inline.

### Expanded detail view

When user clicks "Show details," the row expands:

```
┌────────────────────────────────────────────────────────────────┐
│ ● Payment edited                              2 hr ago         │
│ ZEN-2026-0042 · ₹10,000 → ₹9,500                               │
│ Vibhu Dawar (Owner) · Main Branch                              │
│                                                                │
│  Reason: "Customer overcharged due to discount missed at desk" │
│                                                                │
│  ▼ BEFORE                          ▼ AFTER                     │
│  ┌──────────────────────────┐    ┌──────────────────────────┐ │
│  │ {                         │    │ {                         │ │
│  │   "amount_paise": 1000000,│    │   "amount_paise": 950000, │ │
│  │   "payment_mode": "cash", │    │   "payment_mode": "cash", │ │
│  │   "notes": null           │    │   "notes": "Discount fix" │ │
│  │ }                         │    │ }                         │ │
│  └──────────────────────────┘    └──────────────────────────┘ │
│                                                                │
│  → View this payment                                           │
│  → All changes to this payment (3 entries)                     │
└────────────────────────────────────────────────────────────────┘
```

**Components in expanded view:**

- **Reason** (if present in audit metadata): pulled from before/after JSON if there's a `reason` or similar field. For `correction`, `refund`, `cancellation`, `freeze.cancel_early`, `payment.update` — these always have a reason. Render it prominently as a quote.

- **Before / After JSON blocks:** Side-by-side on desktop, stacked on mobile. Use a code block style (`bg-muted`, `font-mono`, `text-xs`). Pretty-printed with 2-space indentation. Diff highlighting *not* required for v1 (raw JSON is fine; diff is polish post-v1).

- **Quick links:**
  - "View this [entity]" → navigate to entity detail page (e.g., `/members/[id]`, `/payments/[id]/...`).
  - "All changes to this [entity]" → filter the audit log to show only entries for this entity_id.

Click "Show details" again or click row header to collapse.

### "All changes to this entity" filter

Adding `?entity_type=payment&entity_id=...` to the URL filters the list to a single entity's history. This is what powers the "View full history" links elsewhere in the app.

Above the filtered list, show a context banner:

```
┌────────────────────────────────────────────────────────────────┐
│ Showing all changes to: Payment ZEN-2026-0042                  │
│ [Clear filter]                                                 │
└────────────────────────────────────────────────────────────────┘
```

### Pagination

50 per page. "Load more" button at bottom (matches members list pattern). For very large audit logs (10k+ entries), users will narrow with filters before scrolling.

### Empty states

- **No entries match filters:** "No audit entries match these filters." Centered, muted. Sub-line: "Try widening your date range or removing a filter."
- **No entries exist at all** (impossible for any active gym, but defensive): "No activity logged yet."

### Loading state

Skeleton: filter bar (real, not skeleton) + 8 skeleton rows.

### Mobile

- Filter bar stacks vertically.
- Entry rows: keep dot + headline + timestamp on top row, attribution below.
- Expanded detail: BEFORE/AFTER blocks stack vertically.

### Member detail integration

Existing Activity card on member detail (Module 03) already shows recent member-scoped audit entries. Add a "View full history →" link at the bottom that navigates to:

```
/audit-log?entity_type=member&entity_id=<member_id>
```

Same pattern wherever an entity has audit history worth seeing in full (payment detail modal, membership history card, etc.). Light touch — these are escape hatches to the full audit log, not the audit log embedded everywhere.

---

## 8.5 Acceptance Criteria

### Schema & RLS
- [ ] Migration adds `branch_id` column, backfills correctly, creates index.
- [ ] `recordAudit()` updated to accept `branchId` parameter.
- [ ] All existing services (members, plans, memberships, payments, freezes, notifications, corrections, cancellations) updated to pass `branchId`.
- [ ] RLS policies updated; verify via `scripts/test-rls.ts`:
  - [ ] Owner sees all entries.
  - [ ] Branch Manager sees branch-scoped entries + null-branch entries.
  - [ ] Receptionist cannot access `/audit-log` (route guarded).

### Listing & filtering
- [ ] Page loads with default "Last 7 days" filter.
- [ ] Date range filter works with all presets and custom range.
- [ ] Entity type filter works.
- [ ] Action filter works.
- [ ] User filter works; only shows users with entries.
- [ ] Branch filter visible to Owner only with multi-branch gyms.
- [ ] Pagination works; "Load more" appends rows.
- [ ] URL state preserved on filter change.
- [ ] Entry counts in filter bar accurate.

### Entity labels
- [ ] Member entries show member name.
- [ ] Payment entries show invoice number.
- [ ] Membership entries show plan + member name.
- [ ] Plan entries show plan name.
- [ ] Add-on entries show add-on name.
- [ ] Freeze entries show "Freeze for [member name]".
- [ ] User entries show user name.
- [ ] Gym entries show gym name.
- [ ] Notification entries show event type + recipient.

### Row presentation
- [ ] Status dot colors match action type (gray/blue/amber/red).
- [ ] Subtitle is entity-specific and informative (not generic "X updated").
- [ ] Attribution shows user name + role + branch.
- [ ] Relative timestamp; absolute on hover.

### Detail expansion
- [ ] Click "Show details" expands inline.
- [ ] Before/After JSON shown side-by-side (stacked on mobile).
- [ ] Reason field surfaced prominently when present in audit metadata.
- [ ] "View this entity" link works.
- [ ] "All changes to this entity" link filters list correctly.
- [ ] Click row header again collapses.

### Excel export
- [ ] Export button downloads .xlsx of currently-filtered set.
- [ ] Filename: `audit-log-<gym-name>-<from>-to-<to>.xlsx`.
- [ ] All filtered rows included (not just paginated).
- [ ] JSON columns pretty-printed strings.
- [ ] Opens in Excel without errors.

### Cross-app integration
- [ ] Activity card on member detail has "View full history →" link.
- [ ] Link navigates to filtered audit log for that member.
- [ ] Similar links on payment detail, membership history (where useful).

### General
- [ ] Lighthouse perf ≥ 90 on `/audit-log` with 1000 entries.
- [ ] No N+1 queries — verify with Drizzle logging.
- [ ] List query <300ms with 10k entries (filtered to a week).
- [ ] No `any` types.

---

## 8.6 Files Created in This Module

```
lib/db/schema/audit-logs.ts                              (MODIFIED — add branch_id)
lib/db/migrations/0008_audit_log_branch.sql              (NEW — column + backfill + index)

lib/auth/audit.ts                                        (MODIFIED — recordAudit accepts branchId)

server/queries/audit-log/list-audit-entries.ts           (NEW)
server/queries/audit-log/get-entity-history.ts           (NEW; replaces / extends Module 03 Activity card query)
server/queries/audit-log/list-audit-users.ts             (NEW)
server/queries/audit-log/export-audit.ts                 (NEW)

server/services/                                         (ALL existing services modified to pass branchId to recordAudit:
                                                          enrollment, renewal, refund, correct-membership, cancel-membership,
                                                          freeze, unfreeze, dispatch-notification, plan/addon/member CRUD)

app/(app)/audit-log/page.tsx                             (NEW)
app/(app)/audit-log/layout.tsx                           (role gate: owner / branch_manager only)
app/(app)/audit-log/loading.tsx                          (skeleton)
app/(app)/audit-log/_components/audit-filters.tsx
app/(app)/audit-log/_components/audit-list.tsx
app/(app)/audit-log/_components/audit-entry-row.tsx
app/(app)/audit-log/_components/audit-entry-details.tsx  (expanded view)
app/(app)/audit-log/_components/json-block.tsx           (formatted JSON display)
app/(app)/audit-log/_components/entity-context-banner.tsx (the "showing changes to..." banner)

app/(app)/members/[id]/_components/member-activity-card.tsx (MODIFIED — add "View full history" link)

scripts/test-rls.ts                                      (extend with audit branch-scoping tests)
```

---

## 8.7 Common Pitfalls

1. **Don't try to "pretty diff" the JSON in v1.** Side-by-side raw JSON is sufficient. Building a real diff (highlighting changed fields, collapsing unchanged sections) is a 2-day project on its own. Defer.

2. **Backfill must be idempotent.** If migration runs twice (or partially fails and reruns), the `where al.branch_id is null` clause prevents double-application. Don't omit it.

3. **The CASE expression for entity labels is verbose but right.** Don't try to abstract it with a polymorphic helper or a separate `entity_labels` view. Keep it inline in the query — it's easier to debug and faster than the abstraction.

4. **Receptionist is route-guarded, but also test direct API calls.** If receptionist calls `/api/...` for audit data directly (which doesn't exist as an API in this design, but defensive), the RLS policies must still block them. RLS is the safety net; route guards are the convenience.

5. **Audit log is append-only by design.** No UPDATE policy, no DELETE policy. This means even Owner cannot edit a misleading audit entry. That's the point — if audit could be edited, it would be useless as evidence. If a row is genuinely wrong (e.g., bug wrote bad data), fix the bug; don't add an "edit audit" feature.

6. **Don't include sensitive data in `before/after` JSON.** Audit logs persist forever; passwords, payment-method-CVVs, etc. should never be there. We're not capturing any of these in current data model — but if the schema ever expands to include sensitive fields, scrub before audit. Document this rule.

7. **`branch_id is null` semantics.** Plan changes, gym profile edits, add-on changes — these are gym-level, not branch-scoped. Branch Manager's RLS *allows* them through (branch_id IS NULL clause), but the **UI filter for Branch Manager hides them** by default (filter dropdown's "All entities" subtly excludes plan/addon/gym for non-owners). Two layers, both intentional.

8. **The "View this entity" link must handle deleted entities.** A member could have been soft-deleted after an audit entry was written. The link should still navigate, but the page might show "Member [name] (deleted)" — handle gracefully. Don't 404.

9. **Time zone consistency.** Audit entries store `created_at` in UTC. Filter and display in IST. Same pattern as elsewhere. Easy to get wrong here because audit is cross-cutting.

10. **The "All changes to this entity" link uses entity_id as a URL param.** Make sure it works for all entity types — including `freeze`, where users might not naturally think to filter.

---

## 8.8 What this changes about the product

Audit Log is the trust layer for chains. A small independent gym might use this once a year (a single payment dispute). A 5-branch chain owner uses it weekly — "Why did this membership get cancelled? Who did it? Was the reason valid?"

This is what makes the difference between "₹2k/month gym software" and "₹5k/month software a chain owner trusts." Without an audit log, chains keep using Excel + paper because they don't trust receptionists with their money.

After this module ships, you can credibly tell a 3-branch chain owner: "Every change made in your gym, by anyone, is recorded permanently. You can see who edited what and when. Your receptionist cannot quietly reduce a member's fees without you knowing." That sentence is what closes a chain deal.

---

## 8.9 What's next

**Module 12 — Settings.** The foundational page that's currently empty. Captures gym profile (including GST number), branches management, staff management, notifications config, plus a danger zone. Required before Module 09 (PDF Invoices) since invoice generation needs the GST number.

After 12, **Module 09 — PDF Invoices** generates compliant invoices using whatever's in Settings. Together with Audit Log, that's the full operator-facing product for v1.
