# Module 07 — Reports & Exports

> The "show me the money" view. Where owners go when they need answers about the business — revenue trends, which plans are selling, where discount leakage is happening. Not a dashboard. Not real-time. Just clean filterable analytical reports that load fast and export cleanly to Excel.

**Estimated time:** 2 days.
**Outcome:** Owner can answer "where is my money going?" in under 30 seconds. Three reports, two charts, every view exportable to Excel for the CA.

---

## 7.1 Scope

In:
- `/reports` page with tabs: Revenue · Plans · Discounts.
- Date range filter (default: this month) common to all tabs.
- Branch filter (Owner only — Branch Manager is auto-scoped).
- Revenue report: daily breakdown table + revenue-by-date bar chart + summary numbers.
- Plan-wise sales report: plan + count + total revenue + average discount per plan + horizontal bar chart.
- Discount leakage report: total discount given, count of discounted enrollments, top discount-givers (which receptionist/manager), discount reasons.
- Excel export per tab.
- All reports respect role and branch scoping.
- Receptionist redirected away from `/reports`.

Out:
- Staff activity report (deferred to v1.1 — useful for chains, over-engineering for v1).
- Branch comparison report (chains can filter per-branch already; cross-branch comparison is post-v1).
- Retention / churn analytics (needs longer historical data first).
- Custom report builder.
- Scheduled report emails / WhatsApp summaries (deferred until notifications module).
- PDF export (Excel only for v1; CAs work in Excel).
- Year-over-year comparisons (defer until you have a year of data).
- Cohort analysis.

---

## 7.2 The "Pre-built Filters" Pattern

Every report has the same filter bar at top. Users land on this page knowing what they want — "show me last month's revenue" or "this quarter's discounts." Make those one-click.

```
┌─────────────────────────────────────────────────────────────────┐
│ [This month ▾]  [All branches ▾]                  [Export →]    │
└─────────────────────────────────────────────────────────────────┘
```

### Date range presets (single dropdown — shadcn Select with custom trigger)

Options:
- **Today**
- **Yesterday**
- **This week** (Mon–Sun, IST)
- **Last week**
- **This month** (calendar month, default)
- **Last month**
- **This quarter** (Apr–Jun, etc.)
- **Last quarter**
- **This year** (Jan–Dec)
- **Custom range…** (opens date picker for from–to)

The "Custom range…" option opens a popover with two date inputs. After picking, the selector shows "12 Apr – 30 Apr" (formatted range).

URL state: filters live in `searchParams` (`?from=2026-04-01&to=2026-04-30&branch=xyz`). Refreshing or sharing the URL preserves the view.

### Branch filter

- Owner sees: "All branches" + each branch by name.
- Branch Manager sees: just their branch (filter is a static label, not interactive).
- Single-branch gyms: filter hidden entirely.

### Export button

- Click → downloads `.xlsx` with the current tab's data + applied filters.
- Filename: `revenue-{gym-name}-{from}-to-{to}.xlsx` (similar pattern for other tabs).
- File contains the full filtered dataset, not just the visible 50 rows.

---

## 7.3 Tab 1 — Revenue Report (default landing tab)

The most important report. Most-asked question: "How much did I make this period?"

### Page layout

