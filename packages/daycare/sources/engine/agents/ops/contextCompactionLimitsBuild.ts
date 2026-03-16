export type ContextCompactionLimits = {
    emergencyLimit: number;
    warningLimit: number;
    criticalLimit: number;
};

/**
 * Normalizes compaction thresholds from an emergency limit plus optional warning/critical overrides.
 * Expects: emergencyLimit is a positive integer; overrides are optional positive integers.
 */
export function contextCompactionLimitsBuild(input: {
    emergencyLimit: number;
    warningLimit?: number;
    criticalLimit?: number;
}): ContextCompactionLimits {
    const emergencyLimit = Math.max(1, Math.floor(input.emergencyLimit));
    const defaultWarningLimit = Math.max(1, Math.floor(emergencyLimit * 0.75));
    const defaultCriticalLimit = Math.max(defaultWarningLimit + 1, Math.floor(emergencyLimit * 0.9));
    const warningLimit = Math.min(emergencyLimit, normalizeLimit(input.warningLimit) ?? defaultWarningLimit);
    const criticalLimit = Math.min(
        emergencyLimit,
        Math.max(warningLimit, normalizeLimit(input.criticalLimit) ?? defaultCriticalLimit)
    );

    return {
        emergencyLimit,
        warningLimit,
        criticalLimit
    };
}

function normalizeLimit(value: number | undefined): number | undefined {
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
        return undefined;
    }
    return Math.floor(value);
}
