import { getProviderDefinition, listActiveInferenceProviders } from "../../../../providers/catalog.js";
import { providerModelSelectBySize } from "../../../../providers/providerModelSelectBySize.js";
import type { ProviderModelSize } from "../../../../providers/types.js";
import type { ProviderSettings } from "../../../../settings.js";
import type { ConfigModule } from "../../../config/configModule.js";

const INFERENCE_MODEL_SIZES: readonly ProviderModelSize[] = ["small", "normal", "large"];

/**
 * Resolves tool inference providers from an optional model selector or explicit model id.
 * Expects: config contains active inference providers in priority order.
 */
export function inferenceResolveProviders(config: ConfigModule, model?: string): ProviderSettings[] {
    const providers = listActiveInferenceProviders(config.current.settings).map((provider) => ({ ...provider }));
    if (providers.length === 0) {
        return providers;
    }

    const normalizedModel = model?.trim();
    if (!normalizedModel) {
        return providers;
    }

    const size = inferenceModelSizeParse(normalizedModel);
    if (!size) {
        providers[0] = { ...providers[0]!, model: normalizedModel };
        return providers;
    }

    return providers.map((provider) => {
        const definition = getProviderDefinition(provider.id);
        const selectedModel = providerModelSelectBySize(definition?.models ?? [], size);
        return selectedModel ? { ...provider, model: selectedModel } : { ...provider };
    });
}

function inferenceModelSizeParse(value: string): ProviderModelSize | null {
    const normalized = value.toLowerCase() as ProviderModelSize;
    return INFERENCE_MODEL_SIZES.includes(normalized) ? normalized : null;
}
