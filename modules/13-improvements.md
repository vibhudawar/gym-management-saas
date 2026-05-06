# Module 13 — Code Quality, Caching & Cleanup

> Audit-driven cleanup of the v1 codebase before customer demos. Trim dead code, tighten cache scope, fix two real timezone correctness bugs, and consolidate duplicated logic. No new features. Rolled out in 4 phases — each phase is independently shippable, ordered by effort × payoff.

**Estimated time:** 1.5 days across all phases (Phase 1 ≈ half-day, Phase 2 ≈ 3h, Phase 3 ≈ half-day, Phase 4 ≈ 3h).
**Outcome:** Smaller surface area, faster pages on warm cache, two correctness bugs fixed, fewer ways to do the same thing.

---

## 13.1 Methodology

- Read-only audit of `app/`, `server/`, `lib/`, `components/`, `middleware.ts` — ~31K LoC across 291 files.
- Skipped: `lib/db/migrations/*` (frozen history), `modules/*.md` (specs), `scripts/*` (one-off tooling).
- Caching scope: **Next.js native primitives only** — React `cache()`, `unstable_cache`, route-segment `revalidate`. No Redis/Upstash for v1.
- Each finding lists file paths, evidence, fix sketch, effort (S/M/L), and expected win.
- Every "dead code" claim was grep-verified across the repo before being included. Several agent claims were dropped after verification (e.g., `findByPhoneInGym`, `globalSearchMembers`, `getBranchActiveCounts`, `cn` from `lib/utils.ts` — all are live and in use).

---

## 13.2 Headline numbers

| Phase | Findings | Effort | Expected win |
|---|---|---|---|
| 1 — Quick wins | 9 | ~4h | ~250 LoC removed, 2 bugs fixed, 1 partial migration completed |
| 2 — Caching & invalidation | 4 | ~3h | Layout cache preserved across most settings mutations; 1–3 fewer DB queries per RSC render where queries are reused |
| 3 — Query & schema perf | 5 | ~5h | Faster expiring-member / payments queries; smaller payloads on member detail |
| 4 — Refactors & abstractions | 5 | ~3h | Single source of truth for dates, enum labels, anomaly thresholds |

---

## 13.3 Phase 1 — Quick wins (S effort, high payoff)

### 1.1 Delete confirmed-dead query exports

**Files:**
- `server/queries/add-ons/get-add-on.ts` — exports `getAddOn`, never imported.
- `server/queries/memberships/list-expired-memberships.ts` — exports `listExpiredMemberships`, never imported.
- `server/queries/memberships/list-expiring-memberships.ts` — exports `listExpiringMemberships`, never imported.
- `server/queries/payments/get-payments-by-membership.ts` — exports `getPaymentsByMembership`, never imported (only `getPaymentsByMember` is used).

**Evidence:** Grep across `app/`, `server/`, `lib/` finds zero call sites for each.

**Fix:** Delete each file. The `expired/expiring` logic is already covered inside `getTodaySnapshot` (Today page) and the reports queries.

**Effort:** S
**Expected win:** ~150 LoC removed, four fewer files to keep in sync with the schema.

---

### 1.2 Delete dead utilities

**Files:**
- `lib/utils/dates.ts:16` — `yesterdayIstIso()` exported, never imported.
- `lib/utils/phone.ts:74` — `lastDigits()` exported, never imported.

**Fix:** Delete both. If a caller ever needs yesterday-IST again, it's `addDays(todayIstIso(), -1)` (one line).

**Effort:** S
**Expected win:** ~10 LoC, smaller public API on `lib/utils/*`.

---

### 1.3 Make `isE164` module-private in `lib/utils/phone.ts`

**File:** `lib/utils/phone.ts:8`

**Evidence:** Exported but only used inside the same file (line 63, inside `formatPhoneForDisplay`). No external imports.

**Fix:** Drop the `export` keyword. Keep the function.

**Effort:** S
**Expected win:** Tighter API surface — callers can't depend on it accidentally.

---

### 1.4 Finish the phone-spelling migration (`normalisePhone` → `normalizeIndianPhone`)

**Files:**
- `lib/utils/phone.ts:106` — defines `normalisePhone` as a "backwards-compat alias" for `normalizeIndianPhone`.
- 4 call sites still use the old spelling: `server/actions/settings/update-account.ts`, `server/actions/settings/branch-actions.ts`, `scripts/create-tenant.ts` (×3 imports/calls).

**Evidence:** Half the codebase uses American spelling, half British. The alias was added during a partial migration that never finished.

