# Manual QA Checklist — Modules 01–04 + Amendment

> Click through each flow below with realistic data. Mark ✅ or ❌. Anything ❌ → flag and fix before Module 05.

---

## Auth & Multi-Tenancy

- Owner A logs in, lands on home (or current placeholder) ✅
- Owner A logs out, returns to login screen ✅
- Wrong password → error message inline (not toast) ✅
- Forgot password → email arrives → reset link works → can log in with new password ❌
- Owner A's session persists on page refresh ✅
- Direct URL access without session redirects to login (try `/members` in incognito) ✅
- Owner A only sees Owner A's gym name in sidebar ✅
- Owner B (different tenant) only sees Owner B's gym name ✅
- **RLS script passes all checks** (run the extended script) ✅

---

## Roles & Permissions

- Receptionist user can be created via `scripts/create-tenant.ts` (or however you onboard staff) ✅
- Receptionist logs in successfully ✅
- Receptionist sidebar: NO "Reports", NO "Audit log" ✅
- Receptionist visiting `/reports` directly → redirected away ✅
- Receptionist visiting `/audit-log` directly → redirected away ✅
- Branch Manager logs in, sees only their assigned branch in branch selector ✅
- Owner sees all branches in branch selector (if multi-branch tenant; single-branch can skip) ✅

---

## Plans

- Owner creates a plan: "1 Month General — ₹2,000" ✅
- Owner creates a plan: "3 Months Gym + Cardio — ₹5,000" ✅
- Owner creates a plan: "Half Yearly — ₹10,000" ✅
- Plan card displays correctly (name, duration, price, type) ✅
- Edit plan: change price → saved, list updates ✅
- Edit plan: change name to a duplicate (case-insensitive) → blocked with inline error ✅ [reasoning, should also be given]
- Deactivate plan → moves to "Inactive" tab ✅
- Reactivate plan → returns to "Active" tab ✅
- Description field renders on card (optional) ✅
- **Receptionist** sees plans page but: no "Add plan" button, no Edit, no menu ✅
- Empty state shows when no plans exist (test on a fresh tenant) ✅
- Mobile (375px): cards stack to 1 column, sheet form usable ✅

---

## Add-ons

- Owner creates "Registration Fee — ₹500 — One-time — auto-apply ✓" ✅
- Owner creates "Locker — ₹300 — Recurring — auto-apply ✗" ✅
- Add-on with auto-apply ON shows the toggle reflected in list ✅
- Edit add-on: change amount → saved ✅
- Deactivate add-on → moves to inactive ✅
- Receptionist cannot add/edit add-ons ✅

---

## Members — Add Member (without enrollment)

- Toggle "Enroll now" OFF in Add Member sheet  ✅
- Add member with only required fields (name + phone) → success ✅
- Phone normalization: enter `9876543210` → saves as `+919876543210` ✅
- Phone normalization: enter `+91 98765 43210` → saves correctly ✅
- Phone normalization: enter `1234` (invalid) → inline error ✅
- Add member with all optional fields filled ✅
- Add member with emergency contact section expanded ✅
- Add member with address & notes section expanded ✅
- **Duplicate phone detection**: try to add a member with phone of existing member → inline alert with link to existing member, Add button disabled ✅
- Click "View member" link in duplicate alert → navigates to existing member, sheet closes ✅
- **"Add another"** checkbox: enable, submit, sheet stays open with form reset, cursor in Name field ✅
- DOB picker works ✅
- Joined date defaults to today, changeable ✅
- Branch defaulted correctly for receptionist (their assigned branch); selectable for owner ✅

---

## Members — Add Member (with enrollment via toggle)

- Toggle "Enroll now" ON (??)
- Plan combobox is searchable, selecting a plan auto-fills price ✅
- Add-ons checklist appears; auto-apply add-ons pre-checked for first enrollment ✅
- Pricing summary updates as add-ons are checked/unchecked ✅
- Discount input → reduces total in summary ✅
- Discount > 0 with empty reason → submit blocked ✅
- Discount > 0 with reason → succeeds, both member and membership created ✅
- Submit creates both member + membership + payment in one shot ✅
- Success toast shows invoice number ✅
- If enrollment fails (e.g., tamper with amount via DevTools) → no member created (transaction rolled back) ✅
- Member detail page shows correct membership and payment ✅

---

## Members — List View

