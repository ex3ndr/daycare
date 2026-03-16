import type { ProviderSettings } from "../settings.js";
import { listProviderModels } from "./models.js";

const ZEN_PROVIDER_ID = "zen";
const ZEN_DEFAULT_MODEL_ID = "gpt-5.4";

/**
 * Resolves the effective model for a provider settings entry.
 * Expects: provider.id identifies a registered provider; provider.model may be omitted.
 */
export function providerSettingsResolveModel(provider: ProviderSettings): ProviderSettings {
    const explicitModel = provider.model?.trim();
    if (explicitModel) {
        return { ...provider, model: explicitModel };
    }

    const optionModel = providerOptionModelResolve(provider);
    if (optionModel) {
        return { ...provider, model: optionModel };
    }

    const catalogModel = providerCatalogModelResolve(provider.id);
    if (catalogModel) {
        return { ...provider, model: catalogModel };
    }

    return { ...provider };
}

function providerOptionModelResolve(provider: ProviderSettings): string | null {
    if (provider.id !== "openai-compatible") {
        return null;
    }

    const modelId = provider.options?.modelId;
    if (typeof modelId !== "string") {
        return null;
    }

    const normalized = modelId.trim();
    return normalized.length > 0 ? normalized : null;
}

function providerCatalogModelResolve(providerId: string): string | null {
    if (providerId === ZEN_PROVIDER_ID) {
        return ZEN_DEFAULT_MODEL_ID;
    }

    const models = listProviderModels(providerId);
    if (models.length === 0) {
        return null;
    }

    return models[0]?.id ?? null;
}
