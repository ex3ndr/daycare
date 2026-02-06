import type { AgentHistoryRecord, Config } from "@/types";

import { contextEstimateTokens } from "./contextEstimateTokens.js";

/**
 * Checks if the current history exceeds the emergency context limit.
 * Expects: config.settings.agents.emergencyContextLimit is a positive integer when set.
 */
export function contextNeedsEmergencyReset(
  config: Config,
  history: AgentHistoryRecord[]
): boolean {
  const limit = config.settings.agents.emergencyContextLimit;
  return contextEstimateTokens(history) >= limit;
}
