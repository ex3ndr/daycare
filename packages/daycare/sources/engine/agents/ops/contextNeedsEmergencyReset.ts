import type { AgentHistoryRecord, Config } from "@/types";
import type { ProviderSettings } from "../../../settings.js";
import { contextCompactionLimitsResolve } from "./contextCompactionLimitsResolve.js";
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
    extras?: ContextEstimateTokensExtras,
    provider?: ProviderSettings | null
): boolean {
    const limit = contextCompactionLimitsResolve(config, provider).emergencyLimit;
    return contextEstimateTokensWithExtras(history, extras) >= limit;
}
