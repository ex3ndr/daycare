import type { AgentDescriptor } from "./agentDescriptorTypes.js";

/**
 * Builds a stable cache key for agent descriptors.
 * Expects: descriptor is validated.
 */
export function agentDescriptorCacheKey(descriptor: AgentDescriptor): string {
    switch (descriptor.type) {
        case "cron":
            return `/cron/${descriptor.id}`;
        case "task":
            return `/task/${descriptor.id}`;
        case "system":
            return `/system/${descriptor.tag}`;
        case "user":
            return `/connectors/${descriptor.connector}/${descriptor.userId}/${descriptor.channelId}`;
        case "subagent":
            return `/subagent/${descriptor.id}`;
        case "app":
            return `/app/${descriptor.id}`;
        case "permanent":
            return `/permanent/${descriptor.id}`;
        case "memory-agent":
            return `/memory-agent/${descriptor.id}`;
        case "memory-search":
            return `/memory-search/${descriptor.id}`;
        case "subuser":
            return `/subuser/${descriptor.id}`;
    }
    return descriptorTypeUnreachable(descriptor);
}

function descriptorTypeUnreachable(_value: never): never {
    throw new Error("Unhandled descriptor type");
}
