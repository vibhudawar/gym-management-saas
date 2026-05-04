# Module 12 — Settings

> The configuration page that's been a placeholder since Module 01. Captures gym-level config (name, GST, invoice prefix), branches management, notifications config, current user's account, and a data export function. Staff management UI is deferred — CLI remains the way to add staff for now.

**Estimated time:** 1 day.
**Outcome:** Owner can configure everything about their gym without database access. Branch Manager and Receptionist can update their own profile. Owner can export all gym data as a multi-sheet Excel workbook for backup, CA handover, or platform migration.

---

## 12.1 Scope

In:
- `/settings` page with tabbed sub-sections.
- **Gym profile** — name, GST number, invoice prefix, currency (display-only for v1), subscription tier (display-only).
- **Branches** — add / rename / soft-deactivate branches. The branch dropdown across the app reads from this.
- **Notifications config** — channel (SMS / WhatsApp / both), provider (display-only, set via DB), sender ID, test message button. Most of this was specced in Module 11 § 11.7; this module finalizes it.
- **Account** — current user's profile (name, phone, email read-only), password change.
- **Subscription** — display-only card showing current tier; "Upgrade" button shows "Contact us" placeholder for now.
- **Data export (Danger zone)** — generate a multi-sheet Excel workbook containing all gym data. Owner-only.
- Per-section role-based access control.

Out:
- Staff management UI (defer — CLI remains).
- Email invitations / magic links (need SMTP).
- Two-factor authentication.
- Branding (logo upload, color overrides).
- Gym deactivation / hard delete.
- Per-branch settings (e.g., different invoice prefix per branch). Single gym-level config in v1.
- Plan / Add-on management here — those have their own page (`/plans`).
- API tokens / integrations.
- Webhooks.
- Audit log retention controls.

---

## 12.2 Page Structure

Settings uses **left-rail navigation** (not top tabs). Reason: there are 6 sub-sections; tabs at top would be cramped, and left rail matches the established sidebar pattern users already know. Also: it scales when more sections get added later.

