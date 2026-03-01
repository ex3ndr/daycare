import type { ModelRoleKey } from "../../../settings.js";
import type { AgentDescriptor } from "./agentDescriptorTypes.js";

/**
 * Maps an agent descriptor to its model role key.
 * Returns null for descriptor types without a dedicated role (e.g. cron).
 */
export function agentDescriptorRoleResolve(descriptor: AgentDescriptor): ModelRoleKey | null {
    switch (descriptor.type) {
        case "user":
        case "permanent":
        case "swarm":
            return "user";
        case "memory-agent":
            return "memory";
        case "memory-search":
            return "memorySearch";
        case "subagent":
            return "subagent";
        case "task":
            return "task";
        case "system":
            return null;
        default:
            return null;
    }
}
