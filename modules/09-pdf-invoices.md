# Module 09 — PDF Invoice Generation

> Generate downloadable PDF invoices on demand. If gym has GSTIN set in Settings, output is GST-compliant tax invoice (HSN, CGST/SGST split, "Tax Invoice" label). Otherwise, simple receipt format. PDFs are generated on first request and cached; subsequent downloads serve instantly.

**Estimated time:** 1 day.
**Outcome:** Owner clicks "Download invoice" on any payment → gets a clean, professional PDF in ≤2 seconds. CA gets compliant tax invoices. Members can be sent invoice PDFs (manually for now; bulk email is a future feature).

---

## 9.1 Scope

In:
- On-demand PDF generation for any payment (enrollment, renewal, refund, correction).
- GST-compliant tax invoice format when `gym.gst_number` is set.
- Simple receipt format when no GSTIN.
- Caching in Supabase Storage; instant subsequent downloads.
- Cache invalidation when underlying payment is corrected.
- "Download invoice" button on payment rows + member detail.
- Bulk PDF download (zip of multiple invoices) for date range.
- Refund invoices: format follows the same rules but clearly labeled "Credit Note" (GST term for refund invoice).

Out:
- Email invoice to member (defer; needs SMTP).
- Branded invoice templates (logos, color overrides) — defer to v1.5.
- Multi-language invoices (English-only for v1).
- E-invoice (eInvoice IRN generation via GSTN portal) — only mandatory for businesses with >₹5 crore turnover. Defer.
- TDS/TCS handling. Out of scope.
- Editing the PDF after generation (PDFs are immutable; corrections regenerate).
- Watermark/signing for "Original / Duplicate / Triplicate" copies. Add if customer asks.

---

## 9.2 Architectural Decision: On-demand + Cached

This is the most important design choice in the module. Read § 9.2 carefully before coding.

### Why not generate on enrollment

- 90% of invoices are never downloaded. Pre-generating wastes storage at scale.
- Pre-generating couples invoice creation to enrollment, increasing transaction time.
- Cached PDF can drift from reality if the underlying payment is corrected; pre-generation means stale PDFs from day one.

### Why not always generate fresh on download

- ~1.5 seconds per generation. Repeated downloads of the same invoice (CA reviews, multiple devices, etc.) are wasteful.
- Server CPU and PDF library cost adds up at scale.

### The caching contract

```
First download of invoice ZEN-2026-0042:
  → Generate PDF
  → Upload to invoices/{gym_id}/{invoice_number}.pdf
  → Stream to browser
  Time: ~1.5s

Second+ download of same invoice (no payment correction in between):
  → Fetch from Supabase Storage
  → Stream to browser
  Time: ~200ms

After correction of payment:
  → Cache marked invalid (cached_pdf_path = null on payment row)
  → Next download regenerates
  → New PDF replaces old at same storage path
  Time: ~1.5s for first download after correction
```

### Storage path convention

```
invoices/{gym_id}/{invoice_number}.pdf
```

Examples:
- `invoices/abc-uuid/ZEN-2026-0042.pdf`
- `invoices/xyz-uuid/PFG-2026-0123.pdf`

Tenant-scoped. RLS on Supabase Storage: only authenticated users in matching gym can read.

### Cache invalidation triggers