```
┌─────────────────────────────────────────────────────────────────┐
│ [filters]                                          [Export]    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ┌─ Total revenue ──┐ ┌─ Refunds ───┐ ┌─ Net ─────┐ ┌─ Avg/day ┐│
│ │ ₹2,47,500        │ │ ₹8,000      │ │ ₹2,39,500 │ │ ₹7,983    ││
│ │ 47 transactions  │ │ 3 refunds   │ │           │ │ 30 days   ││
│ └──────────────────┘ └─────────────┘ └───────────┘ └───────────┘│
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  Daily revenue                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │     ▌                                                       │ │
│  │   ▌ ▌  ▌                                                    │ │
│  │ ▌ ▌ ▌  ▌  ▌▌                                                │ │
│  │ ▌ ▌ ▌▌ ▌ ▌▌▌  ▌                                             │ │
│  │ ▌ ▌ ▌▌ ▌ ▌▌▌▌ ▌  ▌                                          │ │
│  │ Apr 1   Apr 5   Apr 10   Apr 15  ...  Apr 30                │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  Daily breakdown                                                │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Date        Payments  Refunds   Net      Tx count           │ │
│  │ 30 Apr      ₹12,500   -₹0       ₹12,500    4                │ │
│  │ 29 Apr      ₹8,000    -₹2,000   ₹6,000     3                │ │
│  │ 28 Apr      ₹15,000   -₹0       ₹15,000    5                │ │
│  │ ...                                                          │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Summary cards

Four small cards at top (use the same `MetricCard` primitive from Module 05 amendment v2 — different content, same structure):

| Card | Value | Sub-line |
|---|---|---|
| Total revenue | Sum of all positive payments in range | "X transactions" |
| Refunds | Sum of all refund amounts (absolute value) | "Y refunds" |
| Net | Total - Refunds | (no sub-line) |
| Avg/day | Net ÷ days in range | "X days" |

The Net card has no delta badge (this is reporting, not "today vs yesterday"). Numbers use Indian formatting (`formatMoneyShort` for big values, `formatMoney` for precise).

### Daily revenue chart

Bar chart using Recharts. One bar per day in the range.

- X-axis: dates (formatted "Apr 1", "Apr 2"…). For ranges > 31 days, auto-thin to weekly labels (every 7th).
- Y-axis: net revenue per day in rupees (auto-format axis with K/L for large numbers).
- Bar color: `--primary` (blue).
- Hover tooltip: "Apr 14: ₹12,500 net (₹14,500 paid, ₹2,000 refund)".
- Empty days: shown as 0-height bar (so the date stays on the axis).

```tsx
// Use Recharts ResponsiveContainer; height ~280px desktop
<ResponsiveContainer width="100%" height={280}>
  <BarChart data={dailyData}>
    <XAxis dataKey="date" tickFormatter={shortDate} />
    <YAxis tickFormatter={shortMoney} />
    <Tooltip content={<CustomTooltip />} />
    <Bar dataKey="net" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
  </BarChart>
</ResponsiveContainer>
```

**Don't add a legend.** One series, no legend needed.
**Don't add gridlines.** Less noise. Maybe a single horizontal `--border` line at y=0.
**Don't add an "average" reference line.** Cute but unnecessary.

### Daily breakdown table

shadcn DataTable. Columns:

| Column | Notes |
|---|---|
| Date | Sortable; default DESC (most recent first) |
| Payments | Sum of positive payments that day, right-aligned, tabular |
| Refunds | Sum of refunds (shown as negative with `-` prefix in red), right-aligned |
| Net | Payments + Refunds (note: refunds are negative-signed in DB, so this is just SUM); right-aligned bold |
| Tx count | Count of all payment rows (incl. refunds) |

- One row per day.
- Days with zero activity in the range still appear (gives owner a complete picture; "Apr 17: ₹0, 0 transactions" is information).
- Table is paginated for ranges > 60 days.
- No row click (no detail view; this is summary data).

---

## 7.4 Tab 2 — Plan-wise Sales

Question this answers: "Which plan should I push? Which is selling? Which has the highest margin after discounts?"

### Page layout

```
┌─────────────────────────────────────────────────────────────────┐
│ [filters]                                          [Export]    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Revenue by plan                                                │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Half Yearly     ████████████████████  ₹1,20,000  (12 sold) │ │
│  │ Quarterly       ███████████  ₹65,000  (13 sold)             │ │
│  │ Monthly         █████  ₹28,000  (14 sold)                   │ │
│  │ Annual          ███  ₹15,000  (1 sold)                      │ │
│  │ Trial           ▌  ₹500  (1 sold)                           │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  Plan details                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Plan       Sold  Revenue  Avg ticket  Discount  Net        │ │
│  │ Half Yearly  12   ₹1,20K   ₹10,000     ₹4,500   ₹1,15.5K   │ │
│  │ Quarterly    13   ₹65K     ₹5,000      ₹3,000   ₹62K       │ │
│  │ Monthly      14   ₹28K     ₹2,000      ₹0       ₹28K       │ │
│  │ Annual       1    ₹15K     ₹15,000     ₹0       ₹15K       │ │
│  │ Trial        1    ₹500     ₹500        ₹0       ₹500       │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Horizontal bar chart