**Fix:**
1. Update the 4 import sites to `normalizeIndianPhone`.
2. Delete the alias on `phone.ts:106`.
3. The `scripts/` change is fine — they're not under `app/`, but the inconsistency matters.

**Effort:** S
**Expected win:** One canonical spelling. New contributors stop wondering if these are different functions.

---

### 1.5 Fix UTC-vs-IST drift in `cancel-membership.ts`

**File:** `server/services/cancel-membership.ts:62`

**Evidence:**
```ts
const today = new Date().toISOString().slice(0, 10);  // UTC
if (input.effectiveDate > today) {
  return { ok: false, code: "INVALID_DATE", message: "Effective date cannot be in the future." };
}
```
Compare to `server/services/freeze.ts:97`, which uses `todayIstIso()`. Between **18:30 UTC and 23:59 IST** (i.e., 00:00–05:30 UTC on the next IST day), an owner in India cancelling a membership with `effectiveDate = today (IST)` will be rejected: UTC is one day behind IST during that window.

This is the same class of bug we already standardised on with `lib/utils/dates.ts:todayIstIso()`. One file slipped through.

**Fix:** Replace `new Date().toISOString().slice(0, 10)` with `todayIstIso()` (already imported in sibling services). Add a unit test or one manual run at 23:59 IST.

**Effort:** S
**Expected win:** Real correctness fix. Affects ~5.5h/day of traffic in India.

---

### 1.6 Fix UTC `todayIso()` in CSV member import

**File:** `lib/csv/members-import.ts:113-115`

**Evidence:**
```ts
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);  // UTC, not IST
}
```
Used to default `joined_date` for rows with a blank/invalid date. Same drift as 1.5: a 23:59 IST import sets some rows' `joined_date` to tomorrow.

