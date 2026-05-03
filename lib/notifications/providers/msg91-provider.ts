import type {
  MessageProvider,
  ProviderSendInput,
  ProviderSendResult,
} from "../provider";

/**
 * MSG91 — single provider for both SMS and WhatsApp.
 *
 * v1 is intentionally a *scaffold*: shape, validation, and DLT/Meta gating
 * are in place; the actual fetch calls are TODOs that throw. When you're
 * ready to launch:
 *
 * 1. Sign up at MSG91, get authkey.
 * 2. File DLT registration (SMS sender ID + flow_id per template).
 * 3. For WhatsApp: complete Meta Business verification through MSG91 to get
 *    template namespace + per-template names.
 * 4. Replace the throws below with the documented fetch calls (~60 lines total).
 * 5. Set `gym.notification_provider = 'msg91'`, populate sender_id and (for
 *    Pro tier) `whatsapp_template_namespace`. Set MSG91_API_KEY in env.
 */
export class MSG91Provider implements MessageProvider {
  readonly name = "msg91" as const;
  readonly supportedChannels = ["sms", "whatsapp"] as const;

  constructor(private readonly apiKey: string) {
    if (!apiKey) {
      // Defer the error to send-time so app boot doesn't fail when the
      // env is missing; sends will fail-fast (non-retriable).
    }
  }

  async send(input: ProviderSendInput): Promise<ProviderSendResult> {
    if (!this.apiKey) {
      return {
        ok: false,
        error: "MSG91_API_KEY is not set",
        retriable: false,
      };
    }
    if (input.channel === "sms") return this.sendSms(input);
    return this.sendWhatsApp(input);
  }

  private async sendSms(
    input: ProviderSendInput,
  ): Promise<ProviderSendResult> {
    if (!input.senderId) {
      return {
        ok: false,
        error: "MSG91 SMS requires a DLT-approved senderId on the gym",
        retriable: false,
      };
    }
    // TODO(launch): wire MSG91 SMS API.
    //   POST https://control.msg91.com/api/v5/flow/
    //   Headers: { authkey: this.apiKey, 'Content-Type': 'application/json' }
    //   Body: { template_id, sender, mobiles, VAR1, VAR2, ... }
    //   Reference: https://docs.msg91.com/
    //
    // Treat 4xx (template/auth errors) as { retriable: false }.
    // Treat 5xx + network errors as { retriable: true }.
    void input;
    throw new Error(
      "MSG91Provider.sendSms not implemented — replace stub when launching",
    );
  }

  private async sendWhatsApp(
    input: ProviderSendInput,
  ): Promise<ProviderSendResult> {
    if (!input.whatsappTemplateNamespace) {
      return {
        ok: false,
        error:
          "MSG91 WhatsApp requires whatsapp_template_namespace on the gym",
        retriable: false,
      };
    }
    // TODO(launch): wire MSG91 WhatsApp API.
    //   POST https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/
    //   Headers: { authkey: this.apiKey, 'Content-Type': 'application/json' }
    //   Body: { integrated_number, content_type: 'template', payload: { ... } }
    //   Reference: https://docs.msg91.com/whatsapp/
    void input;
    throw new Error(
      "MSG91Provider.sendWhatsApp not implemented — replace stub when launching",
    );
  }
}
