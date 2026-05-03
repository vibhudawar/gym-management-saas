# Module 11 — Member Transactional Notifications

> Send receipt-style messages to members on every payment-affecting event. Solves a real fraud pattern in Indian gyms: branch managers pocketing cash and "forgetting" to record entries. The moment a payment is recorded, the member receives an independent receipt — system-generated, not staff-controlled. If the message doesn't arrive, the member knows at the desk while cash is still recoverable.
>
> Built provider-agnostic with a stub implementation. When you onboard a paying customer, you sign up with MSG91 (which handles both SMS and WhatsApp), file DLT registration, complete Meta Business verification for WhatsApp, and swap the stub for the real provider. ~1 hour of code change.

**Estimated time:** 1.5–2 days.
**Outcome:** Every enrollment, renewal, refund, correction, and cancellation triggers a templated message to the member's phone. Stub provider lets you test end-to-end without real SMS costs. Owner sees delivery status per member. Architecture ready for production swap.

---

## 11.1 Scope

In:
- `notifications` schema with full audit trail and delivery tracking.
- `MessageProvider` interface with `StubProvider` (logs to DB) and `MSG91Provider` (SMS + WhatsApp, scaffolded).
- Templated messages for 5 event types: enrollment, renewal, refund, correction, cancellation.
- Async dispatch — payment commits first, message fires after (no blocking).
- Per-gym channel configuration: SMS (Basic tier) or SMS + WhatsApp (Pro tier).
- Retry logic for failed sends (up to 3 attempts).
- Notification status indicator on member detail (last message sent, delivery status).
- Manual "Resend" button for owner if a message failed.
- Notifications log section on member detail (see all messages sent to this member).
- Settings UI for channel selection (visible based on subscription_tier).

Out:
- Inbound message handling (member replies — defer; out of scope for transactional receipts).
- Marketing campaigns / bulk send (different feature; not transactional).
- Read receipts UI surface (we store delivery status; "read" status is WhatsApp-only and adds complexity).
- Multi-language templates (English-only at v1; templates structured to support future locale).
- Owner notifications (this module is member-facing only).
- Email channel (deferred; SMS/WhatsApp are sufficient for India).
- Notification preferences per member (always send, no opt-out — per § 11.0 decision).

---

## 11.0 Design decisions (locked-in)

These were decided in the discussion that led to this module. Don't relitigate without strong reason.

1. **Always send, no opt-out.** Transactional messages don't require opt-in under Indian TRAI rules. Opt-out would defeat the fraud-protection purpose.
2. **Async, non-blocking.** The DB transaction commits first. Message dispatch happens after, with retries. Payment success doesn't depend on message success.
3. **SMS for Basic tier, SMS + WhatsApp for Pro tier.** Channel selection lives at the gym level, not per-member.
4. **Stub provider for v1.** Real provider (MSG91) wired during first customer onboarding. MSG91 handles both SMS and WhatsApp under one provider account.
5. **Templates are server-controlled, not customer-customizable.** Owners cannot edit message text. This protects the receipt's evidential value (a custom-edited receipt is less credible in a dispute).
6. **No member-facing UI.** Members receive the message; they don't log into the system.

---

## 11.2 Data Model

### `notifications` table

Tracks every message attempt — sent, queued, delivered, failed.

| column | type | notes |
|---|---|---|
| id | uuid PK | |
| gym_id | uuid not null | FK → gyms (denormalized for RLS) |
| branch_id | uuid not null | FK → branches |
| member_id | uuid not null | FK → members |
| event_type | text not null | `enrollment` \| `renewal` \| `refund` \| `correction` \| `cancellation` |
| trigger_entity_type | text not null | `membership` \| `payment` |
| trigger_entity_id | uuid not null | The membership_id or payment_id that triggered this |
| channel | text not null | `sms` \| `whatsapp` |
| recipient_phone | text not null | snapshot of member.phone in E.164; in case member changes phone later |
| template_key | text not null | identifier of the template used (e.g., `receipt_enrollment_v1`) |
| message_body | text not null | the actual rendered message — stored for audit/replay |
| provider | text not null | `stub` \| `msg91` |
| provider_message_id | text | ID returned by provider (for status polling/correlation) |
| status | text not null | `pending` \| `sent` \| `delivered` \| `failed` |
| failure_reason | text | nullable; only set on `failed` |
| attempt_count | integer not null default 0 | how many times we've tried to send |
| next_retry_at | timestamptz | when next retry is scheduled (null if no more retries) |
| sent_at | timestamptz | when the provider acknowledged the send |
| delivered_at | timestamptz | when delivery confirmed (provider webhook); null if not confirmed |
| created_at | timestamptz not null default now() | |
| updated_at | timestamptz not null default now() | |

