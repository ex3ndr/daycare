import { getProviderDefinition } from "../../../providers/catalog.js";
import { providerModelSelectBySize } from "../../../providers/providerModelSelectBySize.js";
import type { ProviderModelSize } from "../../../providers/types.js";
import type { ProviderSettings } from "../../../settings.js";
import type { AgentModelOverride } from "./agentTypes.js";

const SELECTOR_TO_SIZE: Record<string, ProviderModelSize> = {
    small: "small",
    normal: "normal",
    big: "large"
};

/**
 * Applies a model override to the provider list for an agent.
 * Returns a new ProviderSettings[] with the model field overridden on the resolved provider.
 *
 * Expects: providerId identifies the active provider; override may be null (passthrough).
 */
export function agentModelOverrideApply(
    providers: ProviderSettings[],
    override: AgentModelOverride | null | undefined,
    providerId: string | null
): ProviderSettings[] {
    if (!override) {
        return providers;
    }

    const target = providerId ? providers.find((p) => p.id === providerId) : providers[0];
    if (!target) {
        return providers;
    }

    let resolvedModel: string | undefined;

    if (override.type === "selector") {
        const size = SELECTOR_TO_SIZE[override.value];
        if (!size) {
            return providers;
        }
        const definition = getProviderDefinition(target.id);
        const models = definition?.models ?? [];
        if (models.length > 0) {
            resolvedModel = providerModelSelectBySize(models, size) ?? undefined;
        }
        // If no model catalog or no match, keep provider default
        if (!resolvedModel) {
            return providers;
        }
    } else {
        resolvedModel = override.value;
    }

    return providers.map((p) => {
        if (p.id === target.id) {
            return { ...p, model: resolvedModel };
        }
        return p;
    });
}