```
┌──────────────────────────────────────────────────────────────────────┐
│ Settings                                                             │
│ Configure your gym, account, and integrations.                       │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────┐  ┌────────────────────────────────────────────┐ │
│  │ Gym profile     │  │                                            │ │
│  │ Branches        │  │   {section content}                        │ │
│  │ Notifications   │  │                                            │ │
│  │ Subscription    │  │                                            │ │
│  │ Account         │  │                                            │ │
│  │ ───             │  │                                            │ │
│  │ Data export     │  │                                            │ │
│  └─────────────────┘  └────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

URL pattern: `/settings/<section>`. Default `/settings` redirects to `/settings/gym` for Owner, `/settings/account` for non-owners (since that's the only section they can edit).

Left rail items hidden based on role (see § 12.3).

Mobile: left rail collapses into a Select dropdown above the section content; same URL routing.

---

## 12.3 Permission Matrix

| Section | Owner | Branch Manager | Receptionist |
|---|---|---|---|
| Gym profile | ✅ Edit | ❌ Hidden | ❌ Hidden |
| Branches | ✅ Edit | ❌ Hidden | ❌ Hidden |
| Notifications | ✅ Edit | ❌ Hidden | ❌ Hidden |
| Subscription | ✅ View (no upgrade flow yet) | ❌ Hidden | ❌ Hidden |
| Account | ✅ Edit own | ✅ Edit own | ✅ Edit own |
| Data export | ✅ Run | ❌ Hidden | ❌ Hidden |

Implementation: middleware on each subsection page checks role. Left rail conditionally renders items. Direct URL navigation to a denied section redirects to `/settings/account` with a quiet toast ("This section is for owners only").

---

## 12.4 Section: Gym profile

URL: `/settings/gym`

### Fields

| Field | Type | Notes |
|---|---|---|
| Gym name | text input | required, 2–80 chars |
| GST number | text input | optional; validated to GSTIN format on blur |
| Invoice prefix | text input | required, 2–10 uppercase + digits + hyphens, e.g., `ZEN`, `PFG-D` |
| Currency | display-only | "INR" for now |
| Subscription tier | display-only | "Basic" / "Pro" badge |
| Created on | display-only | gym creation date |

### GSTIN validation

Format: 15 chars, structured as:
- 2 digits (state code)
- 10 chars (PAN — 5 letters + 4 digits + 1 letter)
- 1 char (entity number)
- 1 char (default Z)
- 1 char (checksum)

Regex for format check:
```ts
const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
```

Format validation only in v1. Don't validate the checksum digit (algorithm exists but is brittle). Format mismatch = inline error: "Enter a valid 15-character GSTIN (e.g., 27ABCDE1234F1Z5)."

Empty GST is valid — many small gyms don't have one. Field is optional.

### Invoice prefix validation

- Already used at gym creation; this lets owner correct it.
- Validation: `^[A-Z0-9-]{2,10}$`. Same as `create-tenant.ts`.
- **Important warning when changing:** If gym already has issued invoices with the current prefix, changing it creates a discontinuity. Show a confirmation dialog:
  > "Changing the invoice prefix will only affect new invoices. Existing invoices keep their current prefix. Are you sure?"

  This is fine — accountants understand prefix changes. But the warning prevents accidental change.

### Layout

Single-column form, max-width `xl`. Sections grouped:

```
┌── Gym profile ──────────────────────────────────────────┐
│                                                         │
│   Gym name *                                            │
│   [ Zenith Fitness                            ]         │
│                                                         │
│   Invoice prefix *                                      │
│   [ ZEN                                       ]         │
│   New invoices will start with this prefix              │
│                                                         │
│   GST number                                            │
│   [ 27ABCDE1234F1Z5                           ]         │
│   Optional. Set this if you charge GST on invoices.     │
│                                                         │
│   ─────────────────────                                 │
│                                                         │
│   Plan: Basic                  Created: 12 Mar 2026     │
│   Currency: INR                                         │
│                                                         │
│                              [Cancel]    [Save changes] │
└─────────────────────────────────────────────────────────┘
```

Bottom row (display-only): subtle grid showing immutable fields. No card border around them — just informational.

### Save behavior

- Optimistic UI not appropriate here (changes are infrequent + impactful). Use simple form submit.
- Success → toast "Gym profile updated."
- Audit log entry written: `gym.update` with before/after.

### Server

```ts
// server/actions/settings/update-gym-profile.ts
export async function updateGymProfile(input: {
  name: string;
  gstNumber: string | null;
  invoicePrefix: string;
}): Promise<ActionResult>;
```

Owner-gated. Validates via Zod (importing `GSTIN_PATTERN` and `INVOICE_PREFIX_PATTERN` from `lib/constants/`).

If invoice prefix changed and gym has issued invoices: still allow, but log this change with extra context in audit (`{ previousPrefix, newPrefix, existingInvoiceCount }`).

---

## 12.5 Section: Branches

URL: `/settings/branches`

### Layout

A simple list of branches with inline actions:

```
┌── Branches ─────────────────────────────────── [+ Add branch] ─┐
│                                                                │
│  Main Branch              ●  active                  [Edit ⋯] │
│  Created 12 Mar 2026                                           │
│  ────────────────                                              │
│  Saket Branch             ●  active                  [Edit ⋯] │
│  Created 04 Apr 2026                                           │
│  ────────────────                                              │
│  Pilot Branch             ○  inactive                [Edit ⋯] │
│  Deactivated 22 Apr 2026                                       │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

Active dot color: emerald. Inactive: muted gray.

### Add branch

`[+ Add branch]` button → opens shadcn Sheet from right.

Fields:
- Branch name (required, 2–60 chars)
- Address (optional, max 500 chars)
- Phone (optional, E.164 normalized)

Submit creates a branch row. Toast confirmation. Sheet closes. List refreshes.

### Edit branch

`[Edit]` button (or row click) → same Sheet, pre-filled with current values.

### Branch deactivation

`⋯` menu has "Deactivate." Click → AlertDialog:

> "Deactivate **Saket Branch**? Members and staff at this branch will no longer be available for new transactions. Existing data is preserved.
>
> Active members at this branch: **47**
> Active staff at this branch: **3**
>
> Active members must be moved to another branch before deactivation."

Wait — this is a real product decision. What happens to active members at a deactivated branch?

**The right rule:** A branch cannot be deactivated while it has active members or staff. Owner must first transfer those members to another branch (or wait for memberships to end). This prevents orphaned data.