**Indexes:**
- `(gym_id, member_id, created_at desc)` — member detail "Notifications log" card.
- `(status, next_retry_at) where status = 'pending'` — partial index for retry worker.
- `(provider_message_id) where provider_message_id is not null` — correlation with delivery webhooks.
- `(gym_id, created_at desc)` — owner-level notifications view (future).

**Constraints:**
- `event_type in ('enrollment','renewal','refund','correction','cancellation')`
- `channel in ('sms','whatsapp')`
- `provider in ('stub','msg91')`
- `status in ('pending','sent','delivered','failed')`
- `attempt_count >= 0 and attempt_count <= 5`
- `(status = 'failed') = (failure_reason is not null OR attempt_count >= 3)`

**RLS:** standard tenant isolation. No branch scoping — both Owner and Branch Manager need visibility into all messages for their gym.

### `gyms` table additions

| column | type | notes |
|---|---|---|
| notification_channel | text not null default `'sms'` | `sms` \| `whatsapp` \| `sms+whatsapp` |
| notification_provider | text not null default `'stub'` | `stub` \| `msg91` |
| sender_id | text | DLT-approved sender ID for SMS (e.g., `ZENITH`); set during provider setup |
| whatsapp_template_namespace | text | MSG91 WhatsApp template namespace; set when Pro tier configures |

These are populated during provider setup. The stub provider doesn't need them. MSG91 will validate they exist before allowing sends (sender_id for SMS, template namespace for WhatsApp).

### `notification_templates` — NOT a DB table

