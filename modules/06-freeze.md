# Module 06 — Membership Freeze

> Pause memberships for genuine reasons (vacation, illness, injury) without losing days. A small feature with outsized customer-satisfaction impact, and one of the most common dispute triggers in gyms — so the audit trail must be airtight.

**Estimated time:** 1 day.
**Outcome:** Owner / Branch Manager can freeze an active membership with start/end dates and reason. The end date auto-extends correctly. Members on freeze are blocked from showing as "active" on Today's View. Unfreeze (early or scheduled) is supported. Limits enforced.

---

## 6.1 Scope

In:
- `freezes` schema with RLS, audit, soft-delete.
- Freeze action on Current Membership card (Owner / Branch Manager only).
- Unfreeze action — both natural (effective on `freeze_end_date`, computed-on-read) and manual early.
- Freeze validation: integrity rules only (no overlap, dates within membership, reason required). No system-enforced policy limits — gym decides.
- Auto-extension of `memberships.end_date` by exact days frozen.
- Frozen memberships blocked from renewal until unfrozen.
- Frozen status reflected everywhere member status is shown (list, detail, dashboard).
- Freeze history visible on member detail.
- Audit log entries for freeze and early unfreeze (natural completion is not a user action — no audit entry).

Out:
- Freeze for cancelled/expired memberships (only active can be frozen).
- Freezing during another freeze (overlapping freezes blocked).
- Freeze refund (if member wants money back instead of pause, use refund + cancel flow).
- Member-initiated freeze requests (no member-facing UI in v1).
- Per-gym configurable freeze limits (constants for v1; settings page in future).
- Bulk freeze (rare; defer).

---

## 6.2 Data Model

### `freezes` table

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| gym_id | uuid not null | FK → gyms (denormalized for RLS) |
| branch_id | uuid not null | FK → branches (denormalized for RLS) |
| membership_id | uuid not null | FK → memberships |
| member_id | uuid not null | FK → members (denormalized for fast queries) |
| freeze_start_date | date not null | inclusive |
| freeze_end_date | date not null | inclusive; planned end date |
| actual_end_date | date | nullable; set when actually unfrozen (may differ from freeze_end_date if early unfreeze) |
| days_added | integer not null | how many days the membership.end_date was extended by |
| reason | text not null | required, min 10 chars |
| status | text not null | `scheduled` \| `active` \| `completed` \| `cancelled_early` |
| created_by_user_id | uuid not null | FK → users; who initiated the freeze |
| ended_by_user_id | uuid | FK → users; who triggered the early unfreeze (null if scheduled completion) |
| early_unfreeze_reason | text | nullable; required when ending early |
| created_at | timestamptz not null default now() | |
| updated_at | timestamptz not null default now() | |
| deleted_at | timestamptz | soft delete (rare — uses cancel-early flow instead) |

**Indexes:**
- `(gym_id, membership_id)` — find all freezes for a membership.
- `(gym_id, status)` — list scheduled/active freezes for dashboard queries.
- `(member_id, freeze_start_date desc)` — freeze history on member detail.
- `(gym_id, freeze_end_date) where status in ('active', 'scheduled')` — partial index for "ending soon" queries.

**Constraints:**
- `freeze_end_date >= freeze_start_date`
- `days_added >= 1` (no zero-day freezes)
- `status in ('scheduled','active','completed','cancelled_early')`
- `(actual_end_date is null) OR (actual_end_date >= freeze_start_date)`
- `(status = 'cancelled_early') = (ended_by_user_id is not null AND early_unfreeze_reason is not null)`

**RLS:** standard tenant isolation + branch scoping (same template as memberships).

---

## 6.3 Status Lifecycle

A freeze moves through states:

```
[scheduled] → [active] → [completed]
     │            │
     └────────────┴───→ [cancelled_early]
```

- **`scheduled`**: freeze record exists, but `freeze_start_date > today`. Future freeze.
- **`active`**: `freeze_start_date <= today <= freeze_end_date`. Currently freezing.
- **`completed`**: `freeze_end_date < today` AND not cancelled. Finished naturally.
- **`cancelled_early`**: ended manually before `freeze_end_date`.

