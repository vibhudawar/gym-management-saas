# Module 02 — Plans & Add-ons Management

> The owner configures the gym's offerings: membership plans (3-month General, 6-month Cardio, etc.) and add-ons (Registration Fee, Locker). These become the catalogue used at every enrollment in Module 04.

**Estimated time:** 1 day.
**Outcome:** Owner can create, edit, deactivate plans and add-ons. Receptionist can view but not modify. All changes audited.

---

## 2.1 Scope

In:
- `plans` and `add_ons` schemas with RLS.
- CRUD UI for plans (Owner + Branch Manager).
- CRUD UI for add-ons (Owner + Branch Manager).
- Soft delete via `is_active` toggle (preserves history of past memberships on those plans).
- Read-only view for Receptionist.
- Form validation, money input handling, audit trail.

Out:
- Variable pricing per branch (single price per plan; branch-specific pricing is post-MVP).
- Plan duration overrides at enrollment time (use add-ons or discounts instead).
- Tax rules (handled at GST stage, post-v1).

---

## 2.2 Data Model

### `plans`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| gym_id | uuid not null | FK → gyms |
| name | text not null | e.g., "3 Months Gym + Cardio" |
| duration_days | integer not null | 30, 90, 180, 365 — store days, not months |
| type | text not null | `general` \| `cardio` \| `gym_cardio` \| `custom` |
| default_price_paise | integer not null | e.g., 450000 = ₹4500 |
| description | text | optional, shown on plan card |
| is_active | boolean not null default true | inactive = hidden from new enrollments, history preserved |
| created_at | timestamptz not null default now() | |
| updated_at | timestamptz not null default now() | |
| deleted_at | timestamptz | hard-delete only via DB; UI uses `is_active` |

Indexes:
- `(gym_id, is_active)` — list view.
- Unique partial: `(gym_id, lower(name)) where deleted_at is null` — prevent duplicate plan names per gym.

Constraints:
- `duration_days > 0`
- `default_price_paise >= 0`
- `type in ('general','cardio','gym_cardio','custom')`

RLS: standard tenant isolation template from Module 01. Receptionist gets SELECT only (handled at app layer; DB allows SELECT for any authenticated user in the gym).

### `add_ons`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| gym_id | uuid not null | FK → gyms |
| name | text not null | e.g., "Registration Fee", "Locker" |
| amount_paise | integer not null | |
| type | text not null | `one_time` \| `recurring` |
| auto_apply_on_first_enrollment | boolean not null default false | true for Registration Fee; pre-checks the box at enrollment |
| description | text | |
| is_active | boolean not null default true | |
| created_at | timestamptz not null default now() | |
| updated_at | timestamptz not null default now() | |
| deleted_at | timestamptz | |

Indexes:
- `(gym_id, is_active)`
- Unique partial: `(gym_id, lower(name)) where deleted_at is null`.

Constraints:
- `amount_paise >= 0`
- `type in ('one_time','recurring')`

---

## 2.3 Zod Schemas

`lib/db/schema/plans.ts`:
```ts
export const planTypes = ["general", "cardio", "gym_cardio", "custom"] as const;
export type PlanType = (typeof planTypes)[number];

export const planCreateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  duration_days: z.number().int().min(1).max(3650),
  type: z.enum(planTypes),
  default_price_paise: z.number().int().min(0).max(100_000_00),
  description: z.string().trim().max(280).optional(),
});

export const planUpdateSchema = planCreateSchema.partial().extend({
  is_active: z.boolean().optional(),
});
```

`lib/db/schema/add-ons.ts`:
```ts
export const addonTypes = ["one_time", "recurring"] as const;

export const addOnCreateSchema = z.object({
  name: z.string().trim().min(2).max(60),
  amount_paise: z.number().int().min(0).max(100_000_00),
  type: z.enum(addonTypes),
  auto_apply_on_first_enrollment: z.boolean().default(false),
  description: z.string().trim().max(140).optional(),
});

export const addOnUpdateSchema = addOnCreateSchema.partial().extend({
  is_active: z.boolean().optional(),
});
```

---

## 2.4 Server Layer

### Queries — `server/queries/plans/`
- `listPlans({ includeInactive?: boolean })` — default `false`. Sorted: active first, then by name.
- `getPlan(id)` — single plan; respects RLS.

### Queries — `server/queries/add-ons/`
- `listAddOns({ includeInactive? })`
- `getAddOn(id)`

