import { getProviderDefinition, listActiveInferenceProviders } from "../../../../providers/catalog.js";
import { modelRoleApply } from "../../../../providers/modelRoleApply.js";
import { providerModelSelectBySize } from "../../../../providers/providerModelSelectBySize.js";
import type { ProviderModelSize } from "../../../../providers/types.js";
import { BUILTIN_MODEL_FLAVORS, type BuiltinModelFlavor, type ProviderSettings } from "../../../../settings.js";
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

    const flavor = inferenceModelFlavorParse(config, normalizedModel);
    if (!flavor) {
        providers[0] = { ...providers[0]!, model: normalizedModel };
        return providers;
    }

    if (flavor.type === "custom") {
        const applied = modelRoleApply(providers, flavor.model);
        return applied.providerId ? applied.providers : providers;
    }

    return providers.map((provider) => {
        const definition = getProviderDefinition(provider.id);
        const selectedModel = providerModelSelectBySize(definition?.models ?? [], flavor.value);
        return selectedModel ? { ...provider, model: selectedModel } : { ...provider };
    });
}

function inferenceModelFlavorParse(
    config: ConfigModule,
    value: string
): { type: "builtin"; value: BuiltinModelFlavor } | { type: "custom"; model: string } | null {
    const normalized = value.toLowerCase() as ProviderModelSize;
    if (INFERENCE_MODEL_SIZES.includes(normalized) && normalized in BUILTIN_MODEL_FLAVORS) {
        return { type: "builtin", value: normalized as BuiltinModelFlavor };
    }

    const modelFlavors = config.current.settings.modelFlavors ?? {};
    const exactMatch = modelFlavors[value];
    if (exactMatch?.model) {
        return { type: "custom", model: exactMatch.model };
    }

    const customKey = Object.keys(modelFlavors).find((key) => key.toLowerCase() === normalized);
    if (customKey) {
        return { type: "custom", model: modelFlavors[customKey]!.model };
    }

    return null;
}
