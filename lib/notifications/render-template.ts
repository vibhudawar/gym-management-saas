import type { NotificationOutboundChannel } from "@/lib/db/schema/notifications";
import {
  findTemplate,
  type TemplateKey,
  type TemplateVariables,
} from "./templates";

/**
 * Tiny templating engine — `{{var}}` substitution + `{{#if x}}…{{/if}}` blocks.
 * Deliberately minimal: no loops, no helpers, no escape syntax. If a template
 * needs more logic than this provides, it's a sign the template is too
 * complex — split it into multiple templates instead.
 */
export function renderTemplate(
  key: TemplateKey,
  channel: NotificationOutboundChannel,
  vars: TemplateVariables,
): string {
  const template = findTemplate(key, channel);
  if (!template) {
    throw new Error(`Template not found: ${key} (${channel})`);
  }

  for (const v of template.requiredVars) {
    if (vars[v] === undefined || vars[v] === null) {
      throw new Error(`Template ${key} missing required variable: ${v}`);
    }
  }

  let body = handleConditionalBlocks(template.body, vars);
  for (const [k, v] of Object.entries(vars)) {
    body = body.replaceAll(`{{${k}}}`, v);
  }
  // Strip any leftover unmatched placeholders so the message never shows
  // "{{foo}}" to the member.
  body = body.replace(/\{\{[^}]+\}\}/g, "");
  return body.trim();
}

/**
 * Replace `{{#if x}}…{{/if}}` blocks: keep the inner text when `vars[x]` is
 * truthy + non-empty; drop the block (including a trailing newline if any)
 * otherwise. Non-greedy so multiple blocks in one template work.
 */
function handleConditionalBlocks(
  body: string,
  vars: TemplateVariables,
): string {
  return body.replace(
    /\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}\n?/g,
    (_match, name: string, inner: string) => {
      const value = vars[name];
      if (value && value.trim().length > 0) return inner;
      return "";
    },
  );
}
