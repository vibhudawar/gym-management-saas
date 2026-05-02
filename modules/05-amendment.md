# Module 05 — Amendment (Visual Hierarchy & Color)

> Patch to Module 05's Today's View. The original ships correctly but visually flat — equal-weight cards, oversized empty states, no purposeful color. This amendment fixes the hierarchy and introduces color *as signal*, not decoration. Estimated time: 3–4 hours.

**Sections:**
- B1. Hero revenue card (1+3 metric layout)
- B2. Status color system (purposeful, not decorative)
- B3. Action list cards (border-accent + tighter rows)
- B4. Smarter empty states (collapse when empty)
- B5. Page header presence
- B6. Enrolled Today density pass

---

## Design philosophy (read first)

The screen still aims for **calm professional, not energetic**. We're not making it look like a fitness brand. We're making it look like a tool that's *alive* — where the eye knows where to go.

Three rules govern this amendment:

1. **Color is signal, not skin.** Blue = primary (revenue, brand). Amber = attention (expiring, frozen-resuming). Red = urgent (expired, danger). Neutral = informational. Every color we add must answer the question "what does this signal?"

2. **Hierarchy comes from weight and size, not background fills.** No gradient cards. No tinted backgrounds on metric cards. We use type size, font weight, and accent placement to establish order.

3. **Empty space should feel intentional, not abandoned.** When something has nothing to show, it should *acknowledge* that briefly and step out of the way — not occupy half the screen with a sad emoji.

---

## B1. Hero revenue card (1+3 layout)

**Current problem:** Four cards of equal visual weight. The eye has nowhere to land first.

**Fix:** The metric grid changes from `grid-cols-4` to `grid-cols-4` with the revenue card spanning 2 columns. Layout becomes 1+3:

```
Desktop:
┌────────────────────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│                        │  │          │  │          │  │          │
│      Revenue card      │  │ Enrolled │  │ Expiring │  │ Frozen   │
│      (2 cols)          │  │          │  │          │  │          │
│                        │  │          │  │          │  │          │
└────────────────────────┘  └──────────┘  └──────────┘  └──────────┘

Tablet (col-span-2 still hero, 3 small wrap):
┌────────────────────────┐  ┌──────────┐
│      Revenue           │  │ Enrolled │
└────────────────────────┘  └──────────┘
┌──────────┐  ┌──────────┐
│ Expiring │  │ Frozen   │
└──────────┘  └──────────┘

Mobile:
Revenue card full width, then 2x stack of small cards.
```

### Hero revenue card styling

```tsx
// app/(app)/_components/today/hero-revenue-card.tsx
<Card className="col-span-2 relative overflow-hidden">
  <div className="absolute inset-y-0 left-0 w-1 bg-blue-600" />
  <CardContent className="p-6 lg:p-8">
    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
      Collected today
    </p>
    <p className="mt-2 text-5xl lg:text-6xl font-semibold tabular-nums tracking-tight text-blue-600">
      ₹4,200
    </p>
    <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
      <ArrowUpRight className="h-4 w-4 text-emerald-600" />
      <span className="font-medium text-emerald-600">↑ ₹3,200</span>
      <span>vs yesterday</span>
    </p>
  </CardContent>
</Card>
```

Key details:
- Left border accent (4px wide) in `blue-600` — the only place we put blue on a card. It signals "this is the headline."
- The number itself is in `blue-600` — the eye anchors here first.
- Number size: `text-5xl` mobile, `text-6xl` desktop. Massive on purpose.
- Comparison line uses `emerald-600` for positive deltas, `red-600` for negative, neutral `text-muted-foreground` for zero.
- Card padding is generous (`p-8` on desktop) — this card has room to breathe; the others are compact.

### Secondary metric cards

Three small cards: Enrolled today, Expiring in 14 days, Frozen now.

```tsx
// app/(app)/_components/today/metric-card.tsx
<Card className={cn("relative", accent && "...")}>
  <CardContent className="p-5">
    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {label}
    </p>
    <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">
      {value}
    </p>
    {sublineText && (
      <p className="mt-2 text-xs text-muted-foreground">
        {sublineText}
      </p>
    )}
  </CardContent>
</Card>
```

Key details:
- Smaller number (`text-3xl`) — clearly secondary.
- Less padding (`p-5`).
- No accent color on the number itself — only on count badges if status applies (see B2).

