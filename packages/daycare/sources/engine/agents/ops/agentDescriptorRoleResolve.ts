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
            return "user";
        case "memory-agent":
            return "memory";
        case "memory-search":
            return "memorySearch";
        case "subagent":
        case "app":
            return "subagent";
        case "system":
            if (descriptor.tag === "heartbeat") {
                return "heartbeat";
            }
            return null;
        default:
            return null;
    }
}
