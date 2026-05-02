# Module 05 — Today's View (Home Dashboard)

> The first screen every user sees. Owners and receptionists open this 20+ times a day. It's the screen that decides whether your product *feels* like a tool that earns its keep — or a vanity dashboard. Build for ruthless utility, not impressiveness.

**Estimated time:** 1.5–2 days.
**Outcome:** A receptionist opening the app at 10 AM knows in 5 seconds what to do today. An owner opening it at 9 PM knows in 5 seconds whether the day went well.

This is the **sellable demo screen.** After this ships, you have an MVP you can put in front of real gym owners.

---

## 5.1 Scope

In:
- New home route `/` (or `/today`) replacing whatever placeholder is currently there.
- Hero metric strip: 4 cards with today's snapshot.
- "Expiring soon" actionable list (next 14 days).
- "Recently expired" actionable list (last 30 days).
- "Enrolled today" list (today's enrollments).
- Inline WhatsApp + Call buttons per row.
- Reminder status tracking (lightweight; powers Pro-tier later).
- Role-aware rendering: owner sees revenue + everything, receptionist sees lists only.
- Branch-aware rendering: branch-scoped users see only their branch's data.
- Last refreshed timestamp + manual refresh button.
- Empty states for each card.
- Mobile-friendly (this is the one screen receptionists might check on phone).

Out:
- Charts of any kind.
- Customizable dashboard layout (defer to settings post-v1).
- Live realtime updates (use revalidate + manual refresh).
- "Quick actions" buttons (sidebar covers nav; member detail is one click away).
- Comparison periods beyond yesterday/this month (granular reports live in Module 07).
- Push notifications (deferred to notifications module).
- Multi-day forecast / trend lines.

---

## 5.2 Information Architecture

**Two audiences, one layout.** The screen must serve both without becoming bloated.

| Section | Owner sees | Branch Manager sees | Receptionist sees |
|---|---|---|---|
| Hero metrics | All 4 cards (incl. revenue) | All 4, scoped to branch | 3 cards (no revenue) |
| Expiring soon | Across all branches | Branch only | Branch only |
| Recently expired | Across all branches | Branch only | Branch only |
| Enrolled today | Across all branches | Branch only | Branch only, with their own activity highlighted |

The screen's *structure* is identical for all roles — only the content scope and revenue visibility differ. This is intentional: training gym staff on "this is the home screen" should be a 30-second explanation, not a role-specific tour.

---

## 5.3 Layout

### Desktop (≥ 1024px)

```
┌──────────────────────────────────────────────────────────────────────┐
│  Today                                                       [Refresh]│
│  Friday, 1 May 2026 · Main Branch                  Updated 2 min ago │
├──────────────────────────────────────────────────────────────────────┤
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐        │
│  │ ₹12,500    │ │ 4          │ │ 18         │ │ 2          │        │
│  │ collected  │ │ new        │ │ expiring   │ │ frozen     │        │
│  │ today      │ │ today      │ │ in 14 days │ │ now        │        │
│  │            │ │            │ │            │ │            │        │
│  │ ↑ ₹3,200   │ │ ↑ from 2   │ │ 4 in 7d    │ │            │        │
│  │ vs yest.   │ │            │ │            │ │            │        │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘        │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────┐  ┌──────────────────────────────────┐
│  Expiring soon              18  │  │  Recently expired             6  │
│  Next 14 days                   │  │  Last 30 days                    │
│ ───────────────────────────────  │  │ ───────────────────────────────  │
│  Priya Patel                    │  │  Rohit Sharma                    │
│  +91 87654 32109                │  │  +91 98765 43210                 │
│  Half Yearly · Ends in 3 days   │  │  Quarterly · Expired 12 days ago │
│  ⚪ Not contacted yet            │  │  🟡 Reminded 2 days ago          │
│  [WhatsApp]  [Call]    [View →] │  │  [WhatsApp]  [Call]    [View →]  │
│ ───────────────────────────────  │  │ ───────────────────────────────  │
│  Sneha Reddy                    │  │  Amit Kumar                      │
│  ...                            │  │  ...                             │
│ ───────────────────────────────  │  │ ───────────────────────────────  │
│   (3 more rows shown)           │  │   (3 more rows shown)            │
│                                 │  │                                  │
│  [Show all 18 →]                │  │  [Show all 6 →]                  │
└──────────────────────────────────┘  └──────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│  Enrolled today                                                  4   │
│ ──────────────────────────────────────────────────────────────────── │
│  Vibhu Dawar                Half Yearly         ₹10,000   10:15 AM   │
│  +91 81783 62985            New member          Cash      by Vibhu D │
│  ──────────────────────────────────────────────────────────────────  │
│  ... 3 more rows                                                     │
└──────────────────────────────────────────────────────────────────────┘
```

### Mobile (< 768px)

Single-column stack:
1. Hero metrics in a 2x2 grid (smaller cards).
2. Expiring soon (full-width).
3. Recently expired (full-width).
4. Enrolled today (compact list).

### Tablet (768–1023px)

Hero metrics single row (4 cards), action lists stack to single column.

---

## 5.4 Hero Metric Cards

### Visual rules
- Generous padding (`p-6` desktop, `p-4` mobile).
- Big number (`text-3xl font-semibold tabular-nums`), label below (`text-sm text-muted-foreground`).
- Comparison line (`text-xs text-muted-foreground`), with subtle arrow icon and percentage if relevant.
- Card height matches across the row (use `h-full` + grid).
- No icons in the card — number IS the visual. Icons add noise.
- No colored backgrounds — neutral cards. Color reserved for status indicators in lists.

### The 4 cards

#### Card 1 — Revenue today (Owner & Branch Manager only)
- **Big number:** Net revenue today, formatted Indian (`₹12,500`, `₹4.2L`).
  - Net = SUM(payments) − SUM(refunds), where date = today.
- **Label:** "Collected today" (changes to "Collected this week" if user toggles? — *no, don't add toggles in v1*; keep it daily).
- **Comparison:** "↑ ₹3,200 vs yesterday" or "↓ ₹1,500 vs yesterday".
  - Green for positive, red for negative, neutral for zero.
  - Yesterday = previous calendar day (not 24h ago).
- **Click:** navigates to `/payments?date=today` (filtered).

#### Card 2 — New enrollments today
- **Big number:** Count of memberships created today.
- **Label:** "New today".
- **Comparison:** "↑ from 2 yesterday" or just "Same as yesterday" / "↓ from 6".
- **Click:** scrolls to "Enrolled today" section below.

#### Card 3 — Expiring soon (next 14 days)
- **Big number:** Count of memberships ending in next 14 days (effective_status logic).
- **Label:** "Expiring in 14 days".
- **Sub-line:** "X in 7 days · Y in 3 days" — drilling-down breakdown.
- **Click:** scrolls to "Expiring soon" section.

#### Card 4 — Frozen now
- **Big number:** Count of memberships currently in `effective_status = 'frozen'`.
- **Label:** "Frozen now".
- **Sub-line:** "Resuming in next 7 days: X" if any; else hide the line.
- **Click:** navigates to `/members?status=frozen`.

### What I removed and why
- No "Total members" card — too vague. "Active members" is the right number, but it overlaps with the membership filters on `/members`. Not earning its place here.
- No "Refunds today" card — refund volume is rare; surfacing it daily is alarmist. Lives in reports (Module 07).
- No "Expired members in last 7 days" card — already covered by the Recently Expired list below.

### Card visibility for receptionist
- Card 1 (Revenue) → hidden entirely. The slot collapses (cards re-flow to 3 across, evenly spaced).
- Cards 2, 3, 4 → visible as-is.

---

## 5.5 Action Lists

These are the heart of the screen. Owners and receptionists *do* things from here.

### Common row component — `<MemberActionRow />`

Each row in both lists shares this structure:

```
┌──────────────────────────────────────────────────────┐
│  Vibhu Dawar                                         │
│  +91 81783 62985                                     │
│  Half Yearly · Ends in 3 days                        │
│  ⚪ Not contacted yet                                 │
│  [WhatsApp]  [Call]                       [View →]   │
└──────────────────────────────────────────────────────┘
```

**Components from top to bottom:**
1. Member name (`font-medium`).
2. Phone (`text-xs text-muted-foreground`, click to copy).
3. Plan + status line (`text-sm`).
4. Reminder status indicator (see § 5.6).
5. Action buttons row.

### Action buttons

#### `[WhatsApp]` button
- Opens `https://wa.me/{phone}?text={template}` in a new tab.
- Phone is the member's E.164 stripped of `+`.
- Template is pre-filled, role-tagged. Examples:

For expiring soon:
```
Hi Vibhu, this is a reminder that your Half Yearly membership at Zenith Fitness ends on 04 May 2026 (in 3 days). Please drop by to renew at your convenience. - Zenith Fitness, Main Branch
```

For recently expired:
```
Hi Vibhu, your Half Yearly membership at Zenith Fitness expired on 18 Apr 2026. We'd love to have you back — drop by anytime to renew. - Zenith Fitness, Main Branch
```

Templates live in `lib/notifications/templates.ts`. Owner-customizable later (deferred); v1 hardcoded with gym name + branch name interpolated server-side.

**On click:** opens WhatsApp AND optimistically updates the reminder status (see § 5.6).

#### `[Call]` button
- `tel:{phone}` link. Opens phone dialer on mobile, default app on desktop.
- Doesn't update reminder status (calling isn't trackable; only WhatsApp click is).

#### `[View →]` button
- Navigates to `/members/[id]`.

### Empty states

For each list:
- **Expiring soon empty:** "🎉 No memberships ending in the next 14 days." (Single line, centered, muted.)
- **Recently expired empty:** "No expirations in the last 30 days. All your members are up to date."
- These empty states are *good news.* Acknowledge it briefly; don't make them feel like a missing feature.

### "Show all" link

If list has more than 5 rows, show first 5 + "Show all 18 →" link at bottom that navigates to `/members?status=expiring_soon` (or `expired`). The destination page reuses the existing members list with that filter pre-applied.

---

## 5.6 Reminder Status (lightweight tracking)

This is the seed for Module 10's Pro-tier WhatsApp automation. For Module 05, we just track and display.

### Schema — already specced in Module 04 (`reminders` table)

Confirm the table exists. It should look like:
```
reminders:
  id, gym_id, member_id, membership_id,
  type ('renewal_14d' | 'renewal_7d' | 'renewal_3d' | 'lapsed_7d' | 'lapsed_30d' | 'win_back'),
  sent_at, channel ('whatsapp_manual' | 'whatsapp_api' | 'sms' | 'manual'),
  status ('contacted' | 'responded' | 'paid' | 'lapsed'),
  notes, created_by_user_id, created_at
```

For Module 05, we only use:
- `channel = 'whatsapp_manual'` (the wa.me click) or `channel = 'manual'` (call/in-person)
- `status = 'contacted'` (only one status flow in Module 05; richer flow in Module 10)

### Indicator in row

```
⚪ Not contacted yet              (gray dot, neutral text)
🟡 Reminded 2 days ago             (amber dot, "Reminded {relativeTime}")
🟢 Reminded today                  (green dot, recent)
```

If multiple reminders sent, show the most recent.

### Behavior on WhatsApp click

When user clicks `[WhatsApp]`:
1. Open WhatsApp link in new tab.
2. Optimistically: insert a `reminders` row with `channel = 'whatsapp_manual'`, `status = 'contacted'`, `created_by_user_id = current user`.
3. Update the row's indicator to "🟢 Reminded just now" — visible on screen immediately.
4. The current user has effectively "marked as contacted" by the act of sending. Don't add a separate "Mark as contacted" button — that's a duplicate click for the same intent.

### Manual mark-as-contacted

Inside the row's `⋯` menu (subtle, top-right of row), allow:
- "Mark as contacted manually" — for in-person or phone follow-ups.
- "Reset" — clears the latest reminder (rare; mostly for fixing mistakes).

These are not primary CTAs; the WhatsApp button covers 90% of cases.

---

## 5.7 "Enrolled Today" Section

A compact list at the bottom showing today's enrollments — not a card grid, just rows.

| Column | Notes |
|---|---|
| Member name + phone | name in `font-medium`, phone muted |
| Plan name | "Half Yearly" or "New member" badge if first enrollment |
| Amount | right-aligned, `tabular-nums` |
| Payment mode | small badge ("Cash", "UPI", etc.) |
| Time + Receptionist | "10:15 AM · by Priya Sharma" |

- Click row → navigates to that membership/payment.
- Receptionists see this list with their own enrollments highlighted (subtle: `bg-blue-50/30` row background).
- Empty state: "No enrollments yet today."
- Maximum 10 rows shown; "Show all 23 today →" link if more.

---

## 5.8 Server Layer

### `server/queries/today/get-today-snapshot.ts`

Single function, single page query. Returns everything Today's View needs in one shot.

```ts
type TodaySnapshot = {
  asOf: Date;                          // server time when computed
  branchId: string | null;             // null if owner with no branch filter
  branchName: string | null;           // for header display
  metrics: {
    revenueTodayPaise: number;
    revenueYesterdayPaise: number;     // for comparison
    enrollmentsToday: number;
    enrollmentsYesterday: number;
    expiringIn14d: number;
    expiringIn7d: number;
    expiringIn3d: number;
    frozenNow: number;
    resumingIn7d: number;
  };
  expiringSoon: ActionRow[];           // limit 5
  expiringSoonTotal: number;
  recentlyExpired: ActionRow[];        // limit 5
  recentlyExpiredTotal: number;
  enrolledToday: EnrollmentRow[];      // limit 10
  enrolledTodayTotal: number;
};

type ActionRow = {
  member_id: string;
  member_name: string;
  member_phone: string;
  plan_name: string;
  end_date: string;                    // YYYY-MM-DD
  daysFromToday: number;               // negative if expired
  latest_reminder?: {
    sent_at: Date;
    channel: string;
    status: string;
  };
};

type EnrollmentRow = {
  membership_id: string;
  member_id: string;
  member_name: string;
  member_phone: string;
  plan_name: string;
  is_first_enrollment: boolean;
  amount_paise: number;
  payment_mode: string;
  enrolled_at: Date;
  enrolled_by_user_name: string;
};
```

### Implementation notes

- Build this as **one function** that runs ~6 queries in parallel (`Promise.all`). Each query is a single SELECT — no N+1.
- Use the `memberships_with_status` view for the expiring/expired filters.
- Cache in memory per-request only; don't add Redis or database-side caching for v1.
- For revenue: SUM(payments.amount_paise) where date = today. Refunds are negative-amount payments (per Module 04 invariant), so SUM works directly.
- For yesterday's revenue: same query, date = yesterday.
- Time zone: all "today" / "yesterday" derived from IST. Use `date-fns-tz` to convert server time correctly.
- Filter all queries by gym_id always; by branch_id if user is non-owner.

### Performance target
- All queries combined: ≤ 200ms on a gym with 5,000 members and 10,000 historical memberships.
- Add an index on `payments(gym_id, payment_date)` if not already present (Module 04 should have it).
- Add an index on `memberships(gym_id, end_date) where deleted_at is null` (Module 04 partial index covers this).

### `server/actions/reminders/record-reminder.ts`

Used by the WhatsApp click handler.
```ts
recordReminder({
  member_id: string,
  membership_id: string,
  type: 'renewal_14d' | 'renewal_7d' | 'renewal_3d' | 'lapsed_7d' | 'lapsed_30d',
  channel: 'whatsapp_manual' | 'manual',
  notes?: string,
}): Promise<{ ok: true } | { ok: false, error: string }>
```

Determines `type` server-side from the membership's days-to-expiry (don't trust client to send the right type). Inserts row, returns ok.