### Receptionist view (no revenue card)

When the user is a receptionist:
- Revenue card is hidden entirely.
- Layout becomes `grid-cols-3`, three equal-width secondary cards.
- The "Enrolled today" card may take slightly more visual prominence in this case (`text-4xl` instead of `text-3xl`) — it's the closest thing to a "daily activity" metric receptionists care about.

---

## B2. Status color system

We introduce four semantic colors, used **only** in specific places:

| Token | Tailwind | Means | Used on |
|---|---|---|---|
| `primary` | `blue-600` | Brand / headline | Hero revenue accent, primary buttons |
| `attention` | `amber-500` | Soft urgency | Expiring soon (next 14d), Frozen card |
| `urgent` | `red-600` | Hard urgency | Recently expired, refund amounts |
| `success` | `emerald-600` | Positive delta | Revenue up arrow, success states |

Add these to your CSS variables if not already present:

```css
:root {
  --attention: 38 92% 50%;        /* amber-500 */
  --attention-foreground: 30 50% 20%;
  --urgent: 0 72% 51%;            /* red-600 */
  --urgent-foreground: 0 0% 100%;
  --success: 152 76% 40%;         /* emerald-600 */
  --success-foreground: 0 0% 100%;
}
```

These are used sparingly — never on entire card backgrounds. Only on:
- Border accents (left edge, 4px)
- Count badges (small pill in card header)
- Number coloring (only the hero revenue figure)
- Status indicators (dots, icons)

### Where each appears

**Expiring in 14 days metric card:**
- Count badge top-right uses amber-500 background with white text if count > 0.
- If count = 0, no badge.
- Sub-line ("4 in 7d · 1 in 3d") uses amber-700 for the inner numbers.

```tsx
{count > 0 && (
  <Badge className="bg-amber-500 text-white hover:bg-amber-500">
    {count}
  </Badge>
)}
```

**Frozen now metric card:**
- If `count > 0` AND `resumingIn7d > 0`: amber count badge.
- If `count > 0` AND `resumingIn7d === 0`: neutral count, no badge.
- If `count = 0`: no badge.
- Frozen is "informational" most of the time — only signals attention when memberships are about to resume (owner needs to know to expect them back).

**Enrolled today metric card:**
- No status color — this is informational. Number stays neutral.
- Up/down arrow shows emerald or red, but only as the comparison delta.

---

## B3. Action list cards (border-accent + tighter rows)

The two action list cards are the screen's *purpose*. They should look like they matter.

### Card-level changes

**Expiring soon card:**
- Left border accent 4px in `amber-500`.
- Card header gets a count badge in amber.

```tsx
<Card className="relative overflow-hidden">
  <div className="absolute inset-y-0 left-0 w-1 bg-amber-500" />
  <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
    <div>
      <CardTitle className="text-base">Expiring soon</CardTitle>
      <CardDescription className="text-xs">Next 14 days</CardDescription>
    </div>
    <Badge variant="secondary" className="bg-amber-500 text-white hover:bg-amber-500">
      {total}
    </Badge>
  </CardHeader>
  <CardContent className="p-0">
    {/* rows */}
  </CardContent>
</Card>
```

**Recently expired card:**
- Same structure, but `red-600` for the border and badge.

### Row-level changes (tighter)

The rows are currently too airy. Pack them tighter:

```tsx
// app/(app)/_components/today/action-row.tsx
<div className="flex items-start justify-between gap-4 px-5 py-3 border-b border-border last:border-0 hover:bg-muted/40 transition-colors">
  <div className="min-w-0 flex-1">
    <div className="flex items-baseline gap-2 flex-wrap">
      <p className="font-medium text-sm">{member.name}</p>
      <p className="text-xs text-muted-foreground tabular-nums">
        {formatPhone(member.phone)}
      </p>
    </div>
    <p className="mt-0.5 text-xs text-muted-foreground">
      {planName} · <span className={daysClass}>{daysLabel}</span>
    </p>
    <ReminderIndicator reminder={latestReminder} />
  </div>
  <div className="flex items-center gap-1 shrink-0">
    <WhatsAppButton ... />
    <CallButton ... />
  </div>
</div>
```