- Payment edit (Module 04): set `payments.cached_pdf_path = null` and delete the storage object.
- Membership correction (Module 04 A4): same — invalidate any payments linked to the corrected membership.
- Refund processed: parent payment's PDF stays valid; the refund creates its own invoice (Credit Note). No cross-invalidation.
- Cancellation: any prior invoice PDFs stay valid (the cancellation doesn't change what was invoiced).
- Gym profile change (name, GST, invoice prefix): invalidate ALL cached PDFs for that gym.

### Database addition

```sql
-- payments table
alter table payments add column cached_pdf_path text;
alter table payments add column cached_pdf_generated_at timestamptz;
```

`cached_pdf_path` stores the storage object key. NULL means "needs generation." Setting to NULL is the invalidation mechanism.

---

## 9.3 Invoice Format Decision Logic

Server-side determination, no UI choice:

```ts
function determineInvoiceFormat(gym: Gym): 'tax_invoice' | 'simple_receipt' {
  if (gym.gst_number && GSTIN_PATTERN.test(gym.gst_number)) {
    return 'tax_invoice';
  }
  return 'simple_receipt';
}
```

If GSTIN is set AND validly formatted → tax invoice. Otherwise → simple receipt.

If owner unsets GSTIN later, *future* invoices become simple receipts. *Past* invoices stay as tax invoices (we don't retroactively rewrite history). The cached PDFs persist as they were.

---

## 9.4 Tax Invoice Format (GST-compliant)

This is what gets generated when GSTIN is set. Must match GST law's requirements for a valid tax invoice.

### Mandatory fields per GST law

These are non-negotiable for compliance:

| Field | Where it goes | Source |
|---|---|---|
| "Tax Invoice" label | Top of document | Hardcoded |
| Invoice number | Header | `payments.invoice_number` |
| Date of invoice | Header | `payments.payment_date` (in IST) |
| Supplier name | Top-left section | `gyms.name` |
| Supplier address | Top-left section | `gyms.address` (assemble from branch address if available) |
| Supplier GSTIN | Top-left section | `gyms.gst_number` |
| Supplier State / State Code | Top-left section | Derived from first 2 digits of GSTIN |
| Recipient name | Top-right section | `members.name` |
| Recipient phone | Top-right section | `members.phone` |
| Recipient GSTIN (if B2B) | Top-right section | `members.gst_number` (NEW field — see § 9.7) |
| Place of supply | Header line | Member's state if recipient GSTIN set, else supplier state |
| HSN/SAC code | Line item table | `999723` (fitness services) |
| Description of service | Line item table | Plan + add-on names |
| Quantity / Unit | Line item table | `1` / `service` for each line |
| Taxable value | Line item table | Net amount before GST |
| GST rate | Line item table | `18%` for fitness services |
| CGST amount | Tax breakdown | If intra-state: 9% of taxable value |
| SGST amount | Tax breakdown | If intra-state: 9% of taxable value |
| IGST amount | Tax breakdown | If inter-state: 18% of taxable value |
| Total tax | Footer | Sum of CGST + SGST or IGST |
| Total invoice value | Footer | Taxable value + tax |
| Total in words | Footer | "Two Thousand Nine Hundred and Fifty Only" |
| Signature placeholder | Footer | "Authorized Signatory" |

### Inclusive vs exclusive GST decision

**Crucial design decision:** is the plan price (e.g., ₹10,000 for Half Yearly) inclusive of GST or exclusive?

In India, fitness services typically advertise GST-inclusive prices ("₹10,000 all-inclusive"). The plan stores ₹10,000 as the customer-facing price.

For the tax invoice, we need to back-calculate:
```
Total invoice value = ₹10,000 (gross, inclusive)
GST rate = 18%
Taxable value = 10,000 / 1.18 = ₹8,474.58
GST amount = 10,000 - 8,474.58 = ₹1,525.42
  CGST (9%) = ₹762.71
  SGST (9%) = ₹762.71
```

Numbers don't always be clean rupees — show 2 decimal places on tax invoices specifically (per GST norms). Other displays continue using rounded rupees.

This means we need a **`gym.gst_inclusive` setting** (default `true`). Most Indian gyms quote inclusive prices. If a gym wants to switch to exclusive (B2B-only gym, etc.), they can toggle in Settings (add this to Module 12).

For v1 with `gst_inclusive = true` always — defer the toggle. Document in module spec.

### Layout (single A4 page)

```
┌───────────────────────────────────────────────────────────────────┐
│                          TAX INVOICE                              │
│                                                                   │
│  Zenith Fitness                            Invoice #: ZEN-2026-0042│
│  D-23, Connaught Place, New Delhi          Date: 02 May 2026      │
│  Delhi, 110001                                                    │
│  GSTIN: 07AABCZ1234F1Z5                    Place of supply: Delhi │
│  State: Delhi (07)                                                │
│                                                                   │
│  ─────────────────────                                            │
│                                                                   │
│  Bill to:                                                         │
│  Vibhu Dawar                                                      │
│  +91 81783 62985                                                  │
│  GSTIN: 27ABCDE1234F1Z5  (only if member has GSTIN)              │
│                                                                   │
│  ─────────────────────                                            │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ #  Description           HSN     Qty   Taxable    Rate  Amt │  │
│  │ 1  Half Yearly plan      999723  1    8,474.58   18%  10K  │  │
│  │ 2  Locker (add-on)       999723  1      423.73   18%   500 │  │
│  │                                                             │  │
│  │                          Taxable value (subtotal)  8,898.31│  │
│  │                          CGST @ 9%                   801.85│  │
│  │                          SGST @ 9%                   801.85│  │
│  │                          ─────────────                     │  │
│  │                          Total tax                 1,603.69│  │
│  │                          ─────────────                     │  │
│  │                          Total                    10,500.00│  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  Total in words: Ten Thousand Five Hundred Rupees Only            │
│                                                                   │
│  Payment mode: Cash · Received on 02 May 2026                     │
│                                                                   │
│  ─────────────────────                                            │
│                                                                   │
│                                          For Zenith Fitness       │
│                                                                   │
│                                                                   │
│                                          Authorized Signatory    │
└───────────────────────────────────────────────────────────────────┘
```

### Inter-state vs intra-state

Determined by comparing supplier state code (first 2 digits of supplier GSTIN) to recipient's state.

For B2C (no recipient GSTIN), assume intra-state — recipient state == supplier state. This is the safe default; B2C members rarely cross state lines for gym memberships, and we don't capture state otherwise.

For B2B (recipient GSTIN present), use first 2 digits of recipient's GSTIN. If different from supplier's → IGST 18%. Same → CGST 9% + SGST 9%.

### Discounts on tax invoice

Discounts must be shown on the line item, BEFORE tax calculation. GST is calculated on the post-discount amount.

```
Half Yearly plan:
  Plan price (gross):  ₹10,000
  Discount:           -₹1,000
  Taxable value:       ₹9,000
  Tax (18%):           ₹1,620
  Final:              ₹10,620
```

Discount handling on the PDF: show the original price struck through, then the discounted price. Or use a clear "Discount" line. The CA needs to see what discount was applied — don't hide it.

---

## 9.5 Simple Receipt Format

For gyms without GSTIN. No tax fields, no HSN, no compliance burden. Just a clean receipt.

### Mandatory fields

| Field | Source |
|---|---|
| "Receipt" label | Hardcoded |
| Receipt number | `payments.invoice_number` (still call it invoice_number internally) |
| Date | `payments.payment_date` |
| Gym name | `gyms.name` |
| Branch name + address | `branches.name`, `branches.address` |
| Gym phone | `gyms.phone` (if set) |
| Member name + phone | `members.name`, `members.phone` |
| Service description | Plan name + add-ons + period |
| Amount details | Plan price, add-ons, discount, total |
| Payment mode | "Cash" / "UPI" / etc. |

### Layout

```
┌───────────────────────────────────────────────────────────────────┐
│                              RECEIPT                              │
│                                                                   │
│  Zenith Fitness                            Receipt #: ZEN-2026-0042│
│  D-23, Connaught Place, New Delhi          Date: 02 May 2026      │
│  Phone: +91 9876543210                                            │
│                                                                   │
│  ─────────────────────                                            │
│                                                                   │
│  Received from:                                                   │
│  Vibhu Dawar                                                      │
│  +91 81783 62985                                                  │
│                                                                   │
│  ─────────────────────                                            │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ Service                                              Amount │  │
│  │ Half Yearly plan (1 May 2026 to 27 Oct 2026)        10,000 │  │
│  │ Locker (add-on)                                        500 │  │
│  │ Discount                                              -500 │  │
│  │                                                             │  │
│  │                                            Total    10,000 │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  Total in words: Ten Thousand Rupees Only                         │
│                                                                   │
│  Payment mode: Cash                                               │
│  Received on: 02 May 2026                                         │
│                                                                   │
│  ─────────────────────                                            │
│                                                                   │
│  Thank you for your payment.                                      │
└───────────────────────────────────────────────────────────────────┘
```

Simpler than tax invoice. Same single-page A4. No taxable values, no GST split.

---

## 9.6 Refund Invoice (Credit Note Format)

When a refund is issued, generate a Credit Note PDF.

### For GST-registered gyms

GST law requires Credit Notes for refunds, with specific labeling:

```
┌───────────────────────────────────────────────────────────────────┐
│                          CREDIT NOTE                              │
│                                                                   │
│  Zenith Fitness                       Credit Note #: ZEN-2026-0050│
│  ...                                  Date: 05 May 2026           │
│  GSTIN: ...                                                       │
│                                                                   │
│  Original Invoice: ZEN-2026-0042 dated 02 May 2026                │
│                                                                   │
│  Reason for credit note: Cancelled due to relocation              │
│                                                                   │
│  Bill to: ...                                                     │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ Refund of services from invoice ZEN-2026-0042               │  │
│  │                                              -10,000        │  │
│  │ Taxable value reversal               -8,474.58              │  │
│  │ CGST @ 9% reversal                     -762.71              │  │
│  │ SGST @ 9% reversal                     -762.71              │  │
│  │                                                             │  │
│  │ Total credit                       -10,000.00              │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  Refund mode: UPI                                                 │
│  Refund processed on: 05 May 2026                                 │
└───────────────────────────────────────────────────────────────────┘
```

### For gyms without GSTIN

Just a "Refund Receipt":

```
┌───────────────────────────────────────────────────────────────────┐
│                         REFUND RECEIPT                            │
│                                                                   │
│  Original Receipt: ZEN-2026-0042                                  │
│  Reason: Cancelled due to relocation                              │
│  Refund amount: -₹10,000                                          │
│  Refund mode: UPI                                                 │
│                                                                   │
│  ─────────────────────                                            │
└───────────────────────────────────────────────────────────────────┘
```

---

## 9.7 Schema Additions

Two columns to add. Both should be safe additions to existing tables.

### `payments` table

```sql
alter table payments add column cached_pdf_path text;
alter table payments add column cached_pdf_generated_at timestamptz;
```

### `members` table — recipient GSTIN

```sql
alter table members add column gst_number text;
```

Validates against `GSTIN_PATTERN` from Module 12 when set. Optional. Most members won't have one (B2C), but some corporate / freelancer members will (B2B).

Add a small "GSTIN (optional)" field to the Add Member sheet (Module 03). Just an optional input. Document in Module 09's "Files Touched" — minimal change.

### `gyms` table — supplier address

```sql
alter table gyms add column address text;
alter table gyms add column state text;          -- e.g., "Delhi", "Maharashtra"
alter table gyms add column state_code text;     -- e.g., "07", "27" (matches first 2 chars of GSTIN)
alter table gyms add column phone text;
```

If the gym has multiple branches, the supplier address shown on invoice is the **branch's address** (where the membership was sold), not the gym-level address. Resolve at invoice generation time:
- Branch address from `branches.address` (already exists from Module 12).
- Fall back to gym-level address if branch doesn't have one.

Gym state and state_code drive the inter-state vs intra-state determination. Auto-populate state_code from GSTIN's first 2 digits when GSTIN is saved.

Settings → Gym profile (Module 12) needs these fields added: address, state, phone. Quick addition.

---

## 9.8 PDF Generation

Use `@react-pdf/renderer` (already in your stack from Module 00). Server-side rendering only — no client-side PDF generation.

### Why @react-pdf/renderer

- Already in stack.
- React JSX templates (familiar).
- Decent layout primitives.
- Reasonable PDF output quality.
- Active maintenance.

Alternative considered: `pdfmake` (more programmatic, less React-flavored), `puppeteer` (HTML-to-PDF; heavier, requires Chrome). Stick with what's already there.

### Template structure

```
lib/pdf/templates/
  invoice-base.tsx              # Shared layout primitives
  tax-invoice.tsx               # GST-compliant template
  simple-receipt.tsx            # Non-GST template
  credit-note.tsx               # GST refund
  refund-receipt.tsx            # Non-GST refund
  components/
    header.tsx                  # Gym/branch info block
    bill-to.tsx                 # Recipient block
    line-items-table.tsx        # The main table
    tax-summary.tsx             # CGST/SGST/IGST breakdown
    footer.tsx                  # Total in words, signature
```

### Generation flow

```ts
async function generateInvoicePDF(paymentId: string): Promise<Buffer>;
```

Algorithm:
```
1. Load payment, gym, branch, member, plan, addons, freezes (if relevant).
2. Determine format: tax_invoice | simple_receipt | credit_note | refund_receipt.
3. Compute taxable amounts (back-calculate from gross if GST inclusive).
4. Determine intra/inter state if tax invoice.
5. Render React PDF document.
6. Convert to Buffer.
7. Return.
```

### "Total in words" helper

Convert rupees to Indian words ("One Lakh Twenty Thousand"). Use a small library — `to-words` package handles this with `currency: 'INR'` config. ~5 lines of integration.

```ts
import { ToWords } from 'to-words';

const toWords = new ToWords({
  localeCode: 'en-IN',
  converterOptions: {
    currency: true,
    ignoreDecimal: false,
    ignoreZeroCurrency: false,
  },
});

// Usage: toWords.convert(10500.00) → "Ten Thousand Five Hundred Rupees Only"
```

---

## 9.9 Server Layer

### `server/services/invoice-pdf.ts`

```ts
async function getOrGenerateInvoicePDF(paymentId: string): Promise<{
  pdfBuffer: Buffer;
  filename: string;
  cached: boolean;
}>;
```

Algorithm:
```
1. Load payment row.
2. If payment.cached_pdf_path set:
   - Try to download from Supabase Storage.
   - If success, return { buffer, filename, cached: true }.
   - If 404 (storage object missing), continue to generation.
3. Generate PDF via generateInvoicePDF().
4. Upload to invoices/{gym_id}/{invoice_number}.pdf.
5. UPDATE payments SET cached_pdf_path, cached_pdf_generated_at.
6. Return { buffer, filename, cached: false }.
```

### `server/actions/invoices/download-invoice.ts`

Server action returning the PDF as a downloadable response:

```ts
async function downloadInvoice(paymentId: string): Promise<Response>;
```

Sets `Content-Type: application/pdf`, `Content-Disposition: attachment; filename=...`. Filename: `{invoice_number}.pdf` (e.g., `ZEN-2026-0042.pdf`).

Permission: any role can download invoices for their gym (RLS handles tenant scope; branch-scoped users get only their branch's invoices via RLS on payments table from earlier modules).

### `server/actions/invoices/bulk-download.ts`

For "download all invoices in date range" use case:

```ts
async function bulkDownloadInvoices(input: {
  fromDate: string;
  toDate: string;
  branchId?: string;
}): Promise<Response>;  // Returns ZIP file
```

Algorithm:
1. Query payments in range.
2. For each, get-or-generate the PDF (parallel via `Promise.allSettled`).
3. Stream into a zip archive (use `archiver` library).
4. Return zipped response.

Filename: `invoices-{gym-name}-{from}-to-{to}.zip`.

Cap at 500 invoices per bulk download to prevent abuse / timeouts. If owner has more, they need to chunk.

### `server/services/invalidate-invoice-cache.ts`

```ts
async function invalidateInvoiceCache(paymentId: string): Promise<void>;
async function invalidateAllInvoicesForGym(gymId: string): Promise<void>;
```

Called from:
- Module 04 payment edit service → `invalidateInvoiceCache(paymentId)` after commit.
- Module 04 amendment correction service → invalidate the linked payment's PDF.
- Module 12 gym profile update (if name/address/GSTIN/prefix changed) → `invalidateAllInvoicesForGym(gymId)`.

Implementation:
```sql
update payments
set cached_pdf_path = null, cached_pdf_generated_at = null
where id = $1;
```

Then delete the storage object (best-effort; failure to delete isn't critical, just leaves a stale file).

---

## 9.10 UI

### "Download invoice" buttons

Several places get a download button:

**Member detail page → Recent payments card:**
- Each payment row gets a `[⬇ Invoice]` icon button.
- Click → triggers download, button shows brief "Generating..." state, then PDF downloads.

**Payment detail (if exists, Module 04):**
- Prominent "Download invoice" button.

**Reports → Revenue tab → Daily breakdown:**
- Each row's `⋯` menu has "Download invoices for this day."
- Triggers bulk download for that single day.

**Reports tab → Plans / Discounts:**
- No download button on aggregated rows. Use Revenue tab for per-day downloads.

### Bulk download UI

In Reports → Revenue tab, a `[Download all invoices for period]` button next to Export. Click → confirmation dialog with row count, then triggers ZIP download.

```
Download all invoices?
This will generate a ZIP file with 47 invoices for the selected period.
First-time generation may take up to 30 seconds.

[Cancel]    [Download ZIP]
```

### Generating state

For single download:
- Click button → show spinner inline → download triggers when ready (~1.5s for first generation, ~200ms for cached).

For bulk download:
- Click → show progress modal: "Generating invoices... 23 / 47 done."
- Modal closes when ZIP starts downloading.

### Mobile

- Single download buttons work fine on mobile.
- Bulk download is owner-feature; usually used on desktop.
- PDF rendering is server-side, so mobile clients just receive the file.

---

## 9.11 Acceptance Criteria

### Format selection
- [ ] Gym with GSTIN set → tax invoice generated.
- [ ] Gym without GSTIN → simple receipt generated.
- [ ] Refund payment for GST gym → credit note format.
- [ ] Refund payment for non-GST gym → refund receipt format.
- [ ] Owner unsetting GSTIN does not retroactively change cached PDFs.

### Tax invoice content (GST-compliant)
- [ ] "Tax Invoice" label at top.
- [ ] All mandatory fields present (per § 9.4 table).
- [ ] HSN code 999723 on every line item.
- [ ] CGST + SGST split correctly for intra-state.
- [ ] IGST applied for inter-state (recipient GSTIN with different state code).
- [ ] Discount shown on line item, taxable value computed post-discount.
- [ ] Total in words rendered correctly using to-words.
- [ ] "Authorized Signatory" placeholder at bottom.
- [ ] Place of supply displayed.

### Simple receipt content
- [ ] "Receipt" label at top.
- [ ] No HSN, no CGST/SGST, no taxable value fields.
- [ ] Plan period shown clearly.
- [ ] Payment mode visible.

### Caching
- [ ] First download generates and caches.
- [ ] Second download serves from cache (verify via timing or cache-flag).
- [ ] Payment edit invalidates cache; next download regenerates.
- [ ] Membership correction invalidates linked payment's cache.
- [ ] Gym profile change (name/GSTIN/prefix/address) invalidates all gym's invoices.
- [ ] Cached PDFs stored at `invoices/{gym_id}/{invoice_number}.pdf`.
- [ ] Storage RLS prevents cross-tenant access.

### Bulk download
- [ ] Range with 5 invoices generates ZIP successfully.
- [ ] ZIP filename matches pattern.
- [ ] Each PDF inside ZIP is named correctly.
- [ ] Bulk capped at 500 invoices with clear error message above limit.
- [ ] Generation progress shown to user.

### UI integration
- [ ] Download icon on every payment row in member detail.
- [ ] Bulk download button in Reports Revenue tab.
- [ ] Mobile: single download works.

### Edge cases
- [ ] Member with very long name (50+ chars) — PDF doesn't break layout.
- [ ] Plan name in Hindi/Devanagari — renders correctly (font supports).
- [ ] Refund with no original payment notes — PDF doesn't crash.
- [ ] Payment with discount of ₹0 — discount line not shown (clean).
- [ ] Member without GSTIN — recipient GSTIN line not shown.

### General
- [ ] PDF generation < 2 seconds per invoice on realistic data.
- [ ] Cached download < 500ms.
- [ ] No `any` types.
- [ ] All money rendered in Indian format on PDFs (₹4,500 not ₹4500).
- [ ] No N+1 in bulk download — fetch payments + related data in single query.

---

## 9.12 Files Created in This Module

```
lib/db/schema/payments.ts                                (MODIFIED — add cached_pdf_path columns)
lib/db/schema/members.ts                                 (MODIFIED — add gst_number)
lib/db/schema/gyms.ts                                    (MODIFIED — add address, state, state_code, phone)
lib/db/migrations/0009_invoice_pdf.sql                   (NEW)

lib/pdf/templates/invoice-base.tsx                       (NEW)
lib/pdf/templates/tax-invoice.tsx                        (NEW)
lib/pdf/templates/simple-receipt.tsx                     (NEW)
lib/pdf/templates/credit-note.tsx                        (NEW)
lib/pdf/templates/refund-receipt.tsx                     (NEW)
lib/pdf/templates/components/header.tsx
lib/pdf/templates/components/bill-to.tsx
lib/pdf/templates/components/line-items-table.tsx
lib/pdf/templates/components/tax-summary.tsx
lib/pdf/templates/components/footer.tsx
lib/pdf/utils/compute-tax.ts                             (back-calculate taxable values)
lib/pdf/utils/state-from-gstin.ts                        (extract state code)
lib/pdf/utils/to-words.ts                                (wrap to-words library)

server/services/invoice-pdf.ts                           (generateInvoicePDF)
server/services/get-or-generate-invoice.ts               (caching layer)
server/services/invalidate-invoice-cache.ts              (NEW)

server/actions/invoices/download-invoice.ts              (NEW)
server/actions/invoices/bulk-download-invoices.ts        (NEW)

server/services/payments/edit-payment.ts                 (MODIFIED — call invalidateInvoiceCache)
server/services/correct-membership.ts                    (MODIFIED — invalidate linked payment)
server/services/settings/update-gym-profile.ts           (MODIFIED — invalidateAllInvoicesForGym if address/GSTIN/prefix changed)

app/(app)/members/[id]/_components/recent-payments-card.tsx     (MODIFIED — add download button)
app/(app)/members/[id]/_components/current-membership-card.tsx  (MODIFIED — invoice link in correction marker)
app/(app)/reports/_components/revenue-tab.tsx                    (MODIFIED — add bulk download button)
app/(app)/reports/_components/bulk-download-dialog.tsx           (NEW)
app/(app)/members/[id]/_components/add-member-sheet.tsx          (MODIFIED — add optional GSTIN field)

app/(app)/settings/gym/_components/gym-profile-form.tsx          (MODIFIED — add address, state, phone fields)
```

Plus `to-words` and `archiver` packages added to `package.json`.

---

## 9.13 Common Pitfalls

1. **Tax inclusivity is the most error-prone calculation.** If the gym quotes ₹10,000 inclusive and we compute taxable as `10,000 / 1.18 = 8,474.58`, that's correct. If we compute it as `10,000 * 0.82 = 8,200`, that's wrong. Use proper division by `(1 + rate)`. Test with known examples; have a CA verify if possible.

2. **State code extraction from GSTIN.** First 2 chars of a 15-char GSTIN are the state code. `27ABCDE1234F1Z5` → `27` → Maharashtra. Build a static lookup table for state code → state name (33 codes total, won't change). Don't try to look it up dynamically.

3. **Cached PDF path must be tenant-scoped.** `invoices/{gym_id}/...`. Never use a flat namespace; cross-tenant collisions on invoice_number are possible (e.g., two gyms both have "ZEN-2026-0001").

4. **Storage RLS is critical.** Configure Supabase Storage policies so authenticated users can only read objects under `invoices/{their_gym_id}/`. Without this, anyone with a guessed URL could download cross-tenant invoices.

5. **The "supplier address" comes from the branch, not the gym.** Multi-branch gyms have multiple addresses. The invoice shows the branch where the sale happened. Always derive from `branches.address` first; fall back to gym-level only if branch address is null.

6. **Don't forget to invalidate cache on payment edit.** This is the one cache invalidation people miss. Test specifically: edit a payment, download invoice, verify the new amount appears (not the cached old one).

7. **`to-words` defaults to international format.** Configure with `localeCode: 'en-IN'` to get "One Lakh Twenty Thousand" instead of "One Hundred Twenty Thousand." Test with values in lakhs.

8. **Refund invoices need their own invoice_number.** Module 04 already does this — refunds get fresh invoice numbers (`ZEN-2026-0050` instead of reusing the original `ZEN-2026-0042`). Confirm this hasn't drifted.

9. **PDF generation memory.** `@react-pdf/renderer` can be heavy in serverless functions. For Vercel, ensure your function has enough memory allocated (1024 MB recommended for PDF generation routes). Monitor cold-start times.

10. **The "Total in words" must round correctly.** ₹10,500.00 is "Ten Thousand Five Hundred Rupees Only." ₹10,500.45 is "Ten Thousand Five Hundred Rupees and Forty Five Paise Only." Don't strip the paise on tax invoices (legally required to show 2 decimals).

11. **Place of supply is mandatory on tax invoice.** It's the recipient's state. For B2C without recipient GSTIN, default to supplier state. Don't leave this field blank — that's a GST law violation.

12. **Bulk download timeout.** Vercel functions have a 60-second hard limit on Hobby tier, 300 seconds on Pro. 500 invoices × 1.5s each = 750 seconds — exceeds even Pro. The cache trick saves us: subsequent ZIP generations are mostly cached; only first-time generation is slow. Document this trade-off; consider chunking.

13. **HSN code for fitness services is 999723.** This is the SAC (Services Accounting Code) for "Physical well-being including health club & fitness centre services." Hardcode this; don't ask owner to enter.

14. **GST rate for fitness services is 18%.** Currently. This rate has changed once before (from earlier 28% briefly). Hardcode but with a constant that's easy to update: `GST_RATE_FITNESS = 0.18`.

---

## 9.14 What this changes about the product

After this module, the product handles the full financial documentation lifecycle. Member pays → SMS receipt (Module 11) → PDF tax invoice (Module 09) → owner exports for CA (Module 07 + this).

This is what makes the product *complete* for a GST-registered gym. Without GST-compliant invoices, a serious gym owner cannot use your software — they'd have to maintain a parallel invoice system. With this, your software IS their invoicing system.

For non-GST small gyms (probably 60% of your initial customer base), the simple receipt is what they've been giving anyway, just nicer-looking and consistent.

---

## 9.15 What's next

After Module 09, **v1 is functionally complete.** Time to:
1. Demo to real gym owners. (Genuinely. You've been deferring this since Module 05.)
2. Sign first 3-5 paying customers at Basic tier.
3. Listen to what they ask for.
4. Module 10 (WhatsApp Pro tier automation) only when validated by customer demand.

You've built a serious product. Time to validate it.
