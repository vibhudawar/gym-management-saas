import type { NotificationOutboundChannel } from "@/lib/db/schema/notifications";

export type ProviderName = "stub" | "msg91";

export type ProviderSendInput = {
  /** E.164 phone number, e.g. "+919876543210". */
  to: string;
  channel: NotificationOutboundChannel;
  /** Pre-rendered message body. */
  body: string;
  /** DLT-approved sender ID (SMS only). Stub ignores it. */
  senderId?: string | null;
  /** WhatsApp template namespace (Meta-approved). Stub + SMS path ignore it. */
  whatsappTemplateNamespace?: string | null;
  /** Free-form metadata for provider-specific tracking. */
  metadata?: Record<string, string>;
};

export type ProviderSendResult =
  | { ok: true; providerMessageId: string }
  | { ok: false; error: string; retriable: boolean };

/**
 * Common contract every notification provider implements. The dispatch +
 * send services depend only on this interface; the factory is the single
 * place that knows about concrete providers.
 */
export interface MessageProvider {
  readonly name: ProviderName;
  readonly supportedChannels: readonly NotificationOutboundChannel[];
  send(input: ProviderSendInput): Promise<ProviderSendResult>;
}