For v1, **block deactivation when active members or staff exist.** Show count and message:

```
Cannot deactivate Saket Branch.
This branch has 47 active members and 3 active staff.
Move them to another branch first.
[Close]
```

If branch has no active members or staff: confirmation dialog → set `branches.deleted_at = now()`. Audit logged.

Reactivation: from the Inactive section (or via a tab toggle), `⋯` menu has "Reactivate." Sets `deleted_at = null`. Audit logged.

### Where branches show up across the app

Confirm reading from `branches` table where active branches are listed (check `deleted_at IS NULL` and `is_active = true` in queries):
- Branch selector in topbar
- Branch filter in Members list
- Branch filter in Reports
- Member create form (branch dropdown)
- Staff branch_id (foreign key, validated when staff added via CLI)

The Settings page is the only place to *manage* branches. Everywhere else just *uses* them.

### Server

```ts
// server/actions/settings/create-branch.ts
export async function createBranch(input: {
  name: string;
  address?: string;
  phone?: string;
}): Promise<ActionResult>;

// server/actions/settings/update-branch.ts
export async function updateBranch(branchId: string, input: { ... }): Promise<ActionResult>;

// server/actions/settings/deactivate-branch.ts
export async function deactivateBranch(branchId: string): Promise<
  | { ok: true }
  | { ok: false, code: 'HAS_ACTIVE_MEMBERS' | 'HAS_ACTIVE_STAFF', counts: { members: number, staff: number } }
>;

// server/actions/settings/reactivate-branch.ts
```

All Owner-gated. All audit-logged.

### Constraint: cannot deactivate the last active branch

If gym has only one active branch and Owner tries to deactivate it: block with a different message.

```
Cannot deactivate your only branch.
Add another branch first if you're consolidating, or contact support to deactivate the gym entirely.
```

This prevents the gym from having zero functional branches.

---

## 12.6 Section: Notifications

URL: `/settings/notifications`

This was sketched in Module 11 § 11.7. Now it's the real page.

### Layout

```
┌── Notifications ────────────────────────────────────────┐
│                                                         │
│  Channel                                                │
│  ◉ SMS only                                             │
│  ○ WhatsApp only          (Pro tier)  [Upgrade]         │
│  ○ SMS + WhatsApp          (Pro tier)  [Upgrade]        │
│                                                         │
│  ─────────────────────                                  │
│                                                         │
│  Sender ID (SMS)                                        │
│  ZENITH                          [provider stub]        │
│  DLT-approved sender. Set via support during launch.    │
│                                                         │
│  ─────────────────────                                  │
│                                                         │
│  Test message                                           │
│  Send a sample receipt to your phone to verify the      │
│  system works.                                          │
│  [Send test message to +91 81783 62985]                 │
│                                                         │
│  ─────────────────────                                  │
│                                                         │
│  Recent activity                                        │
│  Last 7 days: 142 sent, 138 delivered, 4 failed        │
│                                              View all →│
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Channel selector

Three radio options:
- SMS only — always available
- WhatsApp only — disabled with "Pro tier" badge if `gym.subscription_tier = 'basic'`
- SMS + WhatsApp — same gating

For Basic tier gyms, the disabled options show "[Upgrade]" link. For v1, "Upgrade" is a placeholder that opens an `<UpgradeDialog />` saying "Pro tier is not yet available. Contact us at [email] to upgrade." (Filler — replace when subscription flow is real.)

Save change → updates `gym.notification_channel`. Audit logged.

### Sender ID

For v1 with stub provider: shows "[provider stub]" badge and explanation that this is set via support during launch. Owner cannot edit it themselves (DLT registration requires verification through MSG91; we don't expose self-service for that).

When real MSG91 provider is wired: this field becomes editable but with a strong warning that changes must match DLT-registered sender. For v1, just display.

### Test message button

Click → confirmation dialog:
> "Send a test receipt to **+91 81783 62985**?
> This uses one SMS credit (real SMS) or none (stub provider)."

On confirm: calls `server/actions/notifications/send-test.ts` (built in Module 11). Toast confirms.

The test uses a fixed template (defined in Module 11 templates) — Owner cannot type custom text (DLT compliance).

### Recent activity summary

Pulled via lightweight query: `count by status, last 7 days`. Powers the inline summary. "View all →" links to a notifications log filtered to the gym's all messages (we don't have this page yet — for v1, link to a stub or wire it later as part of post-launch polish).

---

## 12.7 Section: Subscription

URL: `/settings/subscription`

For v1 this is **mostly informational**. No upgrade flow built yet.

### Layout

```
┌── Subscription ─────────────────────────────────────────┐
│                                                         │
│  Current plan                                           │
│  Basic                                                  │
│                                                         │
│  ✓ All core features                                    │
│  ✓ SMS receipts to members                              │
│  ✓ Unlimited members                                    │
│  ✓ Multi-branch support                                 │
│                                                         │
│  ─────────────────────                                  │
│                                                         │
│  Pro plan                              ₹5,000/month     │
│                                                         │
│  Everything in Basic, plus:                             │
│  ✓ WhatsApp receipts (richer engagement)                │
│  ✓ Automated renewal campaigns                          │
│  ✓ Lapsed member win-back flows                         │
│  ✓ Priority support                                     │
│                                                         │
│  [Contact us to upgrade]                                │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

