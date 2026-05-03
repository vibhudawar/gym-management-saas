import { MSG91Provider } from "./providers/msg91-provider";
import { StubProvider } from "./providers/stub-provider";
import type { MessageProvider, ProviderName } from "./provider";

/**
 * Single source of truth for provider instantiation. All other code uses the
 * MessageProvider interface — only this file imports concrete classes.
 */
export function getProvider(name: ProviderName): MessageProvider {
  switch (name) {
    case "stub":
      return new StubProvider();
    case "msg91":
      return new MSG91Provider(process.env.MSG91_API_KEY ?? "");
  }
}
