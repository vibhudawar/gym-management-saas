import { randomUUID } from "node:crypto";
import type {
  MessageProvider,
  ProviderSendInput,
  ProviderSendResult,
} from "../provider";

/**
 * Always-success provider for v1. Logs to console in dev so you can verify
 * the message body locally without a real provider account. Production logs
 * are unaffected because the console.log is gated by NODE_ENV.
 *
 * Returns a "stub-{uuid}" provider message id so the notifications row has
 * something to record; never collides with real provider IDs (which never
 * start with "stub-").
 */
export class StubProvider implements MessageProvider {
  readonly name = "stub" as const;
  readonly supportedChannels = ["sms", "whatsapp"] as const;

  async send(input: ProviderSendInput): Promise<ProviderSendResult> {
    if (process.env.NODE_ENV === "development") {
      console.log(
        `[STUB ${input.channel.toUpperCase()}] To: ${input.to}\n${input.body}\n---`,
      );
    }
    return { ok: true, providerMessageId: `stub-${randomUUID()}` };
  }
}