---

## 5.9 UI

### File structure

```
app/(app)/page.tsx                                        # Today's View root
app/(app)/_components/today/header.tsx                    # title + date + refresh
app/(app)/_components/today/metric-card.tsx               # the hero card primitive
app/(app)/_components/today/metric-grid.tsx               # the 4-card row
app/(app)/_components/today/action-list.tsx               # the expiring/expired card
app/(app)/_components/today/action-row.tsx                # single row in action list
app/(app)/_components/today/whatsapp-button.tsx           # the action button (handles record + open)
app/(app)/_components/today/call-button.tsx
app/(app)/_components/today/reminder-indicator.tsx        # the dot + relative time
app/(app)/_components/today/enrolled-today.tsx            # bottom section

server/queries/today/get-today-snapshot.ts
server/actions/reminders/record-reminder.ts

lib/notifications/templates.ts                            # WhatsApp message templates
lib/utils/relative-time.ts                                # "2 days ago" formatter (date-fns)
```

### Page composition

`app/(app)/page.tsx` is a **Server Component**. It calls `getTodaySnapshot()` and passes data down. Only the WhatsApp button, call button, refresh button, and `⋯` menus are client components.

```tsx
export default async function TodayPage() {
  const user = await requireUser();
  const snapshot = await getTodaySnapshot({
    gymId: user.gymId,
    branchId: user.role === 'owner' ? null : user.branchId,
  });

  return (
    <div className="space-y-6">
      <TodayHeader asOf={snapshot.asOf} branchName={snapshot.branchName} />
      <MetricGrid snapshot={snapshot} userRole={user.role} />
      <div className="grid gap-6 lg:grid-cols-2">
        <ActionList kind="expiring" rows={snapshot.expiringSoon} total={snapshot.expiringSoonTotal} />
        <ActionList kind="expired" rows={snapshot.recentlyExpired} total={snapshot.recentlyExpiredTotal} />
      </div>
      <EnrolledToday rows={snapshot.enrolledToday} total={snapshot.enrolledTodayTotal} />
    </div>
  );
}
```

