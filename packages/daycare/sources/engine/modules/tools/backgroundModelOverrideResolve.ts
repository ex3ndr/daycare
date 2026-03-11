import type { AgentModelOverride, ToolExecutionContext } from "@/types";
import { getProviderDefinition, listActiveInferenceProviders } from "../../../providers/catalog.js";
import { modelRoleApply } from "../../../providers/modelRoleApply.js";

/**
 * Resolves a checked raw model override for a new background subagent.
 * Expects: model is a provider-native model id for the subagent's resolved provider, not a flavor name.
 */
export function backgroundModelOverrideResolve(
    model: string | undefined,
    toolContext: ToolExecutionContext,
    agentId: string
): AgentModelOverride | null {
    const trimmed = model?.trim() ?? "";
    if (!trimmed) {
        return null;
    }

    const providers = listActiveInferenceProviders(toolContext.agentSystem.config.current.settings);
    if (providers.length === 0) {
        throw new Error("No inference provider available for background agent model override.");
    }

    const ruleModel = toolContext.agentSystem.modelRoles?.resolve({
        role: "subagent",
        kind: "sub",
        userId: toolContext.ctx.userId,
        agentId
    });
    const roleConfig = ruleModel ?? toolContext.agentSystem.config.current.settings.models?.subagent;
    const roleApplied = modelRoleApply(providers, roleConfig);
    const providerId = roleApplied.providerId ?? roleApplied.providers[0]?.id ?? null;
    const provider = providerId ? (roleApplied.providers.find((entry) => entry.id === providerId) ?? null) : null;

    if (!provider) {
        throw new Error("No inference provider available for background agent model override.");
    }

    const catalog = getProviderDefinition(provider.id)?.models ?? [];
    if (catalog.length === 0) {
        throw new Error(`Provider "${provider.id}" does not expose a model catalog for raw model validation.`);
    }

    if (!catalog.some((entry) => entry.id === trimmed)) {
        throw new Error(`Unknown raw model "${trimmed}" for provider "${provider.id}".`);
    }

    return { type: "model", value: trimmed };
}
