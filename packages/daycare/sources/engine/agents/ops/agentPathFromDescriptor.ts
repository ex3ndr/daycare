import type { AgentDescriptor } from "./agentDescriptorTypes.js";
import {
    agentPathAgent,
    agentPathConnector,
    agentPathCron,
    agentPathMemory,
    agentPathSearch,
    agentPathSub,
    agentPathSystem,
    agentPathTask
} from "./agentPathBuild.js";
import { type AgentPath, agentPath } from "./agentPathTypes.js";

export type AgentPathFromDescriptorOptions = {
    userId: string;
    parentPath?: AgentPath | null;
    subIndex?: number | null;
    searchIndex?: number | null;
};

/**
 * Converts a legacy descriptor into canonical path identity.
 * Expects: options.userId is the internal user id scope for the descriptor.
 */
export function agentPathFromDescriptor(
    descriptor: AgentDescriptor,
    options: AgentPathFromDescriptorOptions
): AgentPath {
    if (descriptor.type === "system") {
        return agentPathSystem(descriptor.tag);
    }

    const userId = options.userId.trim();
    if (!userId) {
        throw new Error("userId is required to derive AgentPath from descriptor.");
    }

    if (descriptor.type === "user") {
        return agentPathConnector(userId, descriptor.connector);
    }
    if (descriptor.type === "cron") {
        return agentPathCron(userId, descriptor.id);
    }
    if (descriptor.type === "task") {
        return agentPathTask(userId, descriptor.id);
    }
    if (descriptor.type === "permanent") {
        return agentPathAgent(userId, descriptor.name);
    }

    if (descriptor.type === "subagent") {
        const parentPath = options.parentPath;
        const subIndex = options.subIndex;
        if (parentPath && typeof subIndex === "number") {
            return agentPathSub(parentPath, subIndex);
        }
        return agentPath(`/${userId}/sub/${descriptor.id}`);
    }

    if (descriptor.type === "memory-agent") {
        if (options.parentPath) {
            return agentPathMemory(options.parentPath);
        }
        return agentPath(`/${userId}/memory/${descriptor.id}`);
    }

    if (descriptor.type === "memory-search") {
        const parentPath = options.parentPath;
        const searchIndex = options.searchIndex;
        if (parentPath && typeof searchIndex === "number") {
            return agentPathSearch(parentPath, searchIndex);
        }
        return agentPath(`/${userId}/search/${descriptor.id}`);
    }
    if (descriptor.type === "swarm") {
        return agentPathAgent(userId, "swarm");
    }

    return descriptorTypeUnreachable(descriptor);
}

function descriptorTypeUnreachable(_value: never): never {
    throw new Error("Unhandled descriptor type");
}
