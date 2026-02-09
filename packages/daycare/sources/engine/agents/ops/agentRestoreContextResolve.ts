import type { Context } from "@mariozechner/pi-ai";

/**
 * Resolves restored context messages after loading history from disk.
 * Expects: historyMessages are already reconstructed in chronological order.
 */
export function agentRestoreContextResolve(
  currentMessages: Context["messages"],
  historyMessages: Context["messages"]
): Context["messages"] {
  if (historyMessages.length > 0) {
    return historyMessages;
  }
  return currentMessages;
}