### Computed-on-read (no cron)

We use the same **computed-on-read** philosophy as memberships (Module 04). The freeze's `status` column stores ONLY the *terminal* state for explicit user actions:
- Default: `'scheduled'` or `'active'` at insert time (depending on whether start_date is today or future).
- `'cancelled_early'` is the only status the system actively writes (as a user action, in the unfreeze service).
- `'completed'` is **never written by the system**. It's derived from dates via the view.

```sql
create view freezes_with_status as
select
  *,
  case
    when status = 'cancelled_early' then 'cancelled_early'
    when freeze_start_date > current_date then 'scheduled'
    when freeze_end_date < current_date then 'completed'
    else 'active'
  end as effective_status,
  -- For cancelled_early, actual_end_date is set explicitly.
  -- For natural completion, we just use freeze_end_date.
  coalesce(actual_end_date, freeze_end_date) as effective_end_date
from freezes
where deleted_at is null;
```

All read queries use this view. Writes go to the base `freezes` table.

### Why no cron

- The view derives effective status correctly at read-time. No UPDATE needed for natural completion.
- Natural completion isn't a user action — no audit entry needed (the `freeze.create` entry already documents the intent).
- One fewer moving part. No Vercel Cron config, no `CRON_SECRET`, no scheduled function to debug.
- Same pattern as `memberships_with_status` in Module 04.

---

## 6.4 Validation Rules

These are enforced **server-side** in the freeze service. Client validates same rules for instant feedback.

These are **integrity rules**, not policy limits. The gym sets its own freeze policies (max days, max times) by manual decision — the software just makes their decisions easy to track and audit.