**Fix:** Delete the local `todayIso()`, import `todayIstIso` from `lib/utils/dates`. (Don't add a second utility — the project already has one.)

**Effort:** S
**Expected win:** Late-night CSV imports stop drifting. Removes a duplicate utility.

---

### 1.7 Complete or delete the dangling check in `restore-member.ts`

**File:** `server/actions/members/restore-member.ts:40-55`

**Evidence:**
```ts
const [livePhoneOwner] = await db
  .select({ id: members.id })
  .from(members)
  .where(and(
    eq(members.gymId, session.gym.id),
    eq(members.phone, before.phone),
    isNotNull(members.deletedAt),       // <-- looks for ALREADY-DELETED, not live
  ))
  .limit(1);
if (livePhoneOwner) {
  // The above query is symmetric — we'll just re-issue without deletedAt
  // filter to find live duplicates.
}
// ↑ no return, no action, query result is discarded
```
Two problems: (a) the filter is `isNotNull(deletedAt)` which finds soft-deleted owners, not live ones — so `livePhoneOwner` is always undefined for the intended case, (b) even if it weren't, the `if` block is empty.

The unique-constraint catch block on lines 76-89 currently catches the duplicate at write time — so it works, but the upfront pre-check is dead code. Either complete it or remove it.

**Fix:** Remove the dead block entirely. The catch on `23505` is sufficient for surfacing the error. Saves a query and removes confusion.

**Effort:** S
**Expected win:** ~20 LoC removed, one fewer dead query per restore call, no functional change (the catch path was already doing the work).

---

### 1.8 Extract `MIN_REASON_CHARS` to a constant

**Files:** Five services define `const MIN_REASON_CHARS = 10` independently:
- `server/services/freeze.ts:31`
- `server/services/unfreeze.ts:30`
- `server/services/cancel-membership.ts:40`
- `server/services/refund.ts:47`
- `server/services/correct-membership.ts:48`

**Fix:** Add `export const MIN_REASON_CHARS = 10` to `lib/constants/validation.ts`. Import everywhere. If we ever change the policy (e.g., to 20 chars or per-action), it's one edit.

**Effort:** S
**Expected win:** Single source of truth for a policy that's clearly meant to be uniform.

---

### 1.9 Extract `isUniqueViolation` helper

**Files:** Identical helpers defined in:
- `server/actions/members/update-member.ts`
- `server/actions/members/restore-member.ts`
- `server/actions/plans/create-plan.ts`
- `server/actions/plans/update-plan.ts`
- `server/actions/add-ons/create-add-on.ts`
- `server/actions/add-ons/update-add-on.ts`

Each looks like:
```ts
function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err
    && (err as { code: string }).code === "23505";
}
```

**Fix:** Create `lib/db/errors.ts` exporting `isUniqueViolation(err)` and `isCheckViolation(err)` (PG `23514`). Replace local copies.

**Effort:** S
**Expected win:** ~30 LoC removed; if PG error codes ever shift, one place to update.

---

## 13.4 Phase 2 — Caching & invalidation (M effort)

### 2.1 Wrap read-heavy lookup queries in React `cache()`

**Files:**
- `server/queries/plans/list-plans.ts` — currently un-cached, called from members page, member detail, plans page, payments page.
- `server/queries/add-ons/list-add-ons.ts` — same pattern.
- `server/queries/branches/list-active-branches.ts` — already wrapped in `cache()` ✅ (good template).

**Evidence:** Within a single RSC render, the same RSC tree often queries plans/add-ons from layout, page, and a child component. Without `cache()` from React, each call hits the DB; with `cache()`, the second and third calls return the same promise.

**Fix:**
```ts
import { cache } from "react";

export const listPlans = cache(async (options: ListPlansOptions = {}) => {
  // existing body
});
```

**Effort:** S
**Expected win:** Per-render dedup. On member-detail render: ~2–3 fewer DB queries. Page load drops 10–30ms on warm-network conditions.

> Note: `cache()` is per-request only. For cross-request caching of these slow-changing tables (plans, add-ons, branches), `unstable_cache` with tags is the next step — but only worth doing if measurement shows DB pressure. Defer until we see it.

---

### 2.2 Tighten over-broad `revalidatePath('/', 'layout')` calls

**Files:** 9 confirmed call sites:
- `server/actions/settings/update-gym-profile.ts:107`
- `server/actions/settings/branch-actions.ts` — lines 69, 113, 192, 225 (create / update / deactivate / reactivate)
- `server/actions/branches/set-active-branch.ts:38, 66`
- `server/actions/freezes/create-freeze.ts:33` — `revalidatePath("/")` (root, not layout — milder but still wide)
- `server/actions/freezes/unfreeze-early.ts:32` — same
- `server/actions/reminders/record-reminder.ts:118` — same

**Evidence:** `revalidatePath("/", "layout")` invalidates the **entire `(app)` layout subtree**. Every page route's RSC cache gets cleared. For a single branch rename, the user pays a re-render of the dashboard, members list, plans, settings, etc. on the next nav.

**Fix:** Replace each with a narrower call:
- Settings/gym-profile mutation → `revalidatePath("/settings/gym")`. Sidebar-displayed gym name reads from session, which the auth layer caches separately; it picks up the new name on next session refresh anyway.
- Branch create/update → `revalidatePath("/settings/branches")` + `revalidatePath("/", "layout")` only if the branch dropdown in the topbar must update immediately. If the dropdown reads from a `cache()`-wrapped `listActiveBranches` keyed off session (it does), use `revalidateTag("branches")` after switching to tagged caching, OR keep the layout invalidation only on create/deactivate/reactivate (where the dropdown actually changes), not on rename.
- `set-active-branch` → narrower `revalidatePath("/")` is fine; the active branch only affects the dashboard tile.
- Freeze create/unfreeze → narrow to `revalidatePath("/members/${memberId}")` + `revalidatePath("/")` (Today page). They don't touch any layout-cached data.

**Effort:** M
**Expected win:** Layout cache preserved across most settings edits. Subjectively, the app feels faster after settings mutations — no full-app cold reload.

---

### 2.3 Memoize `getCurrentSession` with React `cache()`

**File:** `lib/auth/get-session.ts`

**Evidence:** Called from `(app)/layout.tsx`, every page's role check, every server action's `requireRole(...)`, and indirectly from `recordAudit()`. On a single member-detail render, this can fire 4–6 times.

**Fix:** Confirm whether the function is already wrapped in `cache()`. If not:
```ts
import { cache } from "react";
export const getCurrentSession = cache(async () => { ... });
```
Look for any in-flight Supabase JWT roundtrip — `getClaims()` is fast but not free.

**Effort:** S
**Expected win:** 3–5 fewer `supabase.auth.getClaims()` round-trips per page render. Most are <5ms but they add up.

---

### 2.4 Decide on `getTodaySnapshot` cache strategy (no change yet — write up)

**File:** `server/queries/today/get-today-snapshot.ts`

**Evidence:** ~12 parallel queries. Called on every `(app)/page.tsx` render. Data is per-gym, per-day, with sub-minute drift (a new payment changes today's revenue immediately).

**Options:**
- **(a)** No change — current `Promise.all` is already parallel; query plans look reasonable.
- **(b)** Wrap in `unstable_cache` with `revalidate: 30` and `tags: [`gym-${gymId}-today`]`. After every payment/enrollment/freeze action, `revalidateTag(`gym-${gymId}-today`)`. Up to 30s staleness if a tag-revalidation is missed.
- **(c)** Wrap in React `cache()` only — per-render dedup, no cross-request benefit.

**Recommendation:** **(c)** for now; revisit if we see the dashboard query weight in Supabase logs after onboarding the first 5 customers. The risk of stale-revenue-after-payment in (b) outweighs the speedup at our scale.

**Effort:** Decision now (free); implementation if (b) chosen later: M.

---

## 13.5 Phase 3 — Query & schema perf (M effort)

### 3.1 Add partial-index filter `where deleted_at is null` to `payments` indexes

**File:** `lib/db/schema/payments.ts:74-85`

**Evidence:** Both date indexes scan all rows including soft-deleted ones, then filter:
```ts
index("payments_gym_date_idx").on(table.gymId, table.paymentDate),
index("payments_gym_branch_date_idx").on(table.gymId, table.branchId, table.paymentDate),
```
99% of queries add `where deletedAt is null`. A partial index excludes the dead rows from the index entirely.

**Fix:**
```ts
index("payments_gym_date_idx")
  .on(table.gymId, table.paymentDate)
  .where(sql`${table.deletedAt} is null`),
index("payments_gym_branch_date_idx")
  .on(table.gymId, table.branchId, table.paymentDate)
  .where(sql`${table.deletedAt} is null`),
```
Generate a new migration. The `memberships_gym_end_date_idx` already does this — copy the pattern.

**Effort:** S (migration + verification)
**Expected win:** 5–15% on payment-list / revenue queries depending on soft-delete density. Bigger over time as deleted rows accumulate.

---

### 3.2 Trim over-fetch in `getPaymentsByMember`

**File:** `server/queries/payments/get-payments-by-member.ts:14-49`

**Evidence:** Selects 14 columns including `notes` (free text, can be long), `reason`, `correctedAt`, `correctionCount`, `correctedByUserId` — fields not displayed on the member-detail "Recent payments" card (which shows id, date, amount, mode, kind only).

The same query is reused for the member's full payments page where the extra columns *are* needed.

**Fix:** Two variants.
- `getRecentPaymentsByMember(memberId, limit)` — slim projection: `id, paymentDate, amountPaise, paymentMode, kind, invoiceNumber`. Used on member detail.
- `getPaymentsByMember(memberId)` — full projection. Used on `/members/[id]/payments`.

**Effort:** S
**Expected win:** Member-detail payload smaller (≈30% by row count); negligible CPU but cleaner intent.

---

### 3.3 Untangle scalar subqueries in `listMembers`

**File:** `server/queries/members/list-members.ts:49-84`

**Evidence:** Three correlated subqueries (`latestStatusSql`, `latestEndDateSql`, `latestPlanNameSql`) embedded into the SELECT. The same `latestStatusSql` block is referenced in WHERE filters and ORDER BY — Postgres usually inlines and optimizes these, but the SQL is hard to read and the `latestStatusSql` includes its own `EXISTS` subquery against `freezes`, which adds a row-by-row freeze-table lookup unless the planner can rewrite it.

**Fix:** Materialise as a CTE referenced from the main SELECT:
```sql
with member_latest as (
  select distinct on (member_id) member_id, status, end_date, plan_id
  from memberships
  where deleted_at is null
  order by member_id, start_date desc
),
member_freeze_active as (
  select distinct membership_id from freezes
  where deleted_at is null and freeze_start_date <= current_date
    and freeze_end_date >= current_date and status <> 'cancelled_early'
)
select m.*,
  case when ml.status = 'cancelled' then 'cancelled'
       when ml.end_date < current_date then 'expired'
       when mfa.membership_id is not null then 'frozen'
       else 'active' end as latest_status,
  ...
from members m
left join member_latest ml on ml.member_id = m.id
left join member_freeze_active mfa on mfa.membership_id = ml.member_id
where m.gym_id = ${gymId} and ...
```

**Verification:** `EXPLAIN ANALYZE` before/after on a gym with 5K members. Don't merge unless the rewrite is measurably faster — it could go either way depending on planner behaviour.

**Effort:** L (high care — this is the members-list query, one bug here corrupts every page)
**Expected win:** Speculative — verify before committing. Possibly 30–50% faster on large gyms; unchanged on small ones.

---

### 3.4 Investigate the `enrolled_today.payment_mode` correlated subquery

**File:** `server/queries/today/get-today-snapshot.ts:407-414`

**Evidence:** Embedded scalar subquery to fetch the first payment's mode per enrolled-today row. Agent flagged as N+1; in reality, Postgres often turns this into a hash/merge join. Worth checking with `EXPLAIN ANALYZE` before refactoring.

**Fix (if confirmed slow):** Convert to a `LEFT JOIN LATERAL` once before the main result, or to a window function over a join.

**Effort:** S to investigate, M to refactor if needed.
**Expected win:** Conditional. Don't change unless `EXPLAIN ANALYZE` shows row-by-row execution.

---

### 3.5 Consider a `(gym_id, status, end_date) where deleted_at is null` index on memberships

**File:** `lib/db/schema/memberships.ts:90-91`

**Evidence:** Existing `memberships_gym_end_date_idx` is filtered to `status='active'`. That covers expiring-soon queries well. But queries that need other statuses (frozen, cancelled, expired) by date range fall back to the broader `memberships_gym_branch_status_idx` which doesn't include `end_date`.

**Fix:** Only add this index if reports/anomaly queries are slow. Premature otherwise — partial indexes have maintenance cost on every write.

**Effort:** S
**Expected win:** Conditional. Profile first.

---

## 13.6 Phase 4 — Refactors & abstractions (M effort)

### 4.1 Centralize one-off date conversions

**Files (sample):**
- `lib/utils/period-comparison.ts:61-62`
- `app/(app)/members/[id]/_components/unfreeze-sheet.tsx`
- `app/(app)/members/[id]/_components/refund-sheet.tsx`
- Several other components with inline `.toISOString().slice(0, 10)`.

**Evidence:** Same conversion repeated. Every callsite is a place where the timezone semantics get fuzzy ("is this UTC or local?"). Already burned us in 1.5 and 1.6.

**Fix:** Add `dateToIso(d: Date): string` to `lib/utils/dates.ts` with a doc comment:
> "Returns the date portion of a Date in **UTC**. For IST-aware 'today', use `todayIstIso()`."

Replace inline calls. The point isn't the line saved — it's having one place where a future contributor lands when they grep for date-to-ISO.

**Effort:** M
**Expected win:** Consistency; the function name carries the timezone story.

---

### 4.2 Centralize enum label maps

**Files:**
- `app/(app)/members/_components/member-form-sheet.tsx` — defines `GENDER_LABELS`.
- `app/(app)/members/[id]/_components/member-profile-card.tsx` — duplicates `GENDER_LABELS`.
- `app/(app)/plans/_components/plan-form-sheet.tsx` — defines `PLAN_TYPE_LABELS`.
- Others may exist for `PAYMENT_MODE_LABELS`, `FREEZE_REASON_LABELS`.

**Fix:** Move all to `lib/constants/labels.ts`:
```ts
export const GENDER_LABELS: Record<MemberGender, string> = {
  male: "Male",
  female: "Female",
  other: "Other",
  prefer_not_to_say: "Prefer not to say",
};
// ...
```
Import from a single place.

**Effort:** S
**Expected win:** ~30 LoC removed; future i18n only touches one file.

---

### 4.3 Anomaly thresholds → constants

**Files:** `lib/utils/anomaly-rules/{revenue-drop,refund-spike,large-discount,discount-leakage,member-loss,slow-week}.ts`

**Evidence:** Each rule hardcodes its threshold (`0.8`, `0.6`, `3`, `0.25`, `0.08`, `0.15`, …). When tuning starts (after first customer feedback), each tweak is a multi-file edit.

**Fix:** Add `lib/constants/anomaly-thresholds.ts`:
```ts
export const ANOMALY_THRESHOLDS = {
  REVENUE_DROP_RATIO: 0.8,
  REVENUE_DROP_HIGH_SEVERITY_RATIO: 0.6,
  REFUND_SPIKE_MULTIPLIER: 3,
  REFUND_SPIKE_HIGH_SEVERITY_MULTIPLIER: 5,
  LARGE_DISCOUNT_RATIO: 0.25,
  DISCOUNT_LEAKAGE_RATIO: 0.08,
  DISCOUNT_LEAKAGE_HIGH_SEVERITY_RATIO: 0.15,
  // ...
} as const;
```
Document that these will likely move to a `gyms.anomaly_config` jsonb column when per-tenant tuning is needed.

**Effort:** S
**Expected win:** Tunability is now a single-file edit, not a treasure hunt.

---

### 4.4 Anomaly rules: shared aggregator

**Files:** `lib/utils/anomaly-rules/*.ts`

**Evidence:** Each rule fetches its own context data (revenue, refunds, member churn, discount totals). Six rules × independent fetches = 6 round trips. Even with `Promise.all`, that's six query plans for what could be one.

**Fix:** `lib/utils/anomaly-rules/aggregator.ts` precomputes a single context object — `AnomalyContext` — with all the metrics needed by every rule, in **one** SQL with multiple CTEs. Each rule becomes pure:
```ts
type AnomalyContext = {
  currentPeriodRevenuePaise: number;
  priorPeriodRevenuePaise: number;
  refundCount: number;
  refundTotalPaise: number;
  // ...
};
export function detectRevenueDrop(ctx: AnomalyContext, thresholds): Anomaly | null { ... }
```

**Effort:** M
**Expected win:** 6 queries → 1. Rules become unit-testable without DB. ~150ms saved on the dashboard load when anomaly detection runs.

---

### 4.5 Phone normalization at the Zod boundary

**Files:** `server/actions/members/create-member.ts`, `server/actions/members/update-member.ts`, `server/actions/settings/update-account.ts`, `server/actions/settings/branch-actions.ts`.

**Evidence:** Today, phones are normalised in the action body **after** Zod validates the raw input. A row with `+91 98765 43210` (with spaces) currently passes Zod (`phoneSchema` checks E.164 format on already-normalised), then gets normalised before insert. Fine, but inconsistent — sometimes the action does it, sometimes the schema is asked to validate, sometimes both.

**Fix:** Make `phoneSchema` in `lib/utils/phone.ts` normalize **inside** the schema via `z.string().transform()`:
```ts
export const phoneSchema = z.string().trim().transform((raw, ctx) => {
  const normalized = normalizeIndianPhone(raw);
  if (!normalized) {
    ctx.addIssue({ code: "custom", message: "Invalid Indian mobile number" });
    return z.NEVER;
  }
  return normalized;
});
```
Now every action that uses `phoneSchema` gets normalisation for free. Drop the `normalisePhoneOrError` wrappers in `branch-actions.ts`.

**Effort:** M (touches 4–5 files; needs careful `safeParse` flow)
**Expected win:** One choke point for phone normalization. Removes 30–40 LoC of action-side wrappers.

---

## 13.7 Out of scope (deliberately not doing)

- **Rename `listMembers` to `searchMembers`** — debatable; current name is conventional in the codebase. Breaking change for low value.
- **Rename `correctMembership`** — domain term is "correction", everyone on the team uses it.
- **Structured logger** — overkill at v1 scale. `console.error` with context strings is enough until customer signal demands more.
- **Audit individual addon changes inside `correctMembership`** — the membership audit captures `before/after` of the parent row; addon-level granularity is a v1.5 feature if/when an owner asks.
- **Tenant-scoped Redis cache** — no measured DB pressure. Don't add infra speculatively.
- **Eager removal of MSG91 scaffold** — placeholder is intentional; will earn its keep when notifications go live.

---

## 13.8 Acceptance criteria per phase

Each phase ends green on:
1. `pnpm exec tsc --noEmit` — zero new errors.
2. `pnpm lint` — zero new warnings.
3. Manual smoke: sign in as `owner-a@example.com` → dashboard loads → create member → enroll → freeze → unfreeze → refund. No regressions.
4. **Phase 1**: `git grep` confirms each deleted symbol has zero remaining references.
5. **Phase 2**: After each `revalidatePath` change, verify the affected pages still pick up updates within one nav.
6. **Phase 3**: For each schema/index change, run the migration on a snapshot of the dev DB and confirm `EXPLAIN ANALYZE` improves on the targeted query.
7. **Phase 4**: After each refactor, run the smoke flow above end-to-end.

---

## 13.9 What this changes about the product

Nothing visible to gym owners. This is engineering hygiene before paying customers land. The two correctness fixes (1.5 + 1.6) eliminate two classes of late-night-IST bug that would have shown up as "why does this date look wrong?" support tickets. Everything else is foundation: a smaller surface to read, fewer ways to do the same thing, and cache scope that doesn't carpet-bomb the layout on every settings edit.

After Module 13, the codebase is ready to host Module 09 (PDF invoices) when a customer asks for it, without inheriting the dead code we'd otherwise be adding around.
