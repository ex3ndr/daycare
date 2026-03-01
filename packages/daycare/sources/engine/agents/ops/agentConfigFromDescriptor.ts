import type { AgentConfig } from "./agentConfigTypes.js";
import type { AgentDescriptor } from "./agentDescriptorTypes.js";

/**
 * Converts legacy descriptor metadata into AgentConfig.
 * Expects: descriptor is validated.
 */
export function agentConfigFromDescriptor(descriptor: AgentDescriptor): AgentConfig {
    if (descriptor.type === "permanent") {
        return {
            name: descriptor.name,
            username: descriptor.username,
            description: descriptor.description,
            systemPrompt: descriptor.systemPrompt,
            workspaceDir: descriptor.workspaceDir
        };
    }
    if (descriptor.type === "subagent") {
        return {
            name: descriptor.name
        };
    }
    if (descriptor.type === "memory-search") {
        return {
            name: descriptor.name
        };
    }
    if (descriptor.type === "cron") {
        return {
            name: descriptor.name
        };
    }
    if (descriptor.type === "user") {
        return {
            connectorUserId: descriptor.userId
        };
    }
    return {};
}
