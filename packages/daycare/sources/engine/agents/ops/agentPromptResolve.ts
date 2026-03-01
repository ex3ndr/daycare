import { systemAgentPromptResolve } from "../system/systemAgentPromptResolve.js";
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
    if (kind !== "system") {
        return {
            agentPrompt: "",
            replaceSystemPrompt: false
        };
    }

    const tag = config?.name?.trim();
    if (!tag) {
        return {
            agentPrompt: "",
            replaceSystemPrompt: false
        };
    }

    const resolved = await systemAgentPromptResolve(tag);
    if (!resolved) {
        return {
            agentPrompt: "",
            replaceSystemPrompt: false
        };
    }
    return {
        agentPrompt: resolved.systemPrompt,
        replaceSystemPrompt: resolved.replaceSystemPrompt
    };
}