- List loads with default filters ✅
- Search by name (partial, fuzzy via trigram) finds member ✅
- Search by partial phone (last 4 digits) finds member ✅
- Search by full phone finds member ✅
- Branch filter works (Owner with multi-branch only) ✅
- Status quick-pills: All / Active / Expiring soon / Expired / No membership — filter correctly ✅
- Status pills show correct counts ✅
- **Membership column renders correctly** for: no membership (—), active, expiring soon, expired, frozen, cancelled ✅
- Days-to-expiry shows correctly ("Ends in 6 days", "Expired 12 days ago") ✅
- Sort by name (A→Z, Z→A) ❌
- Sort by joined date ❌
- Sort by membership status (urgency order) ❌
- Pagination: "Load more" or page numbers — verify next/previous works ✅
- Density toggle: switches between Comfortable and Dense, persists on refresh ✅
- Click row → opens member detail ✅
- Empty state when zero members in tenant ✅
- Empty search state ("No members match your search") ✅

---

## Members — Detail Page

- Profile card shows all fields populated correctly ✅
- Empty optional fields show "—" ✅
- Activity card shows recent audit log entries (last 5) ✅
- Edit button opens Edit sheet ✅
- Edit member: change name → saved ✅
- Edit member: change phone to existing duplicate → blocked ✅
- Edit member: changes appear in audit log on activity card ✅
- Soft delete member → confirmation dialog → member moves to Deleted tab ✅
- Undo (within 5s of toast) → member restored ✅
- Restore from Deleted tab → returns to Active list ✅
- Receptionist: no Delete option in menu ✅
- **Soft-delete blocked** if member has active membership → error message ✅

---

## Members — CSV Import

- Download template CSV ✅
- Upload valid CSV (10–20 rows) → preview shows all valid ✅
- Upload CSV with mix of valid + invalid → preview status colors correct ✅
- Upload CSV with internal duplicates (two rows same phone) → second flagged duplicate ✅
- Upload CSV with phones already in DB → flagged as duplicate ✅
- Filter preview by status (Valid / Errors / Duplicates) ✅
- Specific error messages per row (not generic) ✅
- Branch column: typo branch name → clear error with available branches listed ✅
- Confirm import → progress modal → completion toast with counts ✅
- All imported members appear in list ✅
- Audit log has entry per imported member ✅
- **1000-row import** completes in <30 sec ✅

---

## Members — Excel Export

- "Export" button downloads `.xlsx` ✅
- File opens in Excel/Google Sheets without errors ✅
- Filtered list exports the filtered set, not all members ✅
- Filename includes gym name + date ✅

---

## Cmd+K Global Search

- `Cmd+K` opens palette anywhere in app ✅
- `Esc` closes palette ✅
- Type partial name → results appear (debounced) ✅
- Type partial phone → results appear ✅
- Click result → navigates to member, closes palette ✅
- Press Enter on highlighted result → navigates ✅
- No results → "No members match" message ✅
- Cmd+K does NOT trigger when typing in an input/textarea ✅

---

## Enrollment (standalone, from member detail)

- Member with no membership → "Enroll in plan" CTA on Current Membership card ✅
- Click opens Enrollment sheet ✅
- Plan combobox works ✅
- Add-ons checklist works ✅
- Pricing summary correct ✅
- Discount + reason validation ✅
- Payment mode segmented buttons work (Cash/UPI/Card/Bank Transfer) ✅
- Submit → confirm dialog → success ✅
- Invoice number generated correctly (sequential per gym) ✅
- Member detail refreshes; Current Membership card shows new active membership ✅
- Recent payments card shows the new payment ✅
- Members list refreshes; status column updated ✅

---

## Renewal

- Active member with end_date > 14 days away → Renew button **disabled** with tooltip ✅
- Active member with end_date <= 14 days → Renew button **enabled** ✅
- Click Renew → sheet opens, plan pre-filled with previous, recurring add-ons pre-checked ❌
- Start date toggle: "From end of previous" / "From today" / "Custom" ❌ (UI messed up)
- For active member: default = "From end of previous" ✅
- For expired member: default = "From today" ✅
- Custom date picker only shows when Custom selected ✅
- **Pre-renewal blocked**: try to renew with start_date earlier than current end_date → blocked with clear message ✅
- Submit → invoice number generated, new membership created, old one preserved ✅
- Membership history card shows both memberships ✅
- If renewing an expired membership → status flips correctly to active ✅