Key details:
- Vertical padding `py-3` (was probably `py-5` or so).
- Each row is ~64px tall on desktop instead of ~110px.
- Phone number on same line as name (with smaller, muted styling) instead of below — saves a row.
- Plan + days info compressed to one line.
- Reminder indicator is small text, not a separate row.
- Action buttons compact: icon + label on desktop, icon-only at narrow widths.

### "Days to expiry" coloring

Inside the row, the days label gets subtle color based on urgency:

```tsx
const daysClass = cn(
  "font-medium",
  daysFromToday <= 3 && "text-red-600",
  daysFromToday > 3 && daysFromToday <= 7 && "text-amber-600",
  daysFromToday > 7 && "text-foreground",
  daysFromToday < 0 && "text-red-600", // expired
);
```

So "Ends in 3 days" reads in red; "Ends in 12 days" reads neutral. Subtle but the eye picks it up.

### View button

The standalone `[View →]` button is removed from the row. Make the entire row clickable instead (`Link` wrapper or `onClick` with `router.push`). The WhatsApp + Call buttons need `e.stopPropagation()` to not trigger row navigation.

This frees up horizontal space for the action buttons and matches the pattern in the Members table.

---

## B4. Smarter empty states

**Current problem:** A 600px-tall card with a tiny party emoji and one line of text. Looks broken.

### New rule: empty state height matches content type

For action list cards (Expiring/Expired):

**When empty (count = 0):**
- Card collapses to a single compact row, ~80px tall.
- No big emoji, no oversized centering.
- Single line: subtle dot icon + brief message.

```tsx
// app/(app)/_components/today/action-list-empty.tsx
<div className="flex items-center gap-3 px-5 py-6 text-sm text-muted-foreground">
  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
  <span>{message}</span>
</div>
```

Messages:
- Expiring soon empty: "No memberships ending in the next 14 days."
- Recently expired empty: "No expirations in the last 30 days."

### When BOTH action cards are empty

Collapse into a single full-width card:

```tsx
<Card>
  <CardContent className="flex items-center gap-3 px-6 py-5">
    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
    <div>
      <p className="text-sm font-medium">All members are up to date.</p>
      <p className="text-xs text-muted-foreground">
        Nothing expiring in the next 14 days, no recent expirations.
      </p>
    </div>
  </CardContent>
</Card>
```

This is one band of content instead of two empty cards. Page no longer feels hollow.

### Enrolled Today empty state

Same compact pattern:
```
┌─────────────────────────────────────────────────────────┐
│  Enrolled today                                      0  │
├─────────────────────────────────────────────────────────┤
│  No enrollments yet today.                              │
└─────────────────────────────────────────────────────────┘
```

About 60px tall total. Doesn't dominate the screen.

---

## B5. Page header presence

**Current problem:** Header is muted to the point of being invisible. Just "Today" + a date.

### New header

```tsx
<div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pb-2">
  <div>
    <h1 className="text-3xl font-semibold tracking-tight">Today</h1>
    <p className="mt-1 text-sm text-muted-foreground">
      {formattedDate} · {branchLabel}
    </p>
  </div>
  <div className="flex items-center gap-3">
    <p className="text-xs text-muted-foreground">
      Updated {relativeTime}
    </p>
    <Button variant="outline" size="sm" onClick={handleRefresh}>
      <RefreshCw className="h-3.5 w-3.5 mr-2" />
      Refresh
    </Button>
  </div>
</div>
```

Changes:
- Title `text-3xl font-semibold` (was probably `text-2xl`). The page deserves stronger anchoring.
- Date line stays muted — supportive, not competing.
- Refresh button kept on the right but smaller (`size="sm"`), with the timestamp inline beside it.
- On mobile, header items stack with proper spacing.

### Subtle but important

The page should have ~24px of vertical space between the header and the metric grid (`pb-2` on header + `space-y-6` on container = clean separation). Don't crowd them.

---

## B6. Enrolled Today density pass

The Enrolled Today list is currently airy. Tighten it.

