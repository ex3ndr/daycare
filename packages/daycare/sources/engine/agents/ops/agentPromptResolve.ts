import { systemAgentPromptResolve } from "../system/systemAgentPromptResolve.js";
import type { AgentDescriptor } from "./agentDescriptorTypes.js";
import { agentPromptBundledRead } from "./agentPromptBundledRead.js";

export type AgentPromptResolved = {
    agentPrompt: string;
    replaceSystemPrompt: boolean;
};

/**
 * Resolves prompt overrides for a descriptor before building the final system prompt.
 * Expects: descriptor is a validated agent descriptor.
 */
export async function agentPromptResolve(descriptor: AgentDescriptor): Promise<AgentPromptResolved> {
    if (descriptor.type === "permanent" || descriptor.type === "app") {
        return {
            agentPrompt: descriptor.systemPrompt.trim(),
            replaceSystemPrompt: false
        };
    }
    if (descriptor.type === "memory-agent") {
        const prompt = (await agentPromptBundledRead("memory/MEMORY_AGENT.md")).trim();
        return {
            agentPrompt: prompt,
            replaceSystemPrompt: true
        };
    }
    if (descriptor.type !== "system") {
        return {
            agentPrompt: "",
            replaceSystemPrompt: false
        };
    }

    const resolved = await systemAgentPromptResolve(descriptor.tag);
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
