# Module 07 — Amendment (Overview tab + insights upgrade)

> The original Module 07 ships data display. This amendment ships *answers*. Adds an Overview tab as the new default landing, plus insight-layer improvements to the existing tabs. Estimated time: 4–6 hours on top of original.
>
> **Sections:**
> - C1. Overview tab — the weekly health check
> - C2. Period comparisons across all tabs
> - C3. Anomaly detection layer
> - C4. Sales trend sparklines (Plans tab)
> - C5. Cumulative running total (Revenue chart)
> - C6. Discount distribution histogram (Discount tab)
>
> **Design philosophy:** Overview answers "how's the business?" in one glance. The other three tabs answer "show me the data." Insights live on Overview; deep numbers live elsewhere. No card on Overview should require reading more than 5 seconds.
>
> **AI-readiness:** Every insight card on Overview follows the structure `{ headline, subline, severity }`. Today these are computed by rules. In v1.5, the same card slots can be powered by an AI summary. The interpretation layer swaps; the display layer stays.

---

## C1. Overview tab (NEW, becomes default)

### Tab order change

```
Current: [Revenue] [Plans] [Discounts]
New:     [Overview] [Revenue] [Plans] [Discounts]
```

Default landing tab becomes **Overview**. URL: `/reports?tab=overview` is the default if no tab param.

### Page layout — Overview tab

The page is intentionally short. Five sections, top to bottom. Designed for a 30-second weekly read.

```
┌─────────────────────────────────────────────────────────────────┐
│ [filters: this month ▾]  [All branches ▾]                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ HEADLINE                                                        │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │  ↑ +13% vs last month                                       │ │
│ │  ₹2,47,500 net revenue                                      │ │
│ │  47 new members · ₹8,000 in refunds                         │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ NEEDS ATTENTION (only if anomalies exist)                       │
│ ┌─ ⚠ Refunds spiked ────────────────────────────────────────┐ │
│ │ ₹8,000 across 3 refunds — 4× more than last month         │ │
│ │ View payments →                                            │ │
│ └────────────────────────────────────────────────────────────┘ │
│ ┌─ ⚠ Discount leakage rising ────────────────────────────────┐ │
│ │ ₹47,500 given (12.3% of gross). Vibhu Dawar gave 60% of it │ │
│ │ View discount details →                                    │ │
│ └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ TRENDS                                                          │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │  Revenue this month vs last month                           │ │
│ │                                                             │ │
│ │   ▌                                  ▌▌                     │ │
│ │   ▌▌  ▌▌                          ▌▌▌▌▌                     │ │
│ │   ▌▌▌▌▌▌▌▌  ▌▌▌▌  ▌▌▌▌▌▌▌▌  ▌▌▌▌▌▌▌▌▌▌▌                    │ │
│ │   ▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌                   │ │
│ │   1   5   10  15  20  25  30                                │ │
│ │                                                             │ │
│ │   ─── This month  ─── Last month (faded)                    │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ HIGHLIGHTS                                                      │
│ ┌─ Best day ──────────────┐ ┌─ Top plan ────────────────┐      │
│ │ Apr 15 · ₹47,500        │ │ Half Yearly                │      │
│ │ 8 enrolments            │ │ ₹1,20,000 across 12 sales  │      │
│ └─────────────────────────┘ └────────────────────────────┘      │
│ ┌─ Most active day ───────┐ ┌─ Slowest week ────────────┐      │
│ │ Sundays                 │ │ Apr 8–14                   │      │
│ │ Avg 6 enrolments        │ │ ₹38,000 (vs avg ₹62K)     │      │
│ └─────────────────────────┘ └────────────────────────────┘      │
│                                                                 │
│ DIG DEEPER                                                      │
│ → Detailed revenue breakdown                                    │
│ → Plan performance                                              │
│ → Discount details                                              │
└─────────────────────────────────────────────────────────────────┘
```

### Section-by-section spec

