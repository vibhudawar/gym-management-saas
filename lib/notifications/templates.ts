import type {
  NotificationEventType,
  NotificationOutboundChannel,
} from "@/lib/db/schema/notifications";

export type TemplateKey =
  | "receipt_enrollment_v1"
  | "receipt_renewal_v1"
  | "receipt_refund_v1"
  | "receipt_correction_v1"
  | "receipt_cancellation_v1";

export type TemplateVariables = Record<string, string>;

export type Template = {
  key: TemplateKey;
  channel: NotificationOutboundChannel;
  body: string;
  requiredVars: string[];
};

/**
 * v1 templates — English, India context. Receipt-style, short, no staff names,
 * always with the invoice number. WhatsApp uses the same body string in v1
 * (the stub provider doesn't differentiate); when the MSG91 provider goes
 * live, its WhatsApp call will need the same content re-registered as a Meta
 * template via MSG91's portal. Same body, different upload mechanism.
 *
 * Templates are versioned by suffix (`_v1`). Bump to `_v2` when the wording
 * changes — never mutate `_v1` because old `notifications` rows reference
 * their template_key for audit narrative.
 */
const ENROLMENT_BODY = `Hi {{member_name}}, your {{plan_name}} membership at {{gym_name}} is confirmed.
Valid: {{start_date}} to {{end_date}}
Amount: ₹{{amount}}
Invoice: {{invoice_number}}
Branch: {{branch_name}}
Save this as your receipt.`;

const REFUND_BODY = `Hi {{member_name}}, a refund of ₹{{amount}} has been processed for invoice {{original_invoice}}.
Refund invoice: {{refund_invoice}}
Mode: {{payment_mode}}
{{gym_name}}, {{branch_name}}`;

const CORRECTION_BODY = `Hi {{member_name}}, your enrolment at {{gym_name}} was updated.
Updated plan: {{plan_name}}
Updated amount: ₹{{amount}}
Valid: {{start_date}} to {{end_date}}
Invoice: {{invoice_number}}
{{branch_name}}`;

const CANCELLATION_BODY = `Hi {{member_name}}, your {{plan_name}} membership at {{gym_name}} has been cancelled effective {{effective_date}}.
{{#if refund_amount}}Refund of ₹{{refund_amount}} processed.{{/if}}
{{branch_name}}`;

const RECEIPT_REQUIRED = [
  "member_name",
  "plan_name",
  "gym_name",
  "branch_name",
  "start_date",
  "end_date",
  "amount",
  "invoice_number",
];

export const TEMPLATES: Template[] = [
  // The same body powers SMS and WhatsApp in v1 — see file header.
  ...(["sms", "whatsapp"] as const).flatMap((channel) => [
    {
      key: "receipt_enrollment_v1" as const,
      channel,
      body: ENROLMENT_BODY,
      requiredVars: RECEIPT_REQUIRED,
    },
    {
      key: "receipt_renewal_v1" as const,
      channel,
      body: ENROLMENT_BODY, // same content; differentiated by event_type
      requiredVars: RECEIPT_REQUIRED,
    },
    {
      key: "receipt_refund_v1" as const,
      channel,
      body: REFUND_BODY,
      requiredVars: [
        "member_name",
        "amount",
        "original_invoice",
        "refund_invoice",
        "payment_mode",
        "gym_name",
        "branch_name",
      ],
    },
    {
      key: "receipt_correction_v1" as const,
      channel,
      body: CORRECTION_BODY,
      requiredVars: [
        "member_name",
        "gym_name",
        "plan_name",
        "amount",
        "start_date",
        "end_date",
        "invoice_number",
        "branch_name",
      ],
    },
    {
      key: "receipt_cancellation_v1" as const,
      channel,
      body: CANCELLATION_BODY,
      requiredVars: [
        "member_name",
        "plan_name",
        "gym_name",
        "effective_date",
        "branch_name",
      ],
    },
  ]),
];

export function templateKeyFor(
  event: NotificationEventType,
): TemplateKey {
  switch (event) {
    case "enrollment":
      return "receipt_enrollment_v1";
    case "renewal":
      return "receipt_renewal_v1";
    case "refund":
      return "receipt_refund_v1";
    case "correction":
      return "receipt_correction_v1";
    case "cancellation":
      return "receipt_cancellation_v1";
  }
}

export function findTemplate(
  key: TemplateKey,
  channel: NotificationOutboundChannel,
): Template | undefined {
  return TEMPLATES.find((t) => t.key === key && t.channel === channel);
}

export type EventTypeLabel = Record<NotificationEventType, string>;
export const EVENT_TYPE_LABEL: EventTypeLabel = {
  enrollment: "Enrolment receipt",
  renewal: "Renewal receipt",
  refund: "Refund receipt",
  correction: "Update receipt",
  cancellation: "Cancellation receipt",
};
