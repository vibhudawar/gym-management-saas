# Module 03 — Member Management

> The most-used screen in the entire app. Receptionists will spend hours here every day. Speed, search, and the CSV import are the three things that make or break this module. The "register replacement" promise lives or dies here.

**Estimated time:** 2–3 days.
**Outcome:** Receptionist can find any member in <2 seconds, add a new one in <30 seconds, and the owner can import 200 members from their old gym software via CSV.

---

## 3.1 Scope

In:
- `members` schema with RLS, branch scoping, phone normalization.
- Members list page with search, branch filter, status filter, pagination, sort.
- Add member form (sheet) with duplicate-phone detection.
- Member detail page (profile view, edit, soft-delete).
- CSV import: upload → preview → validate → confirm → bulk insert.
- Excel export of filtered member list.
- Global search bar (`Cmd+K`) — finally activated (was placeholder in Module 01).
- Empty/loading/error states for every list and search.

Out:
- Membership history on detail page (placeholder card; populated by Module 04).
- Payments history on detail page (placeholder card; populated by Module 04).
- Photo upload (deferred per v1 decision).
- Bulk edit / bulk delete (post-v1).
- Member tags / segments (post-v1; basic notes field covers ad-hoc).
- Re-import / sync from CSV (one-time imports only in v1).

---

## 3.2 Data Model