#### Section A: Headline (always visible)

A single hero card stating the period's outcome in one sentence.

**Card content:**
- Big delta line: `↑ +13% vs last month` (color: emerald if up, red if down, neutral if flat).
- Big number: `₹2,47,500` net revenue (using `--primary` blue).
- Small line: `47 new members · ₹8,000 in refunds`.

If comparison period has no data (first month of using the system), show:
- "Your first month of tracked data"
- Big number: `₹2,47,500`
- "47 new members enrolled"

This is the ONLY card that uses brand color (blue). Everything else stays neutral or uses anomaly colors only.

#### Section B: Needs attention (conditionally visible)

This is the magic. Only renders if anomalies are detected. If business is normal — section doesn't appear at all. (No "All clear ✓" placeholder. Silence is good.)

Each anomaly = one card. Maximum 3 cards shown (most severe first). If there are 5 anomalies, show top 3 + "View all 5 anomalies →" link.

**Anomaly card structure:**
- Icon: `⚠` (amber for medium, red for high severity)
- Headline: short statement of the anomaly
- Sub-line: specific data + comparison context
- Action link: "View [tab] →"

See § C3 for the rule-based detection logic.

**Severity → color mapping:**
- Low: gray dot, no card (don't surface trivial)
- Medium: amber border-left + amber `⚠` icon
- High: red border-left + red `⚠` icon

#### Section C: Trends (always visible)

The single chart on Overview. Daily revenue, current period overlaid against the equivalent prior period.

- Same height as Revenue tab chart (~280px).
- Two series:
  - This month: solid bars in `--primary` blue.
  - Last month: faded line (or thin lighter bars behind, opacity 0.3) — provides reference but doesn't compete visually.
- Hover tooltip shows both: "Apr 15: ₹47,500 (vs ₹38,000 same day last month)".
- Legend: minimal text labels under chart, not a Recharts `<Legend>` block (cleaner).
- If comparison period unavailable: just show this period's bars, no overlay, no comment.

This is the **only chart** on Overview. We're not stacking multiple visualizations.

#### Section D: Highlights (always visible)

Four small cards in a 2x2 grid (or 4-column on wide screens). These are observations, not metrics. Each is a *finding* expressed as a sentence.

| Card | Content example |
|---|---|
| Best day | "Apr 15 · ₹47,500 · 8 enrolments" |
| Top plan | "Half Yearly · ₹1,20,000 across 12 sales" |
| Most active day-of-week | "Sundays · Avg 6 enrolments" |
| Slowest week | "Apr 8–14 · ₹38,000 (vs avg ₹62K)" |

These are deliberately *patterns* an owner doesn't have time to find themselves. The system found them.

If period has too little data for any card (e.g., 2 days only), card shows "Not enough data yet" — don't fabricate findings.

#### Section E: Dig deeper (always visible)

Three navigation links to the existing tabs:
- `→ Detailed revenue breakdown` (links to Revenue tab with same filters)
- `→ Plan performance` (links to Plans tab)
- `→ Discount details` (links to Discounts tab)

Plain text links, not buttons. Subtle. The Overview is meant to be enough on its own; these are escape hatches for when the owner wants to investigate.

---

## C2. Period comparisons (across all tabs)

Add to Module 07's existing summary cards. Reuse the comparison logic from Module 05's Today's View.

### Where comparison appears

**Revenue tab summary cards:**
| Card | Current behavior | Add comparison |
|---|---|---|
| Total revenue | "₹2,47,500" | "+13% vs last month" |
| Refunds | "₹8,000" | "vs ₹2,000 last month" — note: deltas on refunds always shown numerically, not %, since 0→1 is "infinite %" and that's silly |
| Net | "₹2,39,500" | "+12% vs last month" |
| Avg/day | "₹7,983" | "+9% vs last month" |

**Discount tab summary cards:**
| Card | Add comparison |
|---|---|
| Total discount given | "+18% vs last month" |
| % of gross | "vs 9.2% last month" |
| Avg discount | "+₹150 vs last month" |

**Plans tab:** No card-level comparison (the report is structured differently). But add a small "Sales last period" column to the table — see § C4.

### Comparison resolver

```ts
// lib/utils/period-comparison.ts
export function getPreviousPeriod(
  fromDate: string,
  toDate: string,
): { from: string; to: string } {
  // Calculate the equivalent prior period.
  // If current = "this month" (Apr 1 - Apr 30), previous = "last month" (Mar 1 - Mar 31).
  // If current = "last 7 days" (Apr 24 - Apr 30), previous = "7 days before" (Apr 17 - Apr 23).
  // Use date-fns: differenceInDays + subDays.
  // Special-case calendar months/quarters/years to use prior calendar period.
}
```

The "prior period" semantics matters:
- "This month" → "Last month" (calendar months, even if different lengths).
- "Last 7 days" → "Previous 7 days" (rolling).
- "This quarter" → "Last quarter".
- "This year" → "Last year".
- Custom range → previous range of equal length immediately before.

### When comparison is unavailable

If the gym was created mid-period or there's no prior data:
- Card shows the current value normally.
- Comparison line shows "No data for prior period" in muted text.
- Don't crash, don't show "+∞%", don't fabricate.

### Comparison color rules

- **Green ↑** for revenue/enrolments/net up. Bad-thing-down (refunds, discounts) does NOT show green when down — show neutral muted text with arrow only. Owner shouldn't celebrate fewer refunds as a "win" without context.
- **Red ↓** for revenue/enrolments/net down.
- **Neutral** for ambiguous (refunds, discounts, % of gross — let owner interpret).

This is a small but important call: the system shouldn't editorialize on every metric. Revenue going up is unambiguously good; refunds going down might be good (members happier) or bad (we stopped responding to complaints). Stay neutral.

---

## C3. Anomaly detection layer

The "Needs attention" section on Overview is powered by a small rule-based detector. No ML. Just clean, well-named rules.

### Detection rules

Each rule examines current vs prior period data and returns either `null` (no anomaly) or an `Anomaly` object.

```ts
type Severity = 'medium' | 'high';

type Anomaly = {
  id: string;                       // unique key for sorting/dedupe
  severity: Severity;
  headline: string;                 // one short line
  subline: string;                  // specific data + context
  actionLabel: string;              // e.g., "View payments"
  actionHref: string;               // link to deeper tab
};
```

#### Rule 1: Refund spike
**Trigger:** current refund total >= 3× prior refund total AND current refund count >= 2.
**Severity:**
- `high` if current refunds >= 5× prior OR refund total > 10% of gross revenue.
- `medium` otherwise.
**Headline:** "Refunds spiked"
**Subline:** "₹X across N refunds — Y× more than last month"
**Action:** "View payments →" (links to `/payments?kind=refund&from=...`)

#### Rule 2: Discount leakage
**Trigger:** current discount given >= 8% of gross revenue.
**Severity:**
- `high` if >= 15%.
- `medium` if 8-15%.
**Headline:** "Discount leakage [rising / high]"
**Subline:** "₹X given (Y% of gross). [Top staff] gave Z% of it" (only mention staff if one staff member dominates >50%).
**Action:** "View discount details →"

#### Rule 3: Revenue drop
**Trigger:** current net revenue <= 80% of prior net revenue.
**Severity:**
- `high` if <= 60%.
- `medium` if 60-80%.
**Headline:** "Revenue down"
**Subline:** "₹X this period vs ₹Y last period (-Z%)"
**Action:** "View revenue breakdown →"

#### Rule 4: Single concentrated discount
**Trigger:** any single membership has discount >= 25% of plan price.
**Severity:** `medium` (always).
**Headline:** "Large discount given"
**Subline:** "[Member name] received [X]% off their [Plan] (₹Y discount)"
**Action:** "View member →" (links directly to the member detail).

If multiple in period, headline pluralizes: "N large discounts given" with the highest one in subline + "and N-1 more".

#### Rule 5: Member loss spike (lapsed-not-renewed)
**Trigger:** current period's lapsed-and-not-yet-renewed count >= 1.5× prior period's.
**Severity:**
- `high` if >= 3× and absolute count > 5.
- `medium` otherwise.
**Headline:** "More members lapsing"
**Subline:** "X members didn't renew (was Y last period)"
**Action:** "View lapsed members →" (links to `/members?status=expired`)

#### Rule 6: Slow week within period
**Trigger:** within the period, at least one calendar week's revenue is <= 60% of the period's average week.
**Severity:** `medium`.
**Headline:** "Slow week detected"
**Subline:** "Apr 8-14: ₹X (avg week: ₹Y)"
**Action:** "View revenue chart →"

This is deliberately **6 rules total**. Not 20. Each one is a real business signal an owner cares about. Adding more rules creates noise that eventually gets ignored.

### Anomaly ordering

When multiple anomalies fire:
1. Sort by severity (high first).
2. Within same severity, sort by impact magnitude (e.g., refund spike with bigger ratio first).
3. Show top 3 on Overview.
4. If >3 anomalies, show "+ N more anomalies →" link below the third card.

### File structure

```
server/services/anomaly-detection.ts          (NEW — runs all rules, returns Anomaly[])
server/queries/reports/get-overview.ts        (NEW — composes everything for Overview tab)
lib/utils/period-comparison.ts                (NEW — period resolver)
```

The `getOverviewReport(filters)` function returns:
```ts
type OverviewReport = {
  headline: {
    netPaise: number;
    deltaPct: number | null;
    newMembers: number;
    refundsPaise: number;
  };
  anomalies: Anomaly[];
  trend: {
    current: Array<{ date: string; netPaise: number }>;
    prior: Array<{ date: string; netPaise: number }> | null;
  };
  highlights: {
    bestDay: { date: string; netPaise: number; enrolments: number } | null;
    topPlan: { planName: string; revenuePaise: number; sold: number } | null;
    mostActiveDayOfWeek: { dayName: string; avgEnrolments: number } | null;
    slowestWeek: { weekStart: string; weekEnd: string; netPaise: number; avgWeekPaise: number } | null;
  };
};
```

Single function, runs ~5-7 queries in parallel via `Promise.all`. Same performance pattern as Module 05's `getTodaySnapshot`.

---

## C4. Sales trend sparkline (Plans tab)

Add a small inline chart to each row in the Plan-wise table.

### Implementation

Each plan row gets a tiny sparkline showing **weekly sales count** over the period:

```
Plan       Sales last 4 weeks   Sold  Revenue   Avg ticket  Net
─────────  ──────────────────── ────  ────────  ──────────  ────
Half Yearly  ▁▂▄█▆               12   ₹1,20K   ₹10,000     ₹1,15K
Quarterly    ▆▄▂▁▁                3   ₹15K     ₹5,000      ₹14K
Monthly      ▂▄▆█▆               14   ₹28K     ₹2,000      ₹28K
```

The sparkline is:
- ~80px wide, 24px tall.
- Solid bars (Recharts `<BarChart>` with `<Bar>` only, no axes, no grid).
- Color: `--primary` for the most recent bar; `--muted-foreground` for prior.
- No tooltip on hover (too small; click row for detail).
- For periods <2 weeks: don't render sparkline; show "—".

This single visual addition transforms the Plans tab from "static snapshot" to "trajectory at a glance." Owner instantly sees Quarterly is dying, Monthly is growing.

### Component

```tsx
// app/(app)/reports/_components/plan-sparkline.tsx
type Props = {
  weeklyCounts: number[];  // e.g., [3, 2, 5, 8]
};

export function PlanSparkline({ weeklyCounts }: Props) {
  if (weeklyCounts.length < 2) return <span className="text-muted-foreground">—</span>;
  const data = weeklyCounts.map((count, i) => ({ week: i, count }));
  return (
    <div className="w-20 h-6">
      <ResponsiveContainer>
        <BarChart data={data}>
          <Bar dataKey="count" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

### Query change

`getPlanWiseReport` returns an extra field per row:

```ts
type PlanRow = {
  // ... existing fields
  weeklyCounts: number[];     // length matches weeks in period
};
```

Compute by grouping memberships by week within range. Cap at 12 weeks of bars (so a year-long period shows 12, not 52 — readable).

---

## C5. Cumulative running total (Revenue chart)

The Revenue tab's daily bar chart already exists (Module 07 § 7.3). Add a single line overlay showing the cumulative sum running across the period.

### Visual

```
Net revenue per day                                       Cumulative ──
┌──────────────────────────────────────────────────────────────────────┐
│                                                                ──── │
│                                                          ────       │
│                                                    ────             │
│                                              ────                   │
│   ▌  ▌  ▌    ▌▌      ▌  ▌▌  ▌▌▌  ▌  ▌  ▌▌  ▌                       │
│   ▌▌▌▌▌▌  ▌▌▌▌▌▌  ▌  ▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌                         │
│ Apr 1   5    10    15   20   25   30                                │
└──────────────────────────────────────────────────────────────────────┘
```

The line uses a **secondary Y-axis on the right** for the cumulative total. The existing left axis stays for daily values.

```tsx
<ComposedChart data={dailyData}>
  <XAxis dataKey="date" />
  <YAxis yAxisId="left" tickFormatter={shortMoney} />
  <YAxis yAxisId="right" orientation="right" tickFormatter={shortMoney} />
  <Tooltip content={<CustomTooltip />} />
  <Bar yAxisId="left" dataKey="net" fill="hsl(var(--primary))" />
  <Line yAxisId="right" dataKey="cumulative" stroke="hsl(var(--primary) / 0.6)" dot={false} strokeWidth={2} />
</ComposedChart>
```

The cumulative line uses 60% opacity of primary — present but not competing with the bars.

Hover tooltip extended:
```
Apr 15: ₹12,500 today
Cumulative: ₹1,87,500 of period
```

That second line is what makes this powerful. Owner mid-month sees "we're at ₹1.87L of our usual ₹3L month."

---

## C6. Discount distribution histogram (Discount tab)

Add to the Discount tab, between the summary cards and the "By staff" table. A small histogram of discount sizes:

```
Discount distribution
┌────────────────────────────────────────────────────────────────┐
│   ▌▌▌▌▌                                                         │
│   ▌▌▌▌▌                                                         │
│   ▌▌▌▌▌                                                         │
│   ▌▌▌▌▌                                                         │
│   ▌▌▌▌▌  ▌▌▌                                                    │
│   ▌▌▌▌▌  ▌▌▌                                                    │
│   ▌▌▌▌▌  ▌▌▌  ▌▌                                                │
│   ▌▌▌▌▌  ▌▌▌  ▌▌  ▌                                             │
│   ₹0-500 ₹500- ₹1k- ₹2.5k- ₹5k+                                 │
│         ₹1k    ₹2.5k ₹5k                                        │
│   30 disc.  8     5    3   1                                    │
└────────────────────────────────────────────────────────────────┘
```

5 fixed buckets:
- ₹0-500
- ₹500-₹1,000
- ₹1,000-₹2,500
- ₹2,500-₹5,000
- ₹5,000+

Each bar shows count of memberships with discount in that range. Below each bar: count label.

**The pattern this surfaces:**
- All bars on the left → culture of small concessional discounts (review desk training).
- Bell curve in middle → normal negotiating range.
- Heavy right tail → big special deals (worth investigating each).
- Gaps in middle → polarized: only tiny or huge discounts.

Owner takes 3 seconds to read this and learns something they couldn't get from raw totals.

### Implementation

Lightweight Recharts BarChart, similar to the period chart. Height ~180px. No tooltip needed (counts are below each bar already).

---

## Acceptance Criteria for Amendment

### Overview tab
- [ ] New tab "Overview" appears as the first/default tab.
- [ ] URL `/reports` defaults to `/reports?tab=overview`.
- [ ] Headline card shows current period summary with delta vs prior.
- [ ] Comparison handles "no prior data" case gracefully.
- [ ] "Needs attention" section hidden when zero anomalies.
- [ ] Anomaly cards correctly styled by severity (medium = amber, high = red).
- [ ] Maximum 3 anomaly cards shown; "+N more" link if exceeded.
- [ ] Trend chart overlays current vs prior period correctly.
- [ ] All 4 highlights cards compute correctly.
- [ ] "Dig deeper" links navigate to correct tabs preserving filters.
- [ ] Page loads in <500ms with realistic dataset.
- [ ] Mobile: sections stack cleanly; trend chart shrinks responsively.

### Period comparisons
- [ ] All summary cards on Revenue tab show comparison to prior period.
- [ ] All summary cards on Discount tab show comparison.
- [ ] Comparison color rules followed (green for good metrics up, red for bad metrics down, neutral for ambiguous).
- [ ] Comparison gracefully handles no-prior-data.
- [ ] Period resolver correctly maps "This month" → "Last month", "This quarter" → "Last quarter", custom → equal-length-prior.

### Anomaly detection
- [ ] All 6 rules implemented in `anomaly-detection.ts`.
- [ ] Each rule unit-testable with mock data.
- [ ] Severity assignments correct.
- [ ] Anomaly headlines and sublines render with real data substitution.
- [ ] Anomaly action links navigate correctly with filters preserved.
- [ ] When current period has insufficient data (e.g., < 7 days), anomaly detection runs cleanly — no false positives from tiny sample sizes (rule guards).

### Sparklines (Plans tab)
- [ ] Sparkline renders for plans with 2+ weeks of data.
- [ ] Plans with <2 weeks show "—".
- [ ] Sparkline uses primary color for last bar, muted for prior.
- [ ] Sparkline doesn't break table layout on mobile.

### Cumulative line (Revenue chart)
- [ ] Composed chart renders bars + line.
- [ ] Right Y-axis shows cumulative scale.
- [ ] Hover tooltip shows both daily and cumulative values.
- [ ] Line uses 60% opacity primary; doesn't compete with bars.

### Discount distribution
- [ ] Histogram renders with 5 fixed buckets.
- [ ] Counts under each bar.
- [ ] Empty buckets show as 0-height (not missing).
- [ ] Renders cleanly even when all discounts fall in one bucket.

### General
- [ ] All new queries respect RLS and branch scoping.
- [ ] Excel export (existing per-tab) unchanged for Revenue/Plans/Discounts.
- [ ] Overview tab does NOT have its own export (it's a derived insight view, not raw data).
- [ ] Lighthouse perf still ≥ 90 on `/reports?tab=overview`.

---

## Files Touched/Created

```
app/(app)/reports/_components/overview-tab.tsx               (NEW)
app/(app)/reports/_components/overview-headline.tsx          (NEW)
app/(app)/reports/_components/anomaly-card.tsx               (NEW)
app/(app)/reports/_components/trend-chart.tsx                (NEW — comparison overlay)
app/(app)/reports/_components/highlight-card.tsx             (NEW)
app/(app)/reports/_components/dig-deeper-links.tsx           (NEW)
app/(app)/reports/_components/plan-sparkline.tsx             (NEW)
app/(app)/reports/_components/discount-distribution.tsx      (NEW)
app/(app)/reports/_components/comparison-line.tsx            (NEW — small "+13% vs last month" component)
app/(app)/reports/_components/revenue-chart.tsx              (MODIFIED — add cumulative line)
app/(app)/reports/_components/summary-card.tsx               (MODIFIED — accept comparison prop)
app/(app)/reports/_components/plan-wise-table.tsx            (MODIFIED — add sparkline column)
app/(app)/reports/_components/discount-tab.tsx               (MODIFIED — embed distribution chart)
app/(app)/reports/page.tsx                                   (MODIFIED — add Overview tab)

server/queries/reports/get-overview.ts                       (NEW)
server/queries/reports/get-revenue-report.ts                 (MODIFIED — return comparison data + cumulative)
server/queries/reports/get-plan-wise-report.ts               (MODIFIED — return weekly counts per plan)
server/queries/reports/get-discount-leakage-report.ts        (MODIFIED — return distribution buckets)

server/services/anomaly-detection.ts                         (NEW — 6 rules)

lib/utils/period-comparison.ts                               (NEW — getPreviousPeriod resolver)
lib/utils/anomaly-rules/                                     (NEW — one file per rule, testable)
  refund-spike.ts
  discount-leakage.ts
  revenue-drop.ts
  large-discount.ts
  member-loss.ts
  slow-week.ts
```

---

## Common pitfalls

1. **Don't add anomaly rules beyond the 6 specified.** Every additional rule increases noise. The Overview tab loses its punch when "Needs attention" always has 5 cards. Resist scope creep here specifically.

2. **The anomaly detection runs in the same RSC as the report.** Don't make it a client-side computation. Server-side keeps the rules consistent and testable.

3. **Comparison color editorialization.** Refunds going down isn't necessarily "good" (could mean staff stopped processing legitimate refund requests). Discounts going down isn't necessarily "good" (could mean staff is losing sales). Stay neutral on these. Only revenue/enrolments/net get green/red treatment.

4. **The sparkline width must be fixed.** If sparkline column allows variable width, the entire table reflows. Use exact `w-20 h-6` (or similar) on the wrapper div.

5. **Cumulative line scale matters.** The right axis can dwarf the left axis (cumulative ends 30× higher than the daily max). Make sure both axes scale independently — that's what `yAxisId` does. Without it, daily bars get squashed.

6. **Don't forget the "no prior data" case.** First-time users will land on Overview before they have a prior period. Every comparison must gracefully degrade. Test with a fresh tenant.

7. **The "best day" highlight on Overview must respect IST.** A payment recorded at 11:55 PM IST belongs to today, not tomorrow. Use the same date-bucketing logic as the daily breakdown.

8. **Anomaly action links must preserve filters.** When user clicks "View payments" from a refund spike anomaly, they should land on `/payments?kind=refund&from=...&to=...&branch=...` — same date range, same branch. Reuse the existing URL state pattern.

9. **AI-readiness structure.** Each `Anomaly` returned has `{ id, severity, headline, subline, actionLabel, actionHref }`. Don't bake the rule logic into the UI. The UI just renders Anomaly objects. v1.5 swaps the source from rule-based detector to AI summarizer; UI stays.

10. **The "trend" chart on Overview is NOT the same component as the Revenue tab chart.** Don't try to share. Overview chart shows comparison overlay; Revenue chart shows cumulative line. Different goals, different shapes. Build them separately.

11. **Test with thin data.** Run Overview on a tenant with 2 weeks of data. Then 3 months. Then 1 year. The page should look intentional at every scale, not "lots of empty fields" or "overwhelming density."

---

## What this changes about the product

Before this amendment, Reports is a competent feature. Functional parity with Gymshim, slightly nicer UI.

After this amendment, Reports is a *differentiator*. The Overview tab specifically is what owners will show their CA, their spouse, their business partner. "Look how this software tells me how my business is doing." That moment is what justifies premium pricing.

The 4–6 hours to build this is the highest ROI work in the entire roadmap. Don't skip it because it feels like polish — it isn't polish, it's positioning.
