import type { Config } from "@/types";
import { providerSettingsResolveModel } from "../../../providers/providerSettingsResolveModel.js";
import type { ProviderSettings } from "../../../settings.js";
import { type ContextCompactionLimits, contextCompactionLimitsBuild } from "./contextCompactionLimitsBuild.js";

/**
 * Resolves effective compaction thresholds for the selected provider/model.
 * Expects: config.settings.agents.compaction is already normalized by configResolve().
 */
export function contextCompactionLimitsResolve(
    config: Config,
    provider: ProviderSettings | null | undefined
): ContextCompactionLimits {
    const globalCompaction = config.settings.agents.compaction;
    const resolvedProvider = provider ? providerSettingsResolveModel(provider) : null;
    const modelKey = resolvedProvider?.model ? `${resolvedProvider.id}/${resolvedProvider.model}` : null;
    const modelOverride = modelKey ? globalCompaction.models[modelKey] : undefined;
    const emergencyOverridden = modelOverride?.emergencyLimit !== undefined;

    if (!modelOverride) {
        return {
            emergencyLimit: globalCompaction.emergencyLimit,
            warningLimit: globalCompaction.warningLimit,
            criticalLimit: globalCompaction.criticalLimit
        };
    }

    return contextCompactionLimitsBuild({
        emergencyLimit: modelOverride?.emergencyLimit ?? globalCompaction.emergencyLimit,
        warningLimit: modelOverride.warningLimit ?? (emergencyOverridden ? undefined : globalCompaction.warningLimit),
        criticalLimit: modelOverride.criticalLimit ?? (emergencyOverridden ? undefined : globalCompaction.criticalLimit)
    });
}