### Date integrity
- `freeze_start_date >= today` (no backdated freezes — protects audit narrative).
- `freeze_end_date >= freeze_start_date` (basic sanity).
- `freeze_start_date < membership.end_date` (cannot freeze a membership that's already over).
- `freeze_end_date <= membership.end_date` (defensive; the freeze itself shouldn't extend past the existing end date — though end_date will be extended *because* of this freeze, the freeze planning happens against the current end).

### State preconditions
- Membership must have `effective_status = 'active'` to be freezable.
  - Frozen → cannot freeze again until current freeze ends.
  - Expired → no point freezing; renew first.
  - Cancelled → blocked.

### No overlapping freezes
- For the same membership, no other `scheduled` or `active` freeze can overlap with the proposed `[freeze_start_date, freeze_end_date]` range. This prevents data corruption (membership end_date being extended twice for the same days).

### Reason field
- Required, min 10 chars, max 500 chars.

### What we do NOT enforce (intentionally)
- ❌ Maximum days per freeze. Owner decides — could be 7 days, could be 90 days.
- ❌ Maximum freezes per membership cycle. Owner decides — could be 1, could be 5.
- ❌ Cooldown between freezes. Not enforced.

The audit log + freeze history card give the owner full visibility (e.g., "this member has been frozen 4 times in 6 months — that's a pattern"). Software's job is to surface, not to police. Different gyms have different policies; hardcoding ours forces them to fit our model.

---

## 6.5 The Math (auto-extension)

When freeze starts:
- `days_added = (freeze_end_date - freeze_start_date) + 1` (inclusive)
- `memberships.end_date = memberships.end_date + days_added` (in days, not months)
- `memberships.original_end_date` is **NOT modified** — preserves what end_date was before any freezes (already specced in Module 04).

When unfrozen early:
- `actual_days_used = (unfreeze_date - freeze_start_date) + 1`
- `days_to_subtract = days_added - actual_days_used`
- `memberships.end_date = memberships.end_date - days_to_subtract`
- `freezes.actual_end_date = unfreeze_date - 1` (yesterday, since unfreezing today means the freeze ended yesterday and member returns today)
- `freezes.days_added` is **NOT modified** in the freezes row — keeps the originally-extended count for audit. Only the membership.end_date adjusts.

Wait — that's confusing for audit purposes. Let me clarify:

**`freezes.days_added` represents days that were ACTUALLY ADDED to the membership.** If someone froze for 30 days and unfroze early at day 10, only 10 days were "used" against the membership extension. So `days_added` should reflect 10, not 30.

Revised:
- On freeze creation: `days_added = (freeze_end_date - freeze_start_date) + 1`. Membership extended by `days_added`.
- On early unfreeze: subtract unused days from membership AND from `freezes.days_added`.

This way, `SUM(freezes.days_added)` for a membership always equals the total days actually extended. Audits stay clean.

---

## 6.6 Server Layer

### Service — `server/services/freeze.ts`

```ts
type FreezeInput = {
  membership_id: string;
  freeze_start_date: string;        // YYYY-MM-DD
  freeze_end_date: string;          // YYYY-MM-DD
  reason: string;
};

async function createFreeze(input: FreezeInput, user: User): Promise<
  | { ok: true; freeze_id: string; new_membership_end_date: string }
  | { ok: false; code: string; message: string }
>;
```

Algorithm:
```
BEGIN TRANSACTION
  1. Role check: user.role in ('owner','branch_manager').
  2. Fetch membership FOR UPDATE (lock). Verify exists, not deleted.
  3. Verify membership.effective_status = 'active' (compute from dates if needed).
       Block if frozen, expired, cancelled.
  4. Validate dates:
     - start_date >= today.
     - start_date < membership.end_date.
     - end_date >= start_date.
     - end_date <= membership.end_date.
  5. Validate reason: trim, length 10-500.
  6. Check overlap: no other scheduled/active freeze for this membership
     spans any of [start_date, end_date].
       If overlap, return FREEZE_OVERLAP.
  7. Compute days_added = (end_date - start_date) + 1.
  8. Determine initial freeze status:
     - If start_date == today: 'active'.
     - If start_date > today: 'scheduled'.
  9. INSERT freeze row.
  10. UPDATE memberships:
        SET end_date = end_date + (days_added * INTERVAL '1 day'),
            updated_at = now()
        WHERE id = membership_id.
  11. recordAudit('freeze.create', { reason, days_added, freeze_id }).
COMMIT
```

### Service — early unfreeze

```ts
async function unfreezeEarly(input: {
  freeze_id: string;
  unfreeze_date: string;             // YYYY-MM-DD; defaults today
  early_unfreeze_reason: string;     // required, min 10 chars
}, user: User): Promise<
  | { ok: true; membership_id: string; new_membership_end_date: string }
  | { ok: false; code: string; message: string }
>;
```

Algorithm:
```
BEGIN TRANSACTION
  1. Role check: user.role in ('owner','branch_manager').
  2. Fetch freeze FOR UPDATE.
  3. Verify freeze.effective_status in ('scheduled', 'active').
       Cannot unfreeze a completed or already-cancelled freeze.
  4. Validate unfreeze_date:
     - >= today (cannot unfreeze in the past).
     - >= freeze.freeze_start_date (cannot unfreeze before the freeze even started).
     - <= freeze.freeze_end_date (use 'completed' if at or past end).
  5. Validate early_unfreeze_reason: trim, length 10-500.
  6. Compute:
     actual_end_date = unfreeze_date - 1 day (freeze ended yesterday)
     actual_days_used = (actual_end_date - freeze_start_date) + 1
     days_to_subtract = freeze.days_added - actual_days_used
  7. UPDATE freeze:
        status = 'cancelled_early',
        actual_end_date = ...,
        days_added = actual_days_used,         (revised count)
        ended_by_user_id = user.id,
        early_unfreeze_reason = input.reason.
  8. UPDATE memberships:
        end_date = end_date - (days_to_subtract * INTERVAL '1 day').
  9. recordAudit('freeze.cancel_early', { reason, days_subtracted, days_actually_used }).
COMMIT
```

### Queries

`server/queries/freezes/`:
- `getFreezesByMembership(membership_id)` — used on member detail's freeze history.
- `getCurrentFreeze(membership_id)` — single freeze that is `active` or upcoming `scheduled`. Used by Current Membership card.
- `listActiveFreezesByGym(gym_id, branch_id?)` — used in Today's View Frozen card and dashboard count.

### Actions

`server/actions/freezes/`:
- `createFreezeAction(input)` — wraps `freeze.ts`.
- `unfreezeEarlyAction(input)` — wraps the unfreeze service.

Both gated with `requireRole('owner', 'branch_manager')`.

---

## 6.7 UI

### Where the Freeze button lives

On the Current Membership card on member detail (already specced in Module 04 amendment A3 to have action buttons). Add `[Freeze]` button when:
- Membership effective_status = 'active'.
- User role is owner or branch_manager.

```tsx
{canFreeze && (
  <Button variant="outline" size="sm" onClick={() => setFreezeOpen(true)}>
    <Snowflake className="mr-2 size-4" />
    Freeze
  </Button>
)}
```

### Freeze sheet

`<FreezeSheet />` — a shadcn Sheet, width `sm:max-w-md`.

Layout:
```
┌─────────────────────────────────────────────────┐
│ Freeze membership                            [X]│
│ Pause days will extend the end date.            │
│                                                 │
│ Vibhu Dawar · Half Yearly                       │
│ Currently ends: 27 Oct 2026                     │
│ Past freezes on this membership: 2              │
│ ─────────────────────────────────────────────   │
│                                                 │
│ Start date *                                    │
│ [   02/05/2026   📅]                           │
│                                                 │
│ End date *                                      │
│ [   16/05/2026   📅]                           │
│                                                 │
│ Duration: 14 days                               │
│                                                 │
│ Reason *                                        │
│ [textarea, 3 rows, min 10 chars              ]  │
│                                                 │
│ ────────────────────                            │
│                                                 │
│ ℹ Membership will resume 17 May 2026.           │
│   New end date: 10 Nov 2026.                    │
│                                                 │
│             [Cancel]      [Freeze membership]   │
└─────────────────────────────────────────────────┘
```

Live computation:
- "Duration: X days" updates as dates change.
- The bottom `ℹ` info box shows the resume date (= end + 1) and the projected new membership end date. Helps the receptionist see consequences before confirming.
- Validation errors appear inline; submit disabled while invalid.
- "Past freezes on this membership: N" is **informational only** — visible to give the owner pattern visibility ("this is the 5th freeze on this membership" tells them something), but does NOT block submission.

Confirm dialog:
> "Freeze Vibhu Dawar's Half Yearly membership for 14 days? End date will move from 27 Oct 2026 to 10 Nov 2026."

After success:
- Toast: "Membership frozen. Resumes 17 May 2026."
- Sheet closes.
- Member detail refreshes — Current Membership card shows frozen state.

### Frozen membership card state

When membership is frozen, the Current Membership card looks like:

```
┌─────────────────────────────────────────────────┐
│ Current membership                  ● Frozen    │
│                                                 │
│ Half Yearly                                     │
│ Frozen 02 May → 16 May (14 days)                │
│ Resumes 17 May 2026 · End date: 10 Nov 2026     │
│                                                 │
│ Reason: Vacation in Bali                        │
│                                                 │
│ [Unfreeze now]                       [⋯ menu]   │
└─────────────────────────────────────────────────┘
```

The `[Unfreeze now]` button:
- Visible to owner + branch_manager only.
- Click → opens `<UnfreezeSheet />`.

The `⋯` menu:
- "View freeze history" — scrolls to/expands the freeze history card below.
- (No other items in v1.)

### Unfreeze sheet

```
┌─────────────────────────────────────────────────┐
│ Unfreeze membership                          [X]│
│                                                 │
│ Vibhu Dawar · Half Yearly                       │
│ Frozen since: 02 May 2026                       │
│ Scheduled to resume: 17 May 2026                │
│                                                 │
│ Unfreeze date *                                 │
│ [   05/05/2026   📅]                           │
│                                                 │
│ Days used so far: 3 · Days saved: 11            │
│                                                 │
│ Reason for early unfreeze *                     │
│ [textarea, 3 rows, min 10 chars              ]  │
│                                                 │
│ ────────────────────                            │
│                                                 │
│ ℹ Membership will resume immediately.            │
│   New end date: 30 Oct 2026 (was 10 Nov).       │
│                                                 │
│            [Cancel]      [Unfreeze now]         │
└─────────────────────────────────────────────────┘
```

The "Days saved" / "New end date" preview is critical — gives the user a clear picture before they commit.

After success:
- Toast: "Membership unfrozen. Active until 30 Oct 2026."
- Card transitions back to active state.

### Freeze history card on member detail

Below the Current Membership card and above the Recent payments card, add a "Freeze history" card. Visible only if there's at least one freeze record for the current membership.

```
┌─────────────────────────────────────────────────┐
│ Freeze history                                  │
├─────────────────────────────────────────────────┤
│ ● Active        02 May → 16 May      14 days    │
│   "Vacation in Bali"                            │
│   Frozen by Vibhu D · 01 May, 2:30 PM           │
├─────────────────────────────────────────────────┤
│ ● Completed     12 Jan → 22 Jan      11 days    │
│   "Sick leave"                                  │
│   Frozen by Vibhu D · 11 Jan, 9:00 AM           │
├─────────────────────────────────────────────────┤
│ ● Cancelled early  03 Mar → 10 Mar  5 days used │
│   Originally 8 days · "Joined back early"       │
└─────────────────────────────────────────────────┘
```

- Status dot color: amber (active/scheduled), gray (completed), gray-strikethrough text (cancelled_early — but show it as a record, don't hide it).
- For cancelled_early, show "X days used" and "Originally Y days" so the audit trail is visible.

### Members list — frozen status

Module 03 amendment A2 already specced the dot indicator. Verify the "Frozen" status renders correctly:

```
● Frozen · Half Yearly
Resumes 17 May 2026
```

(Amber dot.)

### Today's View — frozen card

Already specced in Module 05 amendment v2. The "Frozen now" metric card now has a real source of data. Verify:
- Count = number of freezes with `effective_status in ('active','scheduled')` for today.
- Sub-line "X resuming this week" = freezes where `freeze_end_date` is in the next 7 days.

### Renewal block

The Current Membership card's `[Renew]` button is **disabled** when the membership is frozen, with tooltip:

> "Cannot renew while frozen. Unfreeze first or wait for scheduled resume."

This prevents weird timing bugs where renewing during a freeze creates inconsistent state.

---

## 6.8 Audit Log Entries

Two audit actions for this module (natural completion is not a user action — no audit entry):

1. **`freeze.create`**:
   - `before`: null (creation)
   - `after`: full freeze row
   - `meta`: { membership_id, days_added, new_membership_end_date }

2. **`freeze.cancel_early`**:
   - `before`: freeze row before update
   - `after`: freeze row after update
   - `meta`: { early_unfreeze_reason, days_subtracted, new_membership_end_date }

Natural completion has no audit entry. The `freeze.create` entry already captures intent (`freeze_end_date`); reading the freeze later via the view shows it as `'completed'` based on the date. No user action occurred — no audit needed.

The membership's `end_date` change is part of the freeze audit, not a separate `membership.update` audit (avoid duplication).

---

## 6.9 Edge Cases

### What if member's phone shows up in freeze period
Not a feature in v1 (no biometric). Deferred until v2 attendance/biometric integration. For now, the system trusts that a frozen member doesn't show up.

### Freeze that overlaps with cancellation
If the membership is cancelled while a freeze is active:
- The cancel flow sets `membership.status = 'cancelled'`, `end_date = effective_date`.
- The active freeze's `status` should auto-update to `cancelled_early` with `actual_end_date = cancellation date - 1`.
- Build this into the cancel service: before flipping membership to cancelled, if there's an active freeze, end it first.

### Freeze on a corrected membership
If the membership is later corrected (Module 04 amendment A4), the correction does NOT change the freeze records. Freezes stay attached to the membership_id; they survive corrections.

If correction changes the plan duration significantly (e.g., 6-month plan → 3-month plan), the membership's end_date is recomputed. The freezes' `days_added` already applied to the OLD end_date. The correction logic must:
1. Reset end_date to: `start_date + new_plan.duration_days`.
2. Re-apply each freeze's `days_added` to extend.

I'll spec this concern as a pitfall (§ 6.11 #7) so Claude Code doesn't miss it.

### Two scheduled freezes back-to-back
Allowed if they don't overlap and total ≤ 2. E.g., freeze 1 from May 1–10, freeze 2 from June 1–10. Both at scheduled state. The validation step "no overlap" catches the bad case.

### Backdated freeze
**Disallowed.** Freezes cannot start before today. If a member calls saying "I was sick last week," the right answer is: don't freeze backdated; offer goodwill (refund a few days, or apply a token discount on next renewal). Backdated freezes invite abuse and break the audit narrative.

### Member doesn't return after scheduled unfreeze
Not a freeze problem — the membership simply continues until end_date and then expires naturally. The owner sees "Member hasn't shown up in 2 weeks" via attendance reports (post-v1). Don't auto-cancel in v1.

---

## 6.10 Acceptance Criteria

### Schema & RLS
- [ ] `freezes` table created. `freezes_with_status` view created.
- [ ] Indexes in place.
- [ ] RLS policies tested: cross-tenant access blocked. Branch scoping respected.
- [ ] No cron / scheduled function setup needed.

### Freeze creation
- [ ] Owner can freeze an active membership with valid dates + reason.
- [ ] Branch Manager can freeze (their branch only).
- [ ] Receptionist cannot freeze (button hidden).
- [ ] Frozen status reflects correctly on Current Membership card immediately.
- [ ] `memberships.end_date` extended by exactly `days_added`.
- [ ] Audit log entry created.
- [ ] Validation: dates in past → blocked.
- [ ] Validation: end < start → blocked.
- [ ] Validation: reason < 10 chars → blocked.
- [ ] Validation: overlapping freeze on same membership → blocked.
- [ ] Validation: freeze on expired/cancelled/already-frozen membership → blocked.
- [ ] Long freezes (e.g., 60 days, 90 days) succeed without limit blocks.
- [ ] Multiple freezes (e.g., 3rd, 4th, 5th) succeed without count blocks.
- [ ] "Past freezes on this membership: N" appears in the sheet as informational text.

### Unfreeze early
- [ ] "Unfreeze now" button visible only when freeze is active or scheduled.
- [ ] Sheet shows preview: days saved, new end date.
- [ ] Reason required.
- [ ] On submit, membership end_date subtracts unused days.
- [ ] freeze.actual_end_date and status updated.
- [ ] freeze.days_added updated to actual days used.
- [ ] Audit log entry created.

### Natural completion (computed, no cron)
- [ ] A freeze with `freeze_end_date < today` reads as `effective_status = 'completed'` via the view, even though the base table still has `status = 'active'`.
- [ ] Members list and Today's View show such memberships as active (not frozen) immediately on the day after `freeze_end_date`.

### Members list / Today's View integration
- [ ] Members list shows "Frozen" status with correct sub-line ("Resumes X").
- [ ] Today's View "Frozen now" card shows correct count.
- [ ] Today's View "Frozen now" sub-line shows resuming-in-7-days when applicable.

### Freeze history card
- [ ] Visible on member detail only when freezes exist.
- [ ] Shows all freezes (including cancelled_early), sorted newest first.
- [ ] Each row shows status, dates, reason, who initiated.
- [ ] Cancelled-early freezes show "X days used / Originally Y days".

### Renewal block
- [ ] Renew button disabled (with tooltip) when membership is frozen.
- [ ] Unfreeze (early or scheduled) re-enables Renew button as usual.

### Cross-flow
- [ ] Cancelling a frozen membership ends the freeze first (status='cancelled_early', auto-reason "Membership cancelled").
- [ ] Correcting a membership with active freezes preserves the freezes' day extensions.

### General
- [ ] Lighthouse perf ≥ 90 on member detail with 5+ freezes in history.
- [ ] Mobile: freeze sheet and unfreeze sheet usable.
- [ ] No `any`, no console.logs, no TODOs.

---

## 6.11 Common Pitfalls

1. **`days_added` semantics.** Read § 6.5 again. `days_added` is "days actually added to the membership." On early unfreeze, it gets revised down. Don't store the planned days separately — the `freeze_end_date` field already records intent; the `days_added` records reality.

2. **`actual_end_date = unfreeze_date - 1`.** Off-by-one is the easiest bug here. If member unfreezes on May 5 (returns today), the freeze ended May 4 (yesterday). Day 5 itself is "back to active" day. Test with single-day examples.

3. **Don't use `pg_cron`-style timestamps.** Stick to `current_date` (DATE type) for all freeze date math. Mixing DATE and TIMESTAMP introduces TZ confusion. The freeze service receives dates as `YYYY-MM-DD` strings, parses them as DATE.

4. **`memberships.original_end_date` is sacred — don't touch it.** It's the pre-freeze end date. Used in cancellation proration and possibly in future reports. Module 04 already established this. Freezes only modify `end_date`.

5. **Branch Manager freezing across branches.** A Branch Manager can only freeze memberships at their branch. RLS handles SELECT. The service must also verify `branch_id == user.branch_id` on INSERT (defense in depth).

6. **Correction recalculation with active freezes.** If `correctMembership` (Module 04 A4) changes the plan, the membership's end_date is recomputed. The freezes' `days_added` were already added to the OLD end_date. To preserve correctness:
   ```
   new_end_date = start_date + new_plan.duration_days + SUM(freezes.days_added)
   ```
   Build this into the correction service. Test with: enroll → freeze 14 days → correct plan → verify end_date reflects new plan duration + freeze extension.

7. **Frozen members in Today's View "Expiring soon."** A frozen membership with end_date in 5 days is NOT expiring (it's frozen). The Today's View query must exclude frozen memberships from "expiring" lists. Verify this.

8. **No limits, but the audit log must be readable.** Without freeze count limits, the freeze history card on member detail is the owner's only visibility into pattern abuse ("this member has been frozen 6 times"). Make sure the freeze history card renders ALL freezes (including completed and cancelled_early), sorted newest first. Don't truncate to "last 5" — show everything.

9. **No system-attribution edge case.** Since we don't write `'completed'` from a cron, every audit log entry has a real `user_id`. The Audit Log viewer (Module 08) doesn't need a "System" attribution case. One less special path to handle.

10. **Status column values vs effective_status values.** The base table's `status` column will only ever hold: `'scheduled'`, `'active'`, `'cancelled_early'`. Never `'completed'`. The view's `effective_status` is what UI reads. Don't get confused between the two when writing queries — use the view for display, the table for INSERTs/UPDATEs.

---

## 6.12 Files Created in This Module

```
lib/db/schema/freezes.ts                                 (NEW)
lib/db/migrations/0006_freezes.sql                       (NEW; includes view + indexes)

server/queries/freezes/get-freezes-by-membership.ts
server/queries/freezes/get-current-freeze.ts
server/queries/freezes/list-active-freezes-by-gym.ts

server/actions/freezes/create-freeze.ts
server/actions/freezes/unfreeze-early.ts

server/services/freeze.ts                                (createFreeze)
server/services/unfreeze.ts                              (unfreezeEarly)
server/services/cancel-membership.ts                     (MODIFIED — handle active freeze)
server/services/correct-membership.ts                    (MODIFIED — preserve days_added)

app/(app)/members/[id]/_components/freeze-sheet.tsx
app/(app)/members/[id]/_components/unfreeze-sheet.tsx
app/(app)/members/[id]/_components/freeze-history-card.tsx
app/(app)/members/[id]/_components/current-membership-card.tsx  (MODIFIED — Freeze button + frozen state)

server/queries/today/get-today-snapshot.ts               (MODIFIED — frozen card uses real data)
server/queries/members/list-members.ts                   (verify frozen status renders)

scripts/test-rls.ts                                      (extend with freeze tests)
```

No cron config, no `vercel.json` changes, no constants file. The module ships with zero new infrastructure dependencies.

---

## 6.13 What's Next

Module 07 — Reports & Exports. The "show me the money" view that gym owners care about most. Filterable revenue, plan-wise sales, discount leakage, branch comparisons, Excel exports. After Module 07, you have the full operator-facing product.

**Reminder: demo to a real gym owner before Module 07.** Module 06 completes the day-to-day operational loop. Module 07 builds analytical depth on top. The right place to validate direction is right here, not after sinking another 3 days into reports.