"Contact us to upgrade" is a `mailto:` link to a hardcoded email (or opens a dialog with email + WhatsApp link to your support number — your call). When you build a real upgrade flow later, this section gets a proper interface.

The Pro features list is your **soft sales pitch on the Settings page itself.** Owners on Basic see it every time they tweak something. Worth getting the copy right.

Subscription metadata read from `gym.subscription_tier`. Changing it requires direct DB intervention or admin tooling — no self-service.

---

## 12.8 Section: Account

URL: `/settings/account`

The only Settings page accessible to **all roles** (since it's about the user's own profile).

### Layout

```
┌── Account ──────────────────────────────────────────────┐
│                                                         │
│  Profile                                                │
│                                                         │
│  Name                                                   │
│  [ Vibhu Dawar                                ]         │
│                                                         │
│  Phone                                                  │
│  [ +918178362985                              ]         │
│  Will be saved as +91 81783 62985                       │
│                                                         │
│  Email                                                  │
│  vibhu@zenith.in                  [read-only]           │
│  Email is used for login and cannot be changed.         │
│                                                         │
│  Role                                                   │
│  Owner                                       [read-only]│
│                                                         │
│  Branch                                                 │
│  All branches                                [read-only]│
│  (or specific branch for Branch Manager / Receptionist) │
│                                                         │
│                              [Cancel]    [Save changes] │
│                                                         │
│  ─────────────────────                                  │
│                                                         │
│  Password                                               │
│                                                         │
│  Current password                                       │
│  [                                            ]         │
│                                                         │
│  New password                                           │
│  [                                            ]         │
│                                                         │
│  Confirm new password                                   │
│  [                                            ]         │
│                                                         │
│                              [Update password]          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Editable fields

- **Name** — required, 2–80 chars.
- **Phone** — required, E.164 normalized (same util from Module 03).

### Read-only fields

- **Email** — cannot be changed in v1. Email is the login identity (Supabase Auth ties it). Changing email requires confirmation flow that needs SMTP. Defer.
- **Role** — only changeable by manual DB intervention (since we don't have staff management UI yet).
- **Branch** — same reason.

### Password change

Current password + new password + confirm. Calls Supabase Auth's `updateUser` with the new password.

Validation:
- Current password must verify.
- New password ≥ 8 chars (Supabase default; could match the `Test@12345` complexity if you want stricter).
- New ≠ current.
- Confirm matches new.

On success: toast "Password updated. You'll need this for next login." Optionally sign out other sessions (Supabase has this; defer to keep it simple).

### Server

```ts
// server/actions/settings/update-account.ts
export async function updateAccount(input: {
  name: string;
  phone: string;
}): Promise<ActionResult>;

