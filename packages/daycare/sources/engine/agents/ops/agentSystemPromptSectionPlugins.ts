import type { AgentSystemPromptContext } from "./agentSystemPromptContext.js";

/**
 * Renders plugin-provided system prompt snippets as a single prompt section.
 * Expects: plugin prompts are already normalized by PluginManager.
 */
export async function agentSystemPromptSectionPlugins(context: AgentSystemPromptContext): Promise<string> {
    const pluginSections = (context.pluginPrompts ?? [])
        .map((prompt) => prompt.text.trim())
        .filter((text) => text.length > 0);
    if (pluginSections.length === 0) {
        return "";
    }
    return ["## Plugin Context", ...pluginSections].join("\n\n").trim();
}