### Actions — `server/actions/plans/`
- `createPlan(input)` — Owner/Manager only. Validate via `planCreateSchema`. Returns `{ ok, data | error }`. Records audit.
- `updatePlan(id, input)` — same. Records `before/after`.
- `togglePlanActive(id, active: boolean)` — separate from `updatePlan` for clarity.

Mirror for add-ons.

### Permissions
Wrap each action with `requireRole("owner","branch_manager")`. Receptionist gets a 403 toast if they somehow trigger.

---

## 2.5 UI

### Navigation
Add to sidebar under Settings (sub-section), or as a top-level "Catalogue" item — pick **top-level "Plans"** for v1 (it's accessed at every enrollment indirectly, and keeps menu shallow).

Sidebar order (for Owner):
1. Today
2. Members
3. Enrollments
4. **Plans** ← new
5. Payments
6. Reports
7. Audit log
8. Settings

### `/plans` — list page

**Layout:** Page header with title "Plans" + subtitle "Membership offerings shown at enrollment" + primary button **"Add plan"** (top-right).

Below header:
- Tabs: "Active" | "Inactive" (uses shadcn Tabs).
- Card grid (3 columns desktop, 2 tablet, 1 mobile). **Not** a table — plan cards convey hierarchy better and there'll be ~5–15 plans per gym.

**Plan card structure (custom component):**
```
+-----------------------------------+
| 3 Months Gym + Cardio             |  <- name (font-medium text-base)
| 90 days · Gym + Cardio            |  <- duration · type (text-xs muted)
|                                   |
| ₹4,500                            |  <- price (text-2xl font-semibold)
|                                   |
| [optional description]            |  <- text-sm muted line-clamp-2
|                                   |
| [Edit]              [⋯ menu]      |  <- ghost button + dropdown
+-----------------------------------+
```

The `⋯` dropdown (DropdownMenu): "Deactivate" (or "Activate" if inactive).

Hover: subtle shadow lift (`hover:shadow-md transition`). Border `border-border`.

**Empty state (no plans):**
- Centered, full-width across the grid area.
- Icon: lucide `Package` (muted).
- Heading: "No plans yet".
- Body: "Create your first membership plan to start enrolling members."
- Primary CTA: "Add your first plan" (opens same dialog as "Add plan").

**Loading state:** Show 6 skeleton cards.

### Add/Edit plan — Sheet (slide-over from right)

Use shadcn **Sheet**, not Dialog. Sheets feel less modal and are better for forms. Width: `sm:max-w-md`.

Fields:
1. **Name** (required, text input). Placeholder: "3 Months Gym + Cardio".
2. **Type** (required, segmented buttons via Tabs or shadcn ToggleGroup): General / Cardio / Gym + Cardio / Custom.
3. **Duration** (required) — two inputs side by side:
   - A number input (`min=1`).
   - A select for unit (Days / Months). Internally always converts to days. Default: 3 / Months.
   - Show calculated `days` next to it as muted text: "= 90 days".
4. **Price (₹)** — money input. Internally a custom `<MoneyInput>` component:
   - Accepts decimal input ("4500" or "4500.00").
   - Stores as paise on form submit.
   - Shows ₹ prefix inside the input (using leading icon slot).
5. **Description** (optional, textarea, max 280 chars). Char counter below.

Footer of sheet:
- Right-aligned: secondary "Cancel" + primary "Save plan".
- On edit: also a destructive ghost button on the LEFT: "Deactivate plan" (or "Reactivate"). Confirm via AlertDialog.

Validation: inline errors below each field (react-hook-form + Zod).

**Save behaviour:**
- Submit calls server action.
- Success → Sonner toast "Plan saved", close sheet, refresh list (TanStack Query invalidate or `revalidatePath`).
- Server validation error (e.g., duplicate name) → inline error on the relevant field.

### `/plans` — Receptionist view
- Same layout, **read-only**.
- "Add plan" button hidden.
- Card menu hidden.
- Cards not clickable for edit.
- Tabs still toggle Active/Inactive.

This is rare but useful: receptionist verifies pricing during a renewal call without bothering the owner.

---

### Add-ons UI

Could be a separate page `/add-ons`, but for v1 keep them on the same `/plans` page using a secondary tab strip:

```
[ Plans ]  [ Add-ons ]
```

This keeps catalogue management in one place and the sidebar shorter.

**Add-ons list:** simple shadcn DataTable.

| Column | Notes |
|---|---|
| Name | + small badge for type ("One-time" / "Recurring") |
| Amount | ₹ formatted, right-aligned |
| Auto-apply on first enrollment | Yes/No (badge) |
| Status | Active / Inactive |
| Actions | Edit, Deactivate/Activate |

Add-on form (Sheet):
1. Name (required).
2. Amount (₹) — money input.
3. Type — Toggle group: One-time / Recurring.
4. **Auto-apply on first enrollment** — Switch with explanation: "When ON, this add-on is pre-checked when enrolling a new member."
5. Description (optional).

---

## 2.6 Money Input Helper

Create `components/shared/money-input.tsx`:

```tsx
type Props = {
  value: number | undefined;     // paise
  onChange: (paise: number) => void;
  ...
};
```

Behaviour:
- Display value in rupees with up to 2 decimals.
- Parse on blur, not on every keystroke.
- Show ₹ prefix.
- Reject negative values.
- On invalid input, snap back to last valid.

This component will be reused in Modules 04 (enrollment), 07 (reports filters).

---

## 2.7 Acceptance Criteria

- [ ] Schemas migrated; RLS verified — Tenant B owner cannot read Tenant A's plans (via `scripts/test-rls.ts`).
- [ ] Owner creates 5 plans, 3 add-ons. All visible in their respective lists.
- [ ] Duplicate plan name (case-insensitive) rejected with inline error.
- [ ] Editing a plan changes its display in the list immediately (optimistic OR revalidatePath, both fine).
- [ ] Deactivating a plan moves it to "Inactive" tab; reactivating restores it.
- [ ] Receptionist user can view plans but not edit; "Add plan" button absent.
- [ ] Each create / update / deactivate writes an `audit_logs` row with proper `before/after`.
- [ ] Empty state appears on a fresh tenant with no plans.
- [ ] Mobile view: plan cards stack to 1 column, sheet form fills viewport, money input usable on mobile keyboard (`inputMode="decimal"`).
- [ ] Adding an add-on with `auto_apply_on_first_enrollment = true` is reflected; this flag is consumed by Module 04.

---

## 2.8 Files Created in This Module

```
lib/db/schema/plans.ts
lib/db/schema/add-ons.ts
lib/db/migrations/0001_plans_addons.sql

server/queries/plans/list-plans.ts
server/queries/plans/get-plan.ts
server/queries/add-ons/list-add-ons.ts
server/queries/add-ons/get-add-on.ts

server/actions/plans/create-plan.ts
server/actions/plans/update-plan.ts
server/actions/plans/toggle-plan-active.ts
server/actions/add-ons/create-add-on.ts
server/actions/add-ons/update-add-on.ts
server/actions/add-ons/toggle-add-on-active.ts

app/(app)/plans/page.tsx
app/(app)/plans/_components/plans-list.tsx
app/(app)/plans/_components/plan-card.tsx
app/(app)/plans/_components/plan-form-sheet.tsx
app/(app)/plans/_components/add-ons-table.tsx
app/(app)/plans/_components/add-on-form-sheet.tsx

components/shared/money-input.tsx
components/shared/empty-state.tsx                  (reusable, will be used in many modules)
```

---

## 2.9 Common Pitfalls

1. **Don't store rupees as floats.** Always paise. The `MoneyInput` is the only place rupees → paise conversion happens, and it does so on blur, not on every keystroke.
2. **Duplicate name check is case-insensitive.** Use the unique partial index with `lower(name)`. Validate at server too (race condition: two tabs).
3. **Don't hard-delete plans.** A plan referenced by a past membership must remain queryable. `is_active = false` hides from new enrollments.
4. **Duration in days, not months.** A "3 month plan" is 90 days for billing. A member enrolled on Feb 1 with a 3-month plan ends on May 2 (= +90 days), not May 1. Decide once: we use **calendar days, fixed**, not "same day next month". This is simpler and avoids edge cases like Feb 30. Document in plan card if needed.
5. **`auto_apply_on_first_enrollment`** is consumed in Module 04. Don't gold-plate in Module 02 — just persist the flag.
6. **Audit logs:** capture the full row before/after, but strip `created_at`/`updated_at` from the diff (noise).

---

## 2.10 What's Next

Module 03 — Member management. The most-used screen in the app. Heavy focus on speed, search, and CSV import.