// server/actions/settings/change-password.ts
export async function changePassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<ActionResult>;
```

Both work for any role (acting on the current user). Profile update audit-logged as `user.update_self`. Password change is **not** audit-logged with old/new values (we never log password content); only the fact that a password change occurred.

---

## 12.9 Section: Data Export (Danger zone)

URL: `/settings/export`

Visible in the left rail with a separator above it (signaling "this is different"). Light red accent or `⚠` icon next to the label.

### Why it's "Danger zone" but data export isn't dangerous

Strictly speaking, downloading a copy of your data isn't destructive. We put it under "Danger zone" anyway because:
- It's a sensitive operation (full data leaving your system).
- The visual treatment encourages owners to think before clicking.
- Future destructive actions (gym deactivation, etc.) will live here too.

You could call this "Data & Export" or just "Export" instead of "Danger zone." For v1 with only one item, I'll use the title **"Data export"** for the section, located under a `Danger zone` group header in the left rail. Clean enough.

### Layout

```
┌── Data export ──────────────────────────────────────────┐
│                                                         │
│  Download all your gym's data as an Excel workbook.     │
│  Useful for backup, accounting handover, or platform    │
│  migration.                                             │
│                                                         │
│  What's included:                                       │
│  • All members (active + deleted)                       │
│  • All memberships (current + history)                  │
│  • All payments (incl. refunds)                         │
│  • All freezes                                          │
│  • All plans & add-ons                                  │
│  • All audit log entries                                │
│  • All notifications                                    │
│                                                         │
│  Last export: never                                     │
│                                                         │
│  [Generate export →]                                    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Generate flow

Click → confirmation dialog:

> "Generate full data export?
> This may take 30 seconds to 2 minutes depending on your data volume.
> The file will download automatically when ready."

On confirm:
1. Show inline progress: "Generating export… X% complete." (Use a simple progress indicator.)
2. Server queries each entity type in parallel.
3. Build multi-sheet Excel workbook using SheetJS.
4. Stream download to client.

### Excel workbook structure

One sheet per entity type. Sheet names:
- `Members`
- `Memberships`
- `Payments`
- `Freezes`
- `Plans`
- `Add-ons`
- `Audit Log`
- `Notifications`

Each sheet has all rows (no pagination), all columns (including IDs, denormalized for cross-reference). Money columns formatted in rupees (paise / 100 with 2 decimals). Timestamps in IST.

### Performance considerations

- Cap exports at reasonable size — for v1, hard limit at 100,000 rows per sheet. Above that, show a warning: "Your dataset is unusually large. Contact support for a custom export."
- The export query runs sequentially with progress callbacks if needed (or all in parallel if size permits). 
- Generated file is **not stored** server-side — streamed once, then garbage collected. If owner wants a fresh copy, regenerate.
- Filename: `<gym-name>-full-export-<YYYY-MM-DD>.xlsx`.

### Audit logging

The export action itself is audit-logged: `gym.data_export` with metadata `{ rowCounts, fileSize, exportedAt }`. The export *contents* are obviously not in the log.

### Server

```ts
// server/actions/settings/generate-data-export.ts
export async function generateDataExport(): Promise<{
  ok: true;
  downloadUrl: string;        // signed URL or base64 stream
  filename: string;
  rowCounts: Record<string, number>;
}>;
```

Owner-only. Implementation reuses each entity's existing query function but unbounded.

### Update "Last export" timestamp

Store `gym.last_data_export_at` (timestamptz, nullable). Update on every export. Display: "Last export: 23 May 2026, 3:42 PM" or "never."

This both helps the owner remember when they last backed up AND gives you a soft signal of how often data export is actually used.

---

## 12.10 Acceptance Criteria

### Routing & layout
- [ ] `/settings` redirects to `/settings/gym` for Owner, `/settings/account` for non-owners.
- [ ] Left rail renders correctly per role; hidden items not visible.
- [ ] Direct URL to denied section redirects to `/settings/account` with toast.
- [ ] Mobile: left rail collapses to Select dropdown.
- [ ] Each section has its own URL; back button works.

### Gym profile
- [ ] Owner can edit name, GST, invoice prefix.
- [ ] GSTIN format validated; invalid input shows inline error.
- [ ] Empty GST is allowed.
- [ ] Invoice prefix change shows confirmation when invoices exist.
- [ ] Read-only fields (currency, tier, created on) display correctly.
- [ ] Save action audit-logged.

### Branches
- [ ] Owner can add new branch via Sheet.
- [ ] Owner can edit branch name/address/phone.
- [ ] Branch deactivation blocked with active members or staff; counts shown.
- [ ] Cannot deactivate last active branch.
- [ ] Inactive branches visible in a separate section (or via toggle).
- [ ] Reactivation works.
- [ ] Audit log entry per change.
- [ ] Branch dropdowns elsewhere in the app reflect changes.