### Refresh behavior

- "Refresh" button in header triggers `router.refresh()` (Next.js, refetches RSC).
- "Updated 2 min ago" timestamp updates client-side every 30 seconds (a small `useEffect` interval; not a network call, just relative-time formatting).
- After 10 minutes of being on the page, show a subtle nudge near the timestamp: "Showing data from 11 min ago. Refresh?"
- No auto-refresh. Owners check this screen actively; auto-refresh is jarring and wastes server cycles.

### Loading state

This is a Server Component, so loading is server-side. Add `app/(app)/loading.tsx` with the same layout as the page but using skeletons for each section. Three sections of skeleton:
- 4 skeleton metric cards.
- 2 skeleton action lists.
- 1 skeleton enrolled-today section.

### Mobile considerations

- Hero grid: 2x2 instead of 1x4.
- Action lists: stack vertically.
- Action buttons inside rows: keep `[WhatsApp]` and `[Call]` always visible; `[View →]` collapsed into row click.
- Enrolled today: same compact rows, no time column on mobile (saves space).

---

## 5.10 Acceptance Criteria

### Layout & rendering
- [ ] Page renders with all 4 sections (header, metrics, two action lists, enrolled today) for owner.
- [ ] Receptionist sees same layout but no Revenue card; metric grid re-flows to 3 cards.
- [ ] Branch Manager sees data scoped to their branch only.
- [ ] All counts and revenue figures are correct (verify against `/members` and `/payments` lists).
- [ ] Mobile (375px): single column layout, metric cards in 2x2 grid, all interactive elements thumb-reachable.
- [ ] Lighthouse perf ≥ 90 on home page with 1,000 members in DB.

