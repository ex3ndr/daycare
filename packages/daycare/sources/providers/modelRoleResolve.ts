import type { ThinkingLevel } from "@mariozechner/pi-ai";
import type { ModelSelectionConfig, ProviderSettings } from "../settings.js";

export type ModelRoleResolution = {
    providerId: string;
    model: string;
    reasoning?: ThinkingLevel;
};

/**
 * Parses a "<providerId>/<modelName>" model selection and validates
 * that the referenced provider exists in the active providers list.
 *
 * Returns null when the config is missing, malformed, or the provider is inactive.
 */
export function modelRoleResolve(
    config: ModelSelectionConfig | undefined,
    providers: ProviderSettings[]
): ModelRoleResolution | null {
    if (!config) {
        return null;
    }

    const slashIndex = config.model.indexOf("/");
    if (slashIndex <= 0 || slashIndex === config.model.length - 1) {
        return null;
    }

    const providerId = config.model.slice(0, slashIndex);
    const model = config.model.slice(slashIndex + 1);

    const match = providers.find((p) => p.id === providerId);
    if (!match) {
        return null;
    }

    return config.reasoning === undefined ? { providerId, model } : { providerId, model, reasoning: config.reasoning };
}
