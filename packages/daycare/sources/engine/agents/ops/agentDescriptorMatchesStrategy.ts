import type { AgentDescriptor, AgentFetchStrategy } from "./agentDescriptorTypes.js";

/**
 * Checks whether a descriptor matches a lookup strategy.
 * Expects: descriptor is validated.
 */
export function agentDescriptorMatchesStrategy(descriptor: AgentDescriptor, strategy: AgentFetchStrategy): boolean {
    switch (strategy) {
        case "most-recent-foreground":
            return descriptor.type === "user" || descriptor.type === "permanent" || descriptor.type === "swarm";
        default:
            return false;
    }
}
