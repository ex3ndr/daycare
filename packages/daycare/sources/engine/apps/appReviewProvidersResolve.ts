import type { Config } from "@/types";
import { listActiveInferenceProviders } from "../../providers/catalog.js";
import type { ProviderSettings } from "../../settings.js";

/**
 * Resolves optional provider overrides for app review model selection.
 * Expects: model is either empty/default, `provider:model`, or a raw model id.
 */
export function appReviewProvidersResolve(config: Config, model: string | undefined): ProviderSettings[] | undefined {
    const requested = model?.trim();
    if (!requested || requested.toLowerCase() === "default") {
        return undefined;
    }

    const providers = listActiveInferenceProviders(config.settings);
    if (providers.length === 0) {
        return undefined;
    }

    const separator = requested.indexOf(":");
    if (separator > 0 && separator < requested.length - 1) {
        const providerId = requested.slice(0, separator);
        const modelId = requested.slice(separator + 1);
        const provider = providers.find((entry) => entry.id === providerId);
        if (provider) {
            return [{ ...provider, model: modelId }];
        }
    }

    const firstProvider = providers[0];
    if (!firstProvider) {
        return undefined;
    }
    return [{ ...firstProvider, model: requested }];
}
