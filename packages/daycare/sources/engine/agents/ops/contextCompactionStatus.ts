import type { AgentHistoryRecord } from "./agentTypes.js";
import type { ContextCompactionLimits } from "./contextCompactionLimitsBuild.js";
import { contextEstimateTokens } from "./contextEstimateTokens.js";
import {
    type ContextEstimateTokensExtras,
    contextEstimateTokensWithExtras
} from "./contextEstimateTokensWithExtras.js";

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
    minimumTokens?: number;
};

/**
 * Evaluates compaction pressure against the emergency context limit.
 * Expects: limits are already normalized.
 */
export function contextCompactionStatus(
    history: AgentHistoryRecord[],
    limits: ContextCompactionLimits,
    options: ContextCompactionStatusOptions = {}
): ContextCompactionStatus {
    const baseTokens = contextEstimateTokens(history);
    const estimatedTokens = Math.max(
        contextEstimateTokensWithExtras(history, options.extras),
        minimumTokensNormalize(options.minimumTokens)
    );
    const extraTokens = Math.max(0, estimatedTokens - baseTokens);
    const { emergencyLimit, warningLimit, criticalLimit } = limits;
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

function minimumTokensNormalize(value: number | undefined): number {
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
        return 0;
    }
    return Math.floor(value);
}
