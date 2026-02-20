import type { AgentHistoryRecord, Config } from "@/types";

import {
    type ContextEstimateTokensExtras,
    contextEstimateTokensWithExtras
} from "./contextEstimateTokensWithExtras.js";

/**
 * Checks if the current history exceeds the emergency context limit.
 * Expects: config.settings.agents.emergencyContextLimit is a positive integer when set.
 */
export function contextNeedsEmergencyReset(
    config: Config,
    history: AgentHistoryRecord[],
    extras?: ContextEstimateTokensExtras
): boolean {
    const limit = config.settings.agents.emergencyContextLimit;
    return contextEstimateTokensWithExtras(history, extras) >= limit;
}
