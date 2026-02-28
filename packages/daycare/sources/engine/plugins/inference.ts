import type { AssistantMessage, Context } from "@mariozechner/pi-ai";
import { createId } from "@paralleldrive/cuid2";

import { getLogger } from "../../log.js";
import { getProviderDefinition, listActiveInferenceProviders } from "../../providers/catalog.js";
import { modelRoleApply } from "../../providers/modelRoleApply.js";
import { providerModelSelectBySize } from "../../providers/providerModelSelectBySize.js";
import {
    BUILTIN_MODEL_FLAVORS,
    type BuiltinModelFlavor,
    type ModelFlavorConfig,
    type ProviderSettings
} from "../../settings.js";
import type { ConfigModule } from "../config/configModule.js";
import type { InferenceRouter } from "../modules/inference/router.js";

export type PluginInferenceStrategy = "default" | string;

export type PluginInferenceRequest = {
    systemPrompt?: string;
    messages: Context["messages"];
    providerId?: string;
    strategy?: PluginInferenceStrategy;
};

export type PluginInferenceResult = {
    message: AssistantMessage;
    providerId: string;
    modelId: string;
};

export type PluginInference = {
    complete: (request: PluginInferenceRequest) => Promise<PluginInferenceResult>;
};

type PluginInferenceServiceOptions = {
    router: InferenceRouter;
    config: ConfigModule;
};

const logger = getLogger("plugins.inference");

export class PluginInferenceService {
    private router: InferenceRouter;
    private config: ConfigModule;

    constructor(options: PluginInferenceServiceOptions) {
        this.router = options.router;
        this.config = options.config;
    }

    createClient(instanceId: string): PluginInference {
        return {
            complete: async (request) => this.complete(request, instanceId)
        };
    }

    private async complete(request: PluginInferenceRequest, instanceId: string): Promise<PluginInferenceResult> {
        const settings = this.config.current.settings;
        const providers = listActiveInferenceProviders(settings);
        if (providers.length === 0) {
            throw new Error("No inference provider available");
        }

        const strategy = request.strategy ?? "default";
        const context: Context = {
            messages: request.messages,
            systemPrompt: request.systemPrompt
        };
        const agentId = `plugin:${instanceId}:${createId()}`;

        if (strategy === "default") {
            const providersOverride = resolveProvidersOverride(providers, request.providerId);
            return this.router.complete(context, agentId, {
                providersOverride
            });
        }

        const providersOverride = resolveProvidersForStrategy(
            providers,
            request.providerId,
            strategy,
            settings.modelFlavors
        );
        logger.debug(
            `event: Plugin inference selection providerId=${providersOverride[0]?.id ?? "unknown"} strategy=${strategy} model=${providersOverride[0]?.model ?? "default"}`
        );
        return this.router.complete(context, agentId, {
            providersOverride
        });
    }
}

function resolveProvidersOverride(providers: ProviderSettings[], providerId?: string): ProviderSettings[] | undefined {
    if (!providerId) {
        return providers;
    }
    const provider = providers.find((entry) => entry.id === providerId);
    if (!provider) {
        throw new Error(`Unknown inference provider: ${providerId}`);
    }
    return [provider];
}

function resolveSelectedProvider(providers: ProviderSettings[], providerId?: string): ProviderSettings {
    if (providerId) {
        const provider = providers.find((entry) => entry.id === providerId);
        if (!provider) {
            throw new Error(`Unknown inference provider: ${providerId}`);
        }
        return provider;
    }
    return providers[0]!;
}

function resolveModelForStrategy(
    providerId: string,
    defaultModel: string | undefined,
    strategy: BuiltinModelFlavor
): string | undefined {
    const definition = getProviderDefinition(providerId);
    const models = definition?.models ?? [];
    if (models.length === 0) {
        return defaultModel;
    }

    const match = providerModelSelectBySize(models, strategy);
    if (match) {
        return match;
    }
    return defaultModel ?? models[0]?.id;
}

function resolveProvidersForStrategy(
    providers: ProviderSettings[],
    providerId: string | undefined,
    strategy: Exclude<PluginInferenceStrategy, "default">,
    modelFlavors: ModelFlavorConfig | undefined
): ProviderSettings[] {
    const builtinFlavor = builtinModelFlavorParse(strategy);
    if (builtinFlavor) {
        const provider = resolveSelectedProvider(providers, providerId);
        const resolvedModel = resolveModelForStrategy(provider.id, provider.model, builtinFlavor);
        return [
            {
                ...provider,
                model: resolvedModel ?? provider.model
            }
        ];
    }

    const customFlavor = customFlavorResolve(strategy, modelFlavors);
    if (!customFlavor) {
        throw new Error(`Unknown inference strategy: ${strategy}`);
    }

    const candidates = providerId ? [resolveSelectedProvider(providers, providerId)] : providers;
    const applied = modelRoleApply(candidates, customFlavor.model);
    if (applied.providerId) {
        const selected = applied.providers.find((entry) => entry.id === applied.providerId);
        if (selected) {
            return [selected];
        }
    }

    return [resolveSelectedProvider(providers, providerId)];
}

function builtinModelFlavorParse(value: string): BuiltinModelFlavor | null {
    const normalized = value.trim().toLowerCase();
    if (normalized in BUILTIN_MODEL_FLAVORS) {
        return normalized as BuiltinModelFlavor;
    }
    return null;
}

function customFlavorResolve(strategy: string, modelFlavors: ModelFlavorConfig | undefined): { model: string } | null {
    if (!modelFlavors) {
        return null;
    }

    const trimmed = strategy.trim();
    const exact = modelFlavors[trimmed];
    if (exact) {
        return { model: exact.model };
    }

    const normalized = trimmed.toLowerCase();
    const flavorKey = Object.keys(modelFlavors).find((key) => key.toLowerCase() === normalized);
    if (!flavorKey) {
        return null;
    }
    return { model: modelFlavors[flavorKey]!.model };
}