Templates are code, not data. They live in `lib/notifications/templates.ts`. Reasons:
- Templates change with business logic (new fields, new event types). Code-versioned alongside the events that use them.
- DLT requires pre-approved SMS templates. Storing in DB invites accidental edits that desync from DLT-registered text.
- No customer customization (per § 11.0 decision #5).

If you ever need per-gym customization (Pro tier feature, post-v1), it can be a `template_overrides` table with whitelisted variable substitutions.

---

## 11.3 Templates

Each event type has one template per channel. Templates use `{{variable}}` syntax.

### Template structure

```ts
// lib/notifications/templates.ts
export type TemplateKey =
  | 'receipt_enrollment_v1'
  | 'receipt_renewal_v1'
  | 'receipt_refund_v1'
  | 'receipt_correction_v1'
  | 'receipt_cancellation_v1';

export type TemplateVariables = Record<string, string>;

export type Template = {
  key: TemplateKey;
  channel: 'sms' | 'whatsapp';
  body: string;
  requiredVars: string[];
};

export const TEMPLATES: Template[] = [
  // ... see below
];
```

### v1 templates (English, India context)

**Enrollment / Renewal (one template, content adapts):**
```
Hi {{member_name}}, your {{plan_name}} membership at {{gym_name}} is confirmed.
Valid: {{start_date}} to {{end_date}}
Amount: ₹{{amount}}
Invoice: {{invoice_number}}
Branch: {{branch_name}}
Save this as your receipt.
```

**Refund:**
```
Hi {{member_name}}, a refund of ₹{{amount}} has been processed for invoice {{original_invoice}}.
Refund invoice: {{refund_invoice}}
Mode: {{payment_mode}}
{{gym_name}}, {{branch_name}}
```

**Correction:**
```
Hi {{member_name}}, your enrollment at {{gym_name}} was updated.
Updated plan: {{plan_name}}
Updated amount: ₹{{amount}}
Valid: {{start_date}} to {{end_date}}
Invoice: {{invoice_number}}
{{branch_name}}
```

**Cancellation:**
```
Hi {{member_name}}, your {{plan_name}} membership at {{gym_name}} has been cancelled effective {{effective_date}}.
{{#if refund_amount}}Refund of ₹{{refund_amount}} processed.{{/if}}
{{branch_name}}
```

### Template rules

- **No staff names ever.** Receipts are about the transaction, not the person who entered it. Including a name accidentally implies blame.
- **Always include invoice number.** It's the system's anchor — uneditable, sequential, verifiable.
- **Always include branch name.** Helps member confirm "yes I paid here."
- **Receipt language ("Save this as your receipt").** Frames the message as a record, not marketing. Crucial for evidential value.
- **No links in v1.** No "click to verify" or "rate us" links. Pure receipt. (Verification UI is a future feature.)

### SMS character budget

DLT-registered transactional SMS in India: 160 chars per credit, then split. Aim for templates under 320 chars (2 credits). All v1 templates fit.

### WhatsApp template considerations

WhatsApp Business templates require Meta approval and use a slightly different syntax. The same content, re-formatted with proper variables in Meta's template syntax, gets registered with MSG91 (which forwards to Meta) when Pro tier goes live. v1 stub uses the same body string for both channels.

### Template renderer

```ts
// lib/notifications/render-template.ts
export function renderTemplate(key: TemplateKey, vars: TemplateVariables): string {
  const template = TEMPLATES.find(t => t.key === key);
  if (!template) throw new Error(`Template not found: ${key}`);

  // Validate all required vars present
  for (const v of template.requiredVars) {
    if (vars[v] === undefined) throw new Error(`Missing variable: ${v}`);
  }

  // Simple {{var}} substitution; supports basic {{#if x}} ... {{/if}} blocks
  let body = template.body;
  for (const [k, v] of Object.entries(vars)) {
    body = body.replaceAll(`{{${k}}}`, v);
  }
  body = handleConditionalBlocks(body, vars);
  return body.trim();
}
```

Keep the templating engine deliberately tiny. No Handlebars, no Mustache. Just `{{var}}` substitution + simple `{{#if x}} ... {{/if}}` for optional blocks. The whole renderer should be ~40 lines.

---

## 11.4 Provider Interface

The architectural keystone. Every provider implements this; calling code doesn't know which it's using.

```ts
// lib/notifications/provider.ts
export interface MessageProvider {
  readonly name: 'stub' | 'msg91';
  readonly supportedChannels: ('sms' | 'whatsapp')[];

  send(input: {
    to: string;                     // E.164 phone
    channel: 'sms' | 'whatsapp';
    body: string;                   // pre-rendered message
    senderId?: string;              // SMS sender ID (DLT-approved, e.g., ZENITH)
    metadata?: Record<string, string>; // for provider-specific tracking
  }): Promise<
    | { ok: true; providerMessageId: string }
    | { ok: false; error: string; retriable: boolean }
  >;
}
```

### Stub provider — `lib/notifications/providers/stub-provider.ts`

For v1. Logs to DB, returns success. Doesn't actually send.

```ts
export class StubProvider implements MessageProvider {
  readonly name = 'stub';
  readonly supportedChannels = ['sms', 'whatsapp'] as const;

  async send(input) {
    // In dev: console.log so you can see the messages locally
    if (process.env.NODE_ENV === 'development') {
      console.log(`[STUB ${input.channel.toUpperCase()}] To: ${input.to}\n${input.body}\n---`);
    }
    // Always succeed
    return { ok: true, providerMessageId: `stub-${crypto.randomUUID()}` };
  }
}
```

### MSG91 provider — scaffold (handles SMS and WhatsApp)

```ts
export class MSG91Provider implements MessageProvider {
  readonly name = 'msg91';
  readonly supportedChannels = ['sms', 'whatsapp'] as const;

  constructor(private apiKey: string) {}

  async send(input) {
    if (input.channel === 'sms') {
      return this.sendSMS(input);
    }
    return this.sendWhatsApp(input);
  }

  private async sendSMS(input) {
    if (!input.senderId) {
      return { ok: false, error: 'MSG91 SMS requires senderId (DLT-approved)', retriable: false };
    }

    // TODO: Wire actual MSG91 SMS API call
    // POST https://control.msg91.com/api/v5/flow/
    // Headers: { authkey: this.apiKey, 'Content-Type': 'application/json' }
    // Body: { template_id, sender, mobiles, VAR1, VAR2, ... }
    // Reference: https://docs.msg91.com/

    throw new Error('MSG91Provider.sendSMS not implemented — replace stub when launching');
  }

  private async sendWhatsApp(input) {
    // TODO: Wire actual MSG91 WhatsApp API call
    // POST https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/
    // Headers: { authkey: this.apiKey, 'Content-Type': 'application/json' }
    // Body: { integrated_number, content_type, payload: { to, type, template, ... } }
    // Reference: https://docs.msg91.com/whatsapp/

    throw new Error('MSG91Provider.sendWhatsApp not implemented — replace stub when launching');
  }
}
```

The shape is in place; both fetch calls are TODO. When you're ready (post-DLT and Meta verification), implementing both is ~60 lines of code following MSG91's docs.

Why one provider class for both channels: MSG91 uses the same API key, same dashboard, same billing, and similar request shape for SMS and WhatsApp. Splitting them into two classes would duplicate the auth setup and obscure the fact that they share infrastructure. If you ever swap WhatsApp to a different BSP (e.g., AiSensy), you'd add a separate `AiSensyProvider` and route by channel — but that's a future decision, not a current concern.

### Provider factory

```ts
// lib/notifications/get-provider.ts
export function getProvider(name: 'stub' | 'msg91'): MessageProvider {
  switch (name) {
    case 'stub':
      return new StubProvider();
    case 'msg91':
      return new MSG91Provider(process.env.MSG91_API_KEY!);
  }
}
```

The factory is the single place that knows about real providers. All other code uses the `MessageProvider` interface. When/if AiSensy or another provider gets added later, only this file and the factory's enum type expand.

---

## 11.5 Dispatch Service

Where notifications get queued and sent.

### `server/services/dispatch-notification.ts`

```ts
type DispatchInput = {
  gymId: string;
  branchId: string;
  memberId: string;
  eventType: 'enrollment' | 'renewal' | 'refund' | 'correction' | 'cancellation';
  triggerEntityType: 'membership' | 'payment';
  triggerEntityId: string;
  templateVars: TemplateVariables;
};

async function dispatchNotification(input: DispatchInput): Promise<void>;
```

### Algorithm

```
1. Load gym row (notification_channel, notification_provider, sender_id).
2. Load member row (phone, name).
3. Determine channels to send on (based on gym.notification_channel).
4. For each channel:
   a. Determine template_key from event_type + channel.
   b. Render message body.
   c. INSERT into notifications with status='pending', attempt_count=0.
   d. Trigger sendNotification(notification_id) — async, fire-and-forget.
5. Return immediately.
```

Note: this function is **fire-and-forget from the perspective of the caller (enrollment service, etc.).** The caller's transaction has already committed. Notification dispatch happens after, in its own context.

### `server/services/send-notification.ts`

The actual sending logic, separated for testability and retry support.

```ts
async function sendNotification(notificationId: string): Promise<void>;
```

Algorithm:
```
1. SELECT FOR UPDATE the notification row.
2. If status != 'pending', skip (already sent or failed terminally).
3. Increment attempt_count.
4. Get provider via factory, call provider.send(...).
5. If success:
   - UPDATE: status='sent', provider_message_id, sent_at.
6. If failure:
   - If retriable AND attempt_count < 3:
     - UPDATE: next_retry_at = now() + (attempt_count * 5 minutes).
     - status stays 'pending'.
   - Else:
     - UPDATE: status='failed', failure_reason.
7. Commit.
```

### Retry worker

A small Vercel Cron route that runs every 5 minutes:

```ts
// app/api/cron/retry-notifications/route.ts
export async function GET(request: Request) {
  // Verify CRON_SECRET
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Find pending notifications ready to retry
  const due = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        eq(notifications.status, 'pending'),
        lte(notifications.nextRetryAt, new Date()),
      ),
    )
    .limit(50); // batch limit

  // Send each (in parallel; retries are short-lived ops)
  await Promise.allSettled(
    due.map(({ id }) => sendNotification(id)),
  );

  return Response.json({ processed: due.length });
}
```

`vercel.json`:
```json
{
  "crons": [
    { "path": "/api/cron/retry-notifications", "schedule": "*/5 * * * *" }
  ]
}
```

For initial sends (not retries), we don't need cron — they fire immediately after dispatch.

### Why Vercel Cron and not pg_cron / a queue

- Vercel Cron is one config line, no infra.
- We're not high-volume — at 100 gyms × 50 messages/day = 5000 messages/day total. A 5-minute batch handles this trivially.
- For higher volume later (10k+ gyms), swap to a proper queue (Inngest, Trigger.dev, BullMQ). Don't optimize prematurely.

---

## 11.6 Integration Points

The dispatch service is called from these existing services. Each call is a single line, post-commit.

### Enrollment (Module 04)
```ts
// In server/services/enrollment.ts, after the commit
await dispatchNotification({
  gymId, branchId, memberId,
  eventType: input.previousMembershipId ? 'renewal' : 'enrollment',
  triggerEntityType: 'membership',
  triggerEntityId: membershipId,
  templateVars: {
    member_name: member.name,
    plan_name: plan.name,
    gym_name: gym.name,
    branch_name: branch.name,
    start_date: formatDate(startDate),
    end_date: formatDate(endDate),
    amount: formatRupees(finalAmountPaise),
    invoice_number: invoiceNumber,
  },
}).catch(err => {
  // Log but don't throw — enrollment already succeeded
  console.error('Notification dispatch failed', err);
});
```

### Refund (Module 04)
Same pattern, with refund template variables.

### Correction (Module 04 amendment A4)
Same pattern, correction template variables. **Don't include "old values"** in the message — keep it about the new state. Owner-side audit log captures the diff.

### Cancellation (Module 04 amendment A5)
Same pattern. If refund issued as part of cancellation, **send ONE message** about the cancellation that includes the refund amount, not two separate messages.

### Why catch-and-log instead of letting the error propagate

The enrollment transaction has committed. The receipt is post-hoc — important but not blocking. If dispatch throws (e.g., DB error in notifications table), the worst case is the member doesn't get a receipt, which the owner can resend manually. Throwing the error would corrupt the API response from the enrollment.

---

## 11.7 UI

### Member detail — Notifications card

A new card on the member detail page, below "Recent payments." Shows the most recent 5 messages sent to this member, with status indicators.

```
┌─────────────────────────────────────────────────────────┐
│ Notifications                              View all →  │
├─────────────────────────────────────────────────────────┤
│ ✓ Enrollment receipt                       2 hr ago   │
│   SMS · Delivered · ZEN-2026-0042                      │
├─────────────────────────────────────────────────────────┤
│ ✓ Renewal receipt                          12 days ago│
│   SMS · Delivered · ZEN-2026-0038                      │
├─────────────────────────────────────────────────────────┤
│ ⚠ Enrollment receipt                       45 days ago│
│   SMS · Failed (provider timeout)         [Resend]    │
└─────────────────────────────────────────────────────────┘
```

Status indicators:
- `✓` green = delivered or sent (sent for stub provider, delivered when real provider confirms)
- `⏱` amber = pending/queued
- `⚠` red = failed

Each row shows:
- Event type label (Enrollment receipt / Renewal receipt / etc.)
- Timestamp (relative)
- Channel + status + linked invoice (where relevant)
- Resend button (Owner only) for failed messages

### Resend button

Click → confirmation dialog → calls `dispatchNotification` again with same params. Creates a new notification row (don't reuse the failed one — keep audit history clean).

### Notifications log page (member-scoped)

`/members/[id]/notifications` — paginated table of all notifications for this member. Same data structure as the card, just full history.

Columns: Date, Event, Channel, Status, Invoice link, Body preview (first 80 chars), Actions.

Click row → expand to show full message body + provider IDs + retry history.

### Settings — Notifications section

`/settings/notifications` (Owner only). Shows:

- **Channel:** SMS / WhatsApp toggle. WhatsApp toggle disabled with tooltip if subscription_tier='basic': "Available in Pro tier."
- **Provider:** Display-only, shows current provider name.
- **Sender ID:** Display-only for now (Owner can request change in v1.5 when Settings becomes editable). Shows "Not configured" if null + small explanation.
- **Test message** button: lets Owner send a test message to their own phone to verify the system works. Useful at customer onboarding.
- **Recent activity:** Last 20 notifications across the entire gym, with status counts ("Last 7 days: 142 sent, 138 delivered, 4 failed").

### Today's View — failed notification badge

If there are >0 failed notifications in the last 24 hours, show a small badge in the Today's View "Needs attention" section (Module 07 amendment C3):

```
⚠ 4 notifications failed in last 24 hours
   Members may not have received receipts
   View notifications →
```

Severity: medium if 1-5, high if >5. Triggers same anomaly card pattern.

This is critical: failed messages are the silent failure mode that owners care about. Surfacing them on the home screen ensures they don't pile up unnoticed.

### Members list — notification status column? NO.

Tempting to add a column showing "last notification status." Don't. Adds noise to the most-used screen. The notification status is per-event, not per-member; surfacing it at the member level is the wrong granularity. The Today's View badge + member detail card together cover the visibility need.

---

## 11.8 Acceptance Criteria

### Schema & infrastructure
- [ ] `notifications` table created with all indexes.
- [ ] `gyms` table extended with notification config columns.
- [ ] `MessageProvider` interface defined; `StubProvider` implemented.
- [ ] `MSG91Provider` scaffolded for both SMS and WhatsApp (throws on send, but compiles).
- [ ] Provider factory works.
- [ ] Vercel Cron config added for `/api/cron/retry-notifications`.

### Dispatch
- [ ] Enrollment fires notification (template: enrollment) after commit.
- [ ] Renewal fires notification (template: renewal).
- [ ] Refund fires notification (template: refund).
- [ ] Correction fires notification (template: correction).
- [ ] Cancellation fires notification (template: cancellation, with refund mention if applicable).
- [ ] Dispatch failure does NOT roll back the parent transaction.
- [ ] Notification rows created with correct event_type, channel, recipient_phone snapshot.

### Stub provider
- [ ] In dev mode, console.log shows the message body.
- [ ] Notification status updates from `pending` → `sent`.
- [ ] `provider_message_id` populated with stub-prefixed UUID.

### Channel selection
- [ ] Basic tier gym: only SMS notifications dispatched.
- [ ] Pro tier gym configured for SMS+WhatsApp: two notification rows per event (one SMS, one WhatsApp).
- [ ] Pro tier gym configured for SMS-only: only SMS dispatched.

### Templates
- [ ] All 5 templates render with correct variable substitution.
- [ ] Missing variable throws clear error (caught and logged in dispatch service).
- [ ] Conditional blocks (`{{#if refund_amount}}`) work for cancellation template.
- [ ] No staff name in any rendered template.
- [ ] Invoice number always present in receipt templates.
- [ ] Templates fit within 320 chars (2 SMS credits).

### Retry logic
- [ ] Failed retriable send: notification stays `pending`, `next_retry_at` set.
- [ ] Cron picks up due retries and attempts again.
- [ ] After 3 attempts, status becomes `failed` with reason logged.
- [ ] Non-retriable failure (e.g., invalid phone): immediately `failed`, no retries.

### UI
- [ ] Notifications card on member detail shows last 5 messages.
- [ ] Status icons render correctly (green/amber/red).
- [ ] Resend button (Owner only) creates new notification row, not reuse old.
- [ ] `/members/[id]/notifications` full log page works with pagination.
- [ ] Settings page shows current channel/provider; Test message button works for Owner.
- [ ] Today's View shows failed-notifications anomaly when applicable.

### RLS
- [ ] Cross-tenant notification access blocked.
- [ ] Receptionist can SEE notifications (read-only); cannot resend.
- [ ] Branch Manager and Owner have full access within their scope.

### Provider swap readiness
- [ ] Setting `gym.notification_provider = 'msg91'` and providing a stub API key results in code attempting to call MSG91Provider.send() (which throws) — confirms wiring is in place.
- [ ] Switching back to `'stub'` works without code change.

### General
- [ ] No notification dispatch is blocking on the user-facing API.
- [ ] Member detail page Lighthouse perf still ≥ 90.
- [ ] No `any` types, no console.logs in production paths (stub's dev-only console.log is gated by NODE_ENV).

---

## 11.9 Files Created in This Module

```
lib/db/schema/notifications.ts                            (NEW)
lib/db/schema/gyms.ts                                     (MODIFIED — add config columns)
lib/db/migrations/0011_notifications.sql                  (NEW)

lib/notifications/provider.ts                             (NEW — interface)
lib/notifications/get-provider.ts                         (NEW — factory)
lib/notifications/providers/stub-provider.ts              (NEW)
lib/notifications/providers/msg91-provider.ts             (NEW — scaffold; SMS + WhatsApp)
lib/notifications/templates.ts                            (NEW)
lib/notifications/render-template.ts                      (NEW)

server/services/dispatch-notification.ts                  (NEW)
server/services/send-notification.ts                      (NEW)
server/queries/notifications/list-by-member.ts            (NEW)
server/queries/notifications/list-by-gym.ts               (NEW — for Settings + anomaly)
server/queries/notifications/get-failed-recent.ts         (NEW — for Today's View anomaly)
server/actions/notifications/resend.ts                    (NEW — Owner-only)
server/actions/notifications/send-test.ts                 (NEW — Settings test message)

server/services/enrollment.ts                             (MODIFIED — add dispatch call)
server/services/renewal.ts                                (MODIFIED — add dispatch call)
server/services/refund.ts                                 (MODIFIED — add dispatch call)
server/services/correct-membership.ts                     (MODIFIED — add dispatch call)
server/services/cancel-membership.ts                      (MODIFIED — add dispatch call)

server/services/anomaly-detection.ts                      (MODIFIED — add failed-notifications rule)

app/api/cron/retry-notifications/route.ts                 (NEW)

app/(app)/members/[id]/_components/notifications-card.tsx (NEW)
app/(app)/members/[id]/notifications/page.tsx             (NEW — full log)
app/(app)/settings/notifications/page.tsx                 (NEW — channel config + test)
app/(app)/settings/notifications/_components/test-message-button.tsx (NEW)

vercel.json                                               (MODIFIED — add cron)
.env.example                                              (MODIFIED — add MSG91/CRON_SECRET keys)
```

Environment variables to document:
```
CRON_SECRET=                  # Random secret, used by retry cron
MSG91_API_KEY=                # Optional; required only when MSG91Provider is active
```

---

## 11.10 Common Pitfalls

1. **Don't make dispatch blocking.** The dispatch call from enrollment must be fire-and-forget. If you `await` it and let errors propagate, a notification provider hiccup will fail the enrollment. Use `.catch(log)` pattern always.

2. **The recipient_phone is a snapshot.** Store the phone at the time of dispatch. If the member updates their phone later, old notifications still show what number they were sent to. Critical for audit.

3. **Don't reuse failed notification rows on resend.** Resend creates a new row. The failed row stays as a record of the failure. Reusing would erase history and is the kind of "convenience" that breaks audit integrity.

4. **Stub's dev console.log must be gated.** `if (process.env.NODE_ENV === 'development') console.log(...)`. Otherwise production logs get polluted.

5. **Templates are versioned by suffix (`_v1`).** When you change a template's wording later, create `_v2` rather than mutating `_v1`. Old notifications retain their template_key. This keeps audit narrative ("the message we sent was X") accurate forever.

6. **Don't include payment_mode in receipts unnecessarily.** Refund template includes it because mode of refund is meaningful (member needs to check their UPI/cash). Enrollment template doesn't — member just paid, they know what they paid with. Less is more on receipts.

7. **The conditional block engine is tiny on purpose.** Don't expand it to support loops, helpers, etc. If a template needs more logic than `{{#if x}}...{{/if}}`, that's a sign the template is too complex — split into multiple templates instead.

8. **Provider message ID can collide across providers.** When you swap providers, old `provider_message_id` values are scoped to the old provider. Don't try to look them up in the new provider. The `provider` column tells you which provider issued the ID.

9. **Test message in Settings respects DLT.** When real MSG91 is wired, the test message must use a valid DLT-approved template. Don't allow Owner to type custom test text — that would fail DLT compliance. Use a fixed "test" template.

10. **Failed-notifications anomaly threshold matters.** "1 failed in last 24 hours" might be a one-off provider blip. The anomaly trigger is `> 0` for 1-5 (medium) and `> 5` for high — but resist the urge to silence the medium one. Owners genuinely want to know.

11. **No "delivered" status from stub provider.** Stub returns `sent`, never `delivered`. Real providers webhook back to upgrade `sent` → `delivered`. Your UI should treat `sent` as "✓ sent" — don't show a different state for delivered until the real provider is wired (post-launch).

12. **Cron secret not in env? Cron route must reject.** Don't fall through to "no auth needed in dev." Always require the secret. Set it locally too. This prevents accidental local cron triggers from clobbering data.

---

## 11.11 What this changes about the product

Before this module, your product is a clean operational tool with great reports. Functional but not differentiated on trust.

After this module, your sales pitch gains a real moment:

> "Every time a payment is recorded, the member gets an SMS receipt with the invoice number. Your branch manager can't pocket cash and 'forget' to enter it — the member knows immediately if the system didn't send a receipt. This alone has paid for the software at gyms we've installed it at."

That paragraph is what justifies ₹5k/month positioning over Gymshim. Notifications aren't a feature — they're the trust layer.

When you're ready to onboard a real customer:
1. Sign up with MSG91 (~5 min). Get your API key.
2. File DLT registration on MSG91's portal (~30 min form, 7-14 days approval).
3. Get sender ID approved for SMS (e.g., "ZENITH").
4. For Pro tier customers wanting WhatsApp: complete Meta Business verification through MSG91 (1-2 weeks). Get template namespace.
5. Implement `MSG91Provider.sendSMS()` and `sendWhatsApp()` per their docs (~60 lines total).
6. Set `gym.notification_provider = 'msg91'`, `gym.sender_id = 'ZENITH'` (and `whatsapp_template_namespace` for Pro tier).
7. Send test message via Settings page.

Total wall-clock: ~2 weeks for SMS, ~3-4 weeks if you need WhatsApp ready (Meta verification dominates). Total active work: ~2 hours.

Single provider account simplifies everything: one billing relationship, one dashboard for support tickets, one place to monitor delivery rates across both channels.

---

## 11.12 What's next

You've already built the natural Module 08 (Audit Log Viewer) and Module 09 (PDF Invoices) candidates in your backlog. After this module, the natural sequence is:

- **Audit Log Viewer (Module 08)** — surface the audit entries that have been accumulating since Module 01. Required for serious customer trust, especially chains.
- **PDF Invoice Generation (Module 09)** — owners want to print or download invoices. Member receipts are SMS-based; PDFs are for the gym's records.

These are the last two infrastructure modules before the product is "complete v1." After them, focus shifts to customer acquisition + iteration.