### Notifications
- [ ] Channel radios reflect current `gym.notification_channel`.
- [ ] WhatsApp options gated for Basic tier with [Upgrade] placeholder.
- [ ] Save updates the gym row + audit log.
- [ ] Sender ID is read-only with explanation.
- [ ] Test message button opens confirmation, sends test, shows toast.
- [ ] Recent activity summary shows correct counts.

### Subscription
- [ ] Current plan card shows correctly per `gym.subscription_tier`.
- [ ] Pro card shows Pro features.
- [ ] [Contact us to upgrade] is a working `mailto:` or opens dialog.

### Account
- [ ] All roles can access `/settings/account`.
- [ ] User can edit own name and phone.
- [ ] Email, role, branch shown read-only.
- [ ] Phone normalization works (consistent with Module 03 phone util).
- [ ] Password change validates current password before applying.
- [ ] New password ≥ 8 chars, must match confirm.
- [ ] Audit log entry for profile update; password change logged as event without content.

### Data export
- [ ] Owner-only access.
- [ ] Confirmation dialog before generating.
- [ ] Progress indicator during generation.
- [ ] Multi-sheet Excel downloaded with correct filename.
- [ ] All 8 sheets present; rows accurate per entity counts.
- [ ] Money columns in rupees (not paise) with 2 decimals.
- [ ] Timestamps in IST.
- [ ] Audit log entry written.
- [ ] `last_data_export_at` updated.
- [ ] Hard cap at 100,000 rows per sheet enforced; warning shown above.

### General
- [ ] Lighthouse perf ≥ 90 on each section.
- [ ] No `any`, no console.logs.
- [ ] All forms use react-hook-form + Zod.
- [ ] All save actions show toast on success.
- [ ] Failed actions show specific error messages, not generic "something went wrong."

---

## 12.11 Files Created in This Module

```
lib/db/schema/gyms.ts                                 (MODIFIED — add last_data_export_at)
lib/db/migrations/0012_settings_columns.sql           (NEW)

app/(app)/settings/page.tsx                           (NEW — redirects based on role)
app/(app)/settings/layout.tsx                         (NEW — left rail + section content)
app/(app)/settings/_components/settings-nav.tsx       (left rail, role-aware)
app/(app)/settings/_components/section-header.tsx     (consistent section title pattern)

app/(app)/settings/gym/page.tsx
app/(app)/settings/gym/_components/gym-profile-form.tsx
app/(app)/settings/gym/_components/invoice-prefix-warning-dialog.tsx

app/(app)/settings/branches/page.tsx
app/(app)/settings/branches/_components/branches-list.tsx
app/(app)/settings/branches/_components/branch-form-sheet.tsx
app/(app)/settings/branches/_components/deactivate-branch-dialog.tsx

app/(app)/settings/notifications/page.tsx
app/(app)/settings/notifications/_components/channel-selector.tsx
app/(app)/settings/notifications/_components/test-message-section.tsx
app/(app)/settings/notifications/_components/upgrade-dialog.tsx

app/(app)/settings/subscription/page.tsx
app/(app)/settings/subscription/_components/plan-card.tsx
app/(app)/settings/subscription/_components/contact-upgrade-dialog.tsx

app/(app)/settings/account/page.tsx
app/(app)/settings/account/_components/account-form.tsx
app/(app)/settings/account/_components/password-form.tsx

app/(app)/settings/export/page.tsx
app/(app)/settings/export/_components/data-export-card.tsx
app/(app)/settings/export/_components/export-progress-dialog.tsx

server/actions/settings/update-gym-profile.ts
server/actions/settings/create-branch.ts
server/actions/settings/update-branch.ts
server/actions/settings/deactivate-branch.ts
server/actions/settings/reactivate-branch.ts
server/actions/settings/update-notification-channel.ts
server/actions/settings/update-account.ts
server/actions/settings/change-password.ts
server/actions/settings/generate-data-export.ts

server/queries/settings/get-branch-active-counts.ts   (members + staff per branch, for deactivation check)
server/queries/settings/get-notification-summary.ts   (last 7 days status counts)

lib/constants/validation.ts                           (NEW — GSTIN_PATTERN, INVOICE_PREFIX_PATTERN)
```