One bar per plan, sorted by revenue DESC.
- Bar length proportional to revenue.
- Plan name on Y-axis (left).
- Bar shows revenue + count inline at the end.
- Color: `--primary` for top performer, `--muted-foreground` (lighter blue/gray) for others. Or all blue with varying intensity. **Keep simple** — one color, all bars.

```tsx
<ResponsiveContainer width="100%" height={Math.max(80, plans.length * 50)}>
  <BarChart data={plans} layout="vertical">
    <XAxis type="number" tickFormatter={shortMoney} />
    <YAxis type="category" dataKey="planName" width={120} />
    <Tooltip content={<CustomPlanTooltip />} />
    <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]}>
      <LabelList dataKey="revenueLabel" position="right" />
    </Bar>
  </BarChart>
</ResponsiveContainer>
```

### Details table

| Column | Notes |
|---|---|
| Plan | Plan name. Inactive plans shown with strikethrough (still tracked if they had sales). |
| Sold | Count of memberships created on this plan in range |
| Revenue | Sum of plan_price_paise (gross, before discount) |
| Avg ticket | Revenue / Sold |
| Discount | Sum of discount_paise across these memberships |
| Net | Revenue − Discount (this is what was actually charged) |

- Sortable on every numeric column.
- Default sort: Net DESC (biggest contributor first).
- Click plan name → navigates to `/plans` (filtered if possible).

