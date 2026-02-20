import type { AgentHistoryRecord } from "./agentTypes.js";
import { contextEstimateTokens } from "./contextEstimateTokens.js";
import {
    type ContextEstimateTokensExtras,
    contextEstimateTokensWithExtras
} from "./contextEstimateTokensWithExtras.js";

const WARNING_RATIO = 0.75;
const CRITICAL_RATIO = 0.9;

export type ContextCompactionStatus = {
    estimatedTokens: number;
    extraTokens: number;
    emergencyLimit: number;
    warningLimit: number;
    criticalLimit: number;
    utilization: number;
    severity: "ok" | "warning" | "critical";
};

export type ContextCompactionStatusOptions = {
    extras?: ContextEstimateTokensExtras;
};

/**
 * Evaluates compaction pressure against the emergency context limit.
 * Expects: emergencyLimit is a positive integer.
 */
export function contextCompactionStatus(
    history: AgentHistoryRecord[],
    emergencyLimit: number,
    options: ContextCompactionStatusOptions = {}
): ContextCompactionStatus {
    const baseTokens = contextEstimateTokens(history);
    const estimatedTokens = contextEstimateTokensWithExtras(history, options.extras);
    const extraTokens = Math.max(0, estimatedTokens - baseTokens);
    const warningLimit = Math.max(1, Math.floor(emergencyLimit * WARNING_RATIO));
    const criticalLimit = Math.max(warningLimit + 1, Math.floor(emergencyLimit * CRITICAL_RATIO));
    const utilization = emergencyLimit > 0 ? Math.min(1, estimatedTokens / emergencyLimit) : 0;
    const severity = estimatedTokens >= criticalLimit ? "critical" : estimatedTokens >= warningLimit ? "warning" : "ok";

    return {
        estimatedTokens,
        extraTokens,
        emergencyLimit,
        warningLimit,
        criticalLimit,
        utilization,
        severity
    };
}
