import Handlebars from "handlebars";

import { getProviderDefinition, listActiveInferenceProviders } from "../../../providers/catalog.js";
import { listProviderModels } from "../../../providers/models.js";
import type { ProviderModelInfo } from "../../../providers/types.js";
import type { ProviderSettings } from "../../../settings.js";
import { agentPromptBundledRead } from "./agentPromptBundledRead.js";
import type { AgentSystemPromptContext } from "./agentSystemPromptContext.js";

/**
 * Renders active inference model catalogs and model-selection guidance.
 * Expects: context matches agentSystemPrompt input shape.
 */
export async function agentSystemPromptSectionModels(context: AgentSystemPromptContext = {}): Promise<string> {
    if (!context.agentSystem) {
        return "";
    }
    const template = await agentPromptBundledRead("SYSTEM_MODELS.md");
    const settings = context.agentSystem.config.current.settings ?? {};
    const activeProviders = listActiveInferenceProviders(settings);
    const section = Handlebars.compile(template)({
        currentModel: context.model ?? "unknown",
        currentProvider: context.provider ?? "unknown",
        availableModels: availableModelsPromptBuild(activeProviders)
    });
    return section.trim();
}

function availableModelsPromptBuild(providers: ProviderSettings[]): string {
    if (providers.length === 0) {
        return "No active inference providers are configured.";
    }
    const lines = providers.map((provider) => availableModelsLineBuild(provider));
    return lines.join("\n");
}

function availableModelsLineBuild(provider: ProviderSettings): string {
    const models = listProviderModels(provider.id).filter((model) => model.deprecated !== true);
    const providerName = getProviderDefinition(provider.id)?.name ?? provider.id;
    if (models.length === 0) {
        return `**${providerName}**: No non-deprecated models in the local catalog.`;
    }
    const modelList = models.map((model) => modelLabelBuild(model)).join(", ");
    return `**${providerName}**: ${modelList}`;
}

function modelLabelBuild(model: ProviderModelInfo): string {
    return `${model.name} (${model.size})`;
}