Note: this report counts **memberships created in range**, not payments received. A renewal in April for a Half Yearly is one Half Yearly sale in April, regardless of when payment was made (which should be the same day in v1 since we don't allow partial payments).

---

## 7.5 Tab 3 — Discount Leakage

This is your secret weapon. **Most gym software doesn't have this.** Indian gyms negotiate every membership; small discounts compound to huge revenue leakage. A receptionist who gives ₹500 off "to close the sale" 10 times a week leaks ₹2.6L a year.

This report tells the owner exactly where the leaks are.

### Page layout

```
┌─────────────────────────────────────────────────────────────────┐
│ [filters]                                          [Export]    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ┌─ Total discount given ─┐ ┌─ % of gross ────┐ ┌─ Avg discount ┐│
│ │ ₹47,500                │ │ 12.3%           │ │ ₹1,254         ││
│ │ across 38 memberships  │ │ of gross revenue│ │ per discounted ││
│ └────────────────────────┘ └─────────────────┘ └───────────────┘│
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  By staff member                                                │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Staff           Discounted  Total given  Avg     % of own  │ │
│  │ Vibhu Dawar     22          ₹28,000      ₹1,272  18.4%     │ │
│  │ Priya Sharma    12          ₹14,500      ₹1,208  9.2%      │ │
│  │ Amit Kumar      4           ₹5,000       ₹1,250  4.5%      │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  All discounted memberships                                     │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Date    Member       Plan        Discount  Reason   By    │ │
│  │ 30 Apr  Rohit Sharma Half Yearly ₹2,000   "Friend"  Vibhu │ │
│  │ 28 Apr  Vibhu Dawar  Quarterly   ₹1,000   "Negotiated" Priya │
│  │ 27 Apr  Amit Kumar   Half Yearly ₹3,500   "Annual contract" Vibhu │
│  │ ...                                                          │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Summary cards

Three cards:

| Card | Value | Sub-line |
|---|---|---|
| Total discount given | Sum of `discount_paise` | "across N memberships" |
| % of gross | Total discount / total plan_price (before discount) | "of gross revenue" |
| Avg discount | Total discount / N (only counting memberships with discount > 0) | "per discounted enrollment" |

These three numbers together tell the story:
- High total + low % = many small discounts (suggests cultural norm).
- Low total + high % = few large discounts (specific high-value deals).
- High avg + high % = receptionists giving away the store.

### By staff member table

Aggregated by who created each membership (`enrolled_by_user_id`).

| Column | Notes |
|---|---|
| Staff | User name |
| Discounted | Count of memberships they enrolled with discount > 0 |
| Total given | Sum of discounts on their enrollments |
| Avg | Total given / Discounted count |
| % of own | Their total discount / their total gross revenue |

Sorted by Total given DESC. The first row is "your most expensive employee" in discount terms.

### All discounted memberships table

The detail level. Every membership with `discount_paise > 0` in the range.

| Column | Notes |
|---|---|
| Date | Membership created_at, sortable |
| Member | Click → member detail |
| Plan | Plan name |
| Discount | Amount given (right-aligned) |
| Reason | The `discount_reason` field (text, truncate to ~60 chars with tooltip for full) |
| By | Who enrolled |

Sortable. Default: Date DESC.

This table is what makes the report actionable. Owner sees "Vibhu gave ₹3,500 off to Amit Kumar with reason 'Annual contract'" — they can verify with Vibhu, with Amit, with their own memory.

---

## 7.6 Server Layer

### Queries — `server/queries/reports/`

Each tab has its own query function. All accept the same filter type:

```ts
type ReportFilters = {
  gymId: string;
  branchId?: string | null;       // null = all branches (owner only)
  fromDate: string;               // YYYY-MM-DD inclusive
  toDate: string;                 // YYYY-MM-DD inclusive
};
```

#### `getRevenueReport(filters)` returns
```ts
type RevenueReport = {
  summary: {
    totalRevenuePaise: number;
    refundsPaise: number;          // positive (absolute value of refund sums)
    netPaise: number;
    transactionCount: number;
    refundCount: number;
    daysInRange: number;
  };
  daily: Array<{
    date: string;                  // YYYY-MM-DD
    paymentsPaise: number;
    refundsPaise: number;
    netPaise: number;
    transactionCount: number;
  }>;                              // one entry per day in range, including zero days
};
```

Implementation: SQL query with `generate_series()` to create a row per date in range, LEFT JOINed against `payments` aggregated by date. This way zero-activity days appear correctly.

#### `getPlanWiseReport(filters)` returns
```ts
type PlanWiseReport = {
  rows: Array<{
    planId: string;
    planName: string;
    isActive: boolean;
    sold: number;
    grossRevenuePaise: number;
    avgTicketPaise: number;
    discountPaise: number;
    netPaise: number;
  }>;
  totals: {
    sold: number;
    grossRevenuePaise: number;
    discountPaise: number;
    netPaise: number;
  };
};
```

Implementation: aggregate from `memberships` filtered by `created_at` in range, joined to `plans`.

#### `getDiscountLeakageReport(filters)` returns
```ts
type DiscountLeakageReport = {
  summary: {
    totalDiscountPaise: number;
    discountedMembershipCount: number;
    totalGrossPaise: number;          // for percentage calc
    avgDiscountPaise: number;
  };
  byStaff: Array<{
    userId: string;
    userName: string;
    discountedCount: number;
    totalDiscountPaise: number;
    avgDiscountPaise: number;
    percentOfOwnRevenue: number;
  }>;
  details: Array<{
    membershipId: string;
    memberId: string;
    memberName: string;
    planName: string;
    createdAt: Date;
    discountPaise: number;
    reason: string | null;
    enrolledByUserName: string;
  }>;
};
```

Note `details` could be large for a busy gym over a year. Cap at 500 rows in the query, paginate in UI. For Excel export, retrieve full set without cap.

### Performance notes

- All three queries should run in <300ms on a gym with 5,000 members and 1 year of data.
- Add indexes if not already present:
  - `payments(gym_id, payment_date)` — already from Module 04.
  - `memberships(gym_id, created_at)` — likely already from Module 04 indexes.
  - `memberships(gym_id, created_at) where discount_paise > 0` — partial index for discount leakage. Add this in Module 07's migration.

### Excel export — `server/queries/reports/export-*.ts`

Each tab has an export function that returns a row-stream usable by `xlsx` (SheetJS) on the client:

```ts
async function exportRevenueReport(filters): Promise<{
  rows: Array<{
    Date: string;
    'Payments (₹)': number;
    'Refunds (₹)': number;
    'Net (₹)': number;
    Transactions: number;
  }>;
  filename: string;
}>;
```

Construct the filename server-side based on filters: `revenue-zenith-fitness-2026-04-01-to-2026-04-30.xlsx`. Sanitize gym name (lowercase, replace spaces with hyphens, strip special chars).

Excel export is **client-driven**: the report page already has the data loaded for display; export reuses the existing query result, formats rows, hands to SheetJS, triggers download. No second server round-trip.

---

## 7.7 UI Implementation

### File structure

```
app/(app)/reports/
  page.tsx                        # Tabs container, default tab = revenue
  layout.tsx                      # role gate (owner / branch_manager only)
  loading.tsx                     # skeleton
  _components/
    report-filters.tsx            # date range + branch selector
    date-range-picker.tsx         # custom popover with presets + custom range
    summary-card.tsx              # reused metric card primitive
    revenue-tab.tsx
    revenue-chart.tsx             # Recharts bar chart
    revenue-table.tsx             # daily breakdown
    plan-wise-tab.tsx
    plan-wise-chart.tsx           # Recharts horizontal bar
    plan-wise-table.tsx
    discount-tab.tsx
    discount-by-staff-table.tsx
    discount-details-table.tsx
    export-button.tsx             # SheetJS-backed download

server/queries/reports/
  get-revenue-report.ts
  get-plan-wise-report.ts
  get-discount-leakage-report.ts
  export-revenue.ts
  export-plan-wise.ts
  export-discount.ts

lib/utils/date-presets.ts         # "this month" → {from, to} resolver
```

### Tab implementation

Use shadcn `Tabs`. URL-aware so refreshing or sharing the URL preserves the tab:

```tsx
const tab = searchParams.get('tab') ?? 'revenue';

<Tabs value={tab} onValueChange={(v) => router.replace(`/reports?tab=${v}&...`)}>
  <TabsList>
    <TabsTrigger value="revenue">Revenue</TabsTrigger>
    <TabsTrigger value="plans">Plans</TabsTrigger>
    <TabsTrigger value="discounts">Discounts</TabsTrigger>
  </TabsList>
  <TabsContent value="revenue"><RevenueTab /></TabsContent>
  <TabsContent value="plans"><PlanWiseTab /></TabsContent>
  <TabsContent value="discounts"><DiscountTab /></TabsContent>
</Tabs>
```

The page is a Server Component. Each tab content is also server-rendered — when the user switches tabs, Next.js fetches the new tab's data via the URL change. No client-side fetching for the tabs themselves.

### Filter state in URL

All filter state lives in URL searchParams:
- `?tab=revenue|plans|discounts`
- `?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `?branch=<uuid>` (if owner)

The filter components push URL updates via `router.replace(...)`. The page re-renders server-side with new filters.

This pattern matches Module 03's members list. Consistent across the app.

### Empty states

For each tab, when the filter range has zero data:
- Revenue tab: "No payments in this period." Single line, centered.
- Plan-wise: "No memberships sold in this period."
- Discounts: "No discounts given in this period." (This is good news; frame neutrally.)

Don't suppress the chart/table — show empty state where the content would be. Filter bar stays visible so user can change range.

### Loading states

Server Component → `loading.tsx` shows skeleton:
- 4 skeleton summary cards.
- 1 skeleton chart (placeholder rectangle).
- 1 skeleton table (8 skeleton rows).

### Mobile

- Filter row stacks: date picker on top, branch below, export below.
- Summary cards: 2x2 grid on tablet, 1-column on phone.
- Chart: shrinks responsively; height min 200px.
- Tables: horizontal scroll if needed (don't truncate columns).

---

## 7.8 Acceptance Criteria

### Routing & permissions
- [ ] `/reports` accessible to Owner and Branch Manager.
- [ ] Receptionist visiting `/reports` redirected to home.
- [ ] Branch Manager sees only their branch's data; branch filter is read-only label.
- [ ] Owner with multi-branch tenant sees branch dropdown with "All branches" option.
- [ ] Owner with single-branch tenant: branch filter hidden.

### Filters
- [ ] All date presets work and update URL params.
- [ ] Custom range picker validates from <= to.
- [ ] URL state preserved on tab switch within same filter range.
- [ ] Filters apply consistently across all 3 tabs.

### Revenue tab
- [ ] Summary cards compute correctly. Cross-check with `/payments` page filtered same range.
- [ ] Daily revenue chart renders. Hover tooltip shows correct values.
- [ ] Days with zero activity show as 0 bar (not missing).
- [ ] Daily breakdown table sorts correctly.
- [ ] Refund column shows negative red values; net column reflects net.
- [ ] Excel export contains all rows (not just visible).

### Plan-wise tab
- [ ] Horizontal bar chart sorted by revenue DESC.
- [ ] Plans with zero sales in range NOT shown (don't pollute the chart).
- [ ] Table includes all sold plans.
- [ ] Inactive plans with sales shown with strikethrough.
- [ ] Sortable on all numeric columns.
- [ ] Numbers reconcile: gross − discount = net (per row, per total).

### Discount tab
- [ ] Summary cards compute correctly. % of gross is total_discount / total_gross_revenue.
- [ ] By-staff table includes only staff who enrolled at least one discounted membership.
- [ ] Details table caps at 500 rows in UI; export includes full set.
- [ ] Reason column shows truncated text with hover for full.
- [ ] Click member name → navigates to member detail.

### Charts
- [ ] Both charts use `--primary` color, no excess decoration.
- [ ] Tooltips show formatted Indian numbers.
- [ ] No legends (single-series charts).
- [ ] Charts responsive; resize on window change.

### Excel export
- [ ] Each tab has working "Export" button.
- [ ] Filename matches pattern `<report>-<gym>-<from>-to-<to>.xlsx`.
- [ ] Downloaded file opens in Excel/Google Sheets without errors.
- [ ] Numbers formatted as numbers (not strings) so Excel can SUM them.
- [ ] For >5000-row exports, button shows toast "Generating file…" until download.

### RLS
- [ ] Cross-tenant data not leakable in any report (verify via test-rls.ts extension).
- [ ] Branch-scoped users genuinely can't see other branches' aggregations.

### General
- [ ] Lighthouse perf ≥ 90 on `/reports` with 1 year of data.
- [ ] No N+1 queries — verify with Drizzle query logging.
- [ ] All 3 tabs load in <500ms on realistic dataset.
- [ ] Mobile: all 3 tabs usable; tables scroll horizontally.
- [ ] No `any` types, no console.logs.

---

## 7.9 Files Created in This Module

```
app/(app)/reports/page.tsx
app/(app)/reports/layout.tsx                          (role gate)
app/(app)/reports/loading.tsx
app/(app)/reports/_components/report-filters.tsx
app/(app)/reports/_components/date-range-picker.tsx
app/(app)/reports/_components/summary-card.tsx
app/(app)/reports/_components/revenue-tab.tsx
app/(app)/reports/_components/revenue-chart.tsx
app/(app)/reports/_components/revenue-table.tsx
app/(app)/reports/_components/plan-wise-tab.tsx
app/(app)/reports/_components/plan-wise-chart.tsx
app/(app)/reports/_components/plan-wise-table.tsx
app/(app)/reports/_components/discount-tab.tsx
app/(app)/reports/_components/discount-by-staff-table.tsx
app/(app)/reports/_components/discount-details-table.tsx
app/(app)/reports/_components/export-button.tsx

server/queries/reports/get-revenue-report.ts
server/queries/reports/get-plan-wise-report.ts
server/queries/reports/get-discount-leakage-report.ts
server/queries/reports/export-revenue.ts
server/queries/reports/export-plan-wise.ts
server/queries/reports/export-discount.ts

lib/utils/date-presets.ts
lib/db/migrations/0007_report_indexes.sql              (partial index on memberships discount > 0)

scripts/test-rls.ts                                    (extend with reports query checks)
```

---

## 7.10 Common Pitfalls

1. **Refunds in revenue math.** Refunds in DB are negative-amount payments (Module 04 invariant). So `SUM(amount_paise)` correctly gives NET. But the summary card "Total revenue" shows GROSS (only positive payments) and "Refunds" shows the absolute sum of negatives. Don't mix the two — be explicit in the SQL: use `WHERE kind = 'payment'` for revenue, `WHERE kind = 'refund'` for refunds.

2. **`generate_series` for date-aware aggregations.** Days with zero payments must show as 0 bars, not missing. `generate_series(from_date, to_date, '1 day'::interval)` LEFT JOIN payments aggregated by date. Without this, the chart will have visual gaps that the user reads as "missing data" — different meaning from "zero revenue."

3. **Plan-wise report counts memberships, not payments.** A renewal in April is one Half Yearly sale in April. In v1 (no partial payments), this matches payment date; but the right semantic is "memberships created in this range." Future-proofs against partial payments.

4. **Inactive plans with historical sales.** Don't filter `WHERE plans.is_active = true` — that hides plans that had sales but were later deactivated. Show them with strikethrough in the table. Critical for accurate historicals.

5. **Discount "by staff" — denormalize at query time.** Use `enrolled_by_user_id` from memberships. Don't accidentally use `payment.received_by_user_id` — that's who recorded the payment, not necessarily who made the discount decision. They're usually the same, but at chains they can diverge.

6. **Tab content is Server-rendered, not client-hydrated.** Tabs swap via URL, page re-renders. Don't fetch via TanStack Query inside tabs — defeats the RSC pattern.

7. **Date math in IST.** A payment recorded at 11:55 PM IST on April 30 is in April's report, not May's. All date filters use IST boundary, not UTC. Use `date-fns-tz` or do the comparison server-side with `AT TIME ZONE 'Asia/Kolkata'` in SQL.

8. **Excel export: numbers are numbers.** Don't pass formatted strings like "₹4,500" to SheetJS. Pass the raw rupee value as a Number. Use cell formatting in SheetJS to display as currency. Otherwise the CA can't run formulas.

9. **Don't aggregate across branches when scoped.** Branch Manager seeing branch-only data: the SQL queries must filter `branch_id = ?` BEFORE aggregation. RLS will protect SELECT but won't prevent aggregating across denied rows (it just returns 0 from those). Defense in depth: query layer also filters explicitly.

10. **Empty range edge cases.** Owner picks "Last quarter" but the gym only opened last month → no data. Reports should show clean empty states, not crash on division by zero. `avgPerDay = days > 0 ? net / days : 0`.

11. **Chart performance with 365-day ranges.** A daily bar chart with 365 bars is ugly and slow. Auto-thin: if range > 90 days, aggregate to weekly bars (Mon-Sun bins). If > 365 days, monthly. Don't render 365 bars. Implement a small `chooseAggregation(daysInRange)` helper that returns `'daily' | 'weekly' | 'monthly'` and aggregates the daily data accordingly.

---

## 7.11 What's Next

Module 08 — Audit Log Viewer. The "who did what when" page that owners use during disputes. We've been writing audit entries since Module 01; now we surface them. Should be straightforward — single page with filters, no new business logic.

After Module 08, you have full operator visibility (Today's View + Reports + Audit Log) — the trifecta that justifies the ₹5k/month positioning. Modules 09 (PDF invoices) and 10 (WhatsApp Pro) layer on top of an already-complete product.

**Reminder once more about the demo.** You said you'd demo "soon." Module 07 just gave you the report screens that owners care about most. This is the moment to demo. The product can sell now.
