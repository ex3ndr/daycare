import { getProviderDefinition } from "../../../providers/catalog.js";
import { modelRoleApply } from "../../../providers/modelRoleApply.js";
import { providerModelSelectBySize } from "../../../providers/providerModelSelectBySize.js";
import {
    BUILTIN_MODEL_FLAVORS,
    type BuiltinModelFlavor,
    type ModelFlavorConfig,
    type ProviderSettings
} from "../../../settings.js";
import type { AgentModelOverride } from "./agentTypes.js";

/**
 * Applies a model override to the provider list for an agent.
 * Returns a new ProviderSettings[] with the model field overridden on the resolved provider.
 *
 * Expects: providerId identifies the active provider; override may be null (passthrough).
 */
export function agentModelOverrideApply(
    providers: ProviderSettings[],
    override: AgentModelOverride | null | undefined,
    providerId: string | null,
    selectorOverrides: ModelFlavorConfig | undefined
): ProviderSettings[] {
    if (!override) {
        return providers;
    }

    const flavor = override.value.trim();
    const normalizedFlavor = flavor.toLowerCase();
    const configuredModel = modelFlavorResolve(selectorOverrides, flavor, normalizedFlavor)?.model;
    if (configuredModel) {
        const configuredApply = modelRoleApply(providers, configuredModel);
        if (configuredApply.providerId) {
            return configuredApply.providers;
        }
    }

    const builtinFlavor = builtinModelFlavorParse(normalizedFlavor);
    if (!builtinFlavor) {
        return providers;
    }

    const target = providerId ? providers.find((p) => p.id === providerId) : providers[0];
    if (!target) {
        return providers;
    }

    const definition = getProviderDefinition(target.id);
    const models = definition?.models ?? [];
    const resolvedModel =
        models.length > 0 ? (providerModelSelectBySize(models, builtinFlavor) ?? undefined) : undefined;

    // If no model catalog or no match, keep provider default
    if (!resolvedModel) {
        return providers;
    }

    return providers.map((p) => {
        if (p.id === target.id) {
            return { ...p, model: resolvedModel };
        }
        return p;
    });
}

function builtinModelFlavorParse(value: string): BuiltinModelFlavor | null {
    return value in BUILTIN_MODEL_FLAVORS ? (value as BuiltinModelFlavor) : null;
}

function modelFlavorResolve(
    modelFlavors: ModelFlavorConfig | undefined,
    flavor: string,
    normalizedFlavor: string
): { model: string } | null {
    if (!modelFlavors) {
        return null;
    }

    const exact = modelFlavors[flavor];
    if (exact) {
        return { model: exact.model };
    }

    const flavorKey = Object.keys(modelFlavors).find((key) => key.toLowerCase() === normalizedFlavor);
    if (!flavorKey) {
        return null;
    }

    return { model: modelFlavors[flavorKey]!.model };
}