### Hero metrics
- [ ] Revenue today calculates correctly (payments minus refunds, IST-anchored).
- [ ] Comparison to yesterday with arrow + percentage.
- [ ] All numbers use Indian numbering (`₹4.7L`, not `₹470,000`).
- [ ] Click on each card navigates correctly (revenue → payments filter; expiring → in-page anchor; etc.).
- [ ] Frozen card hides sub-line if no resumes in next 7 days.
- [ ] On a gym with zero members, all metrics show `0` cleanly without errors.

### Action lists
- [ ] Expiring soon shows correct members (effective_status = active, end_date in next 14 days).
- [ ] Sorted by days remaining (most urgent first).
- [ ] Recently expired: members with end_date in last 30 days.
- [ ] Sorted by recency of expiry (most recent first).
- [ ] WhatsApp button opens correctly formatted wa.me link in new tab.
- [ ] WhatsApp template includes member name, gym name, branch name, dates.
- [ ] Clicking WhatsApp records a reminder row + updates indicator to "Reminded just now."
- [ ] Reminder indicator displays correct relative time ("2 days ago", "Yesterday").
- [ ] Call button opens `tel:` link.
- [ ] View button navigates to member detail.
- [ ] "Show all 18 →" link works, navigates to filtered members list.
- [ ] Empty states render correctly when no expiring/expired members.

