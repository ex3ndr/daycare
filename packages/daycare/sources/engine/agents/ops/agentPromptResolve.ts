import type { AgentConfig } from "./agentConfigTypes.js";
import type { AgentPath } from "./agentPathTypes.js";
import { agentPromptBundledRead } from "./agentPromptBundledRead.js";

export type AgentPromptResolved = {
    agentPrompt: string;
    replaceSystemPrompt: boolean;
};

/**
 * Resolves prompt overrides for a path before building the final system prompt.
 * Expects: pathValue is validated.
 */
export async function agentPromptResolve(
    _pathValue: AgentPath,
    config?: AgentConfig | null
): Promise<AgentPromptResolved> {
    const kind = config?.kind ?? "agent";
    if (kind === "agent") {
        return {
            agentPrompt: config?.systemPrompt?.trim() ?? "",
            replaceSystemPrompt: false
        };
    }
    if (kind === "memory") {
        const prompt = (await agentPromptBundledRead("memory/MEMORY_AGENT.md")).trim();
        return {
            agentPrompt: prompt,
            replaceSystemPrompt: true
        };
    }
    if (kind === "search") {
        const prompt = (await agentPromptBundledRead("memory/MEMORY_SEARCH.md")).trim();
        return {
            agentPrompt: prompt,
            replaceSystemPrompt: true
        };
    }
    return {
        agentPrompt: "",
        replaceSystemPrompt: false
    };
}