### `members`
| column | type | notes |
|---|---|---|
| id | uuid PK | `gen_random_uuid()` |
| gym_id | uuid not null | FK → gyms |
| branch_id | uuid not null | FK → branches; required (member's home branch) |
| name | text not null | trimmed; `min 2`, `max 80` chars |
| phone | text not null | E.164, e.g. `+919876543210` |
| email | text | nullable; lowercased on save |
| gender | text | nullable; `male` \| `female` \| `other` \| `prefer_not_to_say` |
| dob | date | nullable |
| address | text | nullable, max 500 |
| emergency_contact_name | text | nullable, max 80 |
| emergency_contact_phone | text | nullable, E.164 |
| notes | text | nullable, max 1000 |
| joined_date | date not null | defaults to today on create |
| is_active | boolean not null default true | reserved for future deactivation flow; v1 always true |
| created_at | timestamptz not null default now() | |
| updated_at | timestamptz not null default now() | |
| created_by_user_id | uuid | FK → users; nullable for CSV imports (set to importer's id, not null) |
| deleted_at | timestamptz | soft delete |

### Indexes
- `(gym_id, phone)` **unique partial** `where deleted_at is null` — duplicate phone detection lives here.
- `(gym_id, branch_id, is_active)` — list view.
- `(gym_id) include (name, phone)` — search.
- Trigram index on `name`: `create index members_name_trgm on members using gin (name gin_trgm_ops);` — fuzzy name search.
  - Requires `create extension if not exists pg_trgm;` in migration.
- Trigram index on `phone`: same pattern. Allows partial phone search ("9876" finds "+919876543210").

### Constraints
- `name` length 2..80
- `phone` matches `^\+[1-9]\d{6,14}$` (E.164)
- `emergency_contact_phone` same pattern when not null
- `email` matches basic email regex when not null
- `gender in ('male','female','other','prefer_not_to_say')` when not null

### RLS

Standard tenant isolation from Module 01, **plus branch scoping**:

```sql
alter table members enable row level security;

create policy "members_tenant_isolation" on members
  for all
  using (gym_id = current_user_gym())
  with check (gym_id = current_user_gym());

create policy "members_branch_scoping_select" on members
  for select using (
    current_user_role() = 'owner'
    or branch_id = current_user_branch()
  );

create policy "members_branch_scoping_insert" on members
  for insert with check (
    current_user_role() = 'owner'
    or branch_id = current_user_branch()
  );

create policy "members_branch_scoping_update" on members
  for update using (
    current_user_role() = 'owner'
    or branch_id = current_user_branch()
  );
```

Owners see all branches. Branch managers and receptionists see only their assigned branch. The `for all` policy enforces tenant isolation regardless of operation; the explicit per-operation policies layer branch scoping.

---

## 3.3 Phone Normalization

Build `lib/utils/phone.ts`:

```ts
export type NormalizedPhone = string; // E.164, e.g. "+919876543210"

/**
 * Normalize Indian phone input.
 * Accepts: "9876543210", "98765 43210", "+91 98765-43210", "919876543210", "0919876543210"
 * Returns: "+919876543210" or null if invalid.
 *
 * v1: India-only logic. Internationalization deferred.
 */
export function normalizeIndianPhone(input: string): NormalizedPhone | null;

/**
 * Format E.164 → human-friendly display.
 * "+919876543210" → "+91 98765 43210"
 */
export function formatPhoneForDisplay(phone: NormalizedPhone): string;

/**
 * Last-N-digits helper for partial search.
 */
export function lastDigits(phone: NormalizedPhone, n: number): string;
```

Rules:
- Strip all non-digits except leading `+`.
- If 10 digits and starts with 6/7/8/9 → prepend `+91`.
- If 11 digits and starts with `0` followed by 6/7/8/9 → strip 0, prepend `+91`.
- If 12 digits and starts with `91` → prepend `+`.
- If already starts with `+91` and 13 chars total → keep.
- Anything else → return null (invalid).

Validate via Zod refinement, not just regex — wrap `normalizeIndianPhone()` in the schema.

```ts
export const phoneSchema = z
  .string()
  .trim()
  .transform((v) => normalizeIndianPhone(v))
  .refine((v): v is NormalizedPhone => v !== null, {
    message: "Enter a valid 10-digit Indian mobile number",
  });
```

---

## 3.4 Zod Schemas

`lib/db/schema/members.ts`:

```ts
export const memberGenders = ["male", "female", "other", "prefer_not_to_say"] as const;

export const memberCreateSchema = z.object({
  branch_id: z.string().uuid(),
  name: z.string().trim().min(2).max(80),
  phone: phoneSchema,
  email: z.string().trim().toLowerCase().email().max(120).optional().or(z.literal("")),
  gender: z.enum(memberGenders).optional(),
  dob: z.string().date().optional(),                // ISO date "YYYY-MM-DD"
  address: z.string().trim().max(500).optional(),
  emergency_contact_name: z.string().trim().max(80).optional(),
  emergency_contact_phone: phoneSchema.optional(),
  notes: z.string().trim().max(1000).optional(),
  joined_date: z.string().date().optional(),        // defaults to today server-side
});

export const memberUpdateSchema = memberCreateSchema.partial();

export type MemberCreateInput = z.infer<typeof memberCreateSchema>;
export type MemberUpdateInput = z.infer<typeof memberUpdateSchema>;
```

For CSV import, a separate **lenient** schema that pre-normalizes everything and reports per-row errors (see § 3.7).

---

## 3.5 Server Layer

### Queries — `server/queries/members/`

#### `listMembers(input)`
```ts
type ListMembersInput = {
  search?: string;            // matches name OR phone (trigram)
  branchId?: string;          // filter; empty = all branches user can see
  status?: "active" | "inactive" | "all";  // v1: always defaults "active"
  sortBy?: "name" | "joined_date" | "created_at";
  sortDir?: "asc" | "desc";
  page?: number;              // 1-based
  pageSize?: number;          // default 50, max 200
};
```
Returns `{ rows, total, page, pageSize }`. Server-side pagination (don't load all members).

Search behavior:
- If input looks like phone (>= 4 digits, mostly digits) → search phone column with trigram similarity.
- Else → search name column with trigram.
- Always `ilike '%query%'` as a fallback OR-clause.
- Use `pg_trgm` similarity with threshold 0.3 for fuzzy matching.

#### `getMember(id)`
Single member, full row. Respects RLS.

#### `findByPhoneInGym(phone)`
For duplicate detection during create/import. Returns `Member | null`. Bypasses no-RLS-needed check via the user's session.

#### `globalSearchMembers(query, limit = 8)`
Used by the `Cmd+K` palette. Lighter payload (id, name, phone, branch). Same trigram approach.

### Actions — `server/actions/members/`

#### `createMember(input)`
1. Validate via `memberCreateSchema`.
2. Check duplicate via `findByPhoneInGym(input.phone)`.
3. If duplicate → return `{ ok: false, code: "DUPLICATE_PHONE", existingMember: { id, name, branch_name } }`.
4. Insert row inside `db.transaction`, set `created_by_user_id`.
5. `recordAudit({ entityType: "member", action: "create", after: row })`.
6. Return `{ ok: true, data: row }`.

#### `updateMember(id, input)`
1. Validate via `memberUpdateSchema`.
2. Fetch existing row (for audit before-state).
3. If phone changed, check duplicate.
4. Update inside transaction.
5. `recordAudit({ ..., action: "update", before, after })`.

#### `softDeleteMember(id, reason?)`
1. Owner / branch_manager only (gate with `requireRole`).
2. Set `deleted_at = now()`, `is_active = false`.
3. Audit with `reason` in `after_json.delete_reason`.
4. **Block deletion if member has an active membership** — return `{ ok: false, code: "HAS_ACTIVE_MEMBERSHIP" }`. (Module 04 enforces, but stub the check now: if membership table exists by then, query it; else allow.)

#### `restoreMember(id)`
For accidental deletions. Owner only. Sets `deleted_at = null, is_active = true`.

### Services — `server/services/members-import.ts`
Detailed in § 3.7.

---

## 3.6 UI

### Sidebar update
"Members" already in sidebar from Module 01. Activate now.

### Page header pattern
Standardize across all list pages going forward. Build once, reuse in Modules 04+:

`components/layout/page-header.tsx`:
- Left: title (text-2xl font-semibold), optional subtitle (text-sm muted).
- Right: primary action button + secondary actions.
- Optional: tab strip below header for sub-views.

### `/members` — list page

**Layout (top to bottom):**

1. **Page header**
   - Title: "Members"
   - Subtitle: dynamic count, e.g. "1,247 members across 3 branches" (Owner) or "412 members" (Branch Manager / Receptionist).
   - Right: primary "Add member" button + ghost "Import CSV" button + ghost "Export" button.

2. **Filter bar** (sticky on scroll, below header)
   - Search input (left, grows to fill): placeholder "Search by name or phone…", with Search icon prefix; clears on Esc.
   - Branch filter (Owner only): Select dropdown showing "All branches" + each branch.
   - Status filter: Tabs — "Active" | "Deleted" (Deleted tab visible to Owner only).
   - Right: small "Density" toggle button (icon-only) — switches list density between Comfortable and Dense for this user's session (persist in localStorage).

3. **Members table** (shadcn DataTable)

   Default columns (Comfortable density):
   | Column | Notes |
   |---|---|
   | Name | Bold; subtitle below (muted) shows joined date "Joined 12 Mar 2024" |
   | Phone | Formatted via `formatPhoneForDisplay`. Click to copy. |
   | Branch | Hidden if user has only 1 branch visible; otherwise small badge with branch name |
   | Membership status | Badge: "Active" (green), "Expired" (red), "Frozen" (amber), "No membership" (gray). Pulls from latest membership row (Module 04). For Module 03 alpha, show "—" placeholder. |
   | Last visit | Hidden in v1 (attendance not built). Don't add column. |
   | Actions | Trailing `⋯` menu: View, Edit, Delete (Delete only for Owner/Manager) |

   Dense density: hides "joined date" subtitle, smaller row height, single-line cells.

   Row click → navigates to `/members/[id]`.

   Sort: Name (default A→Z), Joined date, Created date.
   Pagination: 50 per page; "Load more" pattern (better than numbered pages on long lists).

4. **Empty state** (no members at all in this branch/gym)
   - Centered, full-width.
   - Icon: lucide `Users` (muted).
   - Heading: "No members yet"
   - Body: "Add your first member to start managing your gym."
   - Two CTAs side by side: primary "Add member" + secondary "Import from CSV".

5. **Empty search result state** (filters/search return zero rows)
   - Less prominent.
   - Body: "No members match your search."
   - Single ghost CTA: "Clear search".

6. **Loading state**
   - 8 skeleton rows on initial load.
   - Search shows inline spinner in the search input (right side), not a full-table skeleton — keeps existing rows visible while filtering.

### Add member — Sheet (right slide-over)

Width: `sm:max-w-lg`.

**Form layout (single column, generous spacing):**

Section: **Personal details**
- Name * (text input)
- Phone * (text input, `inputMode="tel"`, with auto-format on blur via `normalizeIndianPhone`; show normalized value greyed below input as confirmation: "Will be saved as +91 98765 43210")
- Gender (Select; optional)
- Date of birth (Date picker; optional)
- Email (text input, optional)

Section: **Branch & membership info**
- Branch * (Select; pre-filled with user's branch for non-owners; required)
- Joined date (Date picker, defaults today)

Section: **Emergency contact** (collapsible, default collapsed if not filled)
- Emergency contact name
- Emergency contact phone

Section: **Address & notes** (collapsible)
- Address (textarea, 3 rows)
- Notes (textarea, 3 rows)

Footer:
- Right: Secondary "Cancel" + Primary "Add member"
- "Add another" checkbox (left of primary button) — when checked, after save, sheet stays open with form reset (huge time-saver for receptionists doing batch enrollments)

**Duplicate phone handling:**

When the receptionist enters a phone that already exists for this gym:
- On blur, check via `findByPhoneInGym` (debounced).
- If found, replace the "Will be saved as…" hint with an inline alert below the phone input:
  ```
  ⚠ A member with this phone already exists.
  Rohit Sharma · Main Branch · Joined 14 Feb 2024
  [View member →]
  ```
- The "Add member" button is disabled while the duplicate exists.
- The receptionist can either click "View member" (closes sheet, navigates to that member) or change the phone.

This is the **single most valuable UX detail** in this module. Receptionists routinely re-enroll members they don't realize already exist, creating duplicate records that wreck reporting.

**Validation:**
- Inline errors below each field via `react-hook-form` + Zod resolver.
- Server-side validation errors mapped back to specific fields.

**Behavior on submit:**
- If "Add another" is unchecked: success toast → close sheet → revalidatePath, scroll to new member in list, briefly highlight row.
- If "Add another" is checked: success toast "Member added", reset form (keep branch + joined date), focus on Name field.

### Member detail — `/members/[id]`

**Layout:**

Top: page header
- Back arrow
- Member name (text-2xl)
- Subtitle: phone (formatted) · branch · "Joined 12 Mar 2024"
- Right: "Edit" (Sheet, same as Add) + `⋯` menu (Delete, Restore if deleted)

Body: 2-column layout (60/40 on desktop, stacked on mobile)

**Left column:**
- Card: **Profile** — all fields displayed read-only with field labels above values. Empty fields shown as "—" muted.
- Card: **Address & Emergency contact** — same pattern, collapsed if both empty.
- Card: **Notes** — only shown if notes exist.

**Right column:**
- Card: **Current membership** — placeholder card in Module 03: "No active membership. [Enroll in plan]" button. Module 04 wires this fully.
- Card: **Recent payments** — placeholder: "No payments yet." Module 04 populates.
- Card: **Activity log** — last 5 audit entries for this member (member-scoped, e.g., "Profile updated by Vibhu · 2 hours ago"). Renders inline; full log lives in Module 08.

**Delete behavior:**
- Click Delete → AlertDialog: "Delete <Name>? This member will be hidden from lists. You can restore them later from the Deleted tab."
- Confirm → soft-delete → toast "Member deleted" with "Undo" action (5s window) that calls `restoreMember`.

### Global Cmd+K search

Activate the placeholder from Module 01.

Component: `components/layout/global-search.tsx` using shadcn `Command` primitive inside a `Dialog`.

Trigger:
- `Cmd+K` (Mac) / `Ctrl+K` (Win) anywhere in the app.
- Click on the top-bar search input.

Behavior:
- Open dialog with input focused.
- As-you-type, debounced 200ms, calls `globalSearchMembers(query, limit=8)`.
- Results: list of members (name + formatted phone + branch badge).
- Enter or click → navigate to `/members/[id]` and close palette.
- Esc closes.
- Empty state in palette: "Type a name or phone number".
- No results: "No members match '<query>'".

For Module 03, search only members. Future modules can add other entity types (plans, payments) to the same palette.

### Density toggle

Stored in `localStorage.gym-app:member-density` as `"comfortable" | "dense"`. Hydrate on mount; default `comfortable`.

Switching density should not refetch — pure CSS swap.

---

## 3.7 CSV Import

This is the migration story. Owners coming from Gymshim, Excel, or pen-and-paper need this to work flawlessly. **Treat it as a first-class feature, not a utility.**

### Flow

`/members/import` (full-screen wizard, not a sheet — too much to fit).

**Step 1 — Upload**
- Big dropzone: "Drag CSV file here or click to browse".
- Accept: `.csv` only; max 5 MB; max 10,000 rows.
- Below dropzone: "Need a template?" link → downloads `members-import-template.csv` with example rows.

Template columns (in order):
```
name,phone,email,gender,dob,address,emergency_contact_name,emergency_contact_phone,joined_date,branch,notes
```

- `branch` column: text matching branch name. If user has only 1 branch, column is optional and defaults to that branch. If user has multiple branches and column is missing, validation fails with clear message.
- `dob` and `joined_date` accept `YYYY-MM-DD` or `DD/MM/YYYY` (auto-detect).
- `gender` accepts `male/female/other/prefer_not_to_say` case-insensitive, plus `M/F` shortcuts.

**Step 2 — Map & preview**
After upload, parse the CSV (via PapaParse, install: `pnpm add papaparse @types/papaparse`).

Show a table with first 20 rows. Each row gets a status:
- ✅ **Valid** — green dot.
- ⚠️ **Warning** — yellow dot — row will import but with a default applied (e.g., "Branch not specified, using Main Branch").
- ❌ **Error** — red dot — row will be skipped. Hover/click to see specific error.
- 🔁 **Duplicate** — blue dot — phone already exists in your gym; row will be skipped.

Summary card above the table:
- "1,243 valid • 12 warnings • 8 errors • 23 duplicates"
- "1,255 will be imported. 31 will be skipped."

Filters above table: All / Valid / Warnings / Errors / Duplicates.

**Per-row error messages** must be specific:
- "Row 47: Phone '12345' is not a valid Indian mobile number"
- "Row 102: Branch 'Connaught Place' not found. Available: Main Branch, Saket Branch"
- "Row 89: Duplicate phone — already in system as 'Rohit Sharma'"

**Step 3 — Confirm**
Bottom bar with "Cancel" and primary "Import 1,255 members".

Confirm dialog: "This will add 1,255 new members. This cannot be undone in bulk; you'll need to delete individually if needed. Continue?"

**Step 4 — Import progress**
Modal with progress bar. Insert in batches of 100 inside transactions (one transaction per batch — safer than one giant transaction).

On completion:
- Success toast: "1,243 members imported successfully. 12 imported with warnings. 31 skipped."
- Redirect to `/members` filtered by today's import (use a temporary tag in the audit log to identify them: `audit_logs` row per imported member with `action='create'` and `after_json.source='csv_import'`; the member list can show "Imported today" filter button if any imports happened in last 24h — nice-to-have, can defer).

### Implementation notes
- Parse client-side via PapaParse with `header: true, skipEmptyLines: true, dynamicTyping: false`.
- Validate per row using a CSV-specific schema (`memberCsvRowSchema`) that's more lenient (handles "M" → "male", "12/03/1990" → "1990-03-12", etc.) but still strict enough to catch real errors.
- **All validation happens client-side first** for instant feedback. Server re-validates on import (defense in depth).
- Import uses a Server Action that takes the validated rows array and inserts in batches.
- Show inline progress via streaming or simple polling — for 1,000 rows it'll complete in 5-10 seconds, simple optimistic UI is fine.
- Audit log: one entry per imported member (yes, this means 1,000 audit rows for a 1,000-member import — acceptable; this is forever-data and storage is cheap).

### Out of scope for v1
- Re-import / sync (treat each import as one-shot).
- Updating existing members via CSV.
- Field mapping UI (fixed column order — keep simple).
- Import undo (the 31-skip warning is your protection).

---

## 3.8 Excel Export

"Export" button on `/members` triggers download of currently-filtered members as `.xlsx`.

Implementation:
- Client-side via SheetJS (already installed).
- Column order matches CSV import template (so the export can be re-imported elsewhere).
- File name: `members-<gym-name>-<YYYY-MM-DD>.xlsx`.
- If filter is "Active" → file name includes `-active`. Same for branch filter.
- Show toast on success: "Exported 412 members".

If export size > 5,000 rows, show a confirmation toast first ("Exporting 5,432 members. This may take a few seconds…") to set expectation.

---

## 3.9 Acceptance Criteria

- [ ] Migration runs cleanly. `pg_trgm` extension created.
- [ ] RLS verified: Tenant A's owner cannot SELECT Tenant B's members (via `scripts/test-rls.ts` which is now extended for members).
- [ ] Branch scoping verified: Branch Manager B cannot see Branch A's members; Owner sees both.
- [ ] Add member: receptionist completes name + phone in <30 seconds, member appears in list immediately.
- [ ] Duplicate phone detection works: typing existing phone shows inline alert with link to existing member.
- [ ] Phone normalization: `9876543210`, `+91 98765 43210`, `0989-765-4321` (invalid mobile prefix) handled correctly.
- [ ] Search by partial name returns trigram-matched results (e.g., "rohit" matches "Rohit Sharma" and "Rohitash Singh").
- [ ] Search by partial phone (last 4 digits) returns matches.
- [ ] Cmd+K opens search palette anywhere in app; Enter navigates to member.
- [ ] CSV import: download template, fill 50 rows including 5 invalid + 3 duplicates, import preview shows correct status per row, valid rows import successfully.
- [ ] CSV import: branch matched by name; clear error if branch name doesn't match.
- [ ] Excel export of filtered list downloads valid `.xlsx` openable in Excel/Google Sheets.
- [ ] Soft-delete: deleted members hidden from default view, visible in "Deleted" tab (Owner only), can be restored.
- [ ] Receptionist cannot see Delete option in member detail menu.
- [ ] Member detail page renders all sections; placeholder cards for membership/payments don't crash.
- [ ] Density toggle works and persists across page refreshes.
- [ ] Mobile (375px width): list scrolls horizontally if needed; member detail stacks; sheet form is usable; CSV import wizard usable but non-priority.
- [ ] Lighthouse perf ≥ 90 on `/members` with 100 members loaded.
- [ ] All audit log entries written for create / update / delete / restore / import.
- [ ] No `any` types, no `console.log`, no TODOs.

---

## 3.10 Files Created in This Module

```
lib/db/schema/members.ts
lib/db/migrations/0002_members.sql
lib/utils/phone.ts
lib/utils/phone.test.ts                              (recommended: write a few unit tests for normalizeIndianPhone — small surface area, high impact)

server/queries/members/list-members.ts
server/queries/members/get-member.ts
server/queries/members/find-by-phone-in-gym.ts
server/queries/members/global-search-members.ts

server/actions/members/create-member.ts
server/actions/members/update-member.ts
server/actions/members/soft-delete-member.ts
server/actions/members/restore-member.ts
server/actions/members/import-members.ts             (called by import wizard step 3)

server/services/members-import.ts                    (validation + batch insertion logic)

app/(app)/members/page.tsx                           (list)
app/(app)/members/[id]/page.tsx                      (detail)
app/(app)/members/import/page.tsx                    (wizard)
app/(app)/members/_components/members-table.tsx
app/(app)/members/_components/members-filters.tsx
app/(app)/members/_components/member-form-sheet.tsx
app/(app)/members/_components/member-profile-card.tsx
app/(app)/members/_components/member-membership-card.tsx     (placeholder; Module 04 fills)
app/(app)/members/_components/member-payments-card.tsx       (placeholder; Module 04 fills)
app/(app)/members/_components/member-activity-card.tsx
app/(app)/members/import/_components/import-uploader.tsx
app/(app)/members/import/_components/import-preview.tsx
app/(app)/members/import/_components/import-progress.tsx

components/layout/global-search.tsx                  (activates Cmd+K)
components/layout/page-header.tsx                    (reusable; future modules use this)
components/shared/phone-input.tsx                    (wraps Input + normalization hint)
components/shared/density-toggle.tsx
components/shared/empty-state.tsx                    (already exists from Module 02; extend if needed)
components/shared/excel-export-button.tsx            (reusable for future modules)

scripts/test-rls.ts                                  (extend with members tests)

public/templates/members-import-template.csv
```

---

## 3.11 Common Pitfalls

1. **Don't trust client-side phone normalization alone.** The Zod refinement re-runs server-side via the same util. Same code path = no surprises.
2. **`pg_trgm` extension must be in the migration**, not assumed. Always `CREATE EXTENSION IF NOT EXISTS pg_trgm;` at the top of the SQL.
3. **Trigram indexes are huge**. They roughly double the row size in the index. For 10k members it's nothing; for 1M it matters. Acceptable for v1; revisit at scale.
4. **`updated_at` trigger.** Add a Postgres trigger that updates `updated_at` on every UPDATE (do this once for `members`, copy the pattern for future tables in Modules 04+):
   ```sql
   create or replace function set_updated_at()
   returns trigger language plpgsql as $$
   begin new.updated_at = now(); return new; end;
   $$;
   create trigger members_updated_at before update on members
     for each row execute function set_updated_at();
   ```
5. **Duplicate phone in CSV import**: check against (a) existing DB rows AND (b) other rows in the same CSV upload. The latter is easy to forget — two rows with same phone in the CSV would both try to insert, second fails on unique constraint.
6. **Branch matching in CSV is case-insensitive and trim-aware.** "main branch", "Main Branch", "MAIN BRANCH ", "main  branch" should all match. Build a `normalizeBranchName` helper.
7. **PapaParse on huge files**: parse in worker mode (`worker: true`) for files > 1 MB. Otherwise UI freezes during parsing.
8. **Cmd+K conflicts**: don't trigger when user is typing in an input or textarea. Standard pattern via `cmdk` library (which shadcn Command uses internally) handles this — verify it works.
9. **The "Add another" pattern is critical**. Receptionists doing morning intake will add 5-10 members in a row. Without "Add another", they have to reopen the sheet 10 times. This pattern is invisible until used, then beloved.
10. **Don't auto-focus name field on every render** — only on initial open of the sheet. Auto-focus on re-renders steals focus from other UI.

---

## 3.12 What's Next

Module 04 — Enrollment & Payment. The revenue loop. Connects members (this module) to plans (Module 02) via memberships and payments. The single most important business logic in the entire app. Slow down significantly there.