### Enrolled today
- [ ] Lists today's enrollments only (not yesterday's, not all history).
- [ ] Receptionist's own enrollments highlighted with subtle background.
- [ ] Receptionist sees all enrollments at their branch (not just theirs) — but theirs are highlighted.
- [ ] Click row → navigates to membership.
- [ ] "Show all" link if more than 10.

### Refresh
- [ ] Manual refresh button works (RSC refetch).
- [ ] Timestamp shows "Updated X ago" and updates client-side.
- [ ] After 10 min, nudge appears.
- [ ] No automatic background refresh.

### RLS
- [ ] Re-run `scripts/test-rls.ts` — Tenant A's revenue data not leakable to Tenant B (already ensured by existing RLS, but confirm).
- [ ] Branch Manager can't see other branches' rows in any of the lists.

### Performance
- [ ] `getTodaySnapshot()` single call returns in <200ms with 5,000-member dataset.
- [ ] No N+1 — confirm by enabling Drizzle query logging temporarily and counting queries.

---

## 5.11 Files Created in This Module

```
app/(app)/page.tsx                                          # NEW (replaces existing placeholder)
app/(app)/loading.tsx                                       # NEW
app/(app)/_components/today/today-header.tsx
app/(app)/_components/today/metric-card.tsx
app/(app)/_components/today/metric-grid.tsx
app/(app)/_components/today/action-list.tsx
app/(app)/_components/today/action-row.tsx
app/(app)/_components/today/whatsapp-button.tsx
app/(app)/_components/today/call-button.tsx
app/(app)/_components/today/reminder-indicator.tsx
app/(app)/_components/today/enrolled-today.tsx

server/queries/today/get-today-snapshot.ts
server/actions/reminders/record-reminder.ts

lib/notifications/templates.ts
lib/utils/relative-time.ts                                  # if not already present from earlier modules
```