---

## Refund (Owner only)

- Receptionist viewing payment: NO Refund option in menu ✅
- Owner viewing payment: Refund option visible ✅
- Refund sheet shows original payment summary ✅
- Refund amount pre-fills with remaining refundable ✅
- Try to refund more than original → blocked ✅
- Reason < 10 chars → blocked ✅
- Refund mode different from original (e.g., paid cash, refund UPI) → allowed
- Submit → confirm dialog → success ✅
- Refund row appears in payments list with negative amount in red ✅
- Refund has its own invoice number ✅
- Recent payments card on member detail shows updated "Net paid" ✅
- Cannot refund a refund (kind='refund' has no Refund option) ✅
- Multiple partial refunds against same payment → each succeeds, total clamped ✅

---

## Edit Payment (Owner only)

- Receptionist: no Edit option on payment ✅
- Owner: Edit option visible ✅
- Edit amount → membership's final_amount also updates (same transaction) ✅
- Edit reason required ✅
- Audit log shows before/after with reason ✅

---

## Correction (Module 04 Amendment A4)

- **Receptionist correction** (within 60 min, same user): "Fix entry" button visible ❌ (receptionist currently doesn't has any edit permissions)
- Receptionist correction blocked after 60 min (button disappears) ❌, same reason
- Receptionist correction blocked on a membership someone else enrolled (button disappears)  ❌, same reason
- **Branch Manager** correction same-day: button visible ✅
- Branch Manager correction next-day: button disappears ✅
- **Owner** correction within 90 days: button visible ✅
- Owner correction beyond 90 days: button disappears (or explains "use refund + re-enroll") ✅
- Correction sheet shows original (read-only) and corrected (editable) sections ✅
- Plan change in correction → recomputes end_date from new plan's duration ✅
- Plan change → linked payment amount updates atomically ✅
- Reason field required, min 10 chars ✅
- Original invoice_number preserved (no new invoice) ✅
- Correction marker "Corrected by X on Y" appears on Current Membership card ✅
- Click marker → popover shows original values, reason, who/when ✅
- Corrected payment shows "✏ Corrected" badge in payments list ✅
- Audit log entry has action='correction', level, reason, full before/after ❌, under Activity correct is not shown and under Audit log (yet to be implemented in future modules)
- correction_count increments on the membership and payment ❌ (not found on the UI, please check)

---

## Cancel Membership (Owner only, A5)

- Receptionist + Branch Manager: NO Cancel option in menu ✅
- Owner: Cancel option in `⋯` menu of active membership ✅
- Cancel dialog shows: plan, days remaining, total paid ✅
- Effective date defaults today, can backdate to start_date ✅
- Effective date cannot be in the future (beyond end_date) ✅
- Reason field required, min 10 chars ✅
- Refund toggle OFF: cancellation only, no refund row ✅
- Refund toggle ON: amount input + suggested proration shown ✅
- Use suggested chip auto-fills the prorated amount ✅
- Submit → membership status='cancelled', end_date = effective date ✅
- Card now shows "Cancelled on..." state with reason ✅
- If refund issued: linked refund payment row visible ✅
- Cancelled member can be re-enrolled in a new plan (no constraint blocking) ✅
- Cannot cancel an already-cancelled or expired membership ✅
- Members list shows cancelled status correctly ✅

---

## Audit Log (not implemented yet)

- Every member create/update/delete writes a row
- Every plan/add-on create/update/deactivate writes a row
- Every membership create writes a row
- Every payment create writes a row
- Refunds, edits, corrections, cancellations all logged
- CSV import writes one row per imported member
- Audit logs respect tenant isolation (Tenant A cannot see Tenant B's audit logs)

---

## Edge Cases & Money Math

- Money formatting: ₹4,500 (no decimals), ₹4,500.50 (decimals only if non-zero) ✅
- Indian numbering: ₹4,70,000 (lakhs), not ₹470,000 (US) ✅
- Negative amounts (refunds) shown with `-` prefix in red ✅
- Total revenue calculation = SUM(amount_paise across payments + refunds) — refunds correctly subtract  ❌ (we are not showing this yet)
- Plan price + add-ons − discount = final_amount (server recomputes) ✅
- Tampering with `final_amount_paise` via DevTools → server returns AMOUNT_MISMATCH ✅

---

## Mobile Responsiveness (spot-check)

- Login page on phone ✅
- Members list scrolls horizontally on phone ✅
- Add Member sheet usable on phone ✅
- Member detail page stacks vertically on phone ✅
- Sidebar collapses on small screens ✅

---

## Performance

- Lighthouse score ≥ 90 on `/login` ✅
- Lighthouse score ≥ 90 on `/members` with at least 100 members ✅
- Member list with 1000+ members loads in <2 seconds ✅

---

## Process

1. Spend 30–45 minutes clicking through.
2. Run the extended RLS script.
3. Send back the list of any ❌ items.
4. Fix or document gaps, then proceed to Module 05.



# Pre-Module-05 Patch Plan

> Fixes for QA findings from Modules 01–04 + Amendment. Apply this before starting Module 05. Estimated time: 0.5–1 day.

This is a **bug-fix and gap-closure patch**, not a new feature module. Each section is small, focused, and independently testable.

---

## P1. Members list — broken sorting

**Status:** Bug. Three sort options (name, joined date, status) don't work.

### What to fix

- `server/queries/members/list-members.ts` accepts `sortBy` and `sortDir` params per the original Module 03 spec, but they aren't being applied to the query.
- Verify the Drizzle query is using `orderBy()` with the column from `sortBy` and direction from `sortDir`.
- Confirm the UI (column headers in DataTable) is actually pushing `sortBy` and `sortDir` into the URL searchParams.

### Implementation

- Inspect `list-members.ts` — the function signature should accept `sortBy`, `sortDir`. Wire them into the orderBy clause.
- For sorting by membership status, use the same `case` expression specced in the amendment A2: 
  ```sql
  order by case effective_status  when 'expiring' then 1  when 'active' then 2  when 'expired' then 3  when 'frozen' then 4  when 'cancelled' then 5  when null then 6end asc

  ```
  (or descending equivalent).
- Members table column headers should be clickable, with arrow indicators showing sort direction.

### Acceptance

- [ ] Click "Name" header → list re-sorts A→Z. Click again → Z→A. Arrow indicator updates.
- [ ] Click "Joined" header → list re-sorts by joined_date.
- [ ] Click "Membership" header → list re-sorts by status urgency (expiring first by default).
- [ ] Sort persists in URL — sharing the URL preserves the sort.
- [ ] Sort respects current filter (e.g., sort within active members only).

---

## P2. Renewal sheet — UI broken + missing pre-fills

**Status:** Bug. Two issues:

1. Plan and recurring add-ons are not pre-filled from the previous membership.
2. The "Start date toggle" UI is messed up.

### What to fix

**Pre-fills:**

- The renewal sheet must fetch the previous (current) membership and seed the form:
  - `plan_id` = previous membership's plan_id (still valid + active; if the plan has been deactivated, default to no selection and show a small notice "Previous plan is no longer active. Pick a new plan.")
  - `applied_addon_ids` = previous membership's `recurring` add-ons (NOT `one_time`; one-time fees should never re-apply on renewal).

**Start-date toggle UI:**

- Use shadcn `ToggleGroup` (single-select) with three options: `From end of previous` · `From today` · `Custom`.
- Label clearly visible above the toggle.
- The selected option's date should be displayed as readable text below the toggle:
  > "Membership will start on **04 Aug 2026** (day after current end date)."
- Custom option reveals a date picker only when selected (use conditional render, not visibility toggle).

### Layout reference

```
Start date

[ From end of previous (04 Aug 2026) ]  [ From today ]  [ Custom ]

Membership will start on 04 Aug 2026.

(if Custom selected:)
[date picker]

```

Don't try to show all three dates inside the toggle pills — too cramped. The selected option's date displays in a single line below.

### Acceptance

- [ ] Click Renew on an active member → sheet opens with previous plan in combobox, recurring add-ons pre-checked.
- [ ] Click Renew on an expired member → same plan pre-filled, default toggle = "From today".
- [ ] If previous plan is deactivated, plan combobox is empty and a notice line is shown.
- [ ] Toggle UI renders cleanly across desktop + mobile widths.
- [ ] Selected toggle option's date shown below in plain text.
- [ ] Custom option reveals date picker; other options hide it.

---

## P3. Receptionist correction permissions — not implemented

**Status:** Bug. Module 04 amendment A4 specced this; it wasn't built. Receptionist sees no Fix button.

### What to fix

The `canCorrectMembership(user, membership, now)` function in `lib/auth/membership-permissions.ts` should already exist (per A4). Verify that:

1. It returns `{ ok: true, level: 'receptionist' }` when:
  - `user.role === 'receptionist'`
  - `user.id === membership.enrolled_by_user_id`
  - `(now - membership.created_at) < 60 minutes`
2. The Current Membership card uses this function to decide button visibility.
3. Server action `correctMembership` re-runs this check (defense in depth).

If `canCorrectMembership` doesn't exist or doesn't include the receptionist branch, implement it per the A4 spec.

### Acceptance

- [ ] Receptionist enrolls a member at 10:00 AM. At 10:30 AM, "Fix entry" button visible on Current Membership card.
- [ ] At 11:01 AM, button disappears.
- [ ] Different receptionist (logged in as a different user) viewing the same membership at 10:30 AM: button NOT visible (only the same user who enrolled can fix).
- [ ] Branch manager + Owner buttons unaffected (already working).
- [ ] Direct API call attempt by receptionist after 60 min → 403 PERMISSION_DENIED.

### Test sequence

Now that `add-staff.ts` (--mode staff) works:

1. Create a receptionist user.
2. Log in as that receptionist.
3. Add a member + enrol in one shot.
4. Within 1 minute, look for "Fix entry" button → should be visible.
5. Wait 61 minutes (or temporarily change the threshold to `1 minute` for testing, then revert).
6. Refresh — button should disappear.

---

## P4. Refund without auto-cancellation — product gap

**Status:** Real product issue you raised. Currently, a full refund leaves the membership active, which is wrong.

### What to fix

When recording a refund (existing refund flow), after the refund row is inserted, check if the cumulative refund total now equals or exceeds the membership's `final_amount_paise`.

If yes → prompt the user with a follow-up dialog before closing the sheet:

```
┌─────────────────────────────────────────────────────────────┐
│ Refund completed                                            │
│                                                             │
│ This refund returns the full ₹10,000 paid for this          │
│ membership.                                                 │
│                                                             │
│ Should we also cancel the membership? Otherwise the         │
│ member will retain access despite getting their money       │
│ back.                                                       │
│                                                             │
│              [Keep membership active]   [Cancel membership] │
└─────────────────────────────────────────────────────────────┘

```

- **Default focus:** "Cancel membership" (the safer, more correct option).
- **"Cancel membership" button:** opens the existing Cancel Membership dialog, pre-filled with effective date = today, reason = "Full refund issued (Invoice ZEN-2026-0042)". Owner can override and confirm. The cancellation refund toggle is OFF (since refund already happened).
- **"Keep membership active" button:** closes dialog, no further action. Refund stays as recorded.

### Why prompt instead of auto-cancel

Two reasons:

1. **Edge cases exist** where keeping active is correct: e.g., owner is correcting a duplicate payment from initial enrolment (member was double-charged ₹10k, refund returns the duplicate, membership remains valid for the original payment). Auto-cancelling would be wrong here.
2. **The owner is making a financial decision.** They should explicitly decide, not have the system decide for them. Asking is fast (one click); auto-cancel-with-undo is more error-prone.

### Implementation

`server/services/refund.ts`:

- After successful refund, return `{ ok: true, payment_id, requires_cancellation_prompt: boolean }` where the prompt flag is true if cumulative refunds now equal the membership's `final_amount_paise`.

`refund-sheet.tsx`:

- After receiving `requires_cancellation_prompt: true`, instead of closing the sheet, show the new confirmation dialog described above.
- "Cancel membership" button calls existing `cancelMembership` action with the pre-filled reason (skip the refund-as-part-of-cancel toggle since refund is already done).

### Acceptance

- [ ] Refund < full amount → no prompt, sheet closes normally.
- [ ] Refund == full amount → prompt appears with two clear options.
- [ ] Cumulative partial refunds reaching full amount → prompt appears on the refund that pushes total to full.
- [ ] "Cancel membership" → cancellation flow with pre-filled reason → membership status='cancelled', end_date = today.
- [ ] "Keep membership active" → no further changes, refund alone.
- [ ] Audit log shows refund + cancellation as two separate entries when "Cancel membership" chosen.
- [ ] Dialog is Owner-only (matches refund permission).

---

## P5. Import/export progress bar

**Status:** UX polish. Required for large files.

### What to fix

**CSV Import:** The current import is mostly client-side parse + a server action that batch-inserts. Right now, after "Confirm import," the user stares at a frozen modal for 5–30 seconds with no feedback.

Two layers of progress to add:

1. **Parsing progress** (during PapaParse step):
  - PapaParse already supports `step` callback firing per row.
  - Show "Parsing 247 / 1000 rows…" with a progress bar.
2. **Insertion progress** (during server batches):
  - Server inserts in batches of 100 (per Module 03 spec).
  - Use a Server-Sent Events (SSE) endpoint, OR (simpler) chunk the import into multiple Server Action calls from the client, e.g., 10 batches × 100 rows.
  - After each batch, update progress: "Imported 400 / 1000 rows…"

**Excel Export:** SheetJS export of <10k rows is fast (<2 sec), no progress bar needed. For >10k, show a simple "Generating file…" toast with spinner. Don't over-engineer this — Excel export is rarely the bottleneck.

### Implementation hint

For client-driven batched import, the cleanest pattern:

```ts
// import-progress.tsx
const BATCH_SIZE = 100;
const batches = chunk(validatedRows, BATCH_SIZE);
let imported = 0;

for (const batch of batches) {
  await importMembersBatch(batch);
  imported += batch.length;
  setProgress(imported / validatedRows.length);
}

```

Each `importMembersBatch` is a Server Action wrapping a single transaction. Failures of a batch are reported but the whole import doesn't abort — surface "893 imported, 7 failed in batch 9" at the end with a downloadable error report.

Wait — that contradicts atomicity. Let me clarify: for v1, **abort on batch failure**. The user picks "Retry from row N" or "Cancel." Don't try to do partial-success reporting; that adds complexity. Most batch failures will be transient (DB hiccup) — retry resolves them.

### Acceptance

- [ ] Importing 1000 rows shows a progress bar that visibly moves.
- [ ] Parsing phase shows "Parsing X / Y rows" message.
- [ ] Insertion phase shows "Imported X / Y rows" message.
- [ ] If a batch fails, modal shows "Imported 400 / 1000. Batch 5 failed: [error]. [Retry] [Cancel]".
- [ ] Export of <10k rows works without progress bar.
- [ ] Export of >10k rows shows toast "Generating file…" until download starts.

---

## P6. correction_count not surfaced

**Status:** Minor. Spec called for this; UI doesn't show it.

### What to fix

On the membership detail (Current Membership card), if `correction_count > 0`, append to the existing "Corrected by..." marker:

```
ⓘ Corrected by Owner on 02 May 2026 (3 corrections)

```

The "(N corrections)" suffix is shown only when `correction_count > 1`.

This is a small visual addition to the existing correction marker component. Click → popover already shows the latest correction; the popover should also include a small "View all 3 corrections →" link for owners (link goes to audit log filtered by entity, in a future module — for now, link can be disabled with `tooltip: "Coming with Audit Log module"`).

### Acceptance

- [ ] First correction → marker shows "Corrected by X on Y" (no count).
- [ ] Second+ correction → marker shows "Corrected by X on Y (N corrections)".
- [ ] Popover continues to show the latest correction's details.

---

## P7. Deferred items — document, don't build

These came up in QA but are correctly deferred to later modules. Don't pre-build.

### Email-based features (defer until SMTP configured)

- Forgot password email
- Email verification on user signup

**Action:** Add a section to `plan.md` § 9 (Risks & Open Questions) titled "Pre-launch tasks" with these two items + "Configure SMTP provider (Resend/SendGrid/Postmark) in Supabase." 30 minutes of work when you're ready to launch.

### Audit log UI

- Activity card on member detail shows recent member-scoped audit entries (already done).
- Full Audit Log viewer is **Module 08**. Don't add a placeholder page now.

### Total revenue display

- Today's View dashboard tile (**Module 05**) shows daily/monthly revenue.
- Reports page (**Module 07**) provides full revenue analytics.
- Don't pre-build a revenue display anywhere else.

### Member transactional notifications (FUTURE MODULE — register now, build later)

**Why this matters (revenue protection, not nice-to-have):**

A common Indian gym fraud pattern: branch manager takes cash from a member, says "I'll record it later," pockets the money. The member trains for months without a system entry. Owner has no idea. Audit logs catch tampering but only if the member has independent proof of payment.

Automated transactional messages to members on every state-changing financial event close this loophole. The moment a payment is recorded, an SMS fires to the member — server-generated, not manager-controlled. If the message doesn't arrive, the member knows at the desk while the cash is still recoverable.

**Triggers (every financial state change fires a message):**

- New enrollment → "Welcome, your Half Yearly membership is active. Invoice ZEN-2026-0042. Valid 30 Apr → 27 Oct. Amount ₹10,000."
- Renewal → similar template.
- Payment edit (Owner correction) → "Your enrollment was updated. New plan: Quarterly. New amount ₹6,000. Invoice ZEN-2026-0042."
- Refund → "Refund of ₹2,000 processed for invoice ZEN-2026-0042."
- Membership cancellation → "Your membership has been cancelled effective 02 May 2026. Refund: ₹9,580."

**Message content rules:**

- Must include invoice number (server-generated, not editable).
- Must include amount, plan, dates, branch name.
- Must NOT include staff member's name.
- Framed as a "receipt," not a marketing message.

**Channel tiers (when built):**

- **Basic tier:** SMS only (DLT-registered transactional template). Universal coverage in India.
- **Pro tier:** SMS + WhatsApp Business API + Email. Member can set preferred channel.

**Timing:** Always immediate, post-commit. The DB transaction commits first; the message attempt fires within seconds. SMS failure does NOT roll back the transaction (payment is still valid; failed message is logged for owner to retry).

**Edge cases to handle when built:**

- No phone on record → message doesn't fire; flag on member detail.
- Wrong phone number → mitigated by E.164 normalization at member creation.
- No opt-out (transactional messages don't require opt-in under Indian TRAI rules).
- Free trial / no payment → no message fires (no fraud risk).
- Multi-language templates → defer further; English-only at launch.

**Architectural notes for current planning:**

- Don't build the messaging infra now, but make sure the schema captures everything needed:
  - `members.phone` already in E.164 ✅
  - `payments.invoice_number` already server-generated ✅
  - `gyms` will need a `notification_provider` config column eventually (deferred)
- When ready to build, this becomes its own module (Module 11 or similar). Estimated effort: 3–5 days, dominated by DLT/Meta approval bureaucracy, not code.

**Action for** `plan.md`**:** Move "Member transactional notifications" from "Out of Scope" / silent omission to a named row in § 10 (Future considerations). Reframe it from "nice to have" to "v1.1 priority — revenue protection."

### WhatsApp signup confirmation for STAFF

Different from member notifications above. Staff onboarding (owner / branch manager / receptionist) doesn't need WhatsApp confirmation — there are <20 staff per gym, they're onboarded directly by you or the owner. Don't build this.

### Reasoning on duplicate plan name

You noted: "should also be given." If you mean the error message should explain *why* the duplicate is rejected, here's a cleaner message to use:

> "A plan named 'Half Yearly' already exists. Plan names must be unique."

This goes in the inline form error below the Name field. One-line fix in the validation message.

---

## Patch summary


| ID  | Item                                | Severity    | Time |
| --- | ----------------------------------- | ----------- | ---- |
| P1  | Members list sorting                | Bug         | 1h   |
| P2  | Renewal sheet pre-fill + UI         | Bug         | 1.5h |
| P3  | Receptionist correction permissions | Bug         | 1h   |
| P4  | Refund auto-cancellation prompt     | Product gap | 2h   |
| P5  | Import/export progress bar          | UX polish   | 2h   |
| P6  | correction_count display            | Minor       | 30m  |
| P7  | Document deferred items             | Doc         | 15m  |


**Total estimated time:** ~8 hours of focused work.

---

## Order of execution

Recommend Claude Code tackles in this order, one at a time, ending each with a smoke test:

1. **P3** (receptionist correction) — fastest, unlocks more QA testing immediately.
2. **P1** (sorting) — small, contained, nothing else depends on it.
3. **P2** (renewal sheet) — bug visible to users, affects Module 05's "expiring members" actionability.
4. **P4** (refund auto-cancellation) — product semantics matter.
5. **P5** (progress bars) — polish.
6. **P6** (correction_count display) — trivial.
7. **P7** (document deferred items) — update `plan.md`.

After completing all 7, re-run the relevant rows in the QA checklist to confirm fixes.

Then we proceed to Module 05.