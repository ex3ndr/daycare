import type { MessageContext } from "@/types";

/**
 * Strips transient fields from routing context.
 * Expects: messageId should not be persisted.
 */
export function agentRoutingSanitize(context: MessageContext): MessageContext {
  if (context.messageId) {
    return {};
  }
  return { ...context };
}