```tsx
<div className="grid grid-cols-[1fr_1fr_auto_auto] items-center gap-4 px-5 py-3 border-b last:border-0 hover:bg-muted/40 transition-colors">
  <div>
    <p className="font-medium text-sm">{name}</p>
    <p className="text-xs text-muted-foreground tabular-nums">{phone}</p>
  </div>
  <div>
    <p className="text-sm">{planName}</p>
    {isFirstEnrollment && (
      <Badge variant="secondary" className="text-[10px] mt-0.5 bg-blue-50 text-blue-700 border-blue-200">
        New member
      </Badge>
    )}
  </div>
  <div className="text-right tabular-nums">
    <p className="text-sm font-medium">{formatMoney(amount)}</p>
    <p className="text-xs text-muted-foreground">{paymentMode}</p>
  </div>
  <div className="text-right">
    <p className="text-sm tabular-nums">{time}</p>
    <p className="text-xs text-muted-foreground">by {receptionistName}</p>
  </div>
</div>
```

Key changes:
- `New member` badge gets a soft blue tint (`bg-blue-50 text-blue-700 border-blue-200`) — a hint of brand, signals "fresh."
- Each row ~52px tall.
- Receptionist's own enrollments highlight: `bg-blue-50/40` row background — subtle, not loud.

```tsx
const ownRow = enrollment.enrolledByUserId === currentUserId;
className={cn(
  "...",
  ownRow && "bg-blue-50/40",
)}
```

---

## Final layout reference