---

## 12.12 Common Pitfalls

1. **GSTIN format only, no checksum.** The checksum validation is a known algorithm but error-prone to implement. Format check catches 99% of typos. The remaining 1% is caught when the gym actually files GST returns. Don't gold-plate.

2. **Invoice prefix change with existing invoices.** Document this in the warning dialog clearly. The prefix change does NOT retroactively renumber old invoices — they keep their original prefix forever. New invoices use the new prefix. This is what accountants expect.

3. **Branch deactivation blocking.** Don't try to be clever and offer "Move all members automatically." That's a multi-step decision the owner needs to make member by member. Just block and tell them the counts.

4. **Password change re-authentication.** Supabase's updateUser typically requires the user to be authenticated, but verifying the *current* password is a separate step. Use Supabase's `signInWithPassword` to verify current, then `updateUser` to apply new. Don't skip the verification step — that's a security hole.

5. **Data export "what's included" copy must match reality.** If the export ships with 8 sheets but the UI lists 7, the owner notices. Keep the list and the implementation in sync.

6. **Test message uses real SMS credits when MSG91 is wired.** During v1 with stub provider this is free. Once MSG91 is connected, owner clicking "Test message" 50 times = 50 SMS credits. Add a soft rate limit (max 5 test messages per day per gym). Implement using a small rate-limit table or in-memory counter.

7. **Email is the auth identity — don't even hint it might be editable.** The read-only treatment is intentional. Changing email requires:
   - Verifying the new email (SMTP needed).
   - Updating Supabase Auth.
   - Updating the `users.email` column.
   - Handling the case where the user is currently signed in.

   None of this is built. The field is read-only and the UI explains why.

8. **Settings is the first place real customers will spend time configuring.** This means it's the first place bugs become visible. Spend extra time on form validation messages, success states, error states. Better polish here pays off in fewer support tickets.

9. **Don't audit-log password content. Ever.** The audit entry for password change should be `{ event: 'password_changed', at: timestamp }`. Nothing else. Never the old or new password.

10. **The "Generate export" button must be debounced/disabled during generation.** Owner clicks it, gets impatient, clicks again — now you have two parallel exports running. Disable the button while generating, show progress, only re-enable after download starts.

11. **Excel workbook size matters.** A gym with 5000 members + 1 year of data could easily hit 50,000 rows across all sheets. SheetJS handles this fine but generation time grows. The progress indicator is critical UX. Don't make it look frozen.

12. **The left-rail nav uses `Link` not `useRouter().push`.** Each section is a separate URL, fully server-rendered. Don't try to make Settings a single page with tab state. URLs are part of the UX (deep linking, browser back, etc.).

---

## 12.13 What this changes about the product

Before this module, Settings was a placeholder. Owner-onboarded customers couldn't change anything without you running CLI commands or editing the DB.

After this module, the product is **self-service for the configurations that matter most.** New customer can change their gym name when they decide to rebrand. They can add a second branch when they expand. They can run a backup before switching plans. These are the moments that define whether your software feels professional or amateur.

The deferred items (staff management UI, email-based invites, custom branding) are real gaps but solvable later. With this module shipped, you can onboard your first paying customer and they can run their gym entirely through the UI.

---

## 12.14 What's next

**Module 09 — PDF Invoices.** With Settings capturing the GST number and invoice prefix, Module 09 generates the actual invoice PDFs. If GST is set, generates GST-compliant invoices (with HSN code, CGST/SGST split, place-of-supply). If not, simple receipt format. ~1 day.

After Module 09, the v1 product is functionally complete. You'll have:
- Multi-tenant auth + RBAC (Module 01)
- Plans / add-ons (Module 02)
- Members + CSV import (Module 03)
- Revenue loop with corrections, refunds, cancellations (Module 04)
- Today's View dashboard (Module 05)
- Membership freeze (Module 06)
- Reports with Overview tab (Module 07)
- Audit log (Module 08)
- Settings (Module 12)
- PDF invoices (Module 09)
- Notifications infrastructure (Module 11)

That's a sellable product. Time to demo to real gym owners and start signing customers.