If `reminders` schema doesn't exist yet (it was specced in Module 04 but might have been deferred), include it in this module:
```
lib/db/schema/reminders.ts                                  # NEW (if not present)
lib/db/migrations/0005_reminders.sql                        # NEW (if not present)
```

---

## 5.12 Common Pitfalls

1. **Don't add charts.** It's tempting. The screen will look "more designy" with a small sparkline on each metric card. Resist. Charts on operational dashboards are vanity. Numbers + lists win.

2. **Don't add icons to metric cards.** Receptionists scan numbers fast; icons add visual noise. The number IS the visual.

3. **The reminder system is intentionally lightweight.** Don't over-engineer with multiple statuses, follow-up scheduling, etc. Module 10 builds the rich version. Module 05 just records "contacted, when, by whom" so Module 10 has a foundation.

4. **WhatsApp button uses `wa.me`, not Business API.** The Business API is Module 10. v1 just opens WhatsApp Web with a pre-filled message. The user clicks Send themselves.

5. **Don't auto-refresh.** It's tempting. Don't. Users are looking at this screen; movement under their cursor is jarring. Manual refresh is the right pattern. The timestamp aging serves as the "is this stale?" cue.

6. **Time zone discipline.** "Today's revenue" must be IST-anchored, not UTC. A payment received at 11:55 PM IST should be in today's count, not yesterday's. Use `date-fns-tz` consistently. This is the kind of bug that's invisible until accounting time.

7. **Receptionist's own activity highlight is subtle.** Don't make it `bg-blue-100` or louder. `bg-blue-50/30` (very faint blue tint) signals "this is yours" without being decorative.

8. **The 4-card metric grid must re-flow correctly when a card is hidden.** When receptionist views the page, the Revenue card is gone; the remaining 3 cards must redistribute evenly, not leave a blank slot. Use CSS grid with `auto-fit` or conditionally render.

9. **Don't include "average ticket size" or other derived metrics.** They feel insightful but require explanation. v1 sticks to raw numbers an operator can verify against their own intuition.

10. **Empty states should not be defensive.** "No members expiring in 14 days 🎉" is correct framing — it's good news. Don't say "Add members to see them here" (the user already knows what to do).

---

## 5.13 What's Next

After Module 05 ships, you have a sellable MVP. Strongly consider this:

**Pause Modules 06–10. Demo to one real gym owner.** Specifically, your old gym's owner — the one who currently uses paper register. Spend 30 minutes walking him through the flow: he adds 5 members, enrolls 3, sees them on Today's View, clicks WhatsApp on an expiring one. Watch his face. Listen to what he asks about. That feedback is more valuable than any feature in Modules 06–10.

If feedback validates the direction → Modules 06 (freeze), 07 (reports), 08 (audit log), 09 (PDF invoice), 10 (WhatsApp Pro) in that order.

If feedback says "I need X" that you didn't anticipate → re-prioritize. Better to know now than after building 4 more modules.

The point of building lean was specifically to enable this checkpoint. Don't skip it.