After all six patches, the screen should look like this (descriptive, since I can't render):

```
┌──── Today                                  Updated 2m ago [Refresh] ┐
│     Sat, 2 May 2026 · All branches                                  │
├─────────────────────────────────────────────────────────────────────┤
│ ┌─ revenue (blue accent) ────┐  ┌─ enroll ┐ ┌─ expire (amber) ┐    │
│ │ COLLECTED TODAY            │  │ NEW     │ │ EXPIRING [4]    │    │
│ │                            │  │         │ │                 │    │
│ │ ₹4,200    (big, blue)      │  │ 2       │ │ 4               │    │
│ │ ↑ ₹3,200 vs yesterday      │  │ ↑ from 1│ │ 1 in 3d         │    │
│ └────────────────────────────┘  └─────────┘ └─────────────────┘    │
│                                              ┌─ frozen ──────┐     │
│                                              │ FROZEN NOW    │     │
│                                              │ 0             │     │
│                                              └───────────────┘     │
├─────────────────────────────────────────────────────────────────────┤
│ ┌─ Expiring soon (amber accent) [4] ─┐ ┌─ Recently expired (red) [2] ┐
│ │ Priya Patel  +91 87654 32109        │ │ Rohit Sharma  +91 ...        │
│ │ Half Yearly · Ends in 3d (red)      │ │ Quarterly · Expired 12d ago  │
│ │ ⚪ Not contacted    [WA] [Call]      │ │ 🟡 Reminded 2d  [WA] [Call]   │
│ │ ─────────────────                   │ │ ─────────────────             │
│ │ ... 3 more rows                     │ │ ... 1 more row                │
│ │ Show all 4 →                        │ │ Show all 2 →                  │
│ └─────────────────────────────────────┘ └──────────────────────────────┘
├─────────────────────────────────────────────────────────────────────┤
│ ┌─ Enrolled today [2] ─────────────────────────────────────────────┐│
│ │ Vibhu Dawar         Demo                ₹200    2:54 pm          ││
│ │ +91 81783 62985    [New member]         Cash    by Vibhu          ││
│ │ ─────────────────                                                  ││
│ │ Rohit Sharma       Quarterly Plan      ₹4,000  2:37 pm           ││
│ │ +91 93122 46402    [New member]         Cash    by Vibhu          ││
│ └────────────────────────────────────────────────────────────────────┘
└─────────────────────────────────────────────────────────────────────┘
```

The page should now feel:
- **Anchored** — eye lands on revenue first, then scans down.
- **Alive** — color tells you what matters; red/amber accents pull attention to action items.
- **Dense** — content fills the screen without crowding.
- **Calm** — neutrals dominate; color is signal, not skin.

---

## Acceptance Criteria

### Layout
- [ ] Hero revenue card spans 2 columns on desktop, full-width on mobile.
- [ ] Three secondary cards (Enrolled, Expiring, Frozen) are visually smaller (less padding, smaller number).
- [ ] Receptionist view: revenue card hidden, layout adapts to 3 equal cards.
- [ ] Branch manager view: same as owner but data scoped.

### Color signals
- [ ] Revenue figure displayed in `blue-600`.
- [ ] Expiring card has `amber-500` count badge when count > 0.
- [ ] Recently expired card has `red-600` count badge when count > 0.
- [ ] Frozen card has amber badge ONLY if `resumingIn7d > 0`.
- [ ] Days-to-expiry text in row colored: red ≤3 days, amber 4-7, neutral >7, red if expired.
- [ ] Up/down arrows in comparison: emerald for positive, red for negative.

### Action lists
- [ ] Expiring soon card has 4px `amber-500` left border accent.
- [ ] Recently expired card has 4px `red-600` left border accent.
- [ ] Card header includes count badge with status color.
- [ ] Action rows ~64px tall (verify visually — was ~110px).
- [ ] Phone number on same line as name, muted small font.
- [ ] Plan + days on one compressed line.
- [ ] Entire row is clickable (navigates to member detail).
- [ ] WhatsApp and Call buttons stop propagation (don't trigger row navigation).

### Empty states
- [ ] Single empty card collapses to ~80px height (single message line, no big emoji).
- [ ] If BOTH action cards are empty, render a single full-width "All members are up to date" card instead.
- [ ] Enrolled Today empty: ~60px compact message.

### Header
- [ ] Title is `text-3xl font-semibold tracking-tight`.
- [ ] Refresh button on the right with timestamp inline.
- [ ] Mobile: header items stack with proper gap.

### Enrolled Today
- [ ] Row height ~52px.
- [ ] "New member" badge uses soft blue tint (`bg-blue-50 text-blue-700 border-blue-200`).
- [ ] Receptionist's own enrollments have `bg-blue-50/40` background.
- [ ] Tabular nums applied to phone, amount, time.

### Visual consistency
- [ ] No gradients anywhere.
- [ ] No tinted backgrounds on metric cards.
- [ ] Color accents only via: left borders, count badges, number coloring, status dots, soft tints (`/40`).
- [ ] Lighthouse perf still ≥ 90.
- [ ] Mobile layout still works (no horizontal overflow, all touch targets ≥ 44px).

---

## Files Touched

```
app/(app)/_components/today/hero-revenue-card.tsx       (NEW — split out from metric-card)
app/(app)/_components/today/metric-card.tsx             (MODIFIED — secondary card variant)
app/(app)/_components/today/metric-grid.tsx             (MODIFIED — 1+3 grid)
app/(app)/_components/today/action-list.tsx             (MODIFIED — border accent, count badge)
app/(app)/_components/today/action-row.tsx              (MODIFIED — tighter, colored days)
app/(app)/_components/today/action-list-empty.tsx       (NEW)
app/(app)/_components/today/all-clear-card.tsx          (NEW — both-empty state)
app/(app)/_components/today/enrolled-today.tsx          (MODIFIED — denser rows, blue tint badge, own-row highlight)
app/(app)/_components/today/today-header.tsx            (MODIFIED — bigger title, inline refresh)

app/globals.css                                         (MODIFIED — add attention/urgent/success CSS vars)
```

---

## Common pitfalls

1. **Don't tint the metric card backgrounds.** It's tempting to give the Expiring card a faint amber background. Don't. The eye gets confused — is this an alert? An info card? The accent border is enough.

2. **The hero card's `col-span-2` must work in CSS Grid.** Use `grid-cols-4` on the parent (or `grid-cols-3` for receptionist view).

3. **Row click + button click conflict.** When the entire row navigates on click, the WhatsApp/Call buttons inside MUST call `e.stopPropagation()` in their click handlers, or clicking WhatsApp will both open WhatsApp AND navigate to the member detail. Test this explicitly.

4. **Hover states should be subtle.** `hover:bg-muted/40` is right. `hover:bg-muted` (no opacity) feels too aggressive on rows.

5. **The "all clear" card should ONLY appear when both action lists are empty.** If one has rows and the other is empty, show the small empty state in the empty card — don't replace both.

6. **Don't forget the count of 0 case in metric cards.** "Expiring 0" shouldn't have an amber badge — that's misleading. Hide the badge when count is 0.

7. **Test with realistic data densities.** Run the page with: zero data, 1 expiring, 18 expiring, 50+ expiring. The visual hierarchy should still hold at all scales.

8. **Color for the "from yesterday" arrow uses semantic green/red, not blue.** Blue is reserved for brand/primary. Emerald-600 = positive change, red-600 = negative.
